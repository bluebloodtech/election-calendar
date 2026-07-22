-- Migration: adds the Location/Address column to the Master Command Center
-- table, per the client's updated table layout (Market Name | Tier/Status |
-- Price | Volume | Location/Address | Actions).
-- Run once in the Supabase SQL editor.

alter table elections add column if not exists location text not null default '';
