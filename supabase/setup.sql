-- Run this once in the Supabase SQL editor (Database → SQL Editor) for the
-- project you decide to use for the calendar.

-- 1. Table that stores one row per (day, place) pair.
create table if not exists archive_entries (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  place text not null check (place in ('first', 'second', 'third')),
  image_url text not null,
  created_at timestamptz not null default now(),
  unique (day, place)
);

-- Row Level Security stays ON. The app never talks to Supabase from the
-- browser — every read/write goes through Next.js API routes using the
-- service role key, which bypasses RLS by design. No public policies
-- are required on this table.
alter table archive_entries enable row level security;

-- 2. Storage bucket for the screenshots themselves.
-- Create it from the dashboard: Storage → New bucket → name: kalshi-screenshots
-- Mark it "Public" so the stored public URLs can be rendered directly as
-- <Image> thumbnails without needing signed URLs. If the Kalshi screenshots
-- should NOT be publicly reachable by anyone with the link, tell me instead
-- and I'll switch the app to use short-lived signed URLs.

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION (run this if the table already exists with the old constraint):
-- ─────────────────────────────────────────────────────────────────────────────
-- alter table archive_entries
--   drop constraint if exists archive_entries_place_check;
--
-- alter table archive_entries
--   add constraint archive_entries_place_check
--   check (place in ('first', 'second', 'third'));

