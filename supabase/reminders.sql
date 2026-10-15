-- DNY phone reminders. Run once in the Supabase SQL Editor.
-- Replace REPLACE_WITH_CRON_SECRET with the same value as CRON_SECRET on Vercel.

-- 1. Extensions (if one fails, turn it on under Database, Extensions, then run this again)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. One row per phone that wants reminders
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  tz text not null default 'Africa/Lagos',
  morning_on boolean not null default false,
  morning_time text not null default '08:00' check (morning_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  evening_on boolean not null default false,
  evening_time text not null default '20:00' check (evening_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  last_morning date,
  last_evening date,
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- 3. Each login can see and change only its own rows
alter table public.push_subscriptions enable row level security;
drop policy if exists "own select" on public.push_subscriptions;
drop policy if exists "own insert" on public.push_subscriptions;
drop policy if exists "own update" on public.push_subscriptions;
drop policy if exists "own delete" on public.push_subscriptions;
create policy "own select" on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "own insert" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "own update" on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own delete" on public.push_subscriptions for delete using (auth.uid() = user_id);

-- 4. Finds reminders that are due and asks the Vercel function to send them.
-- A reminder is due from its set time until 10 minutes after it, once per day.
create or replace function public.dny_send_due(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  r record;
  k text;
  local_ts timestamp;
  sched timestamp;
  items jsonb := '[]'::jsonb;
  n integer := 0;
begin
  for r in select * from public.push_subscriptions where morning_on or evening_on loop
    begin
      local_ts := p_now at time zone r.tz;
      foreach k in array array['morning', 'evening'] loop
        if k = 'morning' and r.morning_on then
          sched := local_ts::date + r.morning_time::time;
          if local_ts >= sched and local_ts < sched + interval '10 minutes'
             and r.last_morning is distinct from local_ts::date then
            update public.push_subscriptions set last_morning = local_ts::date where id = r.id;
            items := items || jsonb_build_object('id', r.id, 'kind', k, 'endpoint', r.endpoint, 'p256dh', r.p256dh, 'auth', r.auth);
            n := n + 1;
          end if;
        elsif k = 'evening' and r.evening_on then
          sched := local_ts::date + r.evening_time::time;
          if local_ts >= sched and local_ts < sched + interval '10 minutes'
             and r.last_evening is distinct from local_ts::date then
            update public.push_subscriptions set last_evening = local_ts::date where id = r.id;
            items := items || jsonb_build_object('id', r.id, 'kind', k, 'endpoint', r.endpoint, 'p256dh', r.p256dh, 'auth', r.auth);
            n := n + 1;
          end if;
        end if;
      end loop;
    exception when others then
      raise warning 'dny_send_due skipped row %: %', r.id, sqlerrm;
    end;
  end loop;

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

-- Only the scheduler may run it. The app must never be able to call it.
revoke all on function public.dny_send_due(timestamptz) from public, anon, authenticated;

-- 5. Run it every minute
select cron.unschedule('dny-reminders') where exists (select 1 from cron.job where jobname = 'dny-reminders');
select cron.schedule('dny-reminders', '* * * * *', 'select public.dny_send_due()');
