# Election Nightclub — Calendar & Command Center

A small Next.js app with three jobs:

1. **Master Command Center** (`/`) — a table of every tracked election market (max 15), with search/filter, manual Add/Delete, and a drop zone that creates a new row from a screenshot's title via AI vision.
2. **Per-election Calendar** (`/election/[id]`) — an Apple-Calendar-style monthly grid. Drop a screenshot on any day to archive it as an image, filed under a 1st/2nd/3rd manual category.
3. **Map** — reuses the existing Election Intelligence Map already built into the main Ghost site at `electionnightclub.com/map/`. This app does not host its own map; the "View Map" button links out to it with a `?candidate=<name>` param.

All three are reachable from a persistent Master Table / Calendar / Map tab bar (`components/TopTabs.tsx`) shown on both pages of this app. The Map tab is a plain external link, not a client-side tab — it's a different app on a different domain.

**Map deep-linking is half-done.** The `?candidate=` param this app sends only does something once a small snippet is pasted into `partials/custom-election-map.hbs` on the *theme* repo (not this one — this app has no deploy access there). Until that snippet is added, "View Map" opens the map fine, it just doesn't auto-select the candidate. The exact snippet and insertion point were given to the client directly (not stored in this repo, since it doesn't belong to this codebase).

No custom backend framework, no message queue, no auth system — just Next.js API routes talking directly to Supabase. That's a deliberate choice: it's the smallest stack that does the job, and any Next.js/React developer can pick it up without learning project-specific tooling.

## Stack

| Piece | What it is |
|---|---|
| Next.js 16 (App Router) | Pages + API routes, all in one deploy |
| Supabase (Postgres + Storage) | `elections` and `archive_entries` tables, a public storage bucket for screenshots |
| Tailwind CSS v4 | Styling, via CSS custom properties (see Theming below) |
| Google Gemini API (optional) | Reads only a market's plain title off an uploaded screenshot |

## Project layout

```
app/
  page.tsx                        Master Command Center (home page)
  election/[id]/page.tsx          Per-election calendar page
  api/elections/route.ts          GET (list) / POST (add) / DELETE elections
  api/elections/from-screenshot/route.ts  POST a screenshot -> reads its title -> new election
  api/archive-days/route.ts       GET archive entries for one election+month
  api/archive-days/upload/route.ts  POST a screenshot (pure archival, no AI)
  api/archive-days/delete/route.ts  DELETE a screenshot
components/
  TopTabs.tsx                     Master Table / Calendar / Map tab bar
  ThemeToggle.tsx                 Dark/light switch (toggles "apple-calendar" on <body>, persisted in localStorage)
  MasterTable.tsx                 The command-center table + add-election form + ingest drop zone
  CalendarGrid.tsx                 Month grid, navigation, data loading
  DayCell.tsx                      One day's drop zone / thumbnail / delete button
  PlaceToggle.tsx                   1st / 2nd / 3rd manual filing-category switch
lib/
  types.ts                         Shared TypeScript types + the 15-election cap
  supabase-server.ts                Server-only Supabase client (service role key)
  extract-screenshot.ts             The optional AI screenshot title reader
supabase/
  setup.sql                        Original single-election schema (kept for history)
  migration-elections.sql          Adds multi-election support
  migration-location.sql           Adds the Location/Address column
  migration-expiry.sql             Adds election_date + image_url — run this too
  migration-remove-betting-data.sql Drops leader/price/volume columns — run this too
r-integration/
  test-data-flow.R                 Proves the Supabase data lands cleanly in R — see r-integration/README.md
```

Nothing talks to Supabase from the browser. Every read/write goes through a Next.js API route using the service role key, so Row Level Security can stay locked down with no public policies.

## Setting it up from scratch

1. `npm install`
2. Create a Supabase project, then in its SQL Editor run, in order: `supabase/migration-elections.sql` (creates `elections`/`archive_entries`, migrates any pre-existing single-election data), `supabase/migration-location.sql` (adds `location`), `supabase/migration-expiry.sql` (adds `election_date` + `image_url`), `supabase/migration-remove-betting-data.sql` (drops the `leader`/`price`/`volume` columns).
3. In Supabase → Storage, create a **public** bucket for screenshots (name must match `ARCHIVE_BUCKET` in `lib/supabase-server.ts`).
4. Copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — from Project Settings → API.
   - `GEMINI_API_KEY` — **optional**. Only needed for the AI Read feature described below.
