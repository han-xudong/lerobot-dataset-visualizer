"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useTime } from "../context/time-context";
import { FaExpand, FaCompress, FaTimes, FaEye } from "react-icons/fa";
import type { VideoInfo } from "@/types";

const THRESHOLDS = {
  VIDEO_SYNC_TOLERANCE: 0.2,
  VIDEO_SEGMENT_BOUNDARY: 0.05,
};

const VIDEO_READY_TIMEOUT_MS = 10_000;

type VideoPlayerProps = {
  videosInfo: VideoInfo[];
  onVideosReady?: () => void;
};

const videoEventCleanup = new WeakMap<HTMLVideoElement, () => void>();

export const SimpleVideosPlayer = ({
  videosInfo,
  onVideosReady,
}: VideoPlayerProps) => {
  const { currentTime, setCurrentTime, isPlaying, setIsPlaying } = useTime();
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [hiddenVideos, setHiddenVideos] = React.useState<string[]>([]);
  const [enlargedVideo, setEnlargedVideo] = React.useState<string | null>(null);
  const [showHiddenMenu, setShowHiddenMenu] = React.useState(false);
  const [videosReady, setVideosReady] = React.useState(false);

  const hiddenSet = React.useMemo(() => new Set(hiddenVideos), [hiddenVideos]);

  const firstVisibleIdx = videosInfo.findIndex(
    (video) => !hiddenSet.has(video.filename),
  );

  // Tracks the last time value set by the primary video's onTimeUpdate.
  // If currentTime differs from this, an external source (slider/chart click) changed it.
  const lastVideoTimeRef = useRef(0);

  // Initialize video refs array
  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, videosInfo.length);
  }, [videosInfo.length]);

  // Handle videos ready — with a timeout fallback so the UI never hangs
  // if a video fails to reach canplaythrough (e.g. network stall).
  useEffect(() => {
    let readyCount = 0;
    let resolved = false;

    const markReady = () => {
      if (resolved) return;
      resolved = true;
      setVideosReady(true);
      onVideosReady?.();
      setIsPlaying(true);
    };

    const checkReady = () => {
      readyCount++;
      if (readyCount >= videosInfo.length) markReady();
    };

    const timeout = setTimeout(markReady, VIDEO_READY_TIMEOUT_MS);

    videoRefs.current.forEach((video, index) => {
      if (video) {
        const info = videosInfo[index];

        if (info.isSegmented) {
          const handleTimeUpdate = () => {
            const segmentEnd = info.segmentEnd || video.duration;
            const segmentStart = info.segmentStart || 0;

            if (
              video.currentTime >=
              segmentEnd - THRESHOLDS.VIDEO_SEGMENT_BOUNDARY
            ) {
              video.currentTime = segmentStart;
              if (index === firstVisibleIdx) {
                setCurrentTime(0);
              }
            }
          };

          const handleLoadedData = () => {
            video.currentTime = info.segmentStart || 0;
            checkReady();
          };

          video.addEventListener("timeupdate", handleTimeUpdate);
          video.addEventListener("loadeddata", handleLoadedData);

          videoEventCleanup.set(video, () => {
            video.removeEventListener("timeupdate", handleTimeUpdate);
            video.removeEventListener("loadeddata", handleLoadedData);
          });
        } else {
          const handleEnded = () => {
            video.currentTime = 0;
            if (index === firstVisibleIdx) {
              setCurrentTime(0);
            }
          };

          video.addEventListener("ended", handleEnded);
          video.addEventListener("canplaythrough", checkReady, { once: true });

          videoEventCleanup.set(video, () => {
            video.removeEventListener("ended", handleEnded);
          });
        }
      }
    });

    return () => {
      clearTimeout(timeout);
      videoRefs.current.forEach((video) => {
        if (!video) return;
        const cleanup = videoEventCleanup.get(video);
        if (cleanup) {
          cleanup();
          videoEventCleanup.delete(video);
        }
      });
    };
  }, [
    videosInfo,
    onVideosReady,
    setIsPlaying,
    firstVisibleIdx,
    setCurrentTime,
  ]);

  // Handle play/pause — skip hidden videos
  useEffect(() => {
    if (!videosReady) return;

    videoRefs.current.forEach((video, idx) => {
      if (!video || hiddenSet.has(videosInfo[idx].filename)) return;
      if (isPlaying) {
        video.play().catch((e) => {
          if (e.name !== "AbortError") {
            console.error("Error playing video");
          }
        });
      } else {
        video.pause();
      }
    });
  }, [isPlaying, videosReady, hiddenSet, videosInfo]);

  // Sync all video times when currentTime changes.
  // For the primary video, only seek when the change came from an external source
  // (slider drag, chart click, etc.) — detected by comparing against lastVideoTimeRef.
  useEffect(() => {
    if (!videosReady) return;

    const isExternalSeek =
      Math.abs(currentTime - lastVideoTimeRef.current) > 0.3;

    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (hiddenSet.has(videosInfo[index].filename)) return;
      if (index === firstVisibleIdx && !isExternalSeek) return;

      const info = videosInfo[index];
      let targetTime = currentTime;
      if (info.isSegmented) {
        targetTime = (info.segmentStart || 0) + currentTime;
      }

      if (
        Math.abs(video.currentTime - targetTime) >
        THRESHOLDS.VIDEO_SYNC_TOLERANCE
      ) {
        video.currentTime = targetTime;
      }
    });
  }, [currentTime, videosInfo, videosReady, hiddenSet, firstVisibleIdx]);

  // Stable per-index timeupdate handlers avoid findIndex scan on every event
  const makeTimeUpdateHandler = useCallback(
    (index: number) => {
      return () => {
        const video = videoRefs.current[index];
        const info = videosInfo[index];
        if (!video || !info) return;

        let globalTime = video.currentTime;
        if (info.isSegmented) {
          globalTime = video.currentTime - (info.segmentStart || 0);
        }
        lastVideoTimeRef.current = globalTime;
        setCurrentTime(globalTime);
      };
    },
    [videosInfo, setCurrentTime],
  );

  // Handle play click for segmented videos
  const handlePlay = (video: HTMLVideoElement, info: VideoInfo) => {
    if (info.isSegmented) {
      const segmentStart = info.segmentStart || 0;
      const segmentEnd = info.segmentEnd || video.duration;

      if (video.currentTime < segmentStart || video.currentTime >= segmentEnd) {
        video.currentTime = segmentStart;
      }
    }
    video.play();
  };

  return (
    <>
      {/* Hidden videos menu */}
      {hiddenVideos.length > 0 && (
        <div className="relative mb-4">
          <button
            className="brand-focus-ring brand-control-button flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors"
            onClick={() => setShowHiddenMenu(!showHiddenMenu)}
          >
            <FaEye /> Show Hidden Videos ({hiddenVideos.length})
          </button>
          {showHiddenMenu && (
            <div className="glass-panel absolute left-0 z-50 mt-2 w-max rounded-2xl p-2 shadow-lg">
              <div className="text-ink-muted mb-2 text-xs">
                Restore hidden videos:
              </div>
              {hiddenVideos.map((filename) => (
                <button
                  key={filename}
                  className="brand-focus-ring brand-control-list-item block w-full rounded-xl px-2 py-1 text-left transition-colors"
                  onClick={() =>
                    setHiddenVideos((prev) =>
                      prev.filter((v) => v !== filename),
                    )
                  }
                >
                  {filename}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Videos */}
      <div className="flex flex-wrap gap-x-2 gap-y-6">
        {videosInfo.map((info, idx) => {
          if (hiddenVideos.includes(info.filename)) return null;

          const isEnlarged = enlargedVideo === info.filename;
          const isFirstVisible = idx === firstVisibleIdx;

          return (
            <div
              key={info.filename}
              className={`${
                isEnlarged
                  ? "enlarged-video-stage z-40 fixed inset-0 flex flex-col items-center justify-center p-6 backdrop-blur-2xl"
                  : "max-w-96"
              }`}
            >
              <p className="glass-panel text-ink flex w-full items-center justify-between truncate rounded-t-[22px] px-3 py-2 text-sm">
                <span>{info.filename}</span>
                <span className="flex gap-1">
                  <button
                    title={isEnlarged ? "Minimize" : "Enlarge"}
                    className="brand-focus-ring brand-control-button ml-2 rounded-full p-1.5 transition-colors"
                    onClick={() =>
                      setEnlargedVideo(isEnlarged ? null : info.filename)
                    }
                  >
                    {isEnlarged ? <FaCompress /> : <FaExpand />}
                  </button>
                  <button
                    title="Hide Video"
                    className="brand-focus-ring brand-control-button ml-1 rounded-full p-1.5 transition-colors"
                    onClick={() =>
                      setHiddenVideos((prev) => [...prev, info.filename])
                    }
                    disabled={
                      videosInfo.filter(
                        (v) => !hiddenVideos.includes(v.filename),
                      ).length === 1
                    }
                  >
                    <FaTimes />
                  </button>
                </span>
              </p>
              <video
                ref={(el: HTMLVideoElement | null) => {
                  videoRefs.current[idx] = el;
                }}
                className={`w-full object-contain ${
                  isEnlarged
                    ? "max-h-[90vh] max-w-[90vw] rounded-b-[22px]"
                    : "rounded-b-[22px]"
                }`}
                muted
                preload="auto"
                crossOrigin="anonymous"
                onPlay={(e) => handlePlay(e.currentTarget, info)}
                onTimeUpdate={
                  isFirstVisible ? makeTimeUpdateHandler(idx) : undefined
                }
              >
                <source src={info.url} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default SimpleVideosPlayer;
