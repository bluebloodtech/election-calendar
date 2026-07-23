/**
 * Tiny shared input-validation helpers for the API routes.
 *
 * Why this exists: every ID, date, and URL in this app arrives from the
 * browser and goes straight into Supabase queries / Storage paths. The
 * query builder parameterizes values (so classic SQL injection isn't a
 * concern), but an invalid UUID or date string still reaches Postgres,
 * fails the type cast, and surfaces as an ugly 500 — and in the upload
 * route an unvalidated election ID was used as a Storage path prefix
 * BEFORE the DB ever saw it. Validating at the door turns all of that
 * into clean 400s and keeps junk out of the bucket.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const ISO_MONTH_RE = /^\d{4}-\d{2}$/;

/** Postgres-compatible UUID (any version). */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** "YYYY-MM-DD" and actually a real calendar date (rejects 2026-02-31). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** "YYYY-MM" with a sane month. */
export function isIsoMonth(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_MONTH_RE.test(value)) return false;
  const m = Number(value.slice(5, 7));
  return m >= 1 && m <= 12;
}

/** http(s) URL only — blocks javascript:, data:, file:, etc. */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Trimmed string capped at maxLen; empty string if input isn't a string. */
export function cleanString(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}
