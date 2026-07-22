import { MasterTable } from "@/components/MasterTable";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-10 sm:px-8">
      <div className="mb-8 w-full max-w-5xl">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-gold">
          Election Nightclub
        </p>
        <p className="mt-1 text-sm text-text-muted">
          Master command center — every tracked market at a glance.
        </p>
      </div>
      <MasterTable />
    </main>
  );
}
