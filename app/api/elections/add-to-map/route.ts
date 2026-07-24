import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, ELECTIONS_TABLE } from "@/lib/supabase-server";
import { isUuid } from "@/lib/validate";

// POST /api/elections/add-to-map
// JSON body: { id: uuid }
//
// Takes a market already tracked in the Command Center and adds it as a
// candidate on the separate Election Intelligence Map (Ghost site, backed
// by Zoho via the retire-brazil-proxy Cloudflare Worker). This is a
// one-way push — nothing about the map is stored here, and nothing about
// betting/prediction-market data is sent; only the plain name, address,
// and election date already on this election's row.
//
// Server-side (not a browser fetch straight to the Worker) so the
// Worker's admin key never touches the browser, and so this app's origin
// doesn't need to be added to the Worker's CORS allowlist.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const id = body?.id;

  if (!isUuid(id)) {
    return NextResponse.json({ error: "Missing or invalid 'id'." }, { status: 400 });
  }

  const workerUrl = process.env.MAP_WORKER_URL;
  const adminKey = process.env.MAP_ADD_ADMIN_KEY;
  if (!workerUrl || !adminKey) {
    return NextResponse.json(
      { error: "Map integration isn't configured (missing MAP_WORKER_URL / MAP_ADD_ADMIN_KEY)." },
      { status: 501 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data: election, error } = await supabase
    .from(ELECTIONS_TABLE)
    .select("id, name, location, election_date")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[add-to-map] lookup:", error.message);
    return NextResponse.json({ error: "Database error — please try again." }, { status: 500 });
  }
  if (!election) {
    return NextResponse.json({ error: "Election not found." }, { status: 404 });
  }

  let workerRes: Response;
  try {
    workerRes = await fetch(`${workerUrl}/api/add-candidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminKey}`,
      },
      body: JSON.stringify({
        name: election.name,
        tier: "watching",
        address: election.location || "",
        keywords: "",
        race: "",
        electionDate: election.election_date || "",
      }),
    });
  } catch (err) {
    console.error("[add-to-map] worker fetch:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not reach the Map service — please try again." }, { status: 502 });
  }

  const workerData = await workerRes.json().catch(() => null);
  if (!workerRes.ok) {
    console.error("[add-to-map] worker error:", workerData);
    return NextResponse.json(
      { error: (workerData && workerData.error) || "Map service rejected the request." },
      { status: 502 }
    );
  }

  return NextResponse.json({ candidate: workerData?.candidate ?? null });
}
