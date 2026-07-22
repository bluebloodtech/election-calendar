# Election Nightclub — Calendar & Command Center

A small Next.js app with three jobs:

1. **Master Command Center** (`/`) — a table of every tracked election market (max 15), with search/filter and links out to that market's calendar and map.
2. **Per-election Calendar** (`/election/[id]`) — an Apple-Calendar-style monthly grid. Drop a Kalshi screenshot on any day to archive it; toggle between 1st Place and 2nd/3rd Place standings.
3. **Map** — reuses the existing Election Intelligence Map already built into the main Ghost site at `electionnightclub.com/map/`. This app does not host its own map; the "View Map" button links out to it with a `?candidate=<name>` param.

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
  api/elections/route.ts          GET (list) / POST (add) elections
  api/archive-days/route.ts       GET archive entries for one election+month
  api/archive-days/upload/route.ts  POST a screenshot (also runs the AI read)
  api/archive-days/delete/route.ts  DELETE a screenshot
components/
  MasterTable.tsx                 The command-center table + add-election form
  CalendarGrid.tsx                 Month grid, navigation, data loading
  DayCell.tsx                      One day's drop zone / thumbnail / delete button
  PlaceToggle.tsx                   1st / 2nd / 3rd place switch
lib/
  types.ts                         Shared TypeScript types + the 15-election cap
  supabase-server.ts                Server-only Supabase client (service role key)
  extract-screenshot.ts             The optional AI screenshot reader
supabase/
  setup.sql                        Original single-election schema (kept for history)
  migration-elections.sql          Run this one — adds multi-election support
```

Nothing talks to Supabase from the browser. Every read/write goes through a Next.js API route using the service role key, so Row Level Security can stay locked down with no public policies.

## Setting it up from scratch

1. `npm install`
2. Create a Supabase project, then in its SQL Editor run `supabase/migration-elections.sql` (it creates `elections`, adds the `election_id`/`leader`/`price`/`volume` columns to `archive_entries`, and migrates any pre-existing single-election data).
3. In Supabase → Storage, create a **public** bucket named `kalshi-screenshots`.
4. Copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — from Project Settings → API.
   - `ANTHROPIC_API_KEY` — **optional**. Only needed for the AI Read feature described below.
5. `npm run dev`

## The AI Read feature (optional, costs money, off by default)

Each day cell says "+ DROP (AI Read)". When a screenshot is uploaded, `lib/extract-screenshot.ts` sends it to Claude (`claude-haiku-4-5`, the cheapest vision-capable model) to read the leader name, price, and volume off the image, and fills them in automatically.

**This calls a paid third-party API.** If `ANTHROPIC_API_KEY` is not set, the upload still works exactly the same — you just get a blank leader/price/volume until someone types it in manually (there's no manual-entry UI yet; the fields are populated by the AI read or left blank). Nothing breaks and no other feature depends on this key existing. Add the key only if you want the automatic reading; there is no other required API key or paid service anywhere else in this app.

## Theming

Colors are CSS custom properties defined once in `app/globals.css` (`--ink`, `--panel`, `--gold`, etc.), consumed via Tailwind's `@theme inline` mapping. The Master Command Center uses the app's default dark/gold theme. The per-election calendar page wraps its content in an `.apple-calendar` class (also in `globals.css`) that overrides those same variables to a light theme — that's the whole mechanism, no component-level theme logic.

## Known simplifications (by design, not oversights)

- No authentication — anyone with the URL can add elections or upload screenshots. Add auth later if this needs to be public-facing.
- No manual edit form for leader/price/volume — they're set by the AI read or stay blank.
- The 15-election cap and the AI Read model choice are hardcoded in `lib/types.ts` and `lib/extract-screenshot.ts` respectively — change the constant, no config system to learn.
