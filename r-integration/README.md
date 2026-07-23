# R data flow test

One script, one job: prove the data in Supabase lands cleanly in R. No analysis, no charts, no statistics — that's the next phase, and out of scope here on purpose.

## Run it

1. Install R: https://www.r-project.org
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as environment variables (same values as this app's `.env.local` — see `Project Settings → API` in Supabase). Easiest way: create a `.Renviron` file in this folder with those two lines — it's covered by the repo's `.env*` gitignore rule, but name it something you'll recognize as a secret if you ever add a more specific ignore rule.
3. From this folder: `Rscript test-data-flow.R`

## What you'll see

`str()` output for both tables (`elections`, `archive_entries`) showing real column names and types — dates as `Date`, timestamps as `POSIXct`, everything else as character — followed by a `head()` preview of each, and a row count.

## Verified without R installed

R isn't installed on the machine this was built on, so the HTTP layer (same URL shape, same two headers: `apikey` + `Authorization: Bearer`) was verified directly with `curl` against the live Supabase project before writing this script — confirmed both endpoints return valid JSON with the expected columns. The R script is a straight port of that same request.
