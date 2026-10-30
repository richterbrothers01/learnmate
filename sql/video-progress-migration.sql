-- Video watch progress (LearnMate).
-- One row per student per chapter key (classLevel|subject|section|title).
-- Safe to run more than once, including on a database where a
-- video_progress table already exists from the original app. Run this
-- BEFORE using video progress in the app: until it runs, the
-- /api/video-progress route has no table and the dashboard falls back
-- to the old milestone progress (0%).

create table if not exists public.video_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_key text not null,
  watched_seconds double precision not null default 0,
  duration_seconds double precision not null default 0,
  percent integer not null default 0,
  updated_at timestamptz not null default now()
);

-- If the table already existed from the original app (keyed by
-- chapter_id + youtube_video_id, integer seconds, completed flag),
-- add the columns the new code needs. On a fresh table these are
-- all no-ops. chapter_key is deliberately left nullable so existing
-- rows never break the alter; new rows always set it, and nulls
-- never clash in the unique index below.
alter table public.video_progress
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists chapter_key text,
  add column if not exists watched_seconds double precision not null default 0,
  add column if not exists duration_seconds double precision not null default 0,
  add column if not exists percent integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

-- The original app's legacy columns (chapter_id, youtube_video_id,
-- completed) are never written by the new code. If any of them is
-- NOT NULL without a default, every progress insert fails with a
-- null-value error (this caused a live POST 500 on 2026-10-29).
-- Relax them where they exist; no-op on a fresh table.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'video_progress' and column_name = 'chapter_id') then
    alter table public.video_progress alter column chapter_id drop not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'video_progress' and column_name = 'youtube_video_id') then
    alter table public.video_progress alter column youtube_video_id drop not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'video_progress' and column_name = 'completed') then
    alter table public.video_progress alter column completed drop not null;
  end if;
end $$;

create unique index if not exists video_progress_user_chapter_key
  on public.video_progress (user_id, chapter_key);

alter table public.video_progress enable row level security;

drop policy if exists "Users read own video progress" on public.video_progress;
create policy "Users read own video progress" on public.video_progress
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users write own video progress" on public.video_progress;
create policy "Users write own video progress" on public.video_progress
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users update own video progress" on public.video_progress;
create policy "Users update own video progress" on public.video_progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users delete own video progress" on public.video_progress;
create policy "Users delete own video progress" on public.video_progress
  for delete to authenticated using (user_id = auth.uid());
