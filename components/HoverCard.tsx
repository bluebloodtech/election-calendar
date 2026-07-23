"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * A hover tooltip positioned with `position: fixed` from the trigger's real
 * viewport coordinates (via getBoundingClientRect), instead of `absolute`
 * inside the table. `fixed` elements never contribute to an ancestor's
 * scrollable overflow, so this can't trigger the table's scrollbar to
 * appear/disappear and squeeze the columns the way an absolutely
 * positioned popup nested in a scrolling table container can.
 */
export function HoverCard({
  trigger,
  children,
}: {
  trigger: ReactNode;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const cardWidth = 224; // matches w-56 below
    const left = Math.min(rect.left, window.innerWidth - cardWidth - 8);
    setPos({ top: rect.bottom + 8, left: Math.max(8, left) });
  };

  return (
    <span
      ref={ref}
      className="inline-block"
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
    >
      {trigger}
      {pos && (
        <div
          className="fixed z-50 w-56 rounded border border-line bg-panel p-3 text-left text-xs normal-case tracking-normal text-text shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          {children}
        </div>
      )}
    </span>
  );
}
