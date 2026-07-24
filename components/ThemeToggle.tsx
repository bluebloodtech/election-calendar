"use client";

import { useState, useEffect } from "react";

// Switches between the dark master theme and a light "Apple Calendar"
// style theme by toggling a CSS class on <body> (the actual color values
// live in app/globals.css). The choice is remembered in localStorage so
// it persists across page loads/visits.
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
    if (isLight) {
      document.body.classList.add("apple-calendar");
    } else {
      document.body.classList.remove("apple-calendar");
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
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
          <span>Dark Mode</span>
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>
          <span>Light Mode</span>
        </>
      )}
    </button>
  );
}
