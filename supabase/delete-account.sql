-- DNY delete account. Run once in the Supabase SQL Editor.
-- Settings, Delete account asks for the password, checks it with a fresh sign in, then calls this function.
-- The function removes the signed in person's rows from every table, then the login itself.
-- It deletes rows by hand so it does not depend on cascade rules.
-- Shared habits the person started are removed for every member. Habits they only joined are left for the others.

create or replace function public.dny_delete_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;

  -- Shared habits this person started, with their members and checks.
  delete from public.dny_shared_checks where habit_id in (select id from public.dny_shared_habits where created_by = uid);
  delete from public.dny_shared_members where habit_id in (select id from public.dny_shared_habits where created_by = uid);
  delete from public.dny_shared_habits where created_by = uid;

  -- Habits this person only joined.
  delete from public.dny_shared_checks where user_id = uid;
  delete from public.dny_shared_members where user_id = uid;
  update public.dny_shared_members set invited_by = null where invited_by = uid;

  -- Friends and invites.
  delete from public.dny_friends where user_a = uid or user_b = uid;
  update public.dny_invites set used_by = null where used_by = uid;
  delete from public.dny_invites where inviter = uid;
  delete from public.dny_invite_tries where user_id = uid;
  delete from public.dny_friend_codes where user_id = uid;

  -- Progress, reminders and notifications.
  delete from public.dny_progress where user_id = uid;
  delete from public.push_reminders where user_id = uid;
  delete from public.push_subscriptions where user_id = uid;

  -- Ratings stay without a name.
  update public.dny_feedback set user_id = null where user_id = uid;

  -- The synced copy of the app data, then the login.
  delete from public.user_data where user_id = uid;
  delete from auth.users where id = uid;
end;
$fn$;
revoke all on function public.dny_delete_account() from public, anon;
grant execute on function public.dny_delete_account() to authenticated;
