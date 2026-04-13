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
        className="brand-focus-ring brand-control-button hidden rounded-full p-2.5 text-xl transition-colors md:block"
      >
        <FaBackward size={24} />
      </button>
      {!isPlaying ? (
        <button
          className="brand-focus-ring brand-control-button-active scale-110 rounded-full p-3 transition-transform"
          title="Play. Toggle with Space"
          onClick={() => setIsPlaying(true)}
        >
          <FaPlay size={24} />
        </button>
      ) : (
        <button
          className="brand-focus-ring brand-control-button scale-110 rounded-full p-3 transition-transform"
          title="Pause. Toggle with Space"
          onClick={() => setIsPlaying(false)}
        >
          <FaPause size={24} />
        </button>
      )}
      <button
        title="Jump forward 5 seconds"
        onClick={() => setCurrentTime(Math.min(duration, currentTime + 5))}
        className="brand-focus-ring brand-control-button hidden rounded-full p-2.5 text-xl transition-colors md:block"
      >
        <FaForward size={24} />
      </button>
      <button
        title="Rewind from start"
        onClick={() => setCurrentTime(0)}
        className="brand-focus-ring brand-control-button hidden rounded-full p-2.5 text-xl transition-colors md:block"
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
        className="brand-focus-ring brand-scrubber mx-2 flex-1"
        aria-label="Seek video"
      />
      <span className="text-ink-muted w-20 shrink-0 text-right text-xs tabular-nums">
        {Math.floor(sliderValue)} / {Math.floor(duration)}
      </span>

      <div className="text-ink-muted ml-6 hidden select-none flex-col gap-y-0.5 text-xs md:flex">
        <p>
          <span className="inline-flex items-center gap-1 font-mono align-middle">
            <span className="glass-chip text-ink rounded-full px-2 py-0.5 text-xs shadow-inner">
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
