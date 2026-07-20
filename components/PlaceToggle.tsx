"use client";

import type { Place } from "@/lib/types";

export function PlaceToggle({
  value,
  onChange,
}: {
  value: Place;
  onChange: (place: Place) => void;
}) {
  const isFirst = value === "first";

  return (
    <div
      role="radiogroup"
      aria-label="Viewing placement"
      className="inline-flex items-center rounded-full border border-line bg-panel p-1 text-sm font-medium font-display uppercase tracking-wide"
    >
      <button
        type="button"
        role="radio"
        aria-checked={isFirst}
        onClick={() => onChange("first")}
        className={`focus-ring rounded-full px-4 py-1.5 transition-colors ${
          isFirst ? "bg-gold text-ink" : "text-text-muted hover:text-text"
        }`}
      >
        1st Place
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={!isFirst}
        onClick={() => onChange("second_third")}
        className={`focus-ring rounded-full px-4 py-1.5 transition-colors ${
          !isFirst ? "bg-gold text-ink" : "text-text-muted hover:text-text"
        }`}
      >
        2nd &amp; 3rd Place
      </button>
    </div>
  );
}
