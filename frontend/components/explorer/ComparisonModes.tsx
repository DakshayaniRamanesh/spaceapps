import { Scan, Columns2, Blend, Layers } from "lucide-react";
import { Mode, Frame, dateLabel } from "@/lib/types";
const modes = [
  { id: "single", label: "Single frame", icon: Scan },
  { id: "blink", label: "Blink", icon: Blend },
  { id: "split", label: "Side by side", icon: Columns2 },
  { id: "difference", label: "Difference", icon: Layers },
] as const;
export default function ComparisonModes({
  mode,
  onMode,
  frames,
  a,
  b,
  onPair,
  blinkSpeed,
  onBlinkSpeed,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  frames: Frame[];
  a: number;
  b: number;
  onPair: (a: number, b: number) => void;
  blinkSpeed: number;
  onBlinkSpeed: (n: number) => void;
}) {
  return (
    <div className="comparison">
      <div className="mode-tabs" role="group" aria-label="Comparison mode">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => onMode(m.id)}
            aria-pressed={mode === m.id}
            className={mode === m.id ? "active" : ""}
          >
            <m.icon size={15} />
            {m.label}
          </button>
        ))}
      </div>
      {mode !== "single" && (
        <div className="comparison-options">
          <label>
            Frame A
            <select
              aria-label="Frame A"
              value={a}
              onChange={(e) => onPair(Number(e.target.value), b)}
            >
              {frames.map((f, i) => (
                <option value={i} key={i}>
                  {i + 1} · {dateLabel(f.timestamp)}
                </option>
              ))}
            </select>
          </label>
          <span>→</span>
          <label>
            Frame B
            <select
              aria-label="Frame B"
              value={b}
              onChange={(e) => onPair(a, Number(e.target.value))}
            >
              {frames.map((f, i) => (
                <option value={i} key={i}>
                  {i + 1} · {dateLabel(f.timestamp)}
                </option>
              ))}
            </select>
          </label>
          {mode === "blink" && (
            <label>
              Blink interval
              <select
                value={blinkSpeed}
                onChange={(e) => onBlinkSpeed(Number(e.target.value))}
              >
                <option value={1000}>1 second</option>
                <option value={500}>0.5 seconds</option>
                <option value={250}>0.25 seconds</option>
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
