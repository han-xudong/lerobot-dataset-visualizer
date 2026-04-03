"use client";

export default function Loading({
  theme = "dark",
}: {
  theme?: "dark" | "light";
}) {
  const overlayClass =
    theme === "light"
      ? "bg-white/80 text-zinc-900"
      : "bg-black/80 text-zinc-100";
  const chipClass =
    theme === "light"
      ? "border border-black/10 bg-white/70 text-zinc-700"
      : "border border-white/10 bg-white/8 text-white/80";

  return (
    <div
      className={`absolute inset-0 z-10 flex flex-col items-center justify-center animate-fade-in backdrop-blur-xl ${overlayClass}`}
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
      <h1 className="mb-2 text-2xl font-bold">Loading…</h1>
      <p className={`rounded-full px-4 py-1.5 text-sm ${chipClass}`}>
        Preparing data & videos
      </p>
    </div>
  );
}
