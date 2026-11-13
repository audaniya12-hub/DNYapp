-- DNY ratings and comments from Settings, Rate app. Run once in the Supabase SQL Editor.
-- Nobody reads this table from the app. You read it in the Supabase Table Editor.

create table if not exists public.dny_feedback (
  id bigint generated always as identity primary key,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  app_ver text not null default '' check (char_length(app_ver) <= 20),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.dny_feedback enable row level security;
revoke all on public.dny_feedback from anon, authenticated;

create or replace function public.dny_submit_rating(p_rating integer, p_comment text default '', p_app text default '')
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  uid uuid := auth.uid();
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'bad rating'; end if;
  -- Light spam guard: at most 60 ratings a minute in total, and one every 10 seconds per signed in person.
  if (select count(*) from public.dny_feedback where created_at > now() - interval '1 minute') >= 60 then
    raise exception 'busy';
  end if;
  if uid is not null and exists (select 1 from public.dny_feedback where user_id = uid and created_at > now() - interval '10 seconds') then
    raise exception 'too fast';
  end if;
  insert into public.dny_feedback (rating, comment, app_ver, user_id)
  values (p_rating, left(trim(coalesce(p_comment, '')), 500), left(coalesce(p_app, ''), 20), uid);
end;
$fn$;
revoke all on function public.dny_submit_rating(integer, text, text) from public;
grant execute on function public.dny_submit_rating(integer, text, text) to anon, authenticated;
