-- Permanent friend code. Each user has one code that never expires and many friends can use.
-- Reset code makes a new one and the old one stops working.

create table if not exists public.dny_friend_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.dny_friend_codes enable row level security;
revoke all on public.dny_friend_codes from anon, authenticated;

create or replace function public.dny_new_code_value()
returns text
language plpgsql
volatile
set search_path = public
as $fn$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  c text;
  i integer;
begin
  loop
    b := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    c := '';
    for i in 1..8 loop
      c := c || substr(alphabet, (get_byte(b, i - 1) % 32) + 1, 1);
    end loop;
    if not exists (select 1 from public.dny_friend_codes where code = c)
       and not exists (select 1 from public.dny_invites where code = c) then
      return c;
    end if;
  end loop;
end;
$fn$;
revoke all on function public.dny_new_code_value() from public, anon, authenticated;

create or replace function public.dny_my_code()
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  uid uuid := auth.uid();
  c text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select code into c from public.dny_friend_codes where user_id = uid;
  if c is not null then return c; end if;
  insert into public.dny_friend_codes (user_id, code) values (uid, public.dny_new_code_value())
    on conflict (user_id) do nothing;
  select code into c from public.dny_friend_codes where user_id = uid;
  return c;
end;
$fn$;
revoke all on function public.dny_my_code() from public, anon;
grant execute on function public.dny_my_code() to authenticated;

create or replace function public.dny_reset_code()
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  uid uuid := auth.uid();
  c text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  c := public.dny_new_code_value();
  insert into public.dny_friend_codes (user_id, code) values (uid, c)
    on conflict (user_id) do update set code = excluded.code, created_at = now();
  return c;
end;
$fn$;
revoke all on function public.dny_reset_code() from public, anon;
grant execute on function public.dny_reset_code() to authenticated;

-- Accept looks at permanent codes first, then at older one time invites.
create or replace function public.dny_accept_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  owner_id uuid;
  inv record;
  fname text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from public.dny_invite_tries where at < now() - interval '1 day';
  if (select count(*) from public.dny_invite_tries where user_id = uid and at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('error', 'too_many');
  end if;

  select user_id into owner_id from public.dny_friend_codes where code = v_code;
  if owner_id is null then
    select * into inv from public.dny_invites where code = v_code for update;
    if found and inv.used_by is null and inv.expires_at > now() then
      owner_id := inv.inviter;
      update public.dny_invites set used_by = uid, used_at = now() where code = v_code and inv.inviter <> uid;
    end if;
  end if;

  if owner_id is null then
    insert into public.dny_invite_tries (user_id) values (uid);
    return jsonb_build_object('error', 'invalid');
  end if;
  if owner_id = uid then return jsonb_build_object('error', 'own'); end if;

  insert into public.dny_friends (user_a, user_b) values (least(uid, owner_id), greatest(uid, owner_id))
    on conflict do nothing;
  select coalesce(nullif(name, ''), 'Friend') into fname from public.dny_progress where user_id = owner_id;
  return jsonb_build_object('id', owner_id, 'name', coalesce(fname, 'Friend'));
end;
$fn$;
revoke all on function public.dny_accept_invite(text) from public, anon;
grant execute on function public.dny_accept_invite(text) to authenticated;
