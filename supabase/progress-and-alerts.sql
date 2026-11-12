-- DNY streak alerts. Run once in the Supabase SQL Editor, after reminders.sql and habit-reminders.sql.
-- It sends three kinds of phone notification:
--   1. Nudges at 9 pm, 10 pm and 11 pm when you have a streak and have not checked in.
--   2. A "Close call" notice when a freeze saves a streak, or a notice when a streak ends.
--   3. A weekly report on Monday at 8:00 am.
-- It queues the messages in push_reminders, so the existing sender and secret do the work.
-- Times follow the phone's own time zone. Nothing here needs a new secret.

-- 1. One row per person with what the server needs to know about their progress
create table if not exists public.dny_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tz text not null default 'Africa/Lagos',
  day_key date not null,
  today_score integer not null default 0 check (today_score between 0 and 100),
  today_active boolean not null default true,
  streak integer not null default 0 check (streak between 0 and 100000),
  best integer not null default 0 check (best between 0 and 100000),
  active_dows integer[] not null default '{0,1,2,3,4,5,6}',
  scores jsonb not null default '{}'::jsonb,
  frozen text[] not null default '{}',
  name text not null default '' check (char_length(name) <= 40),
  alerts boolean not null default false,
  report boolean not null default false,
  share boolean not null default false,
  share_streak boolean not null default true,
  share_score boolean not null default true,
  last_slot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Nobody reads this table directly. The functions below are the only way in.
alter table public.dny_progress enable row level security;
revoke all on public.dny_progress from anon, authenticated;

