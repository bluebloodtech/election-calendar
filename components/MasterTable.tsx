"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { HoverCard } from "@/components/HoverCard";
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
  const [newLocation, setNewLocation] = useState("");
  const [newElectionDate, setNewElectionDate] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [mapPick, setMapPick] = useState("");
  const dropInputRef = useRef<HTMLInputElement>(null);

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
        body: JSON.stringify({
          name,
          location: newLocation.trim(),
          election_date: newElectionDate || null,
          image_url: newImageUrl.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add election.");
      setElections((prev) => [...prev, json.election]);
      setNewName("");
      setNewLocation("");
      setNewElectionDate("");
      setNewImageUrl("");
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add election.");
    } finally {
      setAdding(false);
    }
  }, [newName, newLocation, newElectionDate, newImageUrl]);

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

  // Command Center's own drop zone: reads a whole new market (name + leader
  // + price + volume) off one screenshot via AI vision, instead of typing
  // the name and filling in the calendar separately.
  const handleIngestScreenshot = useCallback(async (file: File) => {
    setIngesting(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/elections/from-screenshot", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to ingest screenshot.");
      setElections((prev) => [...prev, json.election]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ingest screenshot.");
    } finally {
      setIngesting(false);
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
          className="mb-4 flex flex-wrap gap-2"
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
            className="focus-ring min-w-[220px] flex-1 rounded border border-line bg-panel px-3 py-2 text-sm text-text placeholder:text-text-muted"
          />
          <input
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            placeholder="Location / address (optional)"
            className="focus-ring min-w-[180px] flex-1 rounded border border-line bg-panel px-3 py-2 text-sm text-text placeholder:text-text-muted"
          />
          <input
            type="date"
            value={newElectionDate}
            onChange={(e) => setNewElectionDate(e.target.value)}
            title="Election end date (optional) — the row auto-deletes once this date passes"
            className="focus-ring rounded border border-line bg-panel px-3 py-2 text-sm text-text placeholder:text-text-muted"
          />
          <input
            value={newImageUrl}
            onChange={(e) => setNewImageUrl(e.target.value)}
            placeholder="Candidate image URL (optional)"
            className="focus-ring min-w-[180px] flex-1 rounded border border-line bg-panel px-3 py-2 text-sm text-text placeholder:text-text-muted"
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

      {/* Pick a market -> jump straight to its pin on the Map, auto-selected
          via the same ?candidate= param "View Map" uses per row. The
          dropdown's options come from `elections` (already in state from
          the fetch above) — no extra Supabase call needed. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded border border-line bg-panel px-3 py-2">
        <label htmlFor="map-pick" className="font-display text-xs uppercase tracking-wide text-text-muted">
          Open on Map:
        </label>
        <select
          id="map-pick"
          value={mapPick}
          onChange={(e) => setMapPick(e.target.value)}
          disabled={elections.length === 0}
          className="focus-ring min-w-[200px] flex-1 rounded border border-line bg-panel-raised px-3 py-1.5 text-sm text-text disabled:opacity-50"
        >
          <option value="">Select a candidate…</option>
          {elections.map((e) => (
            <option key={e.id} value={e.name}>
              {e.name}
            </option>
          ))}
        </select>
        <a
          href={mapPick ? mapUrlFor(mapPick) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!mapPick}
          onClick={(e) => {
            if (!mapPick) e.preventDefault();
          }}
          className={`focus-ring rounded px-4 py-1.5 font-display text-xs uppercase tracking-wide ${
            mapPick
              ? "bg-steel text-ink hover:opacity-90"
              : "cursor-not-allowed bg-line/40 text-text-muted"
          }`}
        >
          Go to Map
        </a>
      </div>

      {error && (
        <p className="mb-4 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-md border border-line bg-panel shadow-lg shadow-black/5">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-center font-display text-xs uppercase tracking-widest text-text-muted">
              <th className="px-4 py-3">Market Name</th>
              <th className="px-4 py-3">Leader (1st)</th>
              <th className="px-4 py-3">Tier / Status</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3 hidden md:table-cell">Volume</th>
              <th className="px-4 py-3 hidden md:table-cell">Location / Address</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-text-muted">
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
                  {/* Hover card: candidate image + runner-up names, so the
                      row itself stays a single clean line ("keep the rows
                      clean" per the client) instead of adding columns.
                      HoverCard uses position:fixed (real viewport coords),
                      not absolute-inside-the-table, so it can never trigger
                      the table's scrollbar and squeeze the columns. */}
                  {e.image_url || e.standings ? (
                    <HoverCard
                      trigger={
                        <>
                          <span className="mr-2 font-mono text-xs text-text-muted">
                            {i + 1}.
                          </span>
                          {e.name}
                        </>
                      }
                    >
                      {e.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external candidate photo URLs, not worth Next/Image domain config for a hover card
                        <img
                          src={e.image_url}
                          alt={e.name}
                          className="mb-2 h-20 w-full rounded object-cover"
                        />
                      )}
                      {e.standings && (e.standings.second || e.standings.third) ? (
                        <ul className="space-y-0.5 text-text-muted">
                          {e.standings.second && (
                            <li>
                              <span className="text-steel">2nd:</span> {e.standings.second}
                            </li>
                          )}
                          {e.standings.third && (
                            <li>
                              <span className="text-steel">3rd:</span> {e.standings.third}
                            </li>
                          )}
                        </ul>
                      ) : (
                        !e.image_url && <p className="text-text-muted">No runner-up data yet.</p>
                      )}
                    </HoverCard>
                  ) : (
                    <>
                      <span className="mr-2 font-mono text-xs text-text-muted">
                        {i + 1}.
                      </span>
                      {e.name}
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-gold">{e.leader || <span className="text-text-muted/30">—</span>}</td>
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
                <td className="px-4 py-3 text-center font-mono">{e.price || <span className="text-text-muted/30">—</span>}</td>
                <td className="px-4 py-3 text-center font-mono hidden md:table-cell">{e.volume || <span className="text-text-muted/30">—</span>}</td>
                <td className="px-4 py-3 text-center hidden md:table-cell">{e.location || <span className="text-text-muted/30">—</span>}</td>
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
                    {/* Hover card: election end date + candidate image,
                        so you know what you're about to delete before
                        clicking. Same fixed-position HoverCard as above. */}
                    {e.image_url || e.election_date ? (
                      <HoverCard
                        trigger={
                          <button
                            type="button"
                            disabled={deletingId === e.id}
                            onClick={() => handleDelete(e.id, e.name)}
                            title="Delete this election"
                            className="focus-ring rounded border border-line px-3 py-1 font-display text-xs uppercase tracking-wide text-text-muted hover:border-red-800 hover:text-red-400 disabled:opacity-50"
                          >
                            {deletingId === e.id ? "Deleting…" : "Delete"}
                          </button>
                        }
                      >
                        {e.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element -- arbitrary external candidate photo URLs, not worth Next/Image domain config for a hover card
                          <img
                            src={e.image_url}
                            alt={e.name}
                            className="mb-2 h-16 w-full rounded object-cover"
                          />
                        )}
                        {e.election_date && (
                          <p className="text-text-muted">
                            Ends: <span className="text-text">{e.election_date}</span>
                          </p>
                        )}
                      </HoverCard>
                    ) : (
                      <button
                        type="button"
                        disabled={deletingId === e.id}
                        onClick={() => handleDelete(e.id, e.name)}
                        title="Delete this election"
                        className="focus-ring rounded border border-line px-3 py-1 font-display text-xs uppercase tracking-wide text-text-muted hover:border-red-800 hover:text-red-400 disabled:opacity-50"
                      >
                        {deletingId === e.id ? "Deleting…" : "Delete"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Command Center-level ingest: drop a market-overview screenshot
            here to auto-create a new row via AI vision, instead of typing
            the name and filling in the calendar separately. */}
        <div
          className={`m-3 flex flex-col items-center justify-center gap-1 rounded border border-dashed px-4 py-4 text-center transition-colors ${
            isDragging
              ? "border-gold bg-panel-raised"
              : "border-line-bright text-text-muted hover:border-gold-dim hover:text-text"
          } ${atCap ? "pointer-events-none opacity-40" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleIngestScreenshot(file);
          }}
        >
          <input
            ref={dropInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleIngestScreenshot(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => dropInputRef.current?.click()}
            disabled={ingesting || atCap}
            className="focus-ring text-xs uppercase tracking-wide"
          >
            {ingesting
              ? "Reading screenshot…"
              : "Drag & Drop Screenshot Here to Auto-Populate & Ingest Data via AI Vision"}
          </button>
        </div>
      </div>
    </div>
  );
}
