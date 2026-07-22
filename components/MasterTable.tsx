"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MAX_ELECTIONS, type Election } from "@/lib/types";

// Main marketing site's Election Intelligence Map (Ghost theme, routes.yaml
// maps "/map/" -> custom-election-map). Kept as one shared page rather than
// building a second map per election, per the client's direction.
const MAP_URL = "https://electionnightclub.com/map/";

export function MasterTable() {
  const [elections, setElections] = useState<Election[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  // Suggested names pulled from the Zoho-backed candidate list the Election
  // Intelligence Map already tracks — lets the client add a race in one
  // click instead of retyping a name that's already tracked elsewhere.
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    (async () => {
      try {
        const res = await fetch("/api/elections");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load elections.");
        setElections(json.elections);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load elections.");
      } finally {
        setLoading(false);
      }
    })();

    // Best-effort — if this fails, the add form still works via typing.
    fetch("/api/candidates")
      .then((res) => res.json())
      .then((json) => setSuggestions(json.candidates ?? []))
      .catch(() => {});
  }, []);

  const handleAdd = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/elections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add election.");
      setElections((prev) => [...prev, json.election]);
      setNewName("");
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add election.");
    } finally {
      setAdding(false);
    }
  }, []);

  // Suggestions already added shouldn't be offered again.
  const trackedNames = useMemo(
    () => new Set(elections.map((e) => e.name)),
    [elections]
  );
  const availableSuggestions = suggestions.filter((s) => !trackedNames.has(s));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return elections;
    return elections.filter(
      (e) =>
        e.name.toLowerCase().includes(q) || e.leader.toLowerCase().includes(q)
    );
  }, [elections, search]);

  const activeCount = elections.filter((e) => e.status === "Active").length;
  const atCap = elections.length >= MAX_ELECTIONS;

  return (
    <div className="w-full max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl uppercase tracking-wide text-text">
          Master Command Center
        </h1>
        <button
          type="button"
          disabled={atCap}
          onClick={() => setShowAddForm((v) => !v)}
          title={atCap ? `Limit of ${MAX_ELECTIONS} elections reached` : undefined}
          className="focus-ring rounded border border-gold-dim bg-panel px-4 py-2 font-display text-sm uppercase tracking-wide text-gold hover:border-gold disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Add New Election
        </button>
      </header>

      {showAddForm && (
        <div className="mb-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd(newName);
            }}
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Market name, e.g. US Senate Race - AZ"
              className="focus-ring flex-1 rounded border border-line bg-panel px-3 py-2 text-sm text-text placeholder:text-text-muted"
            />
            <button
              type="submit"
              disabled={adding || !newName.trim()}
              className="focus-ring rounded bg-gold px-4 py-2 font-display text-sm uppercase tracking-wide text-ink disabled:opacity-50"
            >
              {adding ? "Adding…" : "Add"}
            </button>
          </form>

          {availableSuggestions.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-text-muted">
                Or add a tracked candidate from the map:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {availableSuggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    disabled={adding}
                    onClick={() => handleAdd(name)}
                    className="focus-ring rounded-full border border-line px-3 py-1 text-xs text-text-muted hover:border-gold-dim hover:text-gold disabled:opacity-50"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search/Filter Markets..."
          className="focus-ring w-full max-w-xs rounded border border-line bg-panel px-3 py-2 text-sm text-text placeholder:text-text-muted"
        />
        <span className="font-mono text-sm text-text-muted">
          Active Markets: {activeCount} / {MAX_ELECTIONS}
        </span>
      </div>

      {error && (
        <p className="mb-4 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-md border border-line bg-panel">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-center font-display text-xs uppercase tracking-widest text-text-muted">
              <th className="px-4 py-3">Market Name</th>
              <th className="px-4 py-3">Leader (1st)</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Volume</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-muted">
                  {elections.length === 0
                    ? "No elections yet — add your first market above."
                    : "No markets match your search."}
                </td>
              </tr>
            )}
            {filtered.map((e, i) => (
              <tr
                key={e.id}
                className="border-b border-line/50 last:border-b-0 hover:bg-panel-raised"
              >
                <td className="px-4 py-3 text-text">
                  <span className="mr-2 font-mono text-xs text-text-muted">
                    {i + 1}.
                  </span>
                  {e.name}
                </td>
                <td className="px-4 py-3 text-center text-gold">{e.leader || "—"}</td>
                <td className="px-4 py-3 text-center font-mono">{e.price || "—"}</td>
                <td className="px-4 py-3 text-center font-mono">{e.volume || "—"}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      e.status === "Active"
                        ? "bg-streak/15 text-streak"
                        : "bg-line/40 text-text-muted"
                    }`}
                  >
                    {e.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                    <Link
                      href={`/election/${e.id}`}
                      className="focus-ring rounded border border-line px-3 py-1 font-display text-xs uppercase tracking-wide text-text-muted hover:border-gold-dim hover:text-gold"
                    >
                      View Cal
                    </Link>
                    {/* The Election Intelligence Map already lives on the
                        main Ghost site (electionnightclub.com/map/) — link
                        out to it in a new tab instead of duplicating it
                        here, per the client's instruction to reuse it. */}
                    <a
                      href={MAP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring rounded border border-line px-3 py-1 font-display text-xs uppercase tracking-wide text-text-muted hover:border-steel-dim hover:text-steel"
                    >
                      View Map
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
