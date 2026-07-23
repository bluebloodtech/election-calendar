# Election Nightclub — Calendar & Command Center

A small Next.js app with three jobs:

1. **Master Command Center** (`/`) — a table of every tracked election market (max 15), with search/filter, manual Add/Delete, and a drop zone that creates a new row straight from a market-overview screenshot via AI vision.
2. **Per-election Calendar** (`/election/[id]`) — an Apple-Calendar-style monthly grid. Drop a Kalshi screenshot on any day to archive it; toggle between 1st Place and 2nd/3rd Place standings.
3. **Map** — reuses the existing Election Intelligence Map already built into the main Ghost site at `electionnightclub.com/map/`. This app does not host its own map; the "View Map" button links out to it with a `?candidate=<name>` param.

All three are reachable from a persistent Master Table / Calendar / Map tab bar (`components/TopTabs.tsx`) shown on both pages of this app. The Map tab is a plain external link, not a client-side tab — it's a different app on a different domain.

**Map deep-linking is half-done.** The `?candidate=` param this app sends only does something once a small snippet is pasted into `partials/custom-election-map.hbs` on the *theme* repo (not this one — this app has no deploy access there). Until that snippet is added, "View Map" opens the map fine, it just doesn't auto-select the candidate. The exact snippet and insertion point were given to the client directly (not stored in this repo, since it doesn't belong to this codebase).

No custom backend framework, no message queue, no auth system — just Next.js API routes talking directly to Supabase. That's a deliberate choice: it's the smallest stack that does the job, and any Next.js/React developer can pick it up without learning project-specific tooling.

## Stack

| Piece | What it is |
|---|---|
| Next.js 16 (App Router) | Pages + API routes, all in one deploy |
| Supabase (Postgres + Storage) | `elections` and `archive_entries` tables, `kalshi-screenshots` storage bucket |
| Tailwind CSS v4 | Styling, via CSS custom properties (see Theming below) |
| Anthropic API (optional) | Reads price/leader/volume off an uploaded screenshot automatically |

## Project layout

```
app/
  page.tsx                        Master Command Center (home page)
  election/[id]/page.tsx          Per-election calendar page
  api/elections/route.ts          GET (list) / POST (add) / DELETE elections
  api/elections/from-screenshot/route.ts  POST a market-overview screenshot -> new election
  api/archive-days/route.ts       GET archive entries for one election+month
  api/archive-days/upload/route.ts  POST a screenshot (also runs the AI read)
  api/archive-days/delete/route.ts  DELETE a screenshot
components/
  TopTabs.tsx                     Master Table / Calendar / Map tab bar
  ThemeToggle.tsx                 Dark/light switch (toggles "apple-calendar" on <body>, persisted in localStorage)
  MasterTable.tsx                 The command-center table + add-election form + ingest drop zone
  CalendarGrid.tsx                 Month grid, navigation, data loading
  DayCell.tsx                      One day's drop zone / thumbnail / delete button
  PlaceToggle.tsx                   1st / 2nd / 3rd place switch
lib/
  types.ts                         Shared TypeScript types + the 15-election cap
  supabase-server.ts                Server-only Supabase client (service role key)
  extract-screenshot.ts             The optional AI screenshot reader (per-day + whole-market variants)
supabase/
  setup.sql                        Original single-election schema (kept for history)
  migration-elections.sql          Adds multi-election support
  migration-location.sql           Adds the Location/Address column
  migration-expiry.sql             Adds election_date + image_url — run this too
r-integration/
  test-data-flow.R                 Proves the Supabase data lands cleanly in R — see r-integration/README.md
```

Nothing talks to Supabase from the browser. Every read/write goes through a Next.js API route using the service role key, so Row Level Security can stay locked down with no public policies.

## Setting it up from scratch

1. `npm install`
2. Create a Supabase project, then in its SQL Editor run, in order: `supabase/migration-elections.sql` (creates `elections`, adds the `election_id`/`leader`/`price`/`volume` columns to `archive_entries`, migrates any pre-existing single-election data), `supabase/migration-location.sql` (adds `location`), `supabase/migration-expiry.sql` (adds `election_date` + `image_url`).
3. In Supabase → Storage, create a **public** bucket named `kalshi-screenshots`.
4. Copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — from Project Settings → API.
   - `ANTHROPIC_API_KEY` — **optional**. Only needed for the AI Read feature described below.
5. `npm run dev`

## The AI Read features (optional, cost money, off by default)

