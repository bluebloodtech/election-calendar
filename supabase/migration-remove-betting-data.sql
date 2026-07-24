-- Migration: drop the leader/price/volume columns.
-- Run once in the Supabase SQL editor.

alter table elections drop column if exists leader;
alter table elections drop column if exists price;
alter table elections drop column if exists volume;

alter table archive_entries drop column if exists leader;
alter table archive_entries drop column if exists price;
alter table archive_entries drop column if exists volume;
