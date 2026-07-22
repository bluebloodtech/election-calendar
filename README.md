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
  migration-location.sql           Adds the Location/Address column — run this too
```

Nothing talks to Supabase from the browser. Every read/write goes through a Next.js API route using the service role key, so Row Level Security can stay locked down with no public policies.

## Setting it up from scratch

1. `npm install`
2. Create a Supabase project, then in its SQL Editor run `supabase/migration-elections.sql` (it creates `elections`, adds the `election_id`/`leader`/`price`/`volume` columns to `archive_entries`, and migrates any pre-existing single-election data), then `supabase/migration-location.sql` (adds the `location` column to `elections`).
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

Colors are CSS custom properties defined once in `app/globals.css` (`--ink`, `--panel`, `--gold`, etc.), consumed via Tailwind's `@theme inline` mapping. The Master Command Center uses the app's default dark/gold theme. The per-election calendar page wraps its content in an `.apple-calendar` class (also in `globals.css`) that overrides those same variables to a light theme — that's the whole mechanism, no component-level theme logic.

## Known simplifications (by design, not oversights)

- No authentication — anyone with the URL can add elections or upload screenshots. Add auth later if this needs to be public-facing.
- No manual edit form for leader/price/volume — they're set by the AI read or stay blank.
- The 15-election cap and the AI Read model choice are hardcoded in `lib/types.ts` and `lib/extract-screenshot.ts` respectively — change the constant, no config system to learn.
