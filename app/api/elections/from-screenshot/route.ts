import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, ELECTIONS_TABLE } from "@/lib/supabase-server";
import { extractMarketOverview } from "@/lib/extract-screenshot";
import { MAX_ELECTIONS, type Election } from "@/lib/types";

const ALLOWED_TYPES = ["image/png", "image/jpeg"];
const MAX_BYTES = 4 * 1024 * 1024;

// POST /api/elections/from-screenshot
// FormData: file (PNG/JPG)
// The Master Command Center's own drop zone: reads a market overview
// screenshot with AI vision and creates a new election row from it in one
// step. Requires ANTHROPIC_API_KEY — there's no non-AI fallback for this
// one, since the whole point is not typing the name in by hand.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only PNG and JPG images are accepted." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 4MB limit." }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI Vision isn't configured (missing ANTHROPIC_API_KEY) — use '+ Add New Election' instead." },
      { status: 501 }
    );
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

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const overview = await extractMarketOverview(base64, file.type as "image/png" | "image/jpeg");

  if (!overview || !overview.name) {
    return NextResponse.json(
      { error: "Couldn't read a market name off that screenshot — try '+ Add New Election' instead." },
      { status: 422 }
    );
  }

  const { data, error } = await supabase
    .from(ELECTIONS_TABLE)
    .insert({
      name: overview.name,
      leader: overview.leader,
      price: overview.price,
      volume: overview.volume,
    })
    .select("id, name, leader, price, volume, status, location, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ election: data as Election });
}
