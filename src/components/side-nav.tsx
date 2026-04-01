"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFlaggedEpisodes } from "@/context/flagged-episodes-context";

import type { DatasetDisplayInfo } from "@/app/[org]/[dataset]/[episode]/fetch-data";

const EPISODE_ROW_HEIGHT_FALLBACK = 32;
const LIST_VERTICAL_GAP = 2;

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

      const availableHeight = Math.max(0, viewport.clientHeight);
      if (availableHeight <= 0) return;

      const maxItems = Math.max(1, displayEpisodes.length);
      const nextPageSize = Math.max(
        1,
        Math.min(
          maxItems,
          Math.floor((availableHeight + LIST_VERTICAL_GAP) / measuredRowHeight),
        ),
      );

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
          className="text-ink grid grid-cols-1 gap-2 text-xs"
        >
          <div className="glass-chip rounded-2xl px-3 py-2">
            <span className="text-ink-faint block text-[0.65rem] uppercase tracking-[0.2em]">
              Frames
            </span>
            <span className="text-ink-strong mt-1 block text-base font-semibold tabular-nums">
              {datasetInfo.total_frames.toLocaleString()}
            </span>
          </div>
          <div className="glass-chip rounded-2xl px-3 py-2">
            <span className="text-ink-faint block text-[0.65rem] uppercase tracking-[0.2em]">
              Episodes
            </span>
            <span className="text-ink-strong mt-1 block text-base font-semibold tabular-nums">
              {datasetInfo.total_episodes.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-ink-strong text-sm font-semibold">Episodes</p>
          {count > 0 && (
            <button
              onClick={() => onShowFlaggedOnlyChange(!showFlaggedOnly)}
              className={`brand-focus-ring text-xs px-2 py-1 rounded-full transition-colors ${
                showFlaggedOnly ? "brand-pill-active" : "brand-pill-ghost"
              }`}
            >
              Flagged ({count})
            </button>
          )}
        </div>

        <div
          ref={rangeRef}
          className="text-ink-faint mt-4 flex items-center justify-between gap-2 text-[0.7rem] uppercase tracking-[0.22em]"
        >
          <span>
            {pageEpisodes.length > 0
              ? `${pageStartEpisode}-${pageEndEpisode}`
              : "No episodes"}
          </span>
          <span className="text-ink-soft font-mono">
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
                      className={`brand-focus-ring rounded-full px-2 py-1 text-left cursor-pointer transition-colors ${episode === episodeId ? "brand-pill-active font-bold" : "brand-pill-ghost border-transparent"}`}
                    >
                      Episode {episode}
                    </button>
                  ) : (
                    <Link
                      href={`./episode_${episode}`}
                      className={`brand-focus-ring rounded-full px-2 py-1 transition-colors ${episode === episodeId ? "brand-pill-active font-bold" : "brand-pill-ghost border-transparent"}`}
                    >
                      Episode {episode}
                    </Link>
                  )}
                  <button
                    onClick={() => toggle(episode)}
                    className={`brand-focus-ring text-xs leading-none px-1 py-0.5 rounded transition-colors ${
                      flagged.has(episode)
                        ? "text-white hover:text-white/85"
                        : "text-ink-faint hover:text-white/70"
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
            <div className="text-ink-soft flex items-center justify-between text-xs">
              <span className="font-mono">
                Page {currentPage} / {totalPages}
              </span>
              <span className="font-mono">Fit {pageSize}</span>
            </div>
            <div className="mt-2 flex items-center text-xs">
              <button
                onClick={prevPage}
                className={`brand-focus-ring brand-control-button mr-2 rounded-full px-3 py-1.5 ${
                  currentPage === 1 ? "cursor-not-allowed opacity-50" : ""
                }`}
                disabled={currentPage === 1}
              >
                « Prev
              </button>
              <button
                onClick={nextPage}
                className={`brand-focus-ring brand-control-button rounded-full px-3 py-1.5 ${
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
        className="brand-focus-ring brand-sidebar-handle mx-2 flex items-center rounded-full px-2 py-3 opacity-70 transition-opacity hover:opacity-100 md:hidden"
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
