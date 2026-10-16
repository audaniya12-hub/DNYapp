-- DNY habit and prayer reminders. Run once in the Supabase SQL Editor, after reminders.sql.
-- Replace REPLACE_WITH_CRON_SECRET with the same value as CRON_SECRET on Vercel.

-- 1. One row per reminder the phone should receive
create table if not exists public.push_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null references public.push_subscriptions(endpoint) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '' check (char_length(body) <= 160),
  tag text not null default 'dny-habit' check (char_length(tag) <= 64),
  fire_at timestamptz not null,
  sent_at timestamptz
);
create index if not exists push_reminders_due_idx on public.push_reminders (fire_at) where sent_at is null;
create index if not exists push_reminders_endpoint_idx on public.push_reminders (endpoint);

-- 2. Each login can only read its own rows. Writes go through the function below.
alter table public.push_reminders enable row level security;
drop policy if exists "own select" on public.push_reminders;
create policy "own select" on public.push_reminders for select using (auth.uid() = user_id);
revoke all on public.push_reminders from anon, authenticated;
grant select on public.push_reminders to authenticated;

-- 3. The app calls this to replace its list of coming reminders in one step.
create or replace function public.dny_set_reminders(p_endpoint text, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  uid uuid := auth.uid();
  n integer;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'items must be an array'; end if;
  if jsonb_array_length(p_items) > 1000 then raise exception 'too many items'; end if;
  if not exists (select 1 from public.push_subscriptions where endpoint = p_endpoint and user_id = uid) then
    raise exception 'unknown phone';
  end if;
  delete from public.push_reminders where endpoint = p_endpoint and user_id = uid and sent_at is null;
  insert into public.push_reminders (user_id, endpoint, title, body, tag, fire_at)
  select uid, p_endpoint, left(trim(x.title), 80), left(coalesce(x.body, ''), 160), left(coalesce(nullif(x.tag, ''), 'dny-habit'), 64), x.fire_at
  from jsonb_to_recordset(p_items) as x(title text, body text, tag text, fire_at timestamptz)
  where nullif(trim(x.title), '') is not null
    and x.fire_at > now() - interval '5 minutes'
    and x.fire_at < now() + interval '15 days';
  get diagnostics n = row_count;
  return n;
end;
$fn$;
revoke all on function public.dny_set_reminders(text, jsonb) from public, anon;
grant execute on function public.dny_set_reminders(text, jsonb) to authenticated;

-- 4. Sends reminders that are due. A reminder is sent from its time until 15 minutes after it.
create or replace function public.dny_send_due_reminders()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  items jsonb;
  n integer := 0;
begin
  delete from public.push_reminders where fire_at < now() - interval '2 days';
  with due as (
    select r.id from public.push_reminders r
    where r.sent_at is null and r.fire_at <= now()
    order by r.fire_at
    limit 200
    for update skip locked
  ), marked as (
    update public.push_reminders r set sent_at = now()
    from due where r.id = due.id
    returning r.id, r.endpoint, r.title, r.body, r.tag, r.fire_at
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'kind', 'custom', 'endpoint', m.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'title', m.title, 'body', m.body, 'tag', m.tag)), '[]'::jsonb)
  into items
  from marked m join public.push_subscriptions s on s.endpoint = m.endpoint
  where m.fire_at > now() - interval '15 minutes';
  n := jsonb_array_length(items);
  if n > 0 then
    perform net.http_post(
      url := 'https://dnyapp.vercel.app/api/send-reminders',
      body := jsonb_build_object('items', items),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer REPLACE_WITH_CRON_SECRET'),
      timeout_milliseconds := 15000
    );
  end if;
  return n;
end;
$fn$;
revoke all on function public.dny_send_due_reminders() from public, anon, authenticated;

-- 5. Run it every minute
select cron.unschedule('dny-habit-reminders') where exists (select 1 from cron.job where jobname = 'dny-habit-reminders');
select cron.schedule('dny-habit-reminders', '* * * * *', 'select public.dny_send_due_reminders()');
