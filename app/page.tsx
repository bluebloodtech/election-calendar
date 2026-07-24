import { TopTabs } from "@/components/TopTabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MasterTable } from "@/components/MasterTable";

// Home page ("/") — the Master Command Center. All the actual logic
// (loading elections, add/delete, the AI drop zone) lives inside
// MasterTable; this file just lays out the page header around it.
export default function Home() {
  return (
    <main id="calendar-main" className="flex min-h-screen flex-col items-center px-4 py-10 sm:px-8">
      <div className="mb-8 w-full max-w-5xl relative">
        <div className="absolute right-0 top-0">
          <ThemeToggle />
        </div>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-gold">
          Election Nightclub
        </p>
        <p className="mt-1 text-sm text-text-muted">
          Master command center — every tracked market at a glance.
        </p>
      </div>
      <div className="w-full max-w-5xl">
        <TopTabs />
      </div>
      <MasterTable />
    </main>
  );
}
