import { NextResponse } from "next/server";

// Temporary diagnostic route — reports only whether specific env vars are
// present (never their values), to debug why MAP_WORKER_URL /
// MAP_ADD_ADMIN_KEY aren't reaching the deployed function. Delete this
// file once the mystery is solved.
export async function GET() {
  return NextResponse.json({
    hasMapWorkerUrl: !!process.env.MAP_WORKER_URL,
    hasMapAddAdminKey: !!process.env.MAP_ADD_ADMIN_KEY,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    vercelEnv: process.env.VERCEL_ENV || null,
    nodeEnv: process.env.NODE_ENV || null,
  });
}
