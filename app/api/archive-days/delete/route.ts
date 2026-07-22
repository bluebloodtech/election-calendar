import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseServerClient,
  ARCHIVE_BUCKET,
  ARCHIVE_TABLE,
} from "@/lib/supabase-server";

// DELETE /api/archive-days/delete
// JSON body: { election: uuid, day: "YYYY-MM-DD", place: "first" | "second" | "third" }
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { election, day, place } = body ?? {};

  if (typeof election !== "string" || !election) {
    return NextResponse.json({ error: "Missing 'election'." }, { status: 400 });
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

  const supabase = getSupabaseServerClient();

  // Remove stored screenshots under <election>/<day>/<place>-*
  const folder = `${election}/${day}`;
  const { data: files, error: listError } = await supabase.storage
    .from(ARCHIVE_BUCKET)
    .list(folder);

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const toRemove = (files ?? [])
    .filter((f) => f.name.startsWith(`${place}-`))
    .map((f) => `${folder}/${f.name}`);

  if (toRemove.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(ARCHIVE_BUCKET)
      .remove(toRemove);

    if (removeError) {
      return NextResponse.json({ error: removeError.message }, { status: 500 });
    }
  }

  const { error: dbError } = await supabase
    .from(ARCHIVE_TABLE)
    .delete()
    .eq("election_id", election)
    .eq("day", day)
    .eq("place", place);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
