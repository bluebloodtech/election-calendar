import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseServerClient,
  ARCHIVE_BUCKET,
  ARCHIVE_TABLE,
} from "@/lib/supabase-server";

// DELETE /api/archive-days/delete
// JSON body: { day: "YYYY-MM-DD", place: "first" | "second_third" }
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { day, place } = body ?? {};

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

  const supabase = getSupabaseServerClient();

  // List all files under day/place-* prefix and remove them from Storage
  const prefix = `${day}/${place}-`;
  const { data: files, error: listError } = await supabase.storage
    .from(ARCHIVE_BUCKET)
    .list(day);

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const toRemove = (files ?? [])
    .filter((f) => f.name.startsWith(`${place}-`))
    .map((f) => `${day}/${f.name}`);

  if (toRemove.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(ARCHIVE_BUCKET)
      .remove(toRemove);

    if (removeError) {
      return NextResponse.json({ error: removeError.message }, { status: 500 });
    }
  }

  // Delete the database record
  const { error: dbError } = await supabase
    .from(ARCHIVE_TABLE)
    .delete()
    .eq("day", day)
    .eq("place", place);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
