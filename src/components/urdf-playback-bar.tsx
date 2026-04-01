"use client";

import React from "react";

interface UrdfPlaybackBarProps {
  frame: number;
  totalFrames: number;
  fps: number;
  playing: boolean;
  onPlayPause: () => void;
  trailEnabled: boolean;
  onTrailToggle: () => void;
  onFrameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function UrdfPlaybackBar({
  frame,
  totalFrames,
  fps,
  playing,
  onPlayPause,
  trailEnabled,
  onTrailToggle,
  onFrameChange,
}: UrdfPlaybackBarProps) {
  const currentTime = totalFrames > 0 ? (frame / fps).toFixed(2) : "0.00";
  const totalTime = (totalFrames / fps).toFixed(2);

  return (
    <div className="flex items-center gap-3">
      {/* Play/Pause */}
      <button
        onClick={onPlayPause}
        className="brand-focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-white to-zinc-300 text-black transition-colors shadow-[0_10px_30px_rgba(255,255,255,0.12)] hover:from-zinc-100 hover:to-zinc-300"
      >
        {playing ? (
          <svg width="12" height="14" viewBox="0 0 12 14">
            <rect x="1" y="1" width="3" height="12" fill="white" />
            <rect x="8" y="1" width="3" height="12" fill="white" />
          </svg>
        ) : (
          <svg width="12" height="14" viewBox="0 0 12 14">
            <polygon points="2,1 11,7 2,13" fill="white" />
          </svg>
        )}
      </button>

      {/* Trail toggle */}
      <button
        onClick={onTrailToggle}
        className={`brand-focus-ring h-8 shrink-0 rounded-full px-3 text-xs transition-colors ${
          trailEnabled
            ? "border border-white/20 bg-white/14 text-white"
            : "glass-chip text-white/55"
        }`}
        title={trailEnabled ? "Hide trail" : "Show trail"}
      >
        Trail
      </button>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={Math.max(totalFrames - 1, 0)}
        value={frame}
        onChange={onFrameChange}
        title="URDF timeline"
        aria-label="URDF timeline"
        className="brand-focus-ring h-1.5 flex-1 cursor-pointer accent-white"
      />
      <span className="w-28 shrink-0 text-right text-xs tabular-nums text-white/70">
        {currentTime}s / {totalTime}s
      </span>
      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-white/40">
        F {frame}/{Math.max(totalFrames - 1, 0)}
      </span>

      {/* Keyboard hints */}
      <div className="ml-2 hidden shrink-0 select-none flex-col gap-y-0.5 text-xs text-white/45 md:flex">
        <p>
          <span className="glass-chip rounded-full px-1.5 py-0.5 text-xs text-white/70">
            Space
          </span>{" "}
          pause/unpause
        </p>
        <p>
          <span className="font-mono">↑/↓</span> prev/next episode
        </p>
      </div>
    </div>
  );
}
