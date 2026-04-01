"use client";

import type {
  DatasetDisplayInfo,
  EpisodeLengthStats,
  CameraInfo,
} from "@/app/[org]/[dataset]/[episode]/fetch-data";

interface StatsPanelProps {
  datasetInfo: DatasetDisplayInfo;
  episodeLengthStats: EpisodeLengthStats | null;
  loading: boolean;
}

function formatTotalTime(totalFrames: number, fps: number): string {
  const totalSec = totalFrames / fps;
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** SVG bar chart for the episode-length histogram */
function EpisodeLengthHistogram({
  data,
}: {
  data: { binLabel: string; count: number }[];
}) {
  if (data.length === 0) return null;
  const maxCount = Math.max(...data.map((d) => d.count));
  if (maxCount === 0) return null;

  const totalWidth = 560;
  const gap = Math.max(1, Math.min(3, Math.floor(60 / data.length)));
  const barWidth = Math.max(
    4,
    Math.floor((totalWidth - gap * data.length) / data.length),
  );
  const chartHeight = 150;
  const labelHeight = 30;
  const topPad = 16;
  const svgWidth = data.length * (barWidth + gap);
  const labelStep = Math.max(1, Math.ceil(data.length / 10));

  return (
    <div className="overflow-x-auto">
      <svg
        width={svgWidth}
        height={topPad + chartHeight + labelHeight}
        className="block"
        aria-label="Episode length distribution histogram"
      >
        {data.map((bin, i) => {
          const barH = Math.max(1, (bin.count / maxCount) * chartHeight);
          const x = i * (barWidth + gap);
          const y = topPad + chartHeight - barH;
          return (
            <g key={i}>
              <title>{`${bin.binLabel}: ${bin.count} episode${bin.count !== 1 ? "s" : ""}`}</title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                className="fill-white/80 hover:fill-white transition-colors"
                rx={Math.min(2, barWidth / 4)}
              />
              {bin.count > 0 && barWidth >= 8 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 3}
                  textAnchor="middle"
                  className="fill-white/55"
                  fontSize={Math.min(10, barWidth - 1)}
                >
                  {bin.count}
                </text>
              )}
            </g>
          );
        })}
        {data.map((bin, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === data.length - 1;
          if (!isFirst && !isLast && idx % labelStep !== 0) return null;
          const label = bin.binLabel.split("–")[0];
          return (
            <text
              key={idx}
              x={idx * (barWidth + gap) + barWidth / 2}
              y={topPad + chartHeight + 14}
              textAnchor="middle"
              className="fill-white/55"
              fontSize={9}
            >
              {label}s
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-panel rounded-[24px] p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}

function StatsPanel({
  datasetInfo,
  episodeLengthStats,
  loading,
}: StatsPanelProps) {
  const els = episodeLengthStats;

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-2">
      <div>
        <p className="mb-2 text-[0.72rem] uppercase tracking-[0.28em] text-white/38">
          Dataset Statistics
        </p>
        <h2 className="text-xl text-slate-100 md:text-2xl">
          <span className="font-bold text-white">Dataset Statistics:</span>{" "}
          <span className="font-normal text-white/55">
            {datasetInfo.repoId}
          </span>
        </h2>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card label="Robot Type" value={datasetInfo.robot_type ?? "unknown"} />
        <Card label="Dataset Version" value={datasetInfo.codebase_version} />
        <Card label="Tasks" value={datasetInfo.total_tasks} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          label="Total Frames"
          value={datasetInfo.total_frames.toLocaleString()}
        />
        <Card
          label="Total Episodes"
          value={datasetInfo.total_episodes.toLocaleString()}
        />
        <Card label="FPS" value={datasetInfo.fps} />
        <Card
          label="Total Recording Time"
          value={formatTotalTime(datasetInfo.total_frames, datasetInfo.fps)}
        />
      </div>

      {/* Camera resolutions */}
      {datasetInfo.cameras.length > 0 && (
        <div className="glass-panel rounded-[28px] p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">
            Camera Resolutions
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {datasetInfo.cameras.map((cam: CameraInfo) => (
              <div key={cam.name} className="glass-chip rounded-2xl p-3">
                <p
                  className="mb-1 truncate text-xs text-white/45"
                  title={cam.name}
                >
                  {cam.name}
                </p>
                <p className="text-base font-bold tabular-nums">
                  {cam.width}×{cam.height}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading spinner for async stats */}
      {loading && (
        <div className="flex items-center gap-2 py-4 text-sm text-white/58">
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
          Computing episode statistics…
        </div>
      )}

      {/* Episode length section */}
      {els && (
        <>
          <div className="glass-panel rounded-[28px] p-5">
            <h3 className="mb-4 text-sm font-semibold text-white">
              Episode Lengths
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4 mb-4">
              <Card
                label="Shortest"
                value={`${els.shortestEpisodes[0]?.lengthSeconds ?? "–"}s`}
              />
              <Card
                label="Longest"
                value={`${els.longestEpisodes[els.longestEpisodes.length - 1]?.lengthSeconds ?? "–"}s`}
              />
              <Card label="Mean" value={`${els.meanEpisodeLength}s`} />
              <Card label="Median" value={`${els.medianEpisodeLength}s`} />
              <Card label="Std Dev" value={`${els.stdEpisodeLength}s`} />
            </div>
          </div>

          {els.episodeLengthHistogram.length > 0 && (
            <div className="glass-panel rounded-[28px] p-5">
              <h3 className="mb-4 text-sm font-semibold text-white">
                Episode Length Distribution
                <span className="ml-2 text-xs font-normal text-white/40">
                  {els.episodeLengthHistogram.length} bin
                  {els.episodeLengthHistogram.length !== 1 ? "s" : ""}
                </span>
              </h3>
              <EpisodeLengthHistogram data={els.episodeLengthHistogram} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default StatsPanel;
