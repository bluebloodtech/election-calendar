import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client. Uses the service role key so it can write to
 * Storage and the database directly from API routes without needing RLS
 * policies open to the browser. NEVER import this file from a client
 * component — the service role key must stay server-side.
 */
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export const ARCHIVE_BUCKET = "kalshi-screenshots";
export const ARCHIVE_TABLE = "archive_entries";
