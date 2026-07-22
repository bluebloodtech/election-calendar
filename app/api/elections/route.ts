import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, ARCHIVE_BUCKET, ELECTIONS_TABLE } from "@/lib/supabase-server";
import { MAX_ELECTIONS, type Election } from "@/lib/types";

// GET /api/elections — all tracked election markets, oldest first.
// Manual only, by design: the client wants Add/Delete to be the only way
// markets enter this table — no auto-import from any external source.
export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from(ELECTIONS_TABLE)
    .select("id, name, leader, price, volume, status, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ elections: data as Election[] });
}

// POST /api/elections — add a new market. Hard cap of 15 per the client spec.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

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
    .insert({ name })
    .select("id, name, leader, price, volume, status, created_at")
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

  // Best-effort cleanup of stored screenshots under <election-id>/... —
  // archive_entries rows themselves cascade-delete via the FK, but Storage
  // objects don't, so remove them explicitly.
  const { data: dayFolders } = await supabase.storage.from(ARCHIVE_BUCKET).list(id);
  if (dayFolders && dayFolders.length > 0) {
    for (const day of dayFolders) {
      const { data: files } = await supabase.storage
        .from(ARCHIVE_BUCKET)
        .list(`${id}/${day.name}`);
      if (files && files.length > 0) {
        await supabase.storage
          .from(ARCHIVE_BUCKET)
          .remove(files.map((f) => `${id}/${day.name}/${f.name}`));
      }
    }
  }

  const { error } = await supabase.from(ELECTIONS_TABLE).delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
