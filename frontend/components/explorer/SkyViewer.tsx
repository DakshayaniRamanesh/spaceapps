"use client";
import { useEffect, useRef, useState } from "react";
import { Maximize, Plus, Minus, Crosshair, Move } from "lucide-react";
import { ObservationSet, Mode, dateLabel } from "@/lib/types";
export default function SkyViewer({
  data,
  index,
  mode,
  a,
  b,
  blinkIndex,
  loading,
}: {
  data: ObservationSet;
  index: number;
  mode: Mode;
  a: number;
  b: number;
  blinkIndex: number;
  loading: boolean;
}) {
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [crosshair, setCrosshair] = useState(true),
    [imageStatus, setImageStatus] = useState<
      Record<string, "loaded" | "failed">
    >({}),
    [retry, setRetry] = useState(0);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const fa = data.frames[a],
    fb = data.frames[b];
  const current =
    mode === "blink" ? (blinkIndex ? fb : fa) : data.frames[index];
  const diff = `/api/difference?${new URLSearchParams({ frame_a: fa.id, frame_b: fb.id })}`;
  const images =
    mode === "split"
      ? [
          { src: fa.image_url, label: `A · ${dateLabel(fa.timestamp)}` },
          { src: fb.image_url, label: `B · ${dateLabel(fb.timestamp)}` },
        ]
      : [
          {
            src: mode === "difference" ? diff : current.image_url,
            label:
              mode === "difference"
                ? "B − A · intensity residual"
                : dateLabel(current.timestamp),
          },
        ];
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setImageStatus({});
    setRetry(0);
  }, [data.dataset_id]);
  function fit() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }
  function zoomBy(delta: number) {
    setZoom((z) => {
      const v = Math.min(8, Math.max(1, z + delta));
      if (v === 1) setPan({ x: 0, y: 0 });
      return v;
    });
  }
  return (
    <section
      className="viewer panel"
      aria-label="Scientific observation viewer"
    >
      <div className="viewer-heading">
        <span>
          <i className="live-dot" />{" "}
          {mode === "difference" ? "DIFFERENCE IMAGE" : "OBSERVATION FIELD"}
        </span>
        <span className="mono">
          {data.request.detector} / {data.request.fov_arcmin} ARCMIN
        </span>
      </div>
      <div
        className={`image-stage ${mode === "split" ? "split" : ""}`}
        tabIndex={0}
        aria-label="Image viewport. Use zoom buttons, then drag to pan."
        onKeyDown={(e) => {
          if (e.key === "+" || e.key === "=") {
            e.preventDefault();
            zoomBy(0.5);
          }
          if (e.key === "-") {
            e.preventDefault();
            zoomBy(-0.5);
          }
          if (e.key === "0") fit();
          if (zoom > 1 && e.shiftKey && e.key.startsWith("Arrow")) {
            e.preventDefault();
            e.stopPropagation();
            setPan((p) => ({
              x:
                p.x +
                (e.key === "ArrowLeft" ? 10 : e.key === "ArrowRight" ? -10 : 0),
              y:
                p.y +
                (e.key === "ArrowUp" ? 10 : e.key === "ArrowDown" ? -10 : 0),
            }));
          }
        }}
      >
        {images.map((img, i) => (
          <div
            className="image-port"
            key={i}
            style={{
              cursor: zoom > 1 ? "grab" : "default",
              touchAction: zoom > 1 ? "none" : "pan-y",
            }}
            onPointerDown={(e) => {
              if (zoom <= 1) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                px: pan.x,
                py: pan.y,
              };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const limit = 180 * (zoom - 1);
              setPan({
                x: Math.max(
                  -limit,
                  Math.min(limit, drag.current.px + e.clientX - drag.current.x),
                ),
                y: Math.max(
                  -limit,
                  Math.min(limit, drag.current.py + e.clientY - drag.current.y),
                ),
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
          >
            <img
              className="observation-image"
              draggable={false}
              src={
                retry
                  ? `${img.src}${img.src.includes("?") ? "&" : "?"}retry=${retry}`
                  : img.src
              }
              alt={
                mode === "difference"
                  ? "Calculated B minus A difference: amber positive, violet negative"
                  : `Synthetic astronomical field, ${img.label}`
              }
              style={{
                transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
              }}
              onError={() =>
                setImageStatus((s) => ({ ...s, [img.src]: "failed" }))
              }
              onLoad={() =>
                setImageStatus((s) => ({ ...s, [img.src]: "loaded" }))
              }
            />
            <div className="image-date mono">{img.label}</div>
            {crosshair && <div className="crosshair" aria-hidden="true" />}
            <div className="orientation mono" aria-hidden="true">
              <span>N</span>↑<br />E ←
            </div>
          </div>
        ))}
        <div className="coordinate-overlay mono">
          RA {data.request.ra.toFixed(4)}°<br />
          DEC {data.request.dec.toFixed(4)}°
        </div>
        <span className="synthetic-watermark">
          SYNTHETIC / NOT TELESCOPE DATA
        </span>
        {(loading || images.some((img) => !imageStatus[img.src])) && (
          <div className="viewer-loading" role="status">
            <span className="spinner" />
            {loading ? "Generating registered observations…" : "Loading image…"}
          </div>
        )}
        {images.some((img) => imageStatus[img.src] === "failed") && (
          <div className="viewer-loading error" role="alert">
            Image unavailable.
            <button
              className="button secondary"
              onClick={() => {
                setImageStatus({});
                setRetry((r) => r + 1);
              }}
            >
              Retry image
            </button>
          </div>
        )}
      </div>
      <div className="viewer-toolbar">
        <div className="zoom-controls">
          <button
            aria-label="Zoom out"
            title="Zoom out (−)"
            onClick={() => zoomBy(-0.5)}
            disabled={zoom === 1}
          >
            <Minus size={16} />
          </button>
          <span className="mono">{Math.round(zoom * 100)}%</span>
          <button
            aria-label="Zoom in"
            title="Zoom in (+)"
            onClick={() => zoomBy(0.5)}
            disabled={zoom === 8}
          >
            <Plus size={16} />
          </button>
          <button
            onClick={fit}
            title="Fit to view (0)"
            aria-label="Fit to view"
          >
            <Maximize size={16} />
          </button>
          <button
            aria-pressed={crosshair}
            onClick={() => setCrosshair((v) => !v)}
            title="Toggle crosshair"
            aria-label="Toggle crosshair"
          >
            <Crosshair size={16} />
          </button>
        </div>
        {mode === "difference" ? (
          <span className="difference-legend">
            <i /> Negative <b /> Positive · B − A
          </span>
        ) : (
          <span className="pan-hint">
            <Move size={13} />{" "}
            {zoom > 1
              ? "Drag to pan · Shift + arrows"
              : "Zoom to inspect the field"}
          </span>
        )}
      </div>
    </section>
  );
}
