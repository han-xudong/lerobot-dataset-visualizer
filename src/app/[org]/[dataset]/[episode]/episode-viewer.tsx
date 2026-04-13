"use client";

import {
  useState,
  useEffect,
  useRef,
  lazy,
  Suspense,
  useCallback,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FaHome, FaMoon, FaSun } from "react-icons/fa";
import { postParentMessageWithParams } from "@/utils/postParentMessage";
import { SimpleVideosPlayer } from "@/components/simple-videos-player";
import DataRecharts from "@/components/data-recharts";
import PlaybackBar from "@/components/playback-bar";
import { TimeProvider, useTime } from "@/context/time-context";
import { FlaggedEpisodesProvider } from "@/context/flagged-episodes-context";
import Sidebar from "@/components/side-nav";
import StatsPanel from "@/components/stats-panel";
import OverviewPanel from "@/components/overview-panel";
import Loading from "@/components/loading-component";
import { hasURDFSupport } from "@/lib/so101-robot";
import {
  type EpisodeData,
  type ChartRow,
  type ColumnMinMax,
  type EpisodeLengthStats,
  type EpisodeFramesData,
  type CrossEpisodeVarianceData,
} from "./fetch-data";
import {
  buildDatasetId,
  getDatasetDisplayName,
  isLocalDatasetId,
} from "@/utils/datasetSource";
import {
  fetchAdjacentEpisodeVideos,
  fetchCrossEpisodeVariance,
  fetchEpisodeFrames,
  fetchEpisodeLengthStats,
} from "./actions";

const URDFViewer = lazy(() => import("@/components/urdf-viewer"));
const ActionInsightsPanel = lazy(
  () => import("@/components/action-insights-panel"),
);
const FilteringPanel = lazy(() => import("@/components/filtering-panel"));
const THEME_STORAGE_KEY = "episode-viewer-theme";

function resolveInitialTheme(initialTheme: "dark" | "light") {
  if (typeof window === "undefined") {
    return initialTheme;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  if (window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }

  return initialTheme;
}

type ActiveTab =
  | "episodes"
  | "statistics"
  | "frames"
  | "insights"
  | "filtering"
  | "urdf";

export default function EpisodeViewer({
  org,
  dataset,
  episodeId,
  initialTheme,
  initialData,
  initialError,
}: {
  org: string;
  dataset: string;
  episodeId: number;
  initialTheme: "dark" | "light";
  initialData: EpisodeData | null;
  initialError: string | null;
}) {
  const [data, setData] = useState<EpisodeData | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    setData(initialData);
    setError(initialError);
  }, [initialData, initialError, org, dataset, episodeId]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-red-400">
        <div className="max-w-xl p-8 rounded bg-slate-900 border border-red-500 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <p className="text-lg font-mono whitespace-pre-wrap mb-4">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="relative h-screen bg-slate-950">
        <Loading theme={initialTheme} />
      </div>
    );
  }

  return (
    <TimeProvider duration={data!.duration}>
      <FlaggedEpisodesProvider>
        <EpisodeViewerInner
          data={data!}
          org={org}
          dataset={dataset}
          initialTheme={initialTheme}
        />
      </FlaggedEpisodesProvider>
    </TimeProvider>
  );
}

