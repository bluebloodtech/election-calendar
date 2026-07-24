# ─────────────────────────────────────────────────────────────────
# Election Nightclub — R Data Flow Test
# ─────────────────────────────────────────────────────────────────
# What this does, and ONLY this: connects to the Supabase database
# this app writes to, pulls the two tables (elections, archive_entries)
# over the REST API, and lands them as clean, correctly-typed R
# dataframes. It prints their structure so you can see the columns and
# types with your own eyes.
#
# What this deliberately does NOT do: no analysis, no charts, no
# aggregation, no statistics, no algorithms. This is a plumbing test —
# "does the data arrive in R in good shape" — not the analysis itself.
# That part is a separate, later phase, out of scope for this script.
#
# HOW TO RUN
#   1. Install R from https://www.r-project.org (or use RStudio).
#   2. Set two environment variables before launching R (don't hardcode
#      them in this file — same rule as the Next.js app's .env.local):
#        SUPABASE_URL                 — from Supabase → Project Settings → API
#        SUPABASE_SERVICE_ROLE_KEY    — same page, "service_role" secret
#      Easiest: create a file named ".Renviron" next to this script with:
#        SUPABASE_URL=https://xxxx.supabase.co
#        SUPABASE_SERVICE_ROLE_KEY=xxxx
#      (never commit that file — it's already covered by .gitignore's
#      blanket ".env*" rule, but give it its own line if your reviewer
#      wants that spelled out explicitly.)
#   3. From a terminal in this folder: Rscript test-data-flow.R
# ─────────────────────────────────────────────────────────────────

if (!requireNamespace("httr", quietly = TRUE)) install.packages("httr")
if (!requireNamespace("jsonlite", quietly = TRUE)) install.packages("jsonlite")

supabase_url <- Sys.getenv("SUPABASE_URL")
supabase_key <- Sys.getenv("SUPABASE_SERVICE_ROLE_KEY")

if (supabase_url == "" || supabase_key == "") {
  stop(
    "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n",
    "Set them as environment variables (see the comment at the top of ",
    "this file) before running the script."
  )
}

# Pulls one Supabase table over its REST API and returns a plain R
# dataframe. `select` mirrors PostgREST's own query param, so you can
# request specific columns the same way the Next.js app's API routes do.
fetch_table <- function(table, select = "*") {
  url <- paste0(supabase_url, "/rest/v1/", table, "?select=", select)
  res <- httr::GET(
    url,
    httr::add_headers(
      apikey = supabase_key,
      Authorization = paste("Bearer", supabase_key)
    )
  )
  if (httr::http_error(res)) {
    stop(sprintf("Supabase request to '%s' failed: %s", table, httr::content(res, "text")))
  }
  parsed <- jsonlite::fromJSON(httr::content(res, "text", encoding = "UTF-8"))
  # An empty Postgres result is JSON "[]", which jsonlite parses as an
  # empty list(), not a 0-row dataframe -- normalize so nrow()/str() work
  # the same way regardless of whether the table has data yet.
  if (!is.data.frame(parsed)) parsed <- data.frame()
  parsed
}

cat("Connecting to Supabase and pulling both tables...\n\n")

elections <- fetch_table("elections")
archive_entries <- fetch_table("archive_entries")

# Type cleanup — PostgREST returns everything as JSON strings/numbers;
# these two lines are the whole "make it R-native" step.
if (nrow(elections) > 0) {
  elections$created_at <- as.POSIXct(elections$created_at, tz = "UTC")
  elections$election_date <- as.Date(elections$election_date)
}
if (nrow(archive_entries) > 0) {
  archive_entries$day <- as.Date(archive_entries$day)
  archive_entries$created_at <- as.POSIXct(archive_entries$created_at, tz = "UTC")
}

cat("=== elections ===\n")
str(elections)
cat("\n")
print(head(elections))

cat("\n=== archive_entries ===\n")
str(archive_entries)
cat("\n")
print(head(archive_entries))

cat("\n✓ Data flow test complete — both tables landed as clean R dataframes.\n")
cat("  Row counts: elections =", nrow(elections), " archive_entries =", nrow(archive_entries), "\n")
