-- Migration: remove all betting/prediction-market-derived data.
-- Run once in the Supabase SQL editor.
--
-- By design, this app no longer reads or stores any data derived from a
-- betting/prediction market: no candidate rankings ("leader"), no prices,
-- no odds, no trading volume. Only a market's plain title is kept.

alter table elections drop column if exists leader;
alter table elections drop column if exists price;
alter table elections drop column if exists volume;

alter table archive_entries drop column if exists leader;
alter table archive_entries drop column if exists price;
alter table archive_entries drop column if exists volume;
