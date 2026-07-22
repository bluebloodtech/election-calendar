"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MAX_ELECTIONS, type Election } from "@/lib/types";

// Main marketing site's Election Intelligence Map (Ghost theme, routes.yaml
// maps "/map/" -> custom-election-map). Kept as one shared page rather than
// building a second map per election, per the client's direction.
//
// The ?candidate= param only does something once the matching snippet is
// pasted into partials/custom-election-map.hbs on the theme side (this repo
// can't deploy that site) — see the map-deep-link note in the README.
// Until then it's a harmless no-op query param.
function mapUrlFor(electionName: string) {
  return `https://electionnightclub.com/map/?candidate=${encodeURIComponent(electionName)}`;
}

export function MasterTable() {
  const [elections, setElections] = useState<Election[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
  }, []);

  // Manual add only — no auto-import from any external source, by design.
  const handleAdd = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/elections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
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
  }, [newName]);

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This also removes its calendar screenshots.`)) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch("/api/elections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete election.");
      setElections((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete election.");
    } finally {
      setDeletingId(null);
    }
  }, []);

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
        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
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
                      href={mapUrlFor(e.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring rounded border border-line px-3 py-1 font-display text-xs uppercase tracking-wide text-text-muted hover:border-steel-dim hover:text-steel"
                    >
                      View Map
                    </a>
                    <button
                      type="button"
                      disabled={deletingId === e.id}
                      onClick={() => handleDelete(e.id, e.name)}
                      title="Delete this election"
                      className="focus-ring rounded border border-line px-3 py-1 font-display text-xs uppercase tracking-wide text-text-muted hover:border-red-800 hover:text-red-400 disabled:opacity-50"
                    >
                      {deletingId === e.id ? "Deleting…" : "Delete"}
                    </button>
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
