import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseServerClient,
  ARCHIVE_BUCKET,
  ARCHIVE_TABLE,
  ELECTIONS_TABLE,
} from "@/lib/supabase-server";
import { isIsoDate, isUuid } from "@/lib/validate";

const ALLOWED_TYPES = ["image/png", "image/jpeg"];
const MAX_BYTES = 4 * 1024 * 1024; // 4MB — Vercel Hobby caps request bodies at 4.5MB

// POST /api/archive-days/upload
// FormData: file (PNG/JPG), election (uuid), day ("YYYY-MM-DD"),
//           place ("first" | "second" | "third")
//
// Pure archival — the uploaded screenshot is stored as an image; "place"
// is just which of the three manual filing categories it's stored under.
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  const day = form.get("day");
  const place = form.get("place");
  const election = form.get("election");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (!isUuid(election)) {
    return NextResponse.json({ error: "Missing or invalid 'election'." }, { status: 400 });
  }
  if (!isIsoDate(day)) {
    return NextResponse.json(
      { error: "Missing or invalid 'day' (expected YYYY-MM-DD)." },
      { status: 400 }
    );
  }
  if (place !== "first" && place !== "second" && place !== "third") {
    return NextResponse.json(
      { error: "Missing or invalid 'place' (expected 'first', 'second', or 'third')." },
      { status: 400 }
    );
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only PNG and JPG images are accepted." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 4MB limit." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  const { data: electionRow, error: electionError } = await supabase
    .from(ELECTIONS_TABLE)
    .select("id")
    .eq("id", election)
    .maybeSingle();

  if (electionError) {
    console.error("[upload] election lookup:", electionError.message);
    return NextResponse.json({ error: "Database error — please try again." }, { status: 500 });
  }
  if (!electionRow) {
    return NextResponse.json({ error: "Election not found." }, { status: 404 });
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${election}/${day}/${place}-${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(ARCHIVE_BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[upload] storage upload:", uploadError.message);
    return NextResponse.json({ error: "Upload failed — please try again." }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage
    .from(ARCHIVE_BUCKET)
    .getPublicUrl(path);

  const { error: dbError } = await supabase.from(ARCHIVE_TABLE).upsert(
    { election_id: election, day, place, image_url: publicUrlData.publicUrl },
    { onConflict: "election_id,day,place" }
  );

  if (dbError) {
    console.error("[upload] archive upsert:", dbError.message);
    return NextResponse.json({ error: "Database error — please try again." }, { status: 500 });
  }

  return NextResponse.json({ day, place, image_url: publicUrlData.publicUrl });
}
