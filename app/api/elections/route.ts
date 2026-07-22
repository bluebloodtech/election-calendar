import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, ELECTIONS_TABLE } from "@/lib/supabase-server";
import { fetchActiveCandidateNames } from "@/lib/tracked-candidates";
import { MAX_ELECTIONS, type Election } from "@/lib/types";

// GET /api/elections — all tracked election markets, oldest first.
//
// Before returning, auto-syncs in any "active" tier candidates from the
// Election Intelligence Map's tracked-candidates list that aren't already
// here — same pattern as that map page, which merges the same endpoint's
// data in on every load with no manual "add" step. Best-effort: if the
// sync fails or the 15-market cap is already reached, this just returns
// whatever is already in Supabase.
export async function GET() {
  const supabase = getSupabaseServerClient();

  const { data: existing, error } = await supabase
    .from(ELECTIONS_TABLE)
    .select("id, name, leader, price, volume, status, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const elections = existing as Election[];
  const existingNames = new Set(elections.map((e) => e.name));
  const remainingSlots = MAX_ELECTIONS - elections.length;

  if (remainingSlots > 0) {
    const activeCandidates = await fetchActiveCandidateNames();
    const toAdd = activeCandidates
      .filter((name) => !existingNames.has(name))
      .slice(0, remainingSlots);

    if (toAdd.length > 0) {
      const { data: inserted } = await supabase
        .from(ELECTIONS_TABLE)
        .insert(toAdd.map((name) => ({ name })))
        .select("id, name, leader, price, volume, status, created_at");
      if (inserted) elections.push(...(inserted as Election[]));
    }
  }

  return NextResponse.json({ elections });
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
