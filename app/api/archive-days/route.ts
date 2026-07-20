import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, ARCHIVE_TABLE } from "@/lib/supabase-server";
import type { ArchiveEntry } from "@/lib/types";

// GET /api/archive-days?month=2026-07
// Returns all archive entries (both places) for the given month.
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month"); // "YYYY-MM"

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "Query param 'month' is required in YYYY-MM format." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const rangeStart = `${month}-01`;
  const [year, m] = month.split("-").map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  const rangeEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from(ARCHIVE_TABLE)
    .select("day, place, image_url, created_at")
    .gte("day", rangeStart)
    .lte("day", rangeEnd)
    .order("day", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data as ArchiveEntry[] });
}
