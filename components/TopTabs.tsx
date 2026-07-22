import Link from "next/link";

/**
 * Persistent Master Table / Calendar / Map tabs, per the client's mockup —
 * shown on both the command center and the per-election calendar so you can
 * jump between the three views without hunting for a back link.
 *
 * The Map tab is a plain external link (electionnightclub.com/map/, a
 * different app on a different domain) — it can't be a client-side tab.
 */
export function TopTabs({
  electionId,
  electionName,
}: {
  electionId?: string;
  electionName?: string;
}) {
  const active = electionId ? "calendar" : "master";
  const mapHref = electionName
    ? `https://electionnightclub.com/map/?candidate=${encodeURIComponent(electionName)}`
    : "https://electionnightclub.com/map/";

  const base =
    "focus-ring rounded-full px-4 py-1.5 font-display text-xs uppercase tracking-wide transition-colors";
  const activeClass = "bg-gold text-ink";
  const inactiveClass = "text-text-muted hover:text-text";
  const disabledClass = "text-text-muted/40 cursor-not-allowed";

  return (
    <div className="mb-6 inline-flex items-center gap-1 rounded-full border border-line bg-panel p-1">
      <Link href="/" className={`${base} ${active === "master" ? activeClass : inactiveClass}`}>
        Master Table
      </Link>
      {electionId ? (
        <Link
          href={`/election/${electionId}`}
          className={`${base} ${active === "calendar" ? activeClass : inactiveClass}`}
        >
          Calendar
        </Link>
      ) : (
        <span
          className={`${base} ${disabledClass}`}
          title="Open a market's calendar from the Master Table first"
        >
          Calendar
        </span>
      )}
      <a href={mapHref} target="_blank" rel="noopener noreferrer" className={`${base} ${inactiveClass}`}>
        Map
      </a>
    </div>
  );
}
