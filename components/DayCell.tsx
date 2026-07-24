"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import type { ArchiveEntry, Place } from "@/lib/types";

interface DayCellProps {
  electionId: string;
  dateISO: string; // "YYYY-MM-DD"
  dayNumber: number;
  place: Place;
  entry?: ArchiveEntry;
  isToday: boolean;
  isCurrentMonth: boolean;
  onUploaded: (dateISO: string, place: Place, imageUrl: string) => void;
  onDeleted: (dateISO: string, place: Place) => void;
}

export function DayCell({
  electionId,
  dateISO,
  dayNumber,
  place,
  entry,
  isToday,
  isCurrentMonth,
  onUploaded,
  onDeleted,
}: DayCellProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Spec color coding: gold = 1st place standings, steel blue = 2nd/3rd.
  const isFirst = place === "first";
  const filledBorder = isFirst ? "border-gold-dim" : "border-steel-dim";
  const accentText = isFirst ? "text-gold" : "text-steel";
  const imageUrl = entry?.image_url;

  const doUpload = useCallback(
    async (file: File) => {
      setErrorMsg(null);
      setIsUploading(true);
      try {
        const body = new FormData();
        body.append("file", file);
        body.append("election", electionId);
        body.append("day", dateISO);
        body.append("place", place);

        const res = await fetch("/api/archive-days/upload", {
          method: "POST",
          body,
        });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Upload failed.");
        }
        onUploaded(dateISO, place, json.image_url);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setIsUploading(false);
      }
    },
    [electionId, dateISO, place, onUploaded]
  );

  const doDelete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setErrorMsg(null);
      setIsDeleting(true);
      try {
        const res = await fetch("/api/archive-days/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ election: electionId, day: dateISO, place }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Delete failed.");
        onDeleted(dateISO, place);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Delete failed.");
      } finally {
        setIsDeleting(false);
      }
    },
    [electionId, dateISO, place, onDeleted]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) doUpload(file);
    },
    [doUpload]
  );

  return (
    <div
      className={`focus-ring group relative flex aspect-square flex-col overflow-hidden rounded-md border transition-colors ${
        isDragging
          ? "border-gold bg-panel-raised"
          : imageUrl
            ? `${filledBorder} bg-panel`
            : "border-line bg-panel hover:border-line-bright"
      } ${!isCurrentMonth ? "opacity-40" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between px-2 pt-1.5">
        <span
          className={`font-mono text-xs ${
            isToday ? "rounded bg-gold px-1 text-ink" : "text-text-muted"
          }`}
        >
          {String(dayNumber).padStart(2, "0")}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) doUpload(file);
          e.target.value = "";
        }}
      />

      {imageUrl ? (
        <div className="focus-ring relative mx-1.5 mb-1.5 mt-1 flex-1 overflow-hidden rounded">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 h-full w-full"
            title="Click to replace this screenshot"
          />
          <Image
            src={imageUrl}
            alt={`Screenshot — ${dateISO} — ${place} place`}
            fill
            sizes="140px"
            className="object-cover transition-transform group-hover:scale-105"
          />
          {/* Fixed dark overlay (not theme-linked) so "Replace" stays readable
              over a photo in both the dark master theme and the light
              Apple-Calendar theme used on the per-election page. */}
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 text-[10px] font-medium uppercase tracking-wide text-transparent transition-colors group-hover:bg-black/55 group-hover:text-white">
            Replace
          </span>
          {/* Delete button */}
          <button
            type="button"
            onClick={doDelete}
            disabled={isDeleting}
            title="Delete screenshot"
            className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-600/80 text-[10px] text-white opacity-0 transition-opacity hover:bg-red-500 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? "·" : "×"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="focus-ring mx-1.5 mb-1.5 mt-1 flex flex-1 flex-col items-center justify-center gap-1 rounded border border-dashed border-line-bright text-text-muted transition-colors hover:border-gold-dim hover:text-text disabled:opacity-50"
        >
          <span className="text-lg leading-none">{isUploading ? "···" : "+"}</span>
          <span className="text-[10px] uppercase tracking-wide">
            {isUploading ? "Uploading…" : "Drop"}
          </span>
        </button>
      )}

      {errorMsg && (
        <p className="px-1.5 pb-1 text-[9px] leading-tight text-red-400">{errorMsg}</p>
      )}
    </div>
  );
}