function EpisodeViewerInner({
  data,
  org,
  dataset,
  initialTheme,
}: {
  data: EpisodeData;
  org?: string;
  dataset?: string;
  initialTheme: "dark" | "light";
}) {
  const {
    datasetInfo,
    episodeId,
    currentEpisodeFrames,
    videosInfo,
    chartDataGroups,
    episodes,
    task,
  } = data;
  const visibleEpisodeFrameCount =
    currentEpisodeFrames ??
    Math.max(0, Math.round(data.duration * datasetInfo.fps));

  const [videosReady, setVideosReady] = useState(!videosInfo.length);
  const [chartsReady, setChartsReady] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    resolveInitialTheme(initialTheme),
  );

  const loadStartRef = useRef(performance.now());

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.cookie = `${THEME_STORAGE_KEY}=${theme}; path=/; max-age=31536000; samesite=lax`;
  }, [theme]);

  // Tab state & lazy stats
  const [activeTab, setActiveTab] = useState<ActiveTab>("episodes");
  const isLoading = activeTab === "episodes" && (!videosReady || !chartsReady);

  useEffect(() => {
    if (!isLoading) {
      console.log(
        `[perf] Loading complete in ${(performance.now() - loadStartRef.current).toFixed(0)}ms (videos: ${videosReady ? "✓" : "…"}, charts: ${chartsReady ? "✓" : "…"})`,
      );
    }
  }, [isLoading, videosReady, chartsReady]);
  const [, setColumnMinMax] = useState<ColumnMinMax[] | null>(null);
  const [episodeLengthStats, setEpisodeLengthStats] =
    useState<EpisodeLengthStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const statsLoadedRef = useRef(false);
  const [episodeFramesData, setEpisodeFramesData] =
    useState<EpisodeFramesData | null>(null);
  const [framesLoading, setFramesLoading] = useState(false);
  const framesLoadedRef = useRef(false);
  const [framesFlaggedOnly, setFramesFlaggedOnly] = useState(false);
  const [sidebarFlaggedOnly, setSidebarFlaggedOnly] = useState(false);
  const [crossEpData, setCrossEpData] =
    useState<CrossEpisodeVarianceData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const insightsLoadedRef = useRef(false);
  const mountedRef = useRef(true);
  const datasetId = org && dataset ? buildDatasetId(org, dataset) : null;

  const computeColumnMinMax = useCallback(
    (chartDataGroups: ChartRow[][]): ColumnMinMax[] => {
      const stats: Record<string, { min: number; max: number }> = {};

      for (const group of chartDataGroups) {
        for (const row of group) {
          for (const [key, value] of Object.entries(row)) {
            if (key === "timestamp") continue;

            if (typeof value === "number" && Number.isFinite(value)) {
              if (!stats[key]) {
                stats[key] = { min: value, max: value };
              } else {
                if (value < stats[key].min) stats[key].min = value;
                if (value > stats[key].max) stats[key].max = value;
              }
              continue;
            }

            if (typeof value === "object" && value !== null) {
              for (const [subKey, subVal] of Object.entries(value)) {
                const fullKey = `${key} | ${subKey}`;
                if (typeof subVal !== "number" || !Number.isFinite(subVal)) {
                  continue;
                }
                if (!stats[fullKey]) {
                  stats[fullKey] = { min: subVal, max: subVal };
                } else {
                  if (subVal < stats[fullKey].min) stats[fullKey].min = subVal;
                  if (subVal > stats[fullKey].max) stats[fullKey].max = subVal;
                }
              }
            }
          }
        }
      }

      return Object.entries(stats).map(([column, { min, max }]) => ({
        column,
        min: Math.round(min * 1000) / 1000,
        max: Math.round(max * 1000) / 1000,
      }));
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    statsLoadedRef.current = false;
    framesLoadedRef.current = false;
    insightsLoadedRef.current = false;
    setEpisodeLengthStats(null);
    setEpisodeFramesData(null);
    setCrossEpData(null);
  }, [datasetInfo.repoId]);

  // Eagerly load the URDFViewer bundle + warm the STL geometry cache while
  // the user is on the Episodes tab, so the 3D Replay tab opens faster.
  useEffect(() => {
    if (
      hasURDFSupport(datasetInfo.robot_type) &&
      datasetInfo.codebase_version >= "v3.0"
    ) {
      void import("@/components/urdf-viewer");
    }
  }, [datasetInfo.robot_type, datasetInfo.codebase_version]);

  // Hydrate UI state from sessionStorage after mount (avoids SSR/client mismatch)
  useEffect(() => {
    const stored = sessionStorage.getItem("activeTab");
    if (
      stored &&
      [
        "episodes",
        "statistics",
        "frames",
        "insights",
        "filtering",
        "urdf",
      ].includes(stored)
    ) {
      setActiveTab(stored as ActiveTab);
    }
    if (sessionStorage.getItem("framesFlaggedOnly") === "true")
      setFramesFlaggedOnly(true);
    if (sessionStorage.getItem("sidebarFlaggedOnly") === "true")
      setSidebarFlaggedOnly(true);
  }, []);

  // Persist UI state across episode navigations
  useEffect(() => {
    sessionStorage.setItem("activeTab", activeTab);
  }, [activeTab]);
  useEffect(() => {
    sessionStorage.setItem("sidebarFlaggedOnly", String(sidebarFlaggedOnly));
  }, [sidebarFlaggedOnly]);
  useEffect(() => {
    sessionStorage.setItem("framesFlaggedOnly", String(framesFlaggedOnly));
  }, [framesFlaggedOnly]);

  const loadStats = useCallback(() => {
    if (statsLoadedRef.current) return;
    statsLoadedRef.current = true;
    setStatsLoading(true);
    setColumnMinMax(computeColumnMinMax(data.chartDataGroups));
    if (datasetId) {
      fetchEpisodeLengthStats(org!, dataset!)
        .then((result) => {
          if (!mountedRef.current) return;
          setEpisodeLengthStats(result);
        })
        .catch(() => {})
        .finally(() => {
          if (mountedRef.current) setStatsLoading(false);
        });
    } else {
      setStatsLoading(false);
    }
  }, [computeColumnMinMax, data.chartDataGroups, datasetId, dataset, org]);

  const loadFrames = useCallback(() => {
    if (framesLoadedRef.current || !datasetId) return;
    framesLoadedRef.current = true;
    setFramesLoading(true);
    fetchEpisodeFrames(org!, dataset!)
      .then((result) => {
        if (!mountedRef.current) return;
        setEpisodeFramesData(result);
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setEpisodeFramesData({ cameras: [], framesByCamera: {} });
      })
      .finally(() => {
        if (mountedRef.current) setFramesLoading(false);
      });
  }, [datasetId, dataset, org]);

  const loadInsights = useCallback(() => {
    if (insightsLoadedRef.current || !datasetId) return;
    insightsLoadedRef.current = true;
    setInsightsLoading(true);
    fetchCrossEpisodeVariance(org!, dataset!)
      .then((result) => {
        if (!mountedRef.current) return;
        setCrossEpData(result);
      })
      .catch((err) => console.error("[cross-ep] Failed:", err))
      .finally(() => {
        if (mountedRef.current) setInsightsLoading(false);
      });
  }, [datasetId, dataset, org]);

  // Re-trigger data loading for the restored tab on mount
  useEffect(() => {
    if (activeTab === "statistics") loadStats();
    if (activeTab === "frames") loadFrames();
    if (activeTab === "insights") loadInsights();
    if (activeTab === "filtering") {
      loadStats();
      loadInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = useCallback(
    (tab: ActiveTab) => {
      setActiveTab(tab);
      if (tab === "statistics") loadStats();
      if (tab === "frames") loadFrames();
      if (tab === "insights") loadInsights();
      if (tab === "filtering") {
        loadStats();
        loadInsights();
      }
    },
    [loadFrames, loadInsights, loadStats],
  );

  useEffect(() => {
    if (!window.desktop?.onMenuCommand) {
      return;
    }

    return window.desktop.onMenuCommand((command) => {
      switch (command) {
        case "tab-episodes":
          handleTabChange("episodes");
          break;
        case "tab-statistics":
          handleTabChange("statistics");
          break;
        case "tab-filtering":
          handleTabChange("filtering");
          break;
        case "tab-frames":
          handleTabChange("frames");
          break;
        case "tab-insights":
          handleTabChange("insights");
          break;
        case "tab-urdf":
          if (
            hasURDFSupport(datasetInfo.robot_type) &&
            datasetInfo.codebase_version >= "v3.0"
          ) {
            handleTabChange("urdf");
          }
          break;
        case "toggle-theme":
          setTheme((currentTheme) =>
            currentTheme === "dark" ? "light" : "dark",
          );
          break;
        case "episode-next": {
          const nextEpisodeId = episodeId + 1;
          const highestEpisodeId = episodes[episodes.length - 1];
          if (nextEpisodeId <= highestEpisodeId) {
            router.push(`./episode_${nextEpisodeId}`);
          }
          break;
        }
        case "episode-previous": {
          const previousEpisodeId = episodeId - 1;
          const lowestEpisodeId = episodes[0];
          if (previousEpisodeId >= lowestEpisodeId) {
            router.push(`./episode_${previousEpisodeId}`);
          }
          break;
        }
      }
    });
  }, [
    datasetInfo.codebase_version,
    datasetInfo.robot_type,
    episodeId,
    episodes,
    handleTabChange,
    router,
  ]);

  // Use context for time sync
  const { currentTime, setCurrentTime, setIsPlaying, isPlaying } = useTime();

  // URDFViewer episode changer and play toggle — populated by URDFViewer on mount
  const urdfChangerRef = useRef<((ep: number) => void) | undefined>(undefined);
  const urdfPlayToggleRef = useRef<(() => void) | undefined>(undefined);
  const [urdfEpisode, setUrdfEpisode] = useState(episodeId);
  useEffect(() => setUrdfEpisode(episodeId), [episodeId]);

  // Warm the browser cache for adjacent episodes' videos without relying on
  // unsupported preload hints for video resources.
  useEffect(() => {
    if (!org || !dataset) return;
    const links: HTMLLinkElement[] = [];

    fetchAdjacentEpisodeVideos(org, dataset, episodeId, 2)
      .then((adjacentVideos) => {
        for (const ep of adjacentVideos) {
          for (const v of ep.videosInfo) {
            const link = document.createElement("link");
            link.rel = "prefetch";
            link.href = v.url;
            document.head.appendChild(link);
            links.push(link);
          }
        }
      })
      .catch(() => {});

    return () => {
      links.forEach((l) => l.remove());
    };
  }, [org, dataset, episodeId]);

  // Initialize based on URL time parameter
  useEffect(() => {
    const timeParam = searchParams.get("t");
    if (timeParam) {
      const timeValue = parseFloat(timeParam);
      if (!isNaN(timeValue)) {
        setCurrentTime(timeValue);
      }
    }
  }, [searchParams, setCurrentTime]);

  // sync with parent window hf.co/spaces
  useEffect(() => {
    postParentMessageWithParams((params: URLSearchParams) => {
      params.set("path", window.location.pathname + window.location.search);
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const { key } = e;

      if (key === " ") {
        e.preventDefault();
        if (activeTab === "urdf") {
          urdfPlayToggleRef.current?.();
        } else {
          setIsPlaying((prev: boolean) => !prev);
        }
      } else if (key === "ArrowDown" || key === "ArrowUp") {
        e.preventDefault();
        if (activeTab === "urdf") {
          const nextEp =
            key === "ArrowDown" ? urdfEpisode + 1 : urdfEpisode - 1;
          const lowest = episodes[0];
          const highest = episodes[episodes.length - 1];
          if (nextEp >= lowest && nextEp <= highest) {
            setUrdfEpisode(nextEp);
            urdfChangerRef.current?.(nextEp);
          }
        } else {
          const nextEpisodeId =
            key === "ArrowDown" ? episodeId + 1 : episodeId - 1;
          const lowestEpisodeId = episodes[0];
          const highestEpisodeId = episodes[episodes.length - 1];
          if (
            nextEpisodeId >= lowestEpisodeId &&
            nextEpisodeId <= highestEpisodeId
          ) {
            router.push(`./episode_${nextEpisodeId}`);
          }
        }
      }
    },
    [activeTab, episodeId, episodes, router, setIsPlaying, urdfEpisode],
  );

  // Initialize based on URL time parameter
  useEffect(() => {
    // Add keyboard event listener
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // Only update URL ?t= param when the integer second changes
  const lastUrlSecondRef = useRef<number>(-1);
  useEffect(() => {
    if (isPlaying) return;
    const currentSec = Math.floor(currentTime);
    if (currentTime > 0 && lastUrlSecondRef.current !== currentSec) {
      lastUrlSecondRef.current = currentSec;
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set("t", currentSec.toString());
      // Replace state instead of pushing to avoid navigation stack bloat
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}?${newParams.toString()}`,
      );
      postParentMessageWithParams((params: URLSearchParams) => {
        params.set("path", window.location.pathname + window.location.search);
      });
    }
  }, [isPlaying, currentTime, searchParams]);

  return (
    <div
      className="brand-aurora relative flex h-screen max-h-screen flex-col overflow-hidden text-slate-100"
      data-theme={theme}
    >
      <div className="pointer-events-none absolute inset-0 bg-white/[0.05]" />
      <div className="pointer-events-none absolute inset-0 bg-white/[0.03]" />

      {/* Top tab bar */}
      <div className="glass-panel-strong relative z-10 mx-4 mt-4 flex shrink-0 flex-wrap items-center gap-2 rounded-[28px] px-3 py-2">
        <button
          className={`brand-focus-ring relative rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
            activeTab === "episodes" ? "brand-pill-active" : "brand-pill-ghost"
          }`}
          onClick={() => handleTabChange("episodes")}
        >
          Episodes
        </button>
        <button
          className={`brand-focus-ring relative rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
            activeTab === "statistics"
              ? "brand-pill-active"
              : "brand-pill-ghost"
          }`}
          onClick={() => handleTabChange("statistics")}
        >
          Statistics
        </button>
        <button
          className={`brand-focus-ring relative rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
            activeTab === "filtering" ? "brand-pill-active" : "brand-pill-ghost"
          }`}
          onClick={() => handleTabChange("filtering")}
        >
          Filtering
        </button>
        <button
          className={`brand-focus-ring relative rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
            activeTab === "frames" ? "brand-pill-active" : "brand-pill-ghost"
          }`}
          onClick={() => handleTabChange("frames")}
        >
          Frames
        </button>
        <button
          className={`brand-focus-ring relative rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
            activeTab === "insights" ? "brand-pill-active" : "brand-pill-ghost"
          }`}
          onClick={() => handleTabChange("insights")}
        >
          Action Insights
        </button>
        {hasURDFSupport(datasetInfo.robot_type) &&
          datasetInfo.codebase_version >= "v3.0" && (
            <button
              className={`brand-focus-ring relative rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
                activeTab === "urdf" ? "brand-pill-active" : "brand-pill-ghost"
              }`}
              onClick={() => handleTabChange("urdf")}
            >
              3D Replay
            </button>
          )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setTheme((currentTheme) =>
                currentTheme === "dark" ? "light" : "dark",
              )
            }
            className="brand-focus-ring brand-pill-ghost inline-flex items-center justify-center rounded-full p-3 transition-all"
            title={
              theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
            aria-label={
              theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
          >
            {theme === "dark" ? <FaSun size={18} /> : <FaMoon size={18} />}
          </button>
          <Link
            href="/"
            className="brand-focus-ring brand-pill-ghost inline-flex items-center justify-center rounded-full p-3 transition-all"
            title="Return to home"
            aria-label="Return to home"
          >
            <FaHome size={18} />
          </Link>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div className="relative z-10 flex min-h-0 flex-1 gap-4 px-4 pb-4 pt-4 md:gap-5">
        {/* Sidebar — on Episodes and 3D Replay tabs */}
        {(activeTab === "episodes" || activeTab === "urdf") && (
          <Sidebar
            datasetInfo={datasetInfo}
            episodes={episodes}
            episodeId={activeTab === "urdf" ? urdfEpisode : episodeId}
            showFlaggedOnly={sidebarFlaggedOnly}
            onShowFlaggedOnlyChange={setSidebarFlaggedOnly}
            onEpisodeSelect={
              activeTab === "urdf"
                ? (ep) => {
                    setUrdfEpisode(ep);
                    urdfChangerRef.current?.(ep);
                  }
                : undefined
            }
          />
        )}

        {/* Main content */}
        <div
          className={`theme-scrollbar glass-panel-strong flex flex-1 flex-col gap-5 overflow-hidden rounded-[32px] p-5 md:p-6 relative ${isLoading ? "overflow-hidden" : "overflow-y-auto"}`}
        >
          {isLoading && <Loading theme={theme} />}

          {activeTab === "episodes" && (
            <>
              <div className="glass-panel flex items-center justify-between gap-6 rounded-[28px] px-5 py-5">
                <div className="flex min-w-0 items-center gap-5">
                  <div className="min-w-0">
                    <p className="mb-1 text-[0.7rem] uppercase tracking-[0.28em] text-white/38">
                      Episode Viewer
                    </p>
                    {isLocalDatasetId(datasetInfo.repoId) ? (
                      <p className="break-all text-lg font-semibold text-white md:text-2xl">
                        {getDatasetDisplayName(datasetInfo.repoId)}
                      </p>
                    ) : (
                      <a
                        href={`https://huggingface.co/datasets/${datasetInfo.repoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:text-white"
                      >
                        <p className="text-lg font-semibold text-white md:text-2xl">
                          {datasetInfo.repoId}
                        </p>
                      </a>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="glass-chip text-ink rounded-full px-3 py-1 font-mono uppercase tracking-[0.2em]">
                        episode_{episodeId}
                      </span>
                      <span className="glass-chip text-ink-muted rounded-full px-3 py-1 font-mono">
                        {datasetInfo.codebase_version}
                      </span>
                      <span className="glass-chip text-ink-muted rounded-full px-3 py-1 font-mono">
                        {datasetInfo.robot_type ?? "unknown robot"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="hidden text-right md:block">
                  <p className="text-ink-faint text-xs uppercase tracking-[0.24em]">
                    Frames / FPS
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {visibleEpisodeFrameCount.toLocaleString()}
                    <span className="text-ink-soft ml-2 text-sm font-normal">
                      @ {datasetInfo.fps}
                    </span>
                  </p>
                </div>
              </div>

              {/* Videos */}
              {videosInfo.length > 0 && (
                <SimpleVideosPlayer
                  videosInfo={videosInfo}
                  onVideosReady={() => setVideosReady(true)}
                />
              )}

              {/* Language Instruction */}
              {task && (
                <div className="glass-panel mb-2 rounded-[24px] p-5">
                  <p className="text-ink">
                    <span className="text-ink-strong font-semibold">
                      Language Instruction:
                    </span>
                  </p>
                  <div className="text-ink mt-3">
                    {task
                      .split("\n")
                      .map((instruction: string, index: number) => (
                        <p key={index} className="mb-1">
                          {instruction}
                        </p>
                      ))}
                  </div>
                </div>
              )}

              {/* Graph */}
              <div className="mb-4">
                <DataRecharts
                  data={chartDataGroups}
                  onChartsReady={() => setChartsReady(true)}
                />
              </div>

              <PlaybackBar />
            </>
          )}

          {activeTab === "statistics" && (
            <StatsPanel
              datasetInfo={datasetInfo}
              episodeLengthStats={episodeLengthStats}
              loading={statsLoading}
            />
          )}

          {activeTab === "frames" && (
            <OverviewPanel
              data={episodeFramesData}
              loading={framesLoading}
              flaggedOnly={framesFlaggedOnly}
              onFlaggedOnlyChange={setFramesFlaggedOnly}
            />
          )}

          {activeTab === "insights" && (
            <Suspense fallback={<Loading theme={theme} />}>
              <ActionInsightsPanel
                flatChartData={data.flatChartData}
                fps={datasetInfo.fps}
                crossEpisodeData={crossEpData}
                crossEpisodeLoading={insightsLoading}
              />
            </Suspense>
          )}

          {activeTab === "filtering" && (
            <Suspense fallback={<Loading theme={theme} />}>
              <FilteringPanel
                repoId={datasetInfo.repoId}
                crossEpisodeData={crossEpData}
                crossEpisodeLoading={insightsLoading}
                episodeLengthStats={episodeLengthStats}
                flatChartData={data.flatChartData}
                onViewFlaggedEpisodes={() => {
                  setSidebarFlaggedOnly(true);
                  handleTabChange("episodes");
                }}
              />
            </Suspense>
          )}

          {activeTab === "urdf" && (
            <Suspense fallback={<Loading theme={theme} />}>
              <URDFViewer
                data={data}
                org={org}
                dataset={dataset}
                episodeChangerRef={urdfChangerRef}
                playToggleRef={urdfPlayToggleRef}
              />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
