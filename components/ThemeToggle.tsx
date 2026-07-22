"use client";

import { useState, useEffect } from "react";

export function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    // Check initial state from localStorage, default to dark
    const stored = localStorage.getItem("calendar-theme");
    if (stored === "light") {
      setIsLight(true);
    }
  }, []);

  useEffect(() => {
    const mainEl = document.getElementById("calendar-main");
    if (mainEl) {
      if (isLight) {
        mainEl.classList.add("apple-calendar");
      } else {
        mainEl.classList.remove("apple-calendar");
      }
    }
    localStorage.setItem("calendar-theme", isLight ? "light" : "dark");
  }, [isLight]);

  return (
    <button
      onClick={() => setIsLight(!isLight)}
      className="text-xs font-mono px-3 py-1.5 border border-line-bright text-text-muted rounded-md hover:bg-panel-raised transition-colors flex items-center gap-2"
    >
      {isLight ? (
        <>
          <span>🌙</span>
          <span>Dark Mode</span>
        </>
      ) : (
        <>
          <span>☀️</span>
          <span>Light Mode</span>
        </>
      )}
    </button>
  );
}
