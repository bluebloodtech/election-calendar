// Server-only. Same public, unauthenticated endpoint the Election
// Intelligence Map (electionnightclub.com/map/) already calls on every page
// load to merge in tracked candidates — see mergeCandidatesFromAPI() in
// partials/custom-election-map.hbs in the theme repo. Mirroring that here
// so the Master Command Center auto-populates the same way instead of
// requiring a manual click per market.
const CANDIDATES_URL =
  "https://retire-brazil-proxy.mailroom-335.workers.dev/api/candidates";

interface ZohoCandidate {
  name: string;
  tier: "active" | "modeling" | "watching";
}

/** Names of candidates currently tier "active" in Zoho. Empty array on any failure. */
export async function fetchActiveCandidateNames(): Promise<string[]> {
  try {
    const res = await fetch(CANDIDATES_URL, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { candidates: ZohoCandidate[] };
    return (data.candidates ?? [])
      .filter((c) => c.tier === "active")
      .map((c) => c.name);
  } catch {
    return [];
  }
}
