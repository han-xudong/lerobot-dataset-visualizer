"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useFlaggedEpisodes } from "@/context/flagged-episodes-context";
import { getDatasetDisplayName, isLocalDatasetId } from "@/utils/datasetSource";
import type {
  CrossEpisodeVarianceData,
  LowMovementEpisode,
  EpisodeLengthStats,
  EpisodeLengthInfo,
} from "@/app/[org]/[dataset]/[episode]/fetch-data";
import {
  ActionVelocitySection,
  FullscreenWrapper,
} from "@/components/action-insights-panel";

// ─── Shared small components ─────────────────────────────────────

function FlagBtn({ id }: { id: number }) {
  const { has, toggle } = useFlaggedEpisodes();
  const flagged = has(id);
  return (
    <button
      onClick={() => toggle(id)}
      title={flagged ? "Unflag episode" : "Flag for review"}
      className={`brand-focus-ring rounded-full p-1 transition-colors ${flagged ? "brand-control-button-active" : "brand-control-button"}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill={flagged ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    </button>
  );
}

function FlagAllBtn({ ids, label }: { ids: number[]; label?: string }) {
  const { addMany } = useFlaggedEpisodes();
  return (
    <button
      onClick={() => addMany(ids)}
      className="brand-focus-ring brand-control-button rounded-full px-2.5 py-1 text-xs transition-colors flex items-center gap-1"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
      {label ?? "Flag all"}
    </button>
  );
}

// ─── Lowest-Movement Episodes ────────────────────────────────────

function LowMovementSection({ episodes }: { episodes: LowMovementEpisode[] }) {
  if (episodes.length === 0) return null;
  const maxMovement = Math.max(...episodes.map((e) => e.totalMovement), 1e-10);

  return (
    <div className="glass-panel rounded-[28px] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">
          Lowest-Movement Episodes
        </h3>
        <FlagAllBtn ids={episodes.map((e) => e.episodeIndex)} />
      </div>
      <p className="text-ink-muted text-xs">
        Episodes with the lowest average action change per frame. Very low
        values may indicate the robot was standing still or the episode was
        recorded incorrectly.
      </p>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
      >
        {episodes.map((ep) => (
          <div
            key={ep.episodeIndex}
            className="glass-chip rounded-2xl px-3 py-2 flex items-center gap-3"
          >
            <FlagBtn id={ep.episodeIndex} />
            <span className="text-ink shrink-0 text-xs font-medium">
              ep {ep.episodeIndex}
            </span>
            <div className="flex-1 min-w-0">
              <div className="brand-progress-track h-1.5 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, (ep.totalMovement / maxMovement) * 100)}%`,
                    background:
                      ep.totalMovement / maxMovement < 0.15
                        ? "#ef4444"
                        : ep.totalMovement / maxMovement < 0.4
                          ? "#eab308"
                          : "#22c55e",
                  }}
                />
              </div>
            </div>
            <span className="text-ink-faint shrink-0 text-xs tabular-nums">
              {ep.totalMovement.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Episode Length Filter ────────────────────────────────────────

function EpisodeLengthFilter({ episodes }: { episodes: EpisodeLengthInfo[] }) {
  const { addMany } = useFlaggedEpisodes();
  const globalMin = useMemo(
    () => Math.min(...episodes.map((e) => e.lengthSeconds)),
    [episodes],
  );
  const globalMax = useMemo(
    () => Math.max(...episodes.map((e) => e.lengthSeconds)),
    [episodes],
  );

  const [rangeMin, setRangeMin] = useState(globalMin);
  const [rangeMax, setRangeMax] = useState(globalMax);

  const outsideIds = useMemo(
    () =>
      episodes
        .filter((e) => e.lengthSeconds < rangeMin || e.lengthSeconds > rangeMax)
        .map((e) => e.episodeIndex)
        .sort((a, b) => a - b),
    [episodes, rangeMin, rangeMax],
  );

  const rangeChanged = rangeMin > globalMin || rangeMax < globalMax;
  const step =
    Math.max(0.01, Math.round((globalMax - globalMin) * 0.001 * 100) / 100) ||
    0.01;

  return (
    <div className="glass-panel rounded-[28px] p-5 space-y-4">
      <h3 className="text-sm font-semibold text-white">
        Episode Length Filter
      </h3>

      <div className="space-y-2">
        <div className="text-ink-soft flex items-center justify-between text-xs">
          <span className="tabular-nums">{rangeMin.toFixed(1)}s</span>
          <span className="tabular-nums">{rangeMax.toFixed(1)}s</span>
        </div>
        <div className="relative h-5">
          <div className="brand-progress-track absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 rounded" />
          <div
            className="brand-scrubber-fill absolute top-1/2 -translate-y-1/2 h-1 rounded"
            style={{
              left: `${((rangeMin - globalMin) / (globalMax - globalMin || 1)) * 100}%`,
              right: `${100 - ((rangeMax - globalMin) / (globalMax - globalMin || 1)) * 100}%`,
            }}
          />
          <input
            type="range"
            min={globalMin}
            max={globalMax}
            step={step}
            value={rangeMin}
            title="Minimum duration filter"
            aria-label="Minimum duration filter"
            onChange={(e) =>
              setRangeMin(Math.min(Number(e.target.value), rangeMax))
            }
            className="brand-scrubber-dual absolute inset-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto"
          />
          <input
            type="range"
            min={globalMin}
            max={globalMax}
            step={step}
            value={rangeMax}
            title="Maximum duration filter"
            aria-label="Maximum duration filter"
            onChange={(e) =>
              setRangeMax(Math.max(Number(e.target.value), rangeMin))
            }
            className="brand-scrubber-dual absolute inset-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto"
          />
        </div>
      </div>

      {rangeChanged && (
        <div className="flex items-center justify-between">
          <span className="text-ink-soft text-xs">
            {outsideIds.length} episode{outsideIds.length !== 1 ? "s" : ""}{" "}
            outside range
          </span>
          {outsideIds.length > 0 && (
            <button
              onClick={() => addMany(outsideIds)}
              className="brand-focus-ring brand-control-button-active rounded-full px-2.5 py-1 text-xs transition-colors"
            >
              Flag {outsideIds.length} outside range
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Filtering Panel ────────────────────────────────────────

interface FilteringPanelProps {
  repoId: string;
  crossEpisodeData: CrossEpisodeVarianceData | null;
  crossEpisodeLoading: boolean;
  episodeLengthStats: EpisodeLengthStats | null;
  flatChartData: Record<string, number>[];
  onViewFlaggedEpisodes?: () => void;
}

function FlaggedIdsCopyBar({
  repoId,
  onViewEpisodes,
}: {
  repoId: string;
  onViewEpisodes?: () => void;
}) {
  const { flagged, count, clear } = useFlaggedEpisodes();
  const [copied, setCopied] = useState(false);

  const ids = useMemo(() => [...flagged].sort((a, b) => a - b), [flagged]);
  const idStr = ids.join(", ");
  const isLocalDataset = isLocalDatasetId(repoId);
  const displayName = getDatasetDisplayName(repoId);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(idStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [idStr]);

  const deleteEpisodesCommand = [
    "# Delete episodes (modifies original dataset)",
    "lerobot-edit-dataset \\",
    "    --repo_id " + repoId + " \\",
    "    --operation.type delete_episodes \\",
    `    --operation.episode_indices \"[${ids.join(", ")}]\"`,
  ].join("\n");

  const deleteAndSaveCommand = [
    "# Delete episodes and save to a new dataset (preserves original)",
    "lerobot-edit-dataset \\",
    "    --repo_id " + repoId + " \\",
    "    --new_repo_id " + repoId + "_filtered \\",
    "    --operation.type delete_episodes \\",
    `    --operation.episode_indices \"[${ids.join(", ")}]\"`,
  ].join("\n");

  if (count === 0) return null;

  return (
    <div className="glass-panel-strong rounded-[28px] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">
          Flagged Episodes
          <span className="text-xs text-slate-500 ml-2 font-normal">
            ({count})
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
            title="Copy IDs"
          >
            {copied ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-green-400"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
            Copy
          </button>
          <button
            onClick={clear}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-300 tabular-nums leading-relaxed max-h-20 overflow-y-auto">
        {idStr}
      </p>
      {onViewEpisodes && (
        <button
          onClick={onViewEpisodes}
          className="w-full text-xs py-1.5 rounded bg-slate-700/80 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-1.5"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
          View flagged episodes
        </button>
      )}
      <div className="glass-chip rounded-2xl px-3 py-2 space-y-2.5">
        {isLocalDataset ? (
          <>
            <p className="text-xs text-slate-400">Local dataset directory:</p>
            <pre className="text-xs text-slate-300 bg-slate-950/50 rounded px-2 py-1.5 overflow-x-auto select-all">
              {displayName}
            </pre>
            <pre className="text-xs text-slate-300 bg-slate-950/50 rounded px-2 py-1.5 overflow-x-auto select-all">{`# Episode indices selected for removal from the local dataset\n[${ids.join(", ")}]`}</pre>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-400">
              <a
                href="https://github.com/huggingface/lerobot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline"
              >
                LeRobot CLI
              </a>{" "}
              — delete flagged episodes:
            </p>
            <pre className="text-xs text-slate-300 bg-slate-950/50 rounded px-2 py-1.5 overflow-x-auto select-all">
              {deleteEpisodesCommand}
            </pre>
            <pre className="text-xs text-slate-300 bg-slate-950/50 rounded px-2 py-1.5 overflow-x-auto select-all">
              {deleteAndSaveCommand}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

function FilteringPanel({
  repoId,
  crossEpisodeData,
  crossEpisodeLoading,
  episodeLengthStats,
  flatChartData,
  onViewFlaggedEpisodes,
}: FilteringPanelProps) {
  return (
    <div className="max-w-5xl mx-auto py-6 space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Filtering</h2>
        <p className="text-sm text-slate-400 mt-1">
          Identify and flag problematic episodes for removal. Flagged episodes
          appear in the sidebar and can be exported as a CLI command.
        </p>
      </div>

      <FlaggedIdsCopyBar
        repoId={repoId}
        onViewEpisodes={onViewFlaggedEpisodes}
      />

      {episodeLengthStats?.allEpisodeLengths && (
        <EpisodeLengthFilter episodes={episodeLengthStats.allEpisodeLengths} />
      )}

      {crossEpisodeLoading && (
        <div className="glass-panel rounded-[28px] p-5">
          <div className="flex items-center gap-2 text-slate-400 text-sm py-4 justify-center">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
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
            Loading cross-episode data…
          </div>
        </div>
      )}

      {crossEpisodeData?.lowMovementEpisodes && (
        <LowMovementSection episodes={crossEpisodeData.lowMovementEpisodes} />
      )}

      <FullscreenWrapper>
        <ActionVelocitySection
          data={flatChartData}
          agg={crossEpisodeData?.aggVelocity}
          numEpisodes={crossEpisodeData?.numEpisodes}
          jerkyEpisodes={crossEpisodeData?.jerkyEpisodes}
        />
      </FullscreenWrapper>
    </div>
  );
}

export default FilteringPanel;
