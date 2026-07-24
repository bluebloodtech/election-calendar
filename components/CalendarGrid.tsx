"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DayCell } from "./DayCell";
import { PlaceToggle } from "./PlaceToggle";
import type { ArchiveEntry, Place } from "@/lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toISODate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function CalendarGrid({ electionId }: { electionId: string }) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [place, setPlace] = useState<Place>("first");
  const [entries, setEntries] = useState<Record<string, ArchiveEntry>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const loadMonth = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const monthParam = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    try {
      const res = await fetch(
        `/api/archive-days?election=${electionId}&month=${monthParam}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load archive.");
      const map: Record<string, ArchiveEntry> = {};
      for (const entry of json.entries as ArchiveEntry[]) {
        map[`${entry.day}__${entry.place}`] = entry;
      }
      setEntries(map);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load archive.");
    } finally {
      setLoading(false);
    }
  }, [viewYear, viewMonth, electionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount/param-change pattern
    loadMonth();
  }, [loadMonth]);

  const handleUploaded = useCallback(
    (dateISO: string, uploadedPlace: Place, imageUrl: string) => {
      setEntries((prev) => ({
        ...prev,
        [`${dateISO}__${uploadedPlace}`]: {
          day: dateISO,
          place: uploadedPlace,
          image_url: imageUrl,
          created_at: new Date().toISOString(),
        },
      }));
    },
    []
  );

  const handleDeleted = useCallback(
    (dateISO: string, deletedPlace: Place) => {
      setEntries((prev) => {
        const next = { ...prev };
        delete next[`${dateISO}__${deletedPlace}`];
        return next;
      });
    },
    []
  );

  const goToMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const cells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startOffset = firstOfMonth.getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const list: { dateISO: string; dayNumber: number; inMonth: boolean }[] = [];

    for (let i = startOffset - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prev = new Date(viewYear, viewMonth - 1, d);
      list.push({
        dateISO: toISODate(prev.getFullYear(), prev.getMonth(), d),
        dayNumber: d,
        inMonth: false,
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({ dateISO: toISODate(viewYear, viewMonth, d), dayNumber: d, inMonth: true });
    }
    const remainder = (7 - (list.length % 7)) % 7;
    for (let d = 1; d <= remainder; d++) {
      const next = new Date(viewYear, viewMonth + 1, d);
      list.push({
        dateISO: toISODate(next.getFullYear(), next.getMonth(), d),
        dayNumber: d,
        inMonth: false,
      });
    }
    return list;
  }, [viewYear, viewMonth]);

  const todayISO = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="w-full max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            aria-label="Previous month"
            className="focus-ring flex h-8 w-8 items-center justify-center rounded border border-line text-text-muted hover:border-line-bright hover:text-text"
          >
            ‹
          </button>
          <h1 className="font-display text-2xl uppercase tracking-wide text-text">
            {monthLabel}
          </h1>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            aria-label="Next month"
            className="focus-ring flex h-8 w-8 items-center justify-center rounded border border-line text-text-muted hover:border-line-bright hover:text-text"
          >
            ›
          </button>
        </div>
        <PlaceToggle value={place} onChange={setPlace} />
      </header>

      {loadError && (
        <p className="mb-4 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {loadError}
        </p>
      )}

      <div className="mb-2 grid grid-cols-7 gap-2">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="text-center font-display text-xs uppercase tracking-widest text-text-muted"
          >
            {wd}
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-7 gap-2 ${loading ? "opacity-50" : ""}`}>
        {cells.map((cell) => (
          <DayCell
            key={cell.dateISO}
            electionId={electionId}
            dateISO={cell.dateISO}
            dayNumber={cell.dayNumber}
            place={place}
            entry={entries[`${cell.dateISO}__${place}`]}
            isToday={cell.dateISO === todayISO}
            isCurrentMonth={cell.inMonth}
            onUploaded={handleUploaded}
            onDeleted={handleDeleted}
          />
        ))}
      </div>
    </div>
  );
}
