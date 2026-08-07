-- Fretwork Supabase setup
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run; everything is idempotent.

-- ============================================================
-- Feedback from the About page. Write-only from the app:
-- anyone may insert, nobody may read via the public API.
-- ============================================================
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  message text not null check (char_length(message) between 1 and 2000),
  user_id uuid references auth.users (id) on delete set null
);

alter table public.feedback enable row level security;

drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback"
  on public.feedback for insert
  to anon, authenticated
  with check (true);

-- ============================================================
-- Per-user synced data. One row per account. Columns already
-- exist for later features (melodies, custom progressions,
-- practice log) so those ship without a migration.
-- ============================================================
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  bank jsonb not null default '[]'::jsonb,
  changes jsonb not null default '{}'::jsonb,
  custom_progs jsonb not null default '[]'::jsonb,
  melodies jsonb not null default '[]'::jsonb,
  practice_log jsonb not null default '[]'::jsonb,
  settings jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "own data select" on public.user_data;
create policy "own data select"
  on public.user_data for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "own data insert" on public.user_data;
create policy "own data insert"
  on public.user_data for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "own data update" on public.user_data;
create policy "own data update"
  on public.user_data for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
