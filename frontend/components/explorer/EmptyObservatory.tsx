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
  error,
  onRetry,
}: {
  loading: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  const isNoResults =
    error &&
    (error.toLowerCase().includes("no observations") ||
      error.toLowerCase().includes("no spherex archival"));
  const isServiceOffline =
    error &&
    (error.toLowerCase().includes("unavailable") ||
      error.toLowerCase().includes("cannot reach") ||
      error.toLowerCase().includes("offline"));

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
          <span>
            {loading
              ? "Querying archive…"
              : error
                ? "Request error"
                : "No data connected"}
          </span>
        </div>
        <div className="ready-stage">
          <div className="ready-orbit" aria-hidden="true">
            <span />
            <span />
            <Crosshair size={34} />
          </div>
          <p className="eyebrow">
            {loading
              ? "Archival query in progress"
              : error
                ? "Observation status"
                : "Your next discovery starts here."}
          </p>
          <h2>
            {loading ? (
              <>
                SEARCHING
                <br />
                ARCHIVE…
              </>
            ) : isNoResults ? (
              <>
                NO EXPOSURES
                <br />
                FOUND.
              </>
            ) : isServiceOffline ? (
              <>
                SERVICE
                <br />
                OFFLINE.
              </>
            ) : error ? (
              <>
                ARCHIVE
                <br />
                ERROR.
              </>
            ) : (
              <>
                OBSERVATORY
                <br />
                READY.
              </>
            )}
          </h2>
          <p>
            {loading
              ? "Querying NASA / IPAC IRSA archive for calibrated SPHEREx exposures…"
              : error
                ? error
                : "Connect SPHEREx observations to explore the infrared sky."}
          </p>
          {onRetry && error && !loading && (
            <button
              className="button secondary"
              style={{ marginTop: 20 }}
              onClick={onRetry}
            >
              Retry query
            </button>
          )}
          <Link className="text-link" href="/about#integration">
            About the data connection <ArrowUpRight size={19} />
          </Link>
          <p className="connection-status" role="status">
            {loading
              ? "Querying the SPHEREx DR1+QR3 observation archive…"
              : error
                ? "Update your coordinates or detector selection and retry."
                : "Awaiting a validated observation source"}
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
