-- Migration: multi-election support (Master Command Center).
-- Run once in the Supabase SQL editor (Database → SQL Editor).

-- 1. One row per tracked election market (max 15 enforced in the app).
create table if not exists elections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  leader text not null default '',
  price text not null default '',
  volume text not null default '',
  status text not null default 'Active' check (status in ('Active', 'Closed')),
  created_at timestamptz not null default now()
);

alter table elections enable row level security;

-- 2. Tie archive entries to an election, plus the fields the AI reads
--    off each screenshot (shown on the day card and the master table).
alter table archive_entries add column if not exists election_id uuid references elections (id) on delete cascade;
alter table archive_entries add column if not exists leader text not null default '';
alter table archive_entries add column if not exists price text not null default '';
alter table archive_entries add column if not exists volume text not null default '';

-- 3. Uniqueness is now per (election, day, place) instead of (day, place).
alter table archive_entries drop constraint if exists archive_entries_day_place_key;
alter table archive_entries drop constraint if exists archive_entries_election_day_place_key;
alter table archive_entries add constraint archive_entries_election_day_place_key unique (election_id, day, place);

-- 4. Adopt any pre-migration screenshots into a first election so nothing
--    disappears from the calendar.
insert into elections (name)
select 'Kalshi Market #1'
where exists (select 1 from archive_entries where election_id is null)
  and not exists (select 1 from elections where name = 'Kalshi Market #1');

update archive_entries
set election_id = (select id from elections where name = 'Kalshi Market #1')
where election_id is null;
