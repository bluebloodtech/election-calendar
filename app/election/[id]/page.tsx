import { notFound } from "next/navigation";
import { TopTabs } from "@/components/TopTabs";
import { CalendarGrid } from "@/components/CalendarGrid";
import { getSupabaseServerClient, ELECTIONS_TABLE } from "@/lib/supabase-server";
import type { Election } from "@/lib/types";

export default async function ElectionCalendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from(ELECTIONS_TABLE)
    .select("id, name, leader, price, volume, status, location, created_at")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const election = data as Election;

  return (
    // "apple-calendar" (app/globals.css) swaps the dark master-table theme
    // for a clean white one, scoped to just this page, per the client's
    // reference screenshot (Apple Calendar look).
    <main className="apple-calendar flex min-h-screen flex-col items-center px-4 py-10 sm:px-8">
      <div className="mb-8 w-full max-w-5xl">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-gold">
          Election Nightclub
        </p>
        <h1 className="mt-1 font-display text-xl uppercase tracking-wide text-text">
          {election.name}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Drop a Kalshi screenshot on any day — the AI reads the standing and files it.
        </p>
        <div className="mt-4">
          <TopTabs electionId={election.id} electionName={election.name} />
        </div>
      </div>
      <CalendarGrid electionId={election.id} />
    </main>
  );
}
