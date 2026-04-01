import React from "react";
import { useTime } from "../context/time-context";
import {
  FaPlay,
  FaPause,
  FaBackward,
  FaForward,
  FaUndoAlt,
  FaArrowDown,
  FaArrowUp,
} from "react-icons/fa";

const PlaybackBar: React.FC = () => {
  const { duration, isPlaying, setIsPlaying, currentTime, setCurrentTime } =
    useTime();

  const sliderActiveRef = React.useRef(false);
  const wasPlayingRef = React.useRef(false);
  const [sliderValue, setSliderValue] = React.useState(currentTime);

  // Only update sliderValue from context if not dragging
  React.useEffect(() => {
    if (!sliderActiveRef.current) {
      setSliderValue(currentTime);
    }
  }, [currentTime]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    setSliderValue(t);
    // Seek videos immediately while dragging (no debounce)
    setCurrentTime(t);
  };

  const handleSliderMouseDown = () => {
    sliderActiveRef.current = true;
    wasPlayingRef.current = isPlaying;
    setIsPlaying(false);
  };

  const handleSliderMouseUp = () => {
    sliderActiveRef.current = false;
    // Final seek to exact slider position
    setCurrentTime(sliderValue);
    if (wasPlayingRef.current) {
      setIsPlaying(true);
    }
  };

  return (
    <div className="glass-panel-strong sticky bottom-0 mt-auto flex w-full max-w-5xl items-center gap-4 self-center rounded-[28px] px-4 py-3">
      <button
        title="Jump backward 5 seconds"
        onClick={() => setCurrentTime(Math.max(0, currentTime - 5))}
        className="brand-focus-ring hidden rounded-full bg-white/6 p-2.5 text-xl text-white/85 transition-colors hover:bg-white/10 hover:text-white md:block"
      >
        <FaBackward size={24} />
      </button>
      <button
        className={`brand-focus-ring rounded-full bg-gradient-to-r from-white to-zinc-300 p-3 text-slate-950 shadow-[0_10px_30px_rgba(255,255,255,0.12)] transition-transform ${isPlaying ? "scale-90 opacity-60" : "scale-110"}`}
        title="Play. Toggle with Space"
        onClick={() => setIsPlaying(true)}
        style={{ display: isPlaying ? "none" : "inline-block" }}
      >
        <FaPlay size={24} />
      </button>
      <button
        className={`brand-focus-ring rounded-full bg-white/10 p-3 text-white transition-transform ${!isPlaying ? "scale-90 opacity-60" : "scale-110"}`}
        title="Pause. Toggle with Space"
        onClick={() => setIsPlaying(false)}
        style={{ display: !isPlaying ? "none" : "inline-block" }}
      >
        <FaPause size={24} />
      </button>
      <button
        title="Jump forward 5 seconds"
        onClick={() => setCurrentTime(Math.min(duration, currentTime + 5))}
        className="brand-focus-ring hidden rounded-full bg-white/6 p-2.5 text-xl text-white/85 transition-colors hover:bg-white/10 hover:text-white md:block"
      >
        <FaForward size={24} />
      </button>
      <button
        title="Rewind from start"
        onClick={() => setCurrentTime(0)}
        className="brand-focus-ring hidden rounded-full bg-white/6 p-2.5 text-xl text-white/85 transition-colors hover:bg-white/10 hover:text-white md:block"
      >
        <FaUndoAlt size={24} />
      </button>
      <input
        type="range"
        min={0}
        max={duration}
        step={0.01}
        value={sliderValue}
        onChange={handleSliderChange}
        onMouseDown={handleSliderMouseDown}
        onMouseUp={handleSliderMouseUp}
        onTouchStart={handleSliderMouseDown}
        onTouchEnd={handleSliderMouseUp}
        className="brand-focus-ring mx-2 flex-1 accent-white"
        aria-label="Seek video"
      />
      <span className="shrink-0 w-20 text-right text-xs tabular-nums text-white/75">
        {Math.floor(sliderValue)} / {Math.floor(duration)}
      </span>

      <div className="ml-6 hidden select-none flex-col gap-y-0.5 text-xs text-white/65 md:flex">
        <p>
          <span className="inline-flex items-center gap-1 font-mono align-middle">
            <span className="glass-chip rounded-full px-2 py-0.5 text-xs text-white/80 shadow-inner">
              Space
            </span>
          </span>{" "}
          to pause/unpause
        </p>
        <p>
          <span className="inline-flex items-center gap-1 font-mono align-middle">
            <FaArrowUp size={14} />/<FaArrowDown size={14} />
          </span>{" "}
          to previous/next episode
        </p>
      </div>
    </div>
  );
};

export default PlaybackBar;
