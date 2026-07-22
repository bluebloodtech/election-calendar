export type Place = "first" | "second" | "third";

export interface ArchiveEntry {
  day: string; // "YYYY-MM-DD"
  place: Place;
  image_url: string;
  created_at: string;
  leader: string;
  price: string;
  volume: string;
}

export type ElectionStatus = "Active" | "Closed";

export interface Election {
  id: string;
  name: string;
  leader: string;
  price: string;
  volume: string;
  status: ElectionStatus;
  created_at: string;
}

/** Hard cap from the client spec — never track more than 15 markets. */
export const MAX_ELECTIONS = 15;
