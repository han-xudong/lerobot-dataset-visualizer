"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postParentMessageWithParams } from "@/utils/postParentMessage";

type ExploreGridProps = {
  datasets: Array<{ id: string; videoUrl: string | null }>;
  currentPage: number;
  totalPages: number;
};

export default function ExploreGrid({
  datasets,
  currentPage,
  totalPages,
}: ExploreGridProps) {
  const router = useRouter();

  // sync with parent window hf.co/spaces
  useEffect(() => {
    postParentMessageWithParams((params: URLSearchParams) => {
      params.set("path", window.location.pathname + window.location.search);
    });
  }, []);

  useEffect(() => {
    if (currentPage > 1) {
      router.prefetch(`/explore?p=${currentPage - 1}`);
    }

    if (currentPage < totalPages) {
      router.prefetch(`/explore?p=${currentPage + 1}`);
    }
  }, [currentPage, router, totalPages]);

  // Create an array of refs for each video
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [failedVideoIds, setFailedVideoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const failedVideoLookup = useMemo(() => failedVideoIds, [failedVideoIds]);

  const previousPageHref = `/explore?p=${currentPage - 1}`;
  const nextPageHref = `/explore?p=${currentPage + 1}`;

  const markVideoFailed = (datasetId: string) => {
    setFailedVideoIds((current) => {
      if (current.has(datasetId)) {
        return current;
      }

      const next = new Set(current);
      next.add(datasetId);
      return next;
    });
  };

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Explore LeRobot Datasets</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {datasets.map((ds, idx) => (
          <Link
            key={ds.id}
            href={`/${ds.id}`}
            className="relative h-48 overflow-hidden rounded-lg border border-white/10 bg-slate-950 shadow transition hover:shadow-lg group flex items-end p-4"
            onMouseEnter={() => {
              const vid = videoRefs.current[idx];
              if (vid && !failedVideoLookup.has(ds.id)) {
                void vid.play().catch(() => {
                  markVideoFailed(ds.id);
                });
              }
            }}
            onMouseLeave={() => {
              const vid = videoRefs.current[idx];
              if (vid) {
                vid.pause();
                vid.currentTime = 0;
              }
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),_transparent_48%),linear-gradient(160deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.85))]" />
            {!failedVideoLookup.has(ds.id) && ds.videoUrl ? (
              <video
                ref={(el) => {
                  videoRefs.current[idx] = el;
                }}
                src={ds.videoUrl}
                className="absolute top-0 left-0 z-0 h-full w-full object-cover object-center"
                loop
                muted
                playsInline
                preload="metadata"
                onError={() => {
                  markVideoFailed(ds.id);
                }}
                onTimeUpdate={(e) => {
                  const vid = e.currentTarget;
                  if (vid.currentTime >= 15) {
                    vid.pause();
                    vid.currentTime = 0;
                  }
                }}
              />
            ) : null}
            <div className="absolute inset-0 z-10 pointer-events-none bg-black/40" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="relative z-20 rounded bg-black/60 px-2 py-1 font-mono text-sm break-all text-blue-100 shadow backdrop-blur">
              {ds.id}
            </div>
          </Link>
        ))}
      </div>
      <div className="flex justify-center mt-8 gap-4">
        {currentPage > 1 && (
          <Link
            href={previousPageHref}
            prefetch
            className="rounded bg-gray-600 px-6 py-2 text-white shadow transition hover:bg-gray-700"
          >
            Previous
          </Link>
        )}
        {currentPage < totalPages && (
          <Link
            href={nextPageHref}
            prefetch
            className="rounded bg-blue-600 px-6 py-2 text-white shadow transition hover:bg-blue-700"
          >
            Next
          </Link>
        )}
      </div>
    </main>
  );
}
