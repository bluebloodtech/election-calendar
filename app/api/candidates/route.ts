import { NextResponse } from "next/server";
import { fetchActiveCandidateNames } from "@/lib/tracked-candidates";

// GET /api/candidates — kept for the "Add" form's suggestion chips
// (candidates already auto-synced into the elections table won't appear
// here, since the caller filters those out). See lib/tracked-candidates.ts
// for where this list actually comes from.
export async function GET() {
  const candidates = await fetchActiveCandidateNames();
  return NextResponse.json({ candidates });
}
