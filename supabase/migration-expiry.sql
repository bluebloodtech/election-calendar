-- Migration: election end date + candidate image, and auto-expiry support.
-- Run once in the Supabase SQL editor.

alter table elections add column if not exists election_date date;
alter table elections add column if not exists image_url text not null default '';
