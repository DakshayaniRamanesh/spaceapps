import Link from "next/link";
import {
  ArrowUpRight,
  Scan,
  Columns2,
  Blend,
  Layers,
  Crosshair,
  Plus,
  Minus,
} from "lucide-react";
import Timeline from "./Timeline";
export default function EmptyObservatory({
  loading,
  message,
}: {
  loading: boolean;
  message?: string;
}) {
  return (
    <>
      <div className="mode-tabs" role="group" aria-label="Comparison mode">
        {[
          [Scan, "Single frame"],
          [Blend, "Blink"],
          [Columns2, "Side by side"],
          [Layers, "Difference"],
        ].map(([Icon, label]) => {
          const Mark = Icon as typeof Scan;
          return (
            <button key={String(label)} disabled>
              <Mark size={18} />
              {String(label)}
            </button>
          );
        })}
      </div>
      <section
        className="empty-observatory"
        aria-label="Scientific observation viewer"
        aria-busy={loading}
      >
        <div className="viewer-heading">
          <span>Observation field</span>
          <span>{loading ? "Searching archive" : "No images loaded"}</span>
        </div>
        <div className="ready-stage">
          <div className="ready-orbit" aria-hidden="true">
            <span />
            <span />
            <Crosshair size={34} />
          </div>
          <p className="eyebrow">Your next discovery starts here.</p>
          <h2>
            OBSERVATORY
            <br />
            READY.
          </h2>
          <p>
            Choose a featured field or search real SPHEREx exposures by
            coordinates.
          </p>
          <Link className="text-link" href="/about#integration">
            About the data connection <ArrowUpRight size={19} />
          </Link>
          <p className="connection-status" role="status">
            {message ||
              (loading
                ? "Checking the observation provider…"
                : "Choose another field or detector to search again.")}
          </p>
        </div>
        <div className="viewer-toolbar">
          <div className="zoom-controls">
            <button disabled aria-label="Zoom out">
              <Minus size={18} />
            </button>
            <span>Fit to view</span>
            <button disabled aria-label="Zoom in">
              <Plus size={18} />
            </button>
          </div>
          <span className="pan-hint">Image controls unlock with data</span>
        </div>
      </section>
      <Timeline
        frames={[]}
        index={0}
        onIndex={() => {}}
        playing={false}
        onPlay={() => {}}
        speed={1}
        onSpeed={() => {}}
        disabled
      />
    </>
  );
}
