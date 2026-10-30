-- LearnMate notifications (in-app bell tab).
-- Run this file once in the Supabase SQL Editor. It is safe to run
-- twice: tables, policies and the trigger are all guarded.
--
-- What it creates:
--   public.notifications — one row per notification, owned by one user.
--   Owner-only RLS (select / insert / update / delete).
--   A welcome trigger: every new profile row gets a "Welcome" notification.
--
-- Notes:
--   * The `key` column is the dedup key (streak:7, reminder:<id>:24 hours,
--     schedule-created:<id>). The partial unique index makes creation
--     idempotent: creating the same notification twice keeps one row.
--   * Timed reminders (24h, 12h, ...) are created by the app itself while
--     it is open (checked every minute) — no cron or push setup needed
--     for the bell tab. They cannot arrive while the app is closed;
--     that needs the background push sender, which is still parked.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  key text,
  link text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create unique index if not exists notifications_user_key_uidx
  on public.notifications (user_id, key) where key is not null;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can read their own notifications"
  on public.notifications;
create policy "Users can read their own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can create their own notifications"
  on public.notifications;
create policy "Users can create their own notifications"
  on public.notifications for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own notifications"
  on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own notifications"
  on public.notifications;
create policy "Users can delete their own notifications"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- Welcome notification for every new account, whichever signup path
-- created the profile (name signup, Google sign-in, anything else).
create or replace function public.notify_welcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, key, link)
  values (
    new.id,
    'welcome',
    'Welcome to LearnMate!',
    'Your account is ready. Add a course and take your first chapter test.',
    'welcome',
    null
  )
  on conflict (user_id, key) where key is not null do nothing;
  return new;
end;
$$;

drop trigger if exists welcome_notification on public.profiles;
create trigger welcome_notification
  after insert on public.profiles
  for each row execute function public.notify_welcome();

-- Quick check (expect one row describing the table):
-- select column_name, data_type from information_schema.columns
-- where table_schema = 'public' and table_name = 'notifications'
-- order by ordinal_position;
