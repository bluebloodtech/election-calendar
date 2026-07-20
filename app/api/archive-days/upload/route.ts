import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseServerClient,
  ARCHIVE_BUCKET,
  ARCHIVE_TABLE,
} from "@/lib/supabase-server";

const ALLOWED_TYPES = ["image/png", "image/jpeg"];
const MAX_BYTES = 4 * 1024 * 1024; // 4MB — Vercel Hobby caps request bodies at 4.5MB

// POST /api/archive-days/upload
// FormData: file (PNG/JPG), day ("YYYY-MM-DD"), place ("first" | "second_third")
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const day = form.get("day");
  const place = form.get("place");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
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
  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${day}/${place}-${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(ARCHIVE_BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage
    .from(ARCHIVE_BUCKET)
    .getPublicUrl(path);

  const { error: dbError } = await supabase
    .from(ARCHIVE_TABLE)
    .upsert(
      {
        day,
        place,
        image_url: publicUrlData.publicUrl,
      },
      { onConflict: "day,place" }
    );

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({
    day,
    place,
    image_url: publicUrlData.publicUrl,
  });
}
