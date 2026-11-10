"use client";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Frame, dateLabel } from "@/lib/types";
export default function Timeline({
  frames,
  index,
  onIndex,
  playing,
  onPlay,
  speed,
  onSpeed,
  disabled = false,
}: {
  frames: Frame[];
  index: number;
  onIndex: (n: number) => void;
  playing: boolean;
  onPlay: () => void;
  speed: number;
  onSpeed: (n: number) => void;
  disabled?: boolean;
}) {
  const unavailable = disabled || frames.length === 0;
  return (
    <section className="timeline panel" aria-label="Observation timeline">
      <div className="timeline-top">
        <div className="playback">
          <button
            aria-label="Previous frame"
            disabled={unavailable}
            onClick={() => onIndex((index + frames.length - 1) % frames.length)}
          >
            <SkipBack size={17} />
          </button>
          <button
            className="play-button"
            aria-label={playing ? "Pause playback" : "Play observations"}
            disabled={unavailable}
            onClick={onPlay}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            aria-label="Next frame"
            disabled={unavailable}
            onClick={() => onIndex((index + 1) % frames.length)}
          >
            <SkipForward size={17} />
          </button>
          <select
            aria-label="Playback speed"
            disabled={unavailable}
            value={speed}
            onChange={(e) => onSpeed(Number(e.target.value))}
          >
            {[0.5, 1, 2, 4].map((s) => (
              <option value={s} key={s}>
                {s}×
              </option>
            ))}
          </select>
        </div>
        <span className="eyebrow">
          {String(frames.length ? index + 1 : 0).padStart(2, "0")} /{" "}
          {String(frames.length).padStart(2, "0")} OBSERVATIONS
        </span>
        <span className="keyboard-hint">← → Frame · Space Play</span>
      </div>
      <input
        className="scrubber"
        aria-label="Observation frame"
        type="range"
        min="0"
        max={Math.max(0, frames.length - 1)}
        disabled={unavailable}
        step="1"
        value={index}
        onChange={(e) => onIndex(Number(e.target.value))}
      />
      <div className="frame-strip">
        {frames.map((f, i) => (
          <button
            key={f.id}
            aria-label={`Observation ${i + 1}, ${dateLabel(f.timestamp)}`}
            aria-pressed={index === i}
            className={`frame-thumb ${index === i ? "selected" : ""}`}
            onClick={() => onIndex(i)}
          >
            <img src={f.image_url} alt="" loading="eager" />
            <span className="frame-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="frame-date">
              {dateLabel(f.timestamp).slice(0, 6)}
              <small>{dateLabel(f.timestamp).slice(-4)}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="timeline-footer">
        <span>
          {frames.length
            ? "Illustrative epochs · UTC"
            : "Awaiting observations"}
        </span>
        <span>
          {frames.length
            ? "Aligned grid / fixed intensity stretch"
            : "Timeline available when data is connected"}
        </span>
      </div>
    </section>
  );
}
