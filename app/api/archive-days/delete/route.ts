import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseServerClient,
  ARCHIVE_BUCKET,
  ARCHIVE_TABLE,
} from "@/lib/supabase-server";
import { isIsoDate, isUuid } from "@/lib/validate";

// DELETE /api/archive-days/delete
// JSON body: { election: uuid, day: "YYYY-MM-DD", place: "first" | "second" | "third" }
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { election, day, place } = body ?? {};

  // election/day both become a Storage path prefix below — validate the
  // format strictly, not just presence.
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

  const supabase = getSupabaseServerClient();

  // Remove stored screenshots under <election>/<day>/<place>-*
  const folder = `${election}/${day}`;
  const { data: files, error: listError } = await supabase.storage
    .from(ARCHIVE_BUCKET)
    .list(folder);

  if (listError) {
    console.error("[archive-days/delete] storage list:", listError.message);
    return NextResponse.json({ error: "Storage error — please try again." }, { status: 500 });
  }

  const toRemove = (files ?? [])
    .filter((f) => f.name.startsWith(`${place}-`))
    .map((f) => `${folder}/${f.name}`);

  if (toRemove.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(ARCHIVE_BUCKET)
      .remove(toRemove);

    if (removeError) {
      console.error("[archive-days/delete] storage remove:", removeError.message);
      return NextResponse.json({ error: "Storage error — please try again." }, { status: 500 });
    }
  }

  const { error: dbError } = await supabase
    .from(ARCHIVE_TABLE)
    .delete()
    .eq("election_id", election)
    .eq("day", day)
    .eq("place", place);

  if (dbError) {
    console.error("[archive-days/delete] db delete:", dbError.message);
    return NextResponse.json({ error: "Database error — please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
