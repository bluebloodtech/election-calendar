import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseServerClient,
  ARCHIVE_BUCKET,
  ELECTIONS_TABLE,
} from "@/lib/supabase-server";
import { MAX_ELECTIONS, type Election } from "@/lib/types";
import { cleanString, isHttpUrl, isIsoDate, isUuid } from "@/lib/validate";
import type { SupabaseClient } from "@supabase/supabase-js";

const ELECTION_COLUMNS =
  "id, name, status, location, election_date, image_url, created_at";

// Supabase/Postgres error details are logged server-side only — the raw
// messages can reveal schema/constraint names, which is more than a browser
// ever needs to know.
function dbError(context: string, error: { message: string }) {
  console.error(`[elections] ${context}:`, error.message);
  return NextResponse.json({ error: "Database error — please try again." }, { status: 500 });
}

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
    return dbError("GET list", error);
  }

  return NextResponse.json({ elections: data as Election[] });
}

// POST /api/elections — add a new market. Hard cap of 15 per the client spec.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = cleanString(body?.name, 120);
  const location = cleanString(body?.location, 120);
  const imageUrl = cleanString(body?.image_url, 500);
  const rawDate = typeof body?.election_date === "string" ? body.election_date : "";

  if (!name) {
    return NextResponse.json({ error: "Missing 'name'." }, { status: 400 });
  }
  // Optional fields still get validated when present — a bad date would
  // otherwise blow up as a Postgres cast error, and a non-http image URL
  // (javascript:, data:, file:) has no business in an <img src>.
  if (rawDate && !isIsoDate(rawDate)) {
    return NextResponse.json(
      { error: "Invalid 'election_date' (expected YYYY-MM-DD)." },
      { status: 400 }
    );
  }
  if (imageUrl && !isHttpUrl(imageUrl)) {
    return NextResponse.json(
      { error: "Invalid 'image_url' (must be an http(s) URL)." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  const { count, error: countError } = await supabase
    .from(ELECTIONS_TABLE)
    .select("id", { count: "exact", head: true });

  if (countError) {
    return dbError("POST count", countError);
  }
  if ((count ?? 0) >= MAX_ELECTIONS) {
    return NextResponse.json(
      { error: `Limit reached — only ${MAX_ELECTIONS} elections can be tracked at a time.` },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from(ELECTIONS_TABLE)
    .insert({ name, location, election_date: rawDate || null, image_url: imageUrl })
    .select(ELECTION_COLUMNS)
    .single();

  if (error) {
    return dbError("POST insert", error);
  }
  return NextResponse.json({ election: data as Election });
}

// DELETE /api/elections
// JSON body: { id: uuid }
// Removes the election row plus every screenshot filed under it in Storage.
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const id = body?.id;

  // UUID check does double duty: turns a Postgres cast error into a clean
  // 400, and guarantees the Storage path prefix below is a plain UUID
  // rather than an arbitrary client-controlled string.
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Missing or invalid 'id'." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  await deleteElectionFiles(supabase, id);

  const { error } = await supabase.from(ELECTIONS_TABLE).delete().eq("id", id);
  if (error) {
    return dbError("DELETE", error);
  }
  return NextResponse.json({ success: true });
}
