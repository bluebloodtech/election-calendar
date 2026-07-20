"use client";

import type { Place } from "@/lib/types";

const OPTIONS: { value: Place; label: string }[] = [
  { value: "first", label: "1st Place" },
  { value: "second", label: "2nd Place" },
  { value: "third", label: "3rd Place" },
];

export function PlaceToggle({
  value,
  onChange,
}: {
  value: Place;
  onChange: (place: Place) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Viewing placement"
      className="inline-flex items-center rounded-full border border-line bg-panel p-1 text-sm font-medium font-display uppercase tracking-wide"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`focus-ring rounded-full px-4 py-1.5 transition-colors ${
            value === opt.value
              ? "bg-gold text-ink"
              : "text-text-muted hover:text-text"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
