"use client";

export default function Loading({
  theme = "dark",
  title = "Loading…",
  message = "Preparing data & videos",
}: {
  theme?: "dark" | "light";
  title?: string;
  message?: string;
}) {
  const overlayClass =
    theme === "light"
      ? "bg-white/62 text-zinc-900"
      : "bg-black/62 text-zinc-100";
  const chipClass =
    theme === "light"
      ? "border border-black/10 bg-white/70 text-zinc-700"
      : "border border-white/10 bg-white/8 text-white/80";
  const panelClass =
    theme === "light"
      ? "border border-black/10 bg-white/72 shadow-[0_24px_80px_rgba(255,255,255,0.18)]"
      : "border border-white/10 bg-black/28 shadow-[0_24px_80px_rgba(0,0,0,0.45)]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      tabIndex={-1}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`absolute inset-0 backdrop-blur-2xl backdrop-saturate-125 ${overlayClass}`}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.1),_transparent_46%)]" />
      <div
        className={`relative z-10 mx-6 flex min-w-[280px] max-w-md flex-col items-center justify-center rounded-[28px] px-10 py-12 text-center backdrop-blur-md ${panelClass}`}
      >
        <svg
          className="mb-8 animate-spin"
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
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className={`rounded-full px-4 py-1.5 text-sm ${chipClass}`}>
          {message}
        </p>
      </div>
    </div>
  );
}
