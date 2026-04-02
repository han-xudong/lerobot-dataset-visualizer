"use client";

export default function Loading() {
  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 text-slate-100 animate-fade-in backdrop-blur-xl"
      tabIndex={-1}
      aria-modal="true"
      role="dialog"
    >
      <svg
        className="animate-spin mb-8"
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
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
      <h1 className="mb-2 text-2xl font-bold text-white">Loading…</h1>
      <p className="glass-chip rounded-full px-4 py-1.5 text-sm text-white/80">
        Preparing data & videos
      </p>
    </div>
  );
}
