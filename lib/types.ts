export type Place = "first" | "second" | "third";

export interface ArchiveEntry {
  day: string; // "YYYY-MM-DD"
  place: Place;
  image_url: string;
  created_at: string;
}
