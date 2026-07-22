import { CalendarGrid } from "@/components/CalendarGrid";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-10 sm:px-8">
      <div className="mb-8 w-full max-w-5xl">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-gold">
          Election Nightclub
        </p>
        <p className="mt-1 text-sm text-text-muted">
          Daily Kalshi screenshot archive — drop a screenshot on any day to file it.
        </p>
        <p className="mt-1 text-xs text-text-muted/60">
          test deploy {new Date().toISOString().slice(0, 10)}
        </p>
      </div>
      <CalendarGrid />
    </main>
  );
}
