"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFlaggedEpisodes } from "@/context/flagged-episodes-context";

import type { DatasetDisplayInfo } from "@/app/[org]/[dataset]/[episode]/fetch-data";

const EPISODE_ROW_HEIGHT_FALLBACK = 32;
const LIST_VERTICAL_GAP = 2;
const NAV_VERTICAL_BUFFER = 24;

interface SidebarProps {
  datasetInfo: DatasetDisplayInfo;
  episodes: number[];
  episodeId: number;
  showFlaggedOnly: boolean;
  onShowFlaggedOnlyChange: (v: boolean) => void;
  onEpisodeSelect?: (ep: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  datasetInfo,
  episodes,
  episodeId,
  showFlaggedOnly,
  onShowFlaggedOnlyChange,
  onEpisodeSelect,
}) => {
  const [mobileVisible, setMobileVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(1);
  const { flagged, count, toggle } = useFlaggedEpisodes();
  const navRef = useRef<HTMLElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const rangeRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const listViewportRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const displayEpisodes = useMemo(() => {
    if (!showFlaggedOnly || count === 0) return episodes;
    return [...flagged].sort((a, b) => a - b);
  }, [episodes, showFlaggedOnly, flagged, count]);

  useEffect(() => {
    let animationFrameId = 0;
    const viewport = listViewportRef.current;
    const nav = navRef.current;
    if (!viewport || !nav) return;

    const recomputePageSize = () => {
      const firstListItem = listRef.current?.querySelector("li");
      const measuredRowHeight = firstListItem
        ? Math.ceil(firstListItem.getBoundingClientRect().height) +
          LIST_VERTICAL_GAP
        : EPISODE_ROW_HEIGHT_FALLBACK;

      const occupiedHeight =
        (headerRef.current?.offsetHeight ?? 0) +
        (rangeRef.current?.offsetHeight ?? 0) +
        (footerRef.current?.offsetHeight ?? 0) +
        NAV_VERTICAL_BUFFER;

      const availableHeight = Math.max(0, nav.clientHeight - occupiedHeight);
      if (availableHeight <= 0) return;

      const maxItems = Math.max(1, displayEpisodes.length);
      let nextPageSize = 1;

      for (let itemCount = 1; itemCount <= maxItems; itemCount += 1) {
        if (itemCount * measuredRowHeight > availableHeight) {
          break;
        }
        nextPageSize = itemCount;
      }

      setPageSize((prev) => (prev === nextPageSize ? prev : nextPageSize));
    };

    animationFrameId = window.requestAnimationFrame(recomputePageSize);

    const observer = new ResizeObserver(recomputePageSize);
    observer.observe(nav);
    observer.observe(viewport);
    if (headerRef.current) observer.observe(headerRef.current);
    if (rangeRef.current) observer.observe(rangeRef.current);
    if (footerRef.current) observer.observe(footerRef.current);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      observer.disconnect();
    };
  }, [displayEpisodes.length, mobileVisible]);

  useEffect(() => {
    const selectedEpisodeIndex = displayEpisodes.indexOf(episodeId);
    if (selectedEpisodeIndex !== -1) {
      const nextPage = Math.floor(selectedEpisodeIndex / pageSize) + 1;
      setCurrentPage((prev) => (prev === nextPage ? prev : nextPage));
      return;
    }

    setCurrentPage(1);
  }, [displayEpisodes, episodeId, pageSize]);

  const totalPages = Math.max(1, Math.ceil(displayEpisodes.length / pageSize));

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const pageStartIndex = (currentPage - 1) * pageSize;
  const pageEpisodes = displayEpisodes.slice(
    pageStartIndex,
    pageStartIndex + pageSize,
  );
  const pageStartEpisode = pageEpisodes[0];
  const pageEndEpisode = pageEpisodes[pageEpisodes.length - 1];

  const nextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const prevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  return (
    <div className="z-10 flex min-h-0 shrink-0 self-stretch">
      <nav
        ref={navRef}
        className={`glass-panel-strong shrink-0 self-stretch min-h-0 break-words w-64 overflow-hidden rounded-[28px] p-5 ${
          mobileVisible ? "block" : "hidden"
        } md:flex md:flex-col`}
        aria-label="Sidebar navigation"
      >
        <div
          ref={headerRef}
          className="grid grid-cols-1 gap-2 text-xs text-white/80"
        >
          <div className="glass-chip rounded-2xl px-3 py-2">
            <span className="block uppercase tracking-[0.2em] text-[0.65rem] text-white/40">
              Frames
            </span>
            <span className="mt-1 block text-base font-semibold tabular-nums text-white">
              {datasetInfo.total_frames.toLocaleString()}
            </span>
          </div>
          <div className="glass-chip rounded-2xl px-3 py-2">
            <span className="block uppercase tracking-[0.2em] text-[0.65rem] text-white/40">
              Episodes
            </span>
            <span className="mt-1 block text-base font-semibold tabular-nums text-white">
              {datasetInfo.total_episodes.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Episodes</p>
          {count > 0 && (
            <button
              onClick={() => onShowFlaggedOnlyChange(!showFlaggedOnly)}
              className={`brand-focus-ring text-xs px-2 py-1 rounded-full transition-colors ${
                showFlaggedOnly
                  ? "bg-white/14 text-white border border-white/24"
                  : "glass-chip text-white/55 hover:text-white"
              }`}
            >
              Flagged ({count})
            </button>
          )}
        </div>

        <div
          ref={rangeRef}
          className="mt-4 flex items-center justify-between gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-white/38"
        >
          <span>
            {pageEpisodes.length > 0
              ? `${pageStartEpisode}-${pageEndEpisode}`
              : "No episodes"}
          </span>
          <span className="font-mono text-white/56">
            {pageEpisodes.length}/{displayEpisodes.length}
          </span>
        </div>

        <div
          ref={listViewportRef}
          className="mt-3 min-h-0 flex-1 overflow-hidden"
        >
          <div className="flex h-full flex-col justify-start">
            <ul ref={listRef} className="space-y-0.5">
              {pageEpisodes.map((episode) => (
                <li
                  key={episode}
                  className="font-mono text-sm flex items-center gap-1"
                >
                  {onEpisodeSelect ? (
                    <button
                      onClick={() => onEpisodeSelect(episode)}
                      className={`brand-focus-ring rounded-full px-2 py-1 text-left cursor-pointer transition-colors ${episode === episodeId ? "bg-white/12 font-bold text-white border border-white/18" : "text-white/70 hover:bg-white/6 hover:text-white"}`}
                    >
                      Episode {episode}
                    </button>
                  ) : (
                    <Link
                      href={`./episode_${episode}`}
                      className={`brand-focus-ring rounded-full px-2 py-1 transition-colors ${episode === episodeId ? "bg-white/12 font-bold text-white border border-white/18" : "text-white/70 hover:bg-white/6 hover:text-white"}`}
                    >
                      Episode {episode}
                    </Link>
                  )}
                  <button
                    onClick={() => toggle(episode)}
                    className={`brand-focus-ring text-xs leading-none px-1 py-0.5 rounded transition-colors ${
                      flagged.has(episode)
                        ? "text-white hover:text-white/85"
                        : "text-white/30 hover:text-white/70"
                    }`}
                    title={flagged.has(episode) ? "Unflag" : "Flag"}
                    aria-label={
                      flagged.has(episode) ? "Unflag episode" : "Flag episode"
                    }
                  >
                    ⚑
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {totalPages > 1 && (
          <div ref={footerRef} className="mt-3 border-t border-white/8 pt-3">
            <div className="flex items-center justify-between text-xs text-white/55">
              <span className="font-mono">
                Page {currentPage} / {totalPages}
              </span>
              <span className="font-mono">Fit {pageSize}</span>
            </div>
            <div className="mt-2 flex items-center text-xs">
              <button
                onClick={prevPage}
                className={`brand-focus-ring mr-2 rounded-full px-3 py-1.5 glass-chip ${
                  currentPage === 1 ? "cursor-not-allowed opacity-50" : ""
                }`}
                disabled={currentPage === 1}
              >
                « Prev
              </button>
              <button
                onClick={nextPage}
                className={`brand-focus-ring rounded-full px-3 py-1.5 glass-chip ${
                  currentPage === totalPages
                    ? "cursor-not-allowed opacity-50"
                    : ""
                }`}
                disabled={currentPage === totalPages}
              >
                Next »
              </button>
            </div>
          </div>
        )}
      </nav>

      <button
        className="brand-focus-ring mx-2 flex items-center rounded-full bg-white/8 px-2 py-3 opacity-70 hover:opacity-100 md:hidden"
        onClick={() => setMobileVisible((prev) => !prev)}
        title="Toggle sidebar"
        aria-label="Toggle episode sidebar"
      >
        <div className="h-10 w-2 rounded-full bg-gradient-to-b from-white to-zinc-500" />
      </button>
    </div>
  );
};

export default Sidebar;
