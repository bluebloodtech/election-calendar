import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, ELECTIONS_TABLE } from "@/lib/supabase-server";
import { MAX_ELECTIONS, type Election } from "@/lib/types";

// GET /api/elections — all tracked election markets, oldest first.
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
