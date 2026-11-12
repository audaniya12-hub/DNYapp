-- DNY sharing. Run once in the Supabase SQL Editor, after progress-and-alerts.sql.
-- Friends, invite codes and shared habits.
-- Nobody can read these tables directly. Every read and write goes through a function that
-- checks who is signed in. A friend sees only what you chose to share: your name, and if you allow it,
-- your streak and your daily progress. Habit names stay private, except for habits you share on purpose.

-- 1. Invite codes. One use each, valid for 7 days.
create table if not exists public.dny_invites (
  code text primary key,
  inviter uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists dny_invites_inviter_idx on public.dny_invites (inviter);

-- 2. Friendships. One row per pair, with the smaller id first.
create table if not exists public.dny_friends (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists dny_friends_b_idx on public.dny_friends (user_b);

-- 3. Shared habits, who is in them, and their daily check ins
create table if not exists public.dny_shared_habits (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 60),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.dny_shared_members (
  habit_id uuid not null references public.dny_shared_habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'joined')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  primary key (habit_id, user_id)
);
create index if not exists dny_shared_members_user_idx on public.dny_shared_members (user_id);
create table if not exists public.dny_shared_checks (
  habit_id uuid not null,
  user_id uuid not null,
  day_key date not null,
  state smallint not null check (state between 1 and 3),
  updated_at timestamptz not null default now(),
  primary key (habit_id, user_id, day_key),
  foreign key (habit_id, user_id) references public.dny_shared_members(habit_id, user_id) on delete cascade
);

-- 4. Failed code attempts, to stop guessing
create table if not exists public.dny_invite_tries (
  user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists dny_invite_tries_idx on public.dny_invite_tries (user_id, at);

-- 5. Lock every table. Only the functions below can touch them.
alter table public.dny_invites enable row level security;
alter table public.dny_friends enable row level security;
alter table public.dny_shared_habits enable row level security;
alter table public.dny_shared_members enable row level security;
alter table public.dny_shared_checks enable row level security;
alter table public.dny_invite_tries enable row level security;
revoke all on public.dny_invites, public.dny_friends, public.dny_shared_habits,
  public.dny_shared_members, public.dny_shared_checks, public.dny_invite_tries from anon, authenticated;

create or replace function public.dny_are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (select 1 from public.dny_friends where user_a = least(a, b) and user_b = greatest(a, b));
$fn$;
revoke all on function public.dny_are_friends(uuid, uuid) from public, anon, authenticated;

-- 6. Make an invite code
create or replace function public.dny_create_invite()
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  uid uuid := auth.uid();
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  c text;
  i integer;
  idx integer[] := array[0, 1, 2, 3, 4, 5, 9, 10];
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from public.dny_invites where inviter = uid and (expires_at < now() - interval '30 days');
  if (select count(*) from public.dny_invites where inviter = uid and used_by is null and expires_at > now()) >= 10 then
    raise exception 'too many open invites';
  end if;
  loop
    b := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    c := '';
    for i in 1..8 loop
      c := c || substr(alphabet, (get_byte(b, idx[i]) % 32) + 1, 1);
    end loop;
    begin
      insert into public.dny_invites (code, inviter, expires_at) values (c, uid, now() + interval '7 days');
      return c;
    exception when unique_violation then
      null;
    end;
  end loop;
end;
$fn$;
revoke all on function public.dny_create_invite() from public, anon;
grant execute on function public.dny_create_invite() to authenticated;

-- 7. Use an invite code.
-- A wrong code returns an error value instead of raising an error, so the failed try is kept
-- and the limit of 10 wrong tries an hour really works.
create or replace function public.dny_accept_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  inv record;
  fname text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from public.dny_invite_tries where at < now() - interval '1 day';
  if (select count(*) from public.dny_invite_tries where user_id = uid and at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('error', 'too_many');
  end if;
  select * into inv from public.dny_invites where code = v_code for update;
  if not found or inv.used_by is not null or inv.expires_at <= now() then
    insert into public.dny_invite_tries (user_id) values (uid);
    return jsonb_build_object('error', 'invalid');
  end if;
  if inv.inviter = uid then return jsonb_build_object('error', 'own'); end if;
  insert into public.dny_friends (user_a, user_b) values (least(uid, inv.inviter), greatest(uid, inv.inviter))
    on conflict do nothing;
  update public.dny_invites set used_by = uid, used_at = now() where code = v_code;
  select coalesce(nullif(name, ''), 'Friend') into fname from public.dny_progress where user_id = inv.inviter;
  return jsonb_build_object('id', inv.inviter, 'name', coalesce(fname, 'Friend'));
end;
$fn$;
revoke all on function public.dny_accept_invite(text) from public, anon;
grant execute on function public.dny_accept_invite(text) to authenticated;

-- 8. Remove a friend. Shared habits you started with each other end too.
create or replace function public.dny_remove_friend(p_friend uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from public.dny_friends where user_a = least(uid, p_friend) and user_b = greatest(uid, p_friend);
  delete from public.dny_shared_members m using public.dny_shared_habits h
    where m.habit_id = h.id
      and ((h.created_by = uid and m.user_id = p_friend) or (h.created_by = p_friend and m.user_id = uid));
  delete from public.dny_shared_habits h
    where h.created_by in (uid, p_friend)
      and not exists (select 1 from public.dny_shared_members m where m.habit_id = h.id and m.user_id <> h.created_by);
end;
$fn$;
revoke all on function public.dny_remove_friend(uuid) from public, anon;
grant execute on function public.dny_remove_friend(uuid) to authenticated;

-- 9. Start a shared habit and invite friends to it
create or replace function public.dny_create_shared_habit(p_title text, p_friends uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  uid uuid := auth.uid();
  hid uuid;
  f uuid;
  t text := left(trim(coalesce(p_title, '')), 60);
begin
  if uid is null then raise exception 'not signed in'; end if;
  if t = '' then raise exception 'title needed'; end if;
  if coalesce(array_length(p_friends, 1), 0) > 8 then raise exception 'too many people'; end if;
  if (select count(*) from public.dny_shared_members where user_id = uid and status = 'joined') >= 20 then
    raise exception 'too many shared habits';
  end if;
  insert into public.dny_shared_habits (title, created_by) values (t, uid) returning id into hid;
  insert into public.dny_shared_members (habit_id, user_id, status, invited_by, joined_at) values (hid, uid, 'joined', uid, now());
  foreach f in array coalesce(p_friends, '{}') loop
    if f <> uid and public.dny_are_friends(uid, f) then
      insert into public.dny_shared_members (habit_id, user_id, status, invited_by) values (hid, f, 'invited', uid) on conflict do nothing;
    end if;
  end loop;
  return hid;
end;
$fn$;
revoke all on function public.dny_create_shared_habit(text, uuid[]) from public, anon;
grant execute on function public.dny_create_shared_habit(text, uuid[]) to authenticated;

-- 10. Add more friends to a shared habit you are in
create or replace function public.dny_add_to_shared(p_habit uuid, p_friends uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  uid uuid := auth.uid();
  f uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.dny_shared_members where habit_id = p_habit and user_id = uid and status = 'joined') then
    raise exception 'not a member';
  end if;
  if coalesce(array_length(p_friends, 1), 0) > 8
     or (select count(*) from public.dny_shared_members where habit_id = p_habit) + coalesce(array_length(p_friends, 1), 0) > 12 then
    raise exception 'too many people';
  end if;
  foreach f in array coalesce(p_friends, '{}') loop
    if f <> uid and public.dny_are_friends(uid, f) then
      insert into public.dny_shared_members (habit_id, user_id, status, invited_by) values (p_habit, f, 'invited', uid) on conflict do nothing;
    end if;
  end loop;
end;
$fn$;
revoke all on function public.dny_add_to_shared(uuid, uuid[]) from public, anon;
grant execute on function public.dny_add_to_shared(uuid, uuid[]) to authenticated;

-- 11. Accept or decline a shared habit invite
create or replace function public.dny_respond_shared(p_habit uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_accept then
    update public.dny_shared_members set status = 'joined', joined_at = now()
      where habit_id = p_habit and user_id = uid and status = 'invited';
  else
    delete from public.dny_shared_members where habit_id = p_habit and user_id = uid and status = 'invited';
  end if;
end;
$fn$;
revoke all on function public.dny_respond_shared(uuid, boolean) from public, anon;
grant execute on function public.dny_respond_shared(uuid, boolean) to authenticated;

-- 12. Leave a shared habit. It is deleted when nobody has joined any more.
create or replace function public.dny_leave_shared(p_habit uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from public.dny_shared_members where habit_id = p_habit and user_id = uid;
  delete from public.dny_shared_habits h where h.id = p_habit
    and not exists (select 1 from public.dny_shared_members m where m.habit_id = h.id and m.status = 'joined');
end;
$fn$;
revoke all on function public.dny_leave_shared(uuid) from public, anon;
grant execute on function public.dny_leave_shared(uuid) to authenticated;

-- 13. Save one check in for a shared habit. State: 1 done, 2 small version, 3 skipped, 0 clear.
create or replace function public.dny_set_shared_check(p_habit uuid, p_day date, p_state integer)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_day is null or abs(p_day - (now() at time zone 'utc')::date) > 2 then raise exception 'bad day'; end if;
  if not exists (select 1 from public.dny_shared_members where habit_id = p_habit and user_id = uid and status = 'joined') then
    raise exception 'not a member';
  end if;
  if p_state is null or p_state < 1 or p_state > 3 then
    delete from public.dny_shared_checks where habit_id = p_habit and user_id = uid and day_key = p_day;
  else
    insert into public.dny_shared_checks (habit_id, user_id, day_key, state) values (p_habit, uid, p_day, p_state)
      on conflict (habit_id, user_id, day_key) do update set state = excluded.state, updated_at = now();
  end if;
end;
$fn$;
revoke all on function public.dny_set_shared_check(uuid, date, integer) from public, anon;
grant execute on function public.dny_set_shared_check(uuid, date, integer) to authenticated;

-- 14. Everything the Sharing screen needs, in one call.
-- p_today is the day on the phone. Friends see only what each person chose to share.
create or replace function public.dny_sharing_overview(p_today date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  uid uuid := auth.uid();
  out jsonb;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.fid,
        'name', coalesce(nullif(p.name, ''), 'Friend'),
        'shared', coalesce(p.share, false),
        'day_key', case when coalesce(p.share, false) then p.day_key end,
        'streak', case when coalesce(p.share, false) and p.share_streak then p.streak end,
        'best', case when coalesce(p.share, false) and p.share_streak then p.best end,
        'score', case when coalesce(p.share, false) and p.share_score then p.today_score end,
        'week', case when coalesce(p.share, false) and p.share_score then (
          select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
          from jsonb_each(p.scores) as e(k, v) where k::date between p_today - 6 and p_today) end
      ) order by lower(coalesce(nullif(p.name, ''), 'Friend')))
      from (
        select case when user_a = uid then user_b else user_a end as fid
        from public.dny_friends where user_a = uid or user_b = uid
      ) f
      left join public.dny_progress p on p.user_id = f.fid
    ), '[]'::jsonb),
    'habits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id,
        'title', h.title,
        'mine', me.status,
        'owner', h.created_by = uid,
        'members', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', m.user_id,
            'name', coalesce(nullif(pp.name, ''), 'Friend'),
            'status', m.status,
            'days', (
              select coalesce(jsonb_object_agg(c.day_key::text, c.state), '{}'::jsonb)
              from public.dny_shared_checks c
              where c.habit_id = h.id and c.user_id = m.user_id and c.day_key >= p_today - 13
            )
          ) order by (m.user_id = uid) desc, lower(coalesce(nullif(pp.name, ''), 'Friend'))), '[]'::jsonb)
          from public.dny_shared_members m
          left join public.dny_progress pp on pp.user_id = m.user_id
          where m.habit_id = h.id
        )
      ) order by h.created_at)
      from public.dny_shared_members me
      join public.dny_shared_habits h on h.id = me.habit_id
      where me.user_id = uid
    ), '[]'::jsonb)
  ) into out;
  return out;
end;
$fn$;
revoke all on function public.dny_sharing_overview(date) from public, anon;
grant execute on function public.dny_sharing_overview(date) to authenticated;
