import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseServerClient,
  ARCHIVE_BUCKET,
  ARCHIVE_TABLE,
  ELECTIONS_TABLE,
} from "@/lib/supabase-server";
import { MAX_ELECTIONS, type Election } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const ELECTION_COLUMNS =
  "id, name, leader, price, volume, status, location, election_date, image_url, created_at";

// Removes every screenshot filed under <election-id>/... in Storage.
// archive_entries rows themselves cascade-delete via the FK, but Storage
// objects don't, so this has to be done explicitly wherever an election
// is removed (manual delete or auto-expiry).
async function deleteElectionFiles(supabase: SupabaseClient, electionId: string) {
  const { data: dayFolders } = await supabase.storage.from(ARCHIVE_BUCKET).list(electionId);
  if (!dayFolders || dayFolders.length === 0) return;
  for (const day of dayFolders) {
    const { data: files } = await supabase.storage
      .from(ARCHIVE_BUCKET)
      .list(`${electionId}/${day.name}`);
    if (files && files.length > 0) {
      await supabase.storage
        .from(ARCHIVE_BUCKET)
        .remove(files.map((f) => `${electionId}/${day.name}/${f.name}`));
    }
  }
}

// Deletes any election whose election_date has passed, per the client's
// "auto-deletes when the date comes" request. Runs as a lazy sweep on every
// GET rather than a scheduled job — no cron infra needed, matching the
// "any developer can do it" constraint on this build.
async function sweepExpiredElections(supabase: SupabaseClient) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: expired } = await supabase
    .from(ELECTIONS_TABLE)
    .select("id")
    .not("election_date", "is", null)
    .lt("election_date", today);

  if (!expired || expired.length === 0) return;
  for (const row of expired) {
    await deleteElectionFiles(supabase, row.id);
  }
  await supabase
    .from(ELECTIONS_TABLE)
    .delete()
    .in("id", expired.map((r) => r.id));
}

// For the Market Name hover card: the most recent day's leader name for
// each placement, so the runner-up(s) can show on hover without adding a
// column to the row itself ("keep the rows clean").
async function attachStandings(supabase: SupabaseClient, elections: Election[]) {
  if (elections.length === 0) return elections;
  const ids = elections.map((e) => e.id);
  const { data: entries } = await supabase
    .from(ARCHIVE_TABLE)
    .select("election_id, place, leader, day")
    .in("election_id", ids)
    .order("day", { ascending: false });

  if (!entries) return elections;

  const latestByElectionPlace = new Map<string, string>();
  for (const row of entries) {
    const key = `${row.election_id}__${row.place}`;
    if (!latestByElectionPlace.has(key) && row.leader) {
      latestByElectionPlace.set(key, row.leader);
    }
  }

  return elections.map((e) => {
    const first = latestByElectionPlace.get(`${e.id}__first`) || "";
    const second = latestByElectionPlace.get(`${e.id}__second`) || "";
    const third = latestByElectionPlace.get(`${e.id}__third`) || "";
    if (!first && !second && !third) return e;
    return { ...e, standings: { first, second, third } };
  });
}

// GET /api/elections — all tracked election markets, oldest first.
// Manual only, by design: the client wants Add/Delete to be the only way
// markets enter this table — no auto-import from any external source.
export async function GET() {
  const supabase = getSupabaseServerClient();

  await sweepExpiredElections(supabase);

  const { data, error } = await supabase
    .from(ELECTIONS_TABLE)
    .select(ELECTION_COLUMNS)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const elections = await attachStandings(supabase, data as Election[]);
  return NextResponse.json({ elections });
}

// POST /api/elections — add a new market. Hard cap of 15 per the client spec.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const location = typeof body?.location === "string" ? body.location.trim() : "";
  const electionDate = typeof body?.election_date === "string" && body.election_date ? body.election_date : null;
  const imageUrl = typeof body?.image_url === "string" ? body.image_url.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Missing 'name'." }, { status: 400 });
  }
  if (name.length > 120) {
    return NextResponse.json({ error: "Name is too long (max 120 chars)." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  const { count, error: countError } = await supabase
    .from(ELECTIONS_TABLE)
    .select("id", { count: "exact", head: true });

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }
  if ((count ?? 0) >= MAX_ELECTIONS) {
    return NextResponse.json(
      { error: `Limit reached — only ${MAX_ELECTIONS} elections can be tracked at a time.` },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from(ELECTIONS_TABLE)
    .insert({ name, location, election_date: electionDate, image_url: imageUrl })
    .select(ELECTION_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ election: data as Election });
}

// DELETE /api/elections
// JSON body: { id: uuid }
// Removes the election row plus every screenshot filed under it in Storage.
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";

  if (!id) {
    return NextResponse.json({ error: "Missing 'id'." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  await deleteElectionFiles(supabase, id);

  const { error } = await supabase.from(ELECTIONS_TABLE).delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