Both use Claude (`claude-haiku-4-5`, the cheapest vision-capable model) via `lib/extract-screenshot.ts`, and both need `ANTHROPIC_API_KEY` set.

1. **Per-day calendar drop** ("+ DROP (AI Read)" on each day cell) — reads the leader/price/volume for that day's screenshot. Graceful without a key: the upload still works, those three fields just stay blank until typed in manually.
2. **Command Center drop zone** ("Drag & Drop Screenshot Here...") — reads a market's name *and* leader/price/volume off one overview screenshot to create a whole new row. **Not graceful without a key** — there's no non-AI way to guess a market's name from an image, so this specific feature returns an error telling you to use "+ Add New Election" instead. Everything else in the app is unaffected either way.

## Theming

Colors are CSS custom properties defined once in `app/globals.css` (`--ink`, `--panel`, `--gold`, etc.), consumed via Tailwind's `@theme inline` mapping. `.apple-calendar` (also in `globals.css`) overrides those variables to a light theme. `ThemeToggle.tsx` toggles that class on `<body>` and remembers the choice in `localStorage` — no component-level theme logic needed anywhere else.

## Election end date, image, and auto-expiry

Two optional fields on Add: **Election Date** and **Candidate image URL**. Neither is required, and both only show up as a hover card (image + end date on the Delete button, image + runner-up names on the market name) — they don't add columns, keeping rows clean per the client's request.

**Auto-expiry**: once `election_date` passes, the row (and its archived screenshots) is deleted automatically. There's no cron job — `GET /api/elections` does a lazy sweep on every load (`sweepExpiredElections` in `app/api/elections/route.ts`) and deletes anything expired before returning the list. Simple, no scheduler infra, matches "any developer can do it."

**Runner-up names** (hover over the market name) come from the most recent day's `archive_entries` rows for the 2nd/3rd place tabs — the same AI Read already used per day, not a new extraction. There's no separate "top 3 in one shot" feature; dropping a screenshot on each of the 1st/2nd/3rd tabs in the calendar is what populates this.

## Security posture

What's in place:
- All queries go through the supabase-js query builder (parameterized — no raw SQL anywhere), server-side only, with RLS left enabled and no public policies.
- Every client-supplied ID/date/month is format-validated at the door (`lib/validate.ts`): UUIDs, real calendar dates, http(s)-only image URLs, length caps. Invalid input gets a clean 400 instead of reaching Postgres or a Storage path.
- Uploads verify the election exists *before* writing to Storage, so bad requests can't leave orphaned files; the election ID that becomes the Storage path prefix is guaranteed to be a plain UUID.
- Raw database/storage error messages are logged server-side only; clients get generic messages (no schema/constraint leakage).
- AI-read output is treated as untrusted input too — length-clamped before it's stored.
- No secrets ship to the browser: no `NEXT_PUBLIC_` vars at all; the service-role key and the optional Anthropic key are read server-side only. React's default escaping covers XSS (no `dangerouslySetInnerHTML` anywhere).

What's deliberately **not** in place (product decisions, not oversights — see below):
- **No authentication.** Anyone with the URL can add/delete elections and upload screenshots. CSRF tokens would be meaningless without a session to protect. If this ever needs to be public-facing, auth is the first thing to add.
- **No rate limiting.** Relevant mostly to the AI endpoints once `ANTHROPIC_API_KEY` is set — an abuser could run up (small) API costs. Vercel's platform limits are the only backstop.

## R integration — data plumbing only

This app's job stops at delivering clean, well-typed data. `r-integration/test-data-flow.R` proves that data lands correctly in R: it connects to Supabase, pulls `elections` and `archive_entries`, and prints their structure — real dates as `Date`, timestamps as `POSIXct`. It does **not** analyze, chart, or compute anything. Any statistics, comparisons, or algorithms are a separate, later phase that this codebase intentionally has no part of. See `r-integration/README.md` for how to run it.

## Known simplifications (by design, not oversights)

- No authentication — anyone with the URL can add elections or upload screenshots. Add auth later if this needs to be public-facing.
- No manual edit form for leader/price/volume — they're set by the AI read or stay blank. (Location, election date, and image URL *are* editable, but only at creation — no edit-after-the-fact UI for any field yet.)
- The 15-election cap and the AI Read model choice are hardcoded in `lib/types.ts` and `lib/extract-screenshot.ts` respectively — change the constant, no config system to learn.
- Yes/No prices and trading volume are intentionally never extracted by AI Read — out of scope per an explicit agreement with the client to keep this to general market data, not financial/betting data.
