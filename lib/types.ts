export type Place = "first" | "second" | "third";

// No leader/price/volume fields anywhere in this app, by design — the
// client does not want any data derived from a betting/prediction market
// (odds, prices, wagered volume) stored or displayed. Screenshots are
// archived as images only; "place" is just a manual filing category
// (which folder a screenshot goes in), not an AI-read ranking.
export interface ArchiveEntry {
  day: string; // "YYYY-MM-DD"
  place: Place;
  image_url: string;
  created_at: string;
}

export type ElectionStatus = "Active" | "Closed";

export interface Election {
  id: string;
  name: string;
  status: ElectionStatus;
  location: string;
  election_date: string | null; // "YYYY-MM-DD" — the row auto-deletes once this passes
  image_url: string;
  created_at: string;
}

/** Hard cap from the client spec — never track more than 15 markets. */
export const MAX_ELECTIONS = 15;
