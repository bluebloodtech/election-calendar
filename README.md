# Election Nightclub — Calendar & Command Center

## Purpose

A Next.js app with two jobs, both feeding into a separate Map product on the main Ghost site:

1. **Master Command Center** (`/`) — a table of every tracked election market (max 15), with search/filter, manual Add/Delete, an AI-vision drop zone that creates a new row from a screenshot's title, and an "Add to Map" action that pushes a tracked market onto the separate Election Intelligence Map.
2. **Per-election Calendar** (`/election/[id]`) — an Apple-Calendar-style monthly grid. Drop a screenshot on any day to archive it as an image, filed under a 1st/2nd/3rd manual category.

This app does **not** host the Map itself — that's a page on the main Ghost site (`electionnightclub.com/map/`), backed by its own separate stack (Cloudflare Worker + Zoho Tables). This repo only *links to* and, via "Add to Map," *writes into* that system. See **Architecture** below for exactly how the two connect.

No custom backend framework, no message queue, no auth system — just Next.js API routes talking directly to Supabase (and, for one feature, to the Map's Worker). That's a deliberate choice: it's the smallest stack that does the job, and any Next.js/React developer can pick it up without learning project-specific tooling.

## Stack

| Piece | What it is |
|---|---|
| Next.js 16 (App Router) | Pages + API routes, all in one deploy |
| Supabase (Postgres + Storage) | `elections` and `archive_entries` tables, a public storage bucket for screenshots |
| Tailwind CSS v4 | Styling, via CSS custom properties (see Theming below) |
| Google Gemini API (optional) | Reads only a market's plain title off an uploaded screenshot |
| Election Intelligence Map (external) | A separate Ghost/Cloudflare Worker/Zoho stack this app links to and can write a new candidate into — see Architecture |

## Architecture

Two systems, two databases, connected at exactly one point:

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│   election-calendar (this)  │         │   Election Intelligence Map   │
│                              │         │   (electionnightclub.com/map) │
│   Next.js app                │         │   Ghost theme + JS            │
│   ───────────────            │         │   ──────────────              │
│   app/page.tsx               │         │   partials/                    │
│   app/election/[id]/page.tsx │         │     custom-election-map.hbs    │
│                              │         │                                │
│   API routes ──► Supabase    │         │   API calls ──► Cloudflare     │
│   (elections, archive_entries)│        │   Worker (retire-brazil-proxy) │
│                              │         │        │                       │
│                              │         │        ▼                       │
│   "Add to Map" button ───────┼────────►│   Worker ──► Zoho Tables       │
│   POST /api/elections/       │  POST   │   (Tracked_Candidates)         │
│     add-to-map               │ /api/   │                                │
│                              │ add-    │                                │
│                              │candidate│                                │
└─────────────────────────────┘         └──────────────────────────────┘
```

- **This app's own data** (tracked markets, archived screenshots) lives entirely in **this app's own Supabase project** — the Map never reads or writes it.
- **The Map's own data** (candidate pins, tiers, news articles) lives entirely in **Zoho Tables**, behind the Cloudflare Worker — this app never reads or writes it *except* through the one `/add-candidate` call below.
- **The only connection point** is `app/api/elections/add-to-map/route.ts`, which calls the Worker's `POST /api/add-candidate` endpoint server-side (never from the browser) with an admin key, to push one tracked election onto the Map as a new candidate. Everything else — "View Map," the `?candidate=` deep-link — is a plain outbound link, not a data connection.
- **Auto-expiry runs independently on both sides.** This app deletes its own expired rows (see below). The Map/Worker has its own separate auto-expiry (added to the Worker directly — not in this repo) that removes a candidate once *its* `Election_Date` in Zoho has passed.

## Data flow

**Adding a market manually:** browser → `POST /api/elections` → validates input → inserts into Supabase `elections` → returns the new row → UI updates.

**Adding a market via AI screenshot:** browser uploads an image → `POST /api/elections/from-screenshot` → image sent to Gemini as base64 → Gemini returns just a title string → title is cleaned/length-capped → inserted into Supabase `elections`.

**Archiving a calendar screenshot:** browser uploads an image for one day/placement → `POST /api/archive-days/upload` → verifies the parent election exists → uploads the file to Supabase Storage → upserts a row in `archive_entries` pointing at it. No AI call in this path at all — pure archival.

**Reading the calendar for a month:** browser → `GET /api/archive-days?election=<id>&month=<yyyy-mm>` → Supabase query scoped to that election/date range → returned to `CalendarGrid.tsx`, keyed by `"<date>__<place>"` for O(1) lookup per cell.

**Auto-expiry (this app's side):** every `GET /api/elections` call runs `sweepExpiredElections()` first — it finds any election whose `election_date` has passed, deletes its Storage files, then deletes the row (and its `archive_entries` rows cascade-delete via the FK) — *before* returning the list. No cron job; the sweep just rides along on the next page load.

**Pushing a market to the Map ("Add to Map"):** browser → `POST /api/elections/add-to-map` with `{ id }` → server looks up that election's name/location/date in Supabase → server calls the Map's Worker (`POST <MAP_WORKER_URL>/api/add-candidate`) with `Authorization: Bearer <MAP_ADD_ADMIN_KEY>` and `{ name, tier: "watching", address, electionDate }` → Worker geocodes the address, checks for a name clash, and inserts a new row into Zoho's `Tracked_Candidates` table → the Map picks it up on its own next refresh. This app never touches Zoho directly — only through that one Worker call.

## Project layout

```
app/
  page.tsx                        Master Command Center (home page)
  election/[id]/page.tsx          Per-election calendar page
  api/elections/route.ts          GET (list) / POST (add) / DELETE elections
  api/elections/from-screenshot/route.ts  POST a screenshot -> reads its title -> new election
  api/elections/add-to-map/route.ts  POST an election id -> pushes it onto the Map (see Architecture)
  api/archive-days/route.ts       GET archive entries for one election+month
  api/archive-days/upload/route.ts  POST a screenshot (pure archival, no AI)
  api/archive-days/delete/route.ts  DELETE a screenshot
components/
  TopTabs.tsx                     Master Table / Calendar / Map tab bar
  ThemeToggle.tsx                 Dark/light switch (toggles "apple-calendar" on <body>, persisted in localStorage)
  MasterTable.tsx                 The command-center table + add-election form + ingest drop zone + Add to Map
  CalendarGrid.tsx                 Month grid, navigation, data loading
  DayCell.tsx                      One day's drop zone / thumbnail / delete button
  PlaceToggle.tsx                   1st / 2nd / 3rd manual filing-category switch
  HoverCard.tsx                     Fixed-position tooltip (image/date), used on the table
lib/
  types.ts                         Shared TypeScript types + the 15-election cap
  supabase-server.ts                Server-only Supabase client (service role key)
  extract-screenshot.ts             The optional AI screenshot title reader
  validate.ts                       Input validation (UUID/date/URL) shared by every API route
supabase/
  setup.sql                        Original single-election schema (kept for history)
  migration-elections.sql          Adds multi-election support
  migration-location.sql           Adds the Location/Address column
  migration-expiry.sql             Adds election_date + image_url
  migration-remove-betting-data.sql Drops leader/price/volume columns
r-integration/
  test-data-flow.R                 Proves the Supabase data lands cleanly in R — see r-integration/README.md
```

Nothing talks to Supabase from the browser. Every read/write goes through a Next.js API route using the service role key, so Row Level Security can stay locked down with no public policies. Same principle for the Map integration — the Worker's admin key is read server-side only, in `app/api/elections/add-to-map/route.ts`, never sent to the browser.

## Setting it up from scratch

1. `npm install`
2. Create a Supabase project, then in its SQL Editor run, in order: `supabase/migration-elections.sql` (creates `elections`/`archive_entries`, migrates any pre-existing single-election data), `supabase/migration-location.sql` (adds `location`), `supabase/migration-expiry.sql` (adds `election_date` + `image_url`), `supabase/migration-remove-betting-data.sql` (drops the `leader`/`price`/`volume` columns).
3. In Supabase → Storage, create a **public** bucket named `archive-screenshots` (name must match `ARCHIVE_BUCKET` in `lib/supabase-server.ts`).
4. Copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — from Project Settings → API.
   - `GEMINI_API_KEY` — **optional**. Only needed for the AI Read feature described below.
   - `MAP_WORKER_URL` / `MAP_ADD_ADMIN_KEY` — **optional**. Only needed for "Add to Map"; without them it fails with a clear error instead of doing nothing. The admin key must match the Map Worker's `APPROVE_SECRET` — see the Worker's own documentation for where that lives.
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

**Auto-expiry**: once `election_date` passes, the row (and its archived screenshots) is deleted automatically. There's no cron job — `GET /api/elections` does a lazy sweep on every load (`sweepExpiredElections` in `app/api/elections/route.ts`) and deletes anything expired before returning the list. Simple, no scheduler infra, matches "any developer can do it." Note this only expires *this app's* rows — the Map has its own separate copy of a candidate once "Add to Map" is used, with its own separate auto-expiry (see Architecture).

## Debugging & testing notes

- **Manual functional testing** — every feature described in this README was clicked through live in a browser after building (upload/delete a screenshot, add/delete a market, drag a screenshot onto the AI drop zone, toggle theme) before being considered done.
- **API testing** — new/changed routes are hit directly with `fetch()` from the browser console (or `curl`) with both valid and invalid bodies, to confirm the exact status code and error message, not just "it works in the UI."
- **Browser DevTools** — Console and Network tabs checked after any change touching a fetch call, to catch silent failures (e.g. a 401/501 that the UI swallowed into a generic error).
- **Database verification** — after any schema change, checked directly in Supabase's Table Editor that the columns/rows look as expected, not just inferred from the app working.
- **Type checking** — `npm run build` (which runs the TypeScript compiler) is run before every commit; a red build is never shipped.
- **No automated test suite** (Jest/Vitest/Playwright) currently exists in this repo — testing today is manual, per the process above. Adding one would be a reasonable next step if this project keeps growing.

## Security posture

What's in place:
- All queries go through the supabase-js query builder (parameterized — no raw SQL anywhere), server-side only, with RLS left enabled and no public policies.
- Every client-supplied ID/date/month is format-validated at the door (`lib/validate.ts`): UUIDs, real calendar dates, http(s)-only image URLs, length caps. Invalid input gets a clean 400 instead of reaching Postgres or a Storage path.
- Uploads verify the election exists *before* writing to Storage, so bad requests can't leave orphaned files; the election ID that becomes the Storage path prefix is guaranteed to be a plain UUID.
- Raw database/storage error messages are logged server-side only; clients get generic messages (no schema/constraint leakage).
- AI-read output is treated as untrusted input too — length-clamped before it's stored.
- No secrets ship to the browser: no `NEXT_PUBLIC_` vars at all; the service-role key, the optional Gemini key, and the Map admin key are all read server-side only. React's default escaping covers XSS (no `dangerouslySetInnerHTML` anywhere).

What's deliberately **not** in place (product decisions, not oversights — see below):
- **No authentication.** Anyone with the URL can add/delete elections and upload screenshots. CSRF tokens would be meaningless without a session to protect. If this ever needs to be public-facing, auth is the first thing to add.
- **No rate limiting.** Relevant mostly to the AI endpoints once `GEMINI_API_KEY` is set — an abuser could run up (small) API costs. Vercel's platform limits are the only backstop.

## R integration — data plumbing only

This app's job stops at delivering clean, well-typed data. `r-integration/test-data-flow.R` proves that data lands correctly in R: it connects to Supabase, pulls `elections` and `archive_entries`, and prints their structure — real dates as `Date`, timestamps as `POSIXct`. It does **not** analyze, chart, or compute anything. Any statistics, comparisons, or algorithms are a separate, later phase that this codebase intentionally has no part of. See `r-integration/README.md` for how to run it.

## Known simplifications (by design, not oversights)

- No authentication — anyone with the URL can add elections or upload screenshots. Add auth later if this needs to be public-facing.
- No edit-after-the-fact UI for any field — location, election date, and image URL are only set at creation.
- The 15-election cap and the AI Read model choice are hardcoded in `lib/types.ts` and `lib/extract-screenshot.ts` respectively — change the constant, no config system to learn.
- No automated test suite — see Debugging & testing notes above.
