import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, ELECTIONS_TABLE } from "@/lib/supabase-server";
import { extractMarketOverview } from "@/lib/extract-screenshot";
import { MAX_ELECTIONS, type Election } from "@/lib/types";
import { cleanString } from "@/lib/validate";

const ALLOWED_TYPES = ["image/png", "image/jpeg"];
const MAX_BYTES = 4 * 1024 * 1024;

// POST /api/elections/from-screenshot
// FormData: file (PNG/JPG)
// The Master Command Center's own drop zone: reads a market overview
// screenshot with AI vision and creates a new election row from it in one
// step. Requires GEMINI_API_KEY — there's no non-AI fallback for this
// one, since the whole point is not typing the name in by hand.
export async function POST(req: NextRequest) {
  // Malformed multipart bodies throw — catch them into a clean 400 instead
  // of an unhandled 500.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }
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
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "AI Vision isn't configured (missing GEMINI_API_KEY) — use '+ Add New Election' instead." },
      { status: 501 }
    );
  }

  const supabase = getSupabaseServerClient();

  const { count, error: countError } = await supabase
    .from(ELECTIONS_TABLE)
    .select("id", { count: "exact", head: true });
  if (countError) {
    console.error("[from-screenshot] count:", countError.message);
    return NextResponse.json({ error: "Database error — please try again." }, { status: 500 });
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

  // Model output is still untrusted input — clamp it to the same limits
  // the manual Add form enforces.
  const { data, error } = await supabase
    .from(ELECTIONS_TABLE)
    .insert({
      name: cleanString(overview.name, 120),
      leader: cleanString(overview.leader, 120),
      price: cleanString(overview.price, 40),
      volume: cleanString(overview.volume, 40),
    })
    .select("id, name, leader, price, volume, status, location, election_date, image_url, created_at")
    .single();

  if (error) {
    console.error("[from-screenshot] insert:", error.message);
    return NextResponse.json({ error: "Database error — please try again." }, { status: 500 });
  }
  return NextResponse.json({ election: data as Election });
}