5. `npm run dev`

## The AI Read feature (optional, costs money, off by default)

AI vision reads only a plain page/market **title** (e.g. "US Senate Race - AZ") off a screenshot.

Uses Google Gemini (`gemini-2.5-flash`, the cheapest vision-capable tier) via `lib/extract-screenshot.ts`, and needs `GEMINI_API_KEY` set — get one free at [Google AI Studio](https://aistudio.google.com/apikey).

- **Command Center drop zone** ("Drag & Drop Screenshot Here...") — reads a market's title off one screenshot to create a new row with just that name. **Not graceful without a key** — there's no non-AI way to guess a market's name from an image, so this specific feature returns an error telling you to use "+ Add New Election" instead.
- **Per-day calendar drop** — pure archival, no AI call at all. The screenshot is stored as an image under whichever of the three manual 1st/2nd/3rd categories it was dropped into.

The Gemini call goes straight to the REST API with `fetch` (no SDK dependency) — `generateContent` with an inline base64 image plus `responseSchema` for structured JSON output, so the response never needs fragile text parsing.

## Theming

Colors are CSS custom properties defined once in `app/globals.css` (`--ink`, `--panel`, `--gold`, etc.), consumed via Tailwind's `@theme inline` mapping. `.apple-calendar` (also in `globals.css`) overrides those variables to a light theme. `ThemeToggle.tsx` toggles that class on `<body>` and remembers the choice in `localStorage` — no component-level theme logic needed anywhere else.

## Election end date, image, and auto-expiry

Two optional fields on Add: **Election Date** and **Candidate image URL**. Neither is required, and both only show up as a hover card (image on the market name, image + end date on the Delete button) — they don't add columns, keeping rows clean per the client's request.

**Auto-expiry**: once `election_date` passes, the row (and its archived screenshots) is deleted automatically. There's no cron job — `GET /api/elections` does a lazy sweep on every load (`sweepExpiredElections` in `app/api/elections/route.ts`) and deletes anything expired before returning the list. Simple, no scheduler infra, matches "any developer can do it."

## Security posture

What's in place:
- All queries go through the supabase-js query builder (parameterized — no raw SQL anywhere), server-side only, with RLS left enabled and no public policies.
- Every client-supplied ID/date/month is format-validated at the door (`lib/validate.ts`): UUIDs, real calendar dates, http(s)-only image URLs, length caps. Invalid input gets a clean 400 instead of reaching Postgres or a Storage path.
- Uploads verify the election exists *before* writing to Storage, so bad requests can't leave orphaned files; the election ID that becomes the Storage path prefix is guaranteed to be a plain UUID.
- Raw database/storage error messages are logged server-side only; clients get generic messages (no schema/constraint leakage).
- AI-read output is treated as untrusted input too — length-clamped before it's stored.
- No secrets ship to the browser: no `NEXT_PUBLIC_` vars at all; the service-role key and the optional Gemini key are read server-side only. React's default escaping covers XSS (no `dangerouslySetInnerHTML` anywhere).

What's deliberately **not** in place (product decisions, not oversights — see below):
- **No authentication.** Anyone with the URL can add/delete elections and upload screenshots. CSRF tokens would be meaningless without a session to protect. If this ever needs to be public-facing, auth is the first thing to add.
- **No rate limiting.** Relevant mostly to the AI endpoints once `GEMINI_API_KEY` is set — an abuser could run up (small) API costs. Vercel's platform limits are the only backstop.

## R integration — data plumbing only

This app's job stops at delivering clean, well-typed data. `r-integration/test-data-flow.R` proves that data lands correctly in R: it connects to Supabase, pulls `elections` and `archive_entries`, and prints their structure — real dates as `Date`, timestamps as `POSIXct`. It does **not** analyze, chart, or compute anything. Any statistics, comparisons, or algorithms are a separate, later phase that this codebase intentionally has no part of. See `r-integration/README.md` for how to run it.

## Known simplifications (by design, not oversights)

- No authentication — anyone with the URL can add elections or upload screenshots. Add auth later if this needs to be public-facing.
- No edit-after-the-fact UI for any field — location, election date, and image URL are only set at creation.
- The 15-election cap and the AI Read model choice are hardcoded in `lib/types.ts` and `lib/extract-screenshot.ts` respectively — change the constant, no config system to learn.
