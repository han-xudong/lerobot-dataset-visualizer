"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type {
  EpisodeFrameInfo,
  EpisodeFramesData,
} from "@/app/[org]/[dataset]/[episode]/fetch-data";
import { useFlaggedEpisodes } from "@/context/flagged-episodes-context";

const PAGE_SIZE = 48;

function FrameThumbnail({
  info,
  showLast,
}: {
  info: EpisodeFrameInfo;
  showLast: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !inView) return;

    const seek = () => {
      if (showLast) {
        video.currentTime =
          info.lastFrameTime ?? Math.max(0, video.duration - 0.05);
      } else {
        video.currentTime = info.firstFrameTime;
      }
    };

    if (video.readyState >= 1) {
      seek();
    } else {
      video.addEventListener("loadedmetadata", seek, { once: true });
      return () => video.removeEventListener("loadedmetadata", seek);
    }
  }, [inView, showLast, info]);

  const { has, toggle } = useFlaggedEpisodes();
  const isFlagged = has(info.episodeIndex);

  return (
    <div ref={containerRef} className="flex flex-col items-center">
      <div className="glass-panel relative w-full overflow-hidden rounded-[22px] aspect-video group">
        {inView ? (
          <video
            ref={videoRef}
            src={info.videoUrl}
            preload="metadata"
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full animate-pulse bg-slate-700" />
        )}
        <button
          onClick={() => toggle(info.episodeIndex)}
          className={`brand-focus-ring absolute right-2 top-2 rounded-full p-1.5 transition-all ${
            isFlagged
              ? "brand-control-button-active opacity-100"
              : "brand-control-button opacity-0 group-hover:opacity-100"
          }`}
          title={isFlagged ? "Unflag episode" : "Flag episode"}
          aria-label={isFlagged ? "Unflag episode" : "Flag episode"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill={isFlagged ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        </button>
      </div>
      <p
        className={`mt-2 text-xs tabular-nums ${isFlagged ? "text-ink-strong" : "text-ink-soft"}`}
      >
        ep {info.episodeIndex}
        {isFlagged ? " ⚑" : ""}
      </p>
    </div>
  );
}

interface OverviewPanelProps {
  data: EpisodeFramesData | null;
  loading: boolean;
  flaggedOnly?: boolean;
  onFlaggedOnlyChange?: (v: boolean) => void;
}

export default function OverviewPanel({
  data,
  loading,
  flaggedOnly = false,
  onFlaggedOnlyChange,
}: OverviewPanelProps) {
  const { flagged, count: flagCount } = useFlaggedEpisodes();
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [showLast, setShowLast] = useState(false);
  const [page, setPage] = useState(0);

  // Auto-select first camera when data arrives
  useEffect(() => {
    if (data && data.cameras.length > 0 && !selectedCamera) {
      setSelectedCamera(data.cameras[0]);
    }
  }, [data, selectedCamera]);

  const handleCameraChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedCamera(e.target.value);
      setPage(0);
    },
    [],
  );

  if (loading || !data) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-12 justify-center">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        Loading episode frames…
      </div>
    );
  }

  const allFrames = data.framesByCamera[selectedCamera] ?? [];
  const frames = flaggedOnly
    ? allFrames.filter((f) => flagged.has(f.episodeIndex))
    : allFrames;

  if (frames.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <p className="text-slate-500 italic">
          {flaggedOnly
            ? "No flagged episodes to show."
            : "No episode frames available."}
        </p>
        {flaggedOnly && onFlaggedOnlyChange && (
          <button
            onClick={() => onFlaggedOnlyChange(false)}
            className="text-ink-muted text-xs underline transition-colors hover:text-white"
          >
            Show all episodes
          </button>
        )}
      </div>
    );
  }

  const totalPages = Math.ceil(frames.length / PAGE_SIZE);
  const pageFrames = frames.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl space-y-5 py-2">
      <p className="glass-chip text-ink-muted rounded-2xl px-4 py-3 text-sm">
        Use first/last frame views to spot episodes with bad end states or other
        anomalies. Hover over a thumbnail and click the flag icon to mark
        episodes with wrong outcomes for review.
      </p>

      {/* Controls row */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-5">
          {/* Camera selector */}
          {data.cameras.length > 1 && (
            <select
              value={selectedCamera}
              onChange={handleCameraChange}
              title="Select camera"
              className="brand-focus-ring brand-control-button rounded-full px-3 py-1.5 text-sm"
            >
              {data.cameras.map((cam) => (
                <option key={cam} value={cam}>
                  {cam}
                </option>
              ))}
            </select>
          )}

          {/* Flagged only toggle */}
          {flagCount > 0 && onFlaggedOnlyChange && (
            <button
              onClick={() => {
                onFlaggedOnlyChange(!flaggedOnly);
                setPage(0);
              }}
              className={`brand-focus-ring rounded-full px-2.5 py-1 text-xs transition-colors flex items-center gap-1.5 ${
                flaggedOnly
                  ? "brand-control-button-active"
                  : "brand-control-button"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill={flaggedOnly ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
              Flagged only ({flagCount})
            </button>
          )}

          {/* First / Last toggle */}
          <div className="flex items-center gap-3">
            <span
              className={`text-sm ${!showLast ? "text-slate-100 font-medium" : "text-slate-500"}`}
            >
              First Frame
            </span>
            <button
              onClick={() => setShowLast((v) => !v)}
              className={`brand-focus-ring relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${showLast ? "brand-toggle-track-active" : "brand-toggle-track"}`}
              aria-label="Toggle first/last frame"
            >
              <span
                className={`inline-block w-3.5 h-3.5 bg-white rounded-full transition-transform ${showLast ? "translate-x-[18px]" : "translate-x-[3px]"}`}
              />
            </button>
            <span
              className={`text-sm ${showLast ? "text-slate-100 font-medium" : "text-slate-500"}`}
            >
              Last Frame
            </span>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="brand-focus-ring brand-control-button rounded-full px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ← Prev
            </button>
            <span className="tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page === totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="brand-focus-ring brand-control-button rounded-full px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Adaptive grid — only current page's thumbnails are mounted */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
      >
        {pageFrames.map((info) => (
          <FrameThumbnail
            key={`${selectedCamera}-${info.episodeIndex}`}
            info={info}
            showLast={showLast}
          />
        ))}
      </div>
    </div>
  );
}