-- 2. The app calls this to save its latest numbers
create or replace function public.dny_set_progress(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  uid uuid := auth.uid();
  v_tz text;
  v_day date;
  v_dows integer[];
  v_frozen text[];
  v_scores jsonb;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'bad input'; end if;

  v_tz := coalesce(nullif(p->>'tz', ''), 'Africa/Lagos');
  if not exists (select 1 from pg_timezone_names where name = v_tz) then v_tz := 'Africa/Lagos'; end if;

  v_day := (p->>'day_key')::date;
  if v_day is null or abs(v_day - (now() at time zone v_tz)::date) > 2 then raise exception 'bad day'; end if;

  select coalesce(array_agg(distinct d), '{}') into v_dows
  from (select x::integer as d
        from jsonb_array_elements_text(case when jsonb_typeof(p->'active_dows') = 'array' then p->'active_dows' else '[]'::jsonb end) x
        where x ~ '^[0-6]$') q;

  select coalesce(array_agg(k), '{}') into v_frozen
  from (select x as k
        from jsonb_array_elements_text(case when jsonb_typeof(p->'frozen') = 'array' then p->'frozen' else '[]'::jsonb end) x
        where x ~ '^\d{4}-\d{2}-\d{2}$' limit 60) q;

  select coalesce(jsonb_object_agg(q.key, q.val), '{}'::jsonb) into v_scores
  from (
    select e.key, least(100, greatest(0, e.value::integer)) as val
    from jsonb_each_text(case when jsonb_typeof(p->'scores') = 'object' then p->'scores' else '{}'::jsonb end) e
    where e.key ~ '^\d{4}-\d{2}-\d{2}$' and e.value ~ '^\d{1,3}$'
    order by e.key desc limit 21
  ) q;

  insert into public.dny_progress as t
    (user_id, tz, day_key, today_score, today_active, streak, best, active_dows, scores, frozen, name,
     alerts, report, share, share_streak, share_score, updated_at)
  values (
    uid, v_tz, v_day,
    least(100, greatest(0, coalesce((p->>'today_score')::integer, 0))),
    coalesce((p->>'today_active')::boolean, true),
    least(100000, greatest(0, coalesce((p->>'streak')::integer, 0))),
    least(100000, greatest(0, coalesce((p->>'best')::integer, 0))),
    v_dows, v_scores, v_frozen,
    left(trim(coalesce(p->>'name', '')), 40),
    coalesce((p->>'alerts')::boolean, false),
    coalesce((p->>'report')::boolean, false),
    coalesce((p->>'share')::boolean, false),
    coalesce((p->>'share_streak')::boolean, true),
    coalesce((p->>'share_score')::boolean, true),
    now()
  )
  on conflict (user_id) do update set
    tz = excluded.tz, day_key = excluded.day_key, today_score = excluded.today_score,
    today_active = excluded.today_active, streak = excluded.streak, best = excluded.best,
    active_dows = excluded.active_dows, scores = excluded.scores, frozen = excluded.frozen,
    name = excluded.name, alerts = excluded.alerts, report = excluded.report, share = excluded.share,
    share_streak = excluded.share_streak, share_score = excluded.share_score, updated_at = now();
end;
$fn$;
revoke all on function public.dny_set_progress(jsonb) from public, anon;
grant execute on function public.dny_set_progress(jsonb) to authenticated;

-- 3. Queues one notification for each phone a person has turned on
create or replace function public.dny_queue_push(p_user uuid, p_title text, p_body text, p_tag text)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare n integer;
begin
  insert into public.push_reminders (user_id, endpoint, title, body, tag, fire_at)
  select p_user, s.endpoint, left(p_title, 80), left(p_body, 160), left(p_tag, 64), now()
  from public.push_subscriptions s where s.user_id = p_user;
  get diagnostics n = row_count;
  return n;
end;
$fn$;
revoke all on function public.dny_queue_push(uuid, text, text, text) from public, anon, authenticated;

-- 4. Runs every minute. Each message is sent once, inside a 10 minute window after its time.
create or replace function public.dny_progress_tick(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r record;
  lt timestamp;
  ld date;
  tm time;
  slot text;
  y date;
  ws date;
  wstart date;
  used integer;
  frz_left integer;
  ys integer;
  y_active boolean;
  checked_in boolean;
  due_today boolean;
  sent integer := 0;
  title text;
  body text;
  d date;
  active_n integer;
  done_n integer;
  frozen_n integer;
  total integer;
  sc integer;
  avg_n integer;
  rate numeric;
  tail text;
  new_frozen text[];
begin
  for r in
    select * from public.dny_progress where alerts or report for update skip locked
  loop
    begin
      lt := p_now at time zone r.tz;
      ld := lt::date;
      tm := lt::time;
      -- People who have not opened DNY for a month get no messages.
      if r.day_key < ld - 30 then continue; end if;

      -- A. Nudges at 9, 10 and 11 pm
      if r.alerts and r.streak >= 1 then
        slot := case
          when tm >= '21:00' and tm < '21:10' then 'n21'
          when tm >= '22:00' and tm < '22:10' then 'n22'
          when tm >= '23:00' and tm < '23:10' then 'n23'
        end;
        if slot is not null and coalesce(r.last_slot->>slot, '') <> ld::text then
          checked_in := (r.day_key = ld and r.today_score > 0);
          due_today := case when r.day_key = ld then r.today_active
                            else extract(dow from ld)::integer = any(r.active_dows) end;
          if not checked_in and due_today then
            wstart := ld - (extract(isodow from ld)::integer - 1);
            select count(*) into used from unnest(r.frozen) k where k::date between wstart and wstart + 6;
            frz_left := greatest(0, 2 - used);
            if slot = 'n21' then
              title := 'Save your streak';
              body := 'You have not checked in today. Tick one habit to keep your ' || r.streak || ' day streak.';
            elsif slot = 'n22' then
              title := 'Two hours left';
              body := 'Your ' || r.streak || ' day streak is at risk. Open DNY and tick one habit before midnight.';
            else
              title := 'Last call';
              body := 'Less than one hour left. Tick one habit now. ' ||
                case when frz_left > 0 then 'A freeze can cover you, but keep it for another day.'
                     else 'You have no freezes left this week.' end;
            end if;
            if public.dny_queue_push(r.user_id, title, body, 'dny-streak') > 0 then sent := sent + 1; end if;
            update public.dny_progress set last_slot = last_slot || jsonb_build_object(slot, ld::text) where user_id = r.user_id;
          end if;
        end if;
      end if;

      -- B. Just after midnight: a freeze saves the streak, or the streak ends
      if r.alerts and r.streak >= 1 and tm < '00:10' and coalesce(r.last_slot->>'mid', '') <> ld::text then
        y := ld - 1;
        ys := coalesce((r.scores->>(y::text))::integer, 0);
        y_active := case when r.day_key = y then r.today_active
                         else extract(dow from y)::integer = any(r.active_dows) end;
        if y_active and ys = 0 and not (y::text = any(r.frozen)) then
          wstart := y - (extract(isodow from y)::integer - 1);
          select count(*) into used from unnest(r.frozen) k where k::date between wstart and wstart + 6;
          if used < 2 then
            frz_left := 2 - (used + 1);
            new_frozen := array_append(r.frozen, y::text);
            title := E'\U0001F976 Close call!';
            body := 'A freeze kept your ' || r.streak || ' day streak alive. You have ' || frz_left ||
                    case when frz_left = 1 then ' freeze' else ' freezes' end || ' left this week.';
            if public.dny_queue_push(r.user_id, title, body, 'dny-freeze') > 0 then sent := sent + 1; end if;
            update public.dny_progress
              set frozen = new_frozen, last_slot = last_slot || jsonb_build_object('mid', ld::text)
              where user_id = r.user_id;
          else
            title := 'Your streak ended';
            body := 'You missed yesterday and had no freeze left. Your ' || r.streak || ' day streak is over. Start a new one today.';
            if public.dny_queue_push(r.user_id, title, body, 'dny-freeze') > 0 then sent := sent + 1; end if;
            update public.dny_progress
              set streak = 0, last_slot = last_slot || jsonb_build_object('mid', ld::text)
              where user_id = r.user_id;
          end if;
        end if;
      end if;

      -- C. Monday 8:00 am: the report for the week that just ended
      if r.report and extract(isodow from ld) = 1 and tm >= '08:00' and tm < '08:10'
         and coalesce(r.last_slot->>'rep', '') <> ld::text then
        ws := ld - 7;
        active_n := 0; done_n := 0; frozen_n := 0; total := 0;
        for i in 0..6 loop
          d := ws + i;
          if extract(dow from d)::integer = any(r.active_dows) then
            active_n := active_n + 1;
            sc := coalesce((r.scores->>(d::text))::integer, 0);
            total := total + sc;
            if sc > 0 then done_n := done_n + 1; end if;
            if d::text = any(r.frozen) then frozen_n := frozen_n + 1; end if;
          end if;
        end loop;
        if active_n > 0 then
          rate := done_n::numeric / active_n;
          avg_n := round(total::numeric / active_n);
          tail := case when r.streak > 0 then ' Your streak is ' || r.streak || ' days.' else '' end
                  || case when frozen_n > 0 then ' Freezes used: ' || frozen_n || '.' else '' end;
          if done_n = active_n then
            title := 'Weekly report: perfect week';
            body := 'You checked in on all ' || active_n || ' days and averaged ' || avg_n || '%.' || tail || ' Keep it going.';
          elsif rate >= 0.8 then
            title := 'Weekly report: strong week';
            body := 'You checked in on ' || done_n || ' of ' || active_n || ' days and averaged ' || avg_n || '%.' || tail;
          elsif rate >= 0.5 then
            title := 'Weekly report: fair week';
            body := 'You checked in on ' || done_n || ' of ' || active_n || ' days and averaged ' || avg_n || '%.' || tail || ' Add one more day this week.';
          elsif done_n > 0 then
            title := 'Weekly report: slow week';
            body := 'You checked in on ' || done_n || ' of ' || active_n || ' days.' || tail || ' Pick one habit and do it daily this week.';
          else
            title := 'Weekly report: fresh start';
            body := 'You did not check in last week. Start with one habit today. Your history stays.';
          end if;
          if public.dny_queue_push(r.user_id, title, body, 'dny-report') > 0 then sent := sent + 1; end if;
          update public.dny_progress set last_slot = last_slot || jsonb_build_object('rep', ld::text) where user_id = r.user_id;
        end if;
      end if;
    exception when others then
      raise warning 'dny_progress_tick skipped %: %', r.user_id, sqlerrm;
    end;
  end loop;

  -- Send what was queued now, so a phone reminder sync cannot clear it first.
  if sent > 0 and abs(extract(epoch from (now() - p_now))) < 5 then
    perform public.dny_send_due_reminders();
  end if;
  return sent;
end;
$fn$;
revoke all on function public.dny_progress_tick(timestamptz) from public, anon, authenticated;

-- 5. Run it every minute
select cron.unschedule('dny-progress-tick') where exists (select 1 from cron.job where jobname = 'dny-progress-tick');
select cron.schedule('dny-progress-tick', '* * * * *', 'select public.dny_progress_tick()');
