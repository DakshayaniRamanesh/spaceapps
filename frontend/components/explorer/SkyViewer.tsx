"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  Maximize,
  Plus,
  Minus,
  Crosshair,
  Move,
  LassoSelect,
  ScanSearch,
  Eye,
  EyeOff,
  X,
  ShieldAlert,
  Waypoints,
} from "lucide-react";
import { ObservationSet, Mode, dateLabel } from "@/lib/types";
import {
  RegionPoint,
  clamp01,
  computeMotionMetrics,
  frameRegion,
  isUsableRegion,
  polygonAttr,
  regionSummary,
  simplifyPath,
} from "@/lib/sky-region";
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
    [retry, setRetry] = useState(0),
    [tool, setTool] = useState<"pan" | "lasso" | "track">("pan"),
    [draft, setDraft] = useState<RegionPoint[] | null>(null),
    [region, setRegion] = useState<RegionPoint[] | null>(null),
    [hideOutside, setHideOutside] = useState(false),
    [maskOverlay, setMaskOverlay] = useState(false),
    [pinA, setPinA] = useState<
      (RegionPoint & { frameId: string; timestamp: string; label: string }) | null
    >(null),
    [pinB, setPinB] = useState<
      (RegionPoint & { frameId: string; timestamp: string; label: string }) | null
    >(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const lassoCanvas = useRef<HTMLElement | null>(null);
  const canvasSize = useRef(360);
  const maskId = useId().replace(/:/g, "");
  const geometryKey = `${data.request.ra}|${data.request.dec}|${data.request.fov_arcmin}`;
  const fa = data.frames[a],
    fb = data.frames[b];
  const current =
    mode === "blink" ? (blinkIndex ? fb : fa) : data.frames[index];
  const diff = `/api/difference?${new URLSearchParams({ frame_a: fa.id, frame_b: fb.id })}`;
  const withOverlay = (url: string) =>
    maskOverlay ? `${url}${url.includes("?") ? "&" : "?"}overlay=mask` : url;
  const images =
    mode === "split"
      ? [
          {
            src: withOverlay(fa.image_url),
            label: `A · ${dateLabel(fa.timestamp)}`,
          },
          {
            src: withOverlay(fb.image_url),
            label: `B · ${dateLabel(fb.timestamp)}`,
          },
        ]
      : [
          {
            src:
              mode === "difference"
                ? withOverlay(diff)
                : withOverlay(current.image_url),
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
  // A region is defined on the registered grid, so it stays valid across
  // epochs, detectors and comparison modes — but not when the field moves.
  useEffect(() => {
    setRegion(null);
    setDraft(null);
    setPinA(null);
    setPinB(null);
    setTool("pan");
  }, [geometryKey]);
  function panLimit(z: number) {
    return (canvasSize.current * z) / 2;
  }
  function clampPan(p: { x: number; y: number }, z: number) {
    const limit = z > 1 ? panLimit(z) : 0;
    return {
      x: Math.max(-limit, Math.min(limit, p.x)),
      y: Math.max(-limit, Math.min(limit, p.y)),
    };
  }
  function toGrid(e: { clientX: number; clientY: number }, el: HTMLElement) {
    // getBoundingClientRect reflects the zoom/pan transform, so drawing stays
    // accurate while zoomed in.
    const r = el.getBoundingClientRect();
    return {
      u: clamp01((e.clientX - r.left) / r.width),
      v: clamp01((e.clientY - r.top) / r.height),
    };
  }
  function finishLasso() {
    if (draft) {
      const path = simplifyPath(draft);
      if (isUsableRegion(path)) {
        setRegion(path);
        setTool("pan");
      }
    }
    setDraft(null);
    lassoCanvas.current = null;
  }
  function focusRegion() {
    if (!region) return;
    const f = frameRegion(region, canvasSize.current);
    setZoom(f.zoom);
    setPan(clampPan(f.pan, f.zoom));
  }
  function clearRegion() {
    setRegion(null);
    setDraft(null);
    fit();
  }
  const summary = region ? regionSummary(region, data.request) : null;
  const motion =
    pinA && pinB && pinA.frameId !== pinB.frameId
      ? computeMotionMetrics(
          pinA,
          pinB,
          data.request,
          pinA.timestamp,
          pinB.timestamp,
        )
      : pinA && pinB
        ? computeMotionMetrics(pinA, pinB, data.request)
        : null;
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
        key={mode}
        className={`image-stage mode-enter ${mode === "split" ? "split" : ""}`}
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
          if (e.key === "l" || e.key === "L") {
            e.preventDefault();
            setDraft(null);
            setTool((t) => (t === "lasso" ? "pan" : "lasso"));
          }
          if (e.key === "t" || e.key === "T") {
            e.preventDefault();
            setDraft(null);
            setTool((t) => (t === "track" ? "pan" : "track"));
          }
          if (e.key === "m" || e.key === "M") {
            e.preventDefault();
            setMaskOverlay((v) => !v);
          }
          if (e.key === "Escape") {
            if (draft) setDraft(null);
            else if (tool === "lasso" || tool === "track") setTool("pan");
            else if (pinA || pinB) {
              setPinA(null);
              setPinB(null);
            } else if (region) clearRegion();
          }
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
              cursor:
                tool === "lasso" || tool === "track"
                  ? "crosshair"
                  : zoom > 1
                    ? "grab"
                    : "default",
              touchAction:
                tool === "lasso" || tool === "track" || zoom > 1
                  ? "none"
                  : "pan-y",
            }}
            onPointerDown={(e) => {
              if (tool === "track") {
                const canvas = e.currentTarget.querySelector<HTMLElement>(
                  ".image-canvas",
                );
                if (!canvas) return;
                e.preventDefault();
                const pt = toGrid(e, canvas);
                if (mode === "split") {
                  const pinFrame = i === 0 ? fa : fb;
                  const pinned = {
                    ...pt,
                    frameId: pinFrame.id,
                    timestamp: pinFrame.timestamp,
                    label: dateLabel(pinFrame.timestamp),
                  };
                  if (i === 0) setPinA(pinned);
                  else setPinB(pinned);
                } else {
                  const placingA = !pinA || (pinA && pinB);
                  const pinFrame =
                    mode === "difference"
                      ? placingA
                        ? fa
                        : fb
                      : current;
                  const pinned = {
                    ...pt,
                    frameId: pinFrame.id,
                    timestamp: pinFrame.timestamp,
                    label: dateLabel(pinFrame.timestamp),
                  };
                  if (placingA) {
                    setPinA(pinned);
                    setPinB(null);
                  } else {
                    setPinB(pinned);
                  }
                }
                return;
              }
              if (tool === "lasso") {
                const canvas = e.currentTarget.querySelector<HTMLElement>(
                  ".image-canvas",
                );
                if (!canvas) return;
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                lassoCanvas.current = canvas;
                setDraft([toGrid(e, canvas)]);
                return;
              }
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
              if (tool === "lasso" && lassoCanvas.current) {
                const pt = toGrid(e, lassoCanvas.current);
                setDraft((d) => {
                  if (!d) return d;
                  const last = d[d.length - 1];
                  return Math.hypot(pt.u - last.u, pt.v - last.v) < 0.002
                    ? d
                    : [...d, pt];
                });
                return;
              }
              if (!drag.current) return;
              setPan(
                clampPan(
                  {
                    x: drag.current.px + e.clientX - drag.current.x,
                    y: drag.current.py + e.clientY - drag.current.y,
                  },
                  zoom,
                ),
              );
            }}
            onPointerUp={() => {
              if (lassoCanvas.current) finishLasso();
              drag.current = null;
            }}
            onPointerCancel={() => {
              setDraft(null);
              lassoCanvas.current = null;
              drag.current = null;
            }}
            onLostPointerCapture={() => {
              if (lassoCanvas.current) finishLasso();
              drag.current = null;
            }}
          >
            <div
              className="image-canvas"
              ref={(el) => {
                if (el && el.offsetWidth) canvasSize.current = el.offsetWidth;
              }}
              style={{
                transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
              }}
            >
              <img
                key={img.src}
                className={`observation-image ${mode === "single" && !loading ? "frame-enter" : ""}`}
                draggable={false}
                src={
                  retry
                    ? `${img.src}${img.src.includes("?") ? "&" : "?"}retry=${retry}`
                    : img.src
                }
                alt={
                  mode === "difference"
                    ? "Calculated B minus A difference: amber positive, violet negative"
                    : data.source_type === "spherex-irsa"
                      ? `SPHEREx astronomical field, ${img.label}`
                      : `Synthetic astronomical field, ${img.label}`
                }
                onError={() =>
                  setImageStatus((s) => ({ ...s, [img.src]: "failed" }))
                }
                onLoad={() =>
                  setImageStatus((s) => ({ ...s, [img.src]: "loaded" }))
                }
              />
              {(region || draft || pinA || pinB) && (
                <svg
                  className="region-overlay"
                  viewBox="0 0 1 1"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    {region && (
                      <mask id={`${maskId}-${i}`}>
                        <rect width="1" height="1" fill="white" />
                        <polygon points={polygonAttr(region)} fill="black" />
                      </mask>
                    )}
                    <marker
                      id={`${maskId}-arrow-${i}`}
                      viewBox="0 0 10 10"
                      refX="7"
                      refY="5"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 8 5 L 0 9 z" fill="#6ee7ff" />
                    </marker>
                  </defs>
                  {region && (
                    <>
                      <rect
                        width="1"
                        height="1"
                        className="region-shade"
                        style={{ opacity: hideOutside ? 1 : 0.72 }}
                        mask={`url(#${maskId}-${i})`}
                      />
                      <polygon
                        points={polygonAttr(region)}
                        className="region-outline"
                        vectorEffect="non-scaling-stroke"
                      />
                    </>
                  )}
                  {draft && draft.length > 1 && (
                    <polyline
                      points={polygonAttr(draft)}
                      className="region-draft"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {pinA && pinB && (
                    <line
                      x1={pinA.u}
                      y1={pinA.v}
                      x2={pinB.u}
                      y2={pinB.v}
                      className="motion-vector"
                      vectorEffect="non-scaling-stroke"
                      markerEnd={`url(#${maskId}-arrow-${i})`}
                    />
                  )}
                  {pinA && (
                    <g>
                      <circle
                        cx={pinA.u}
                        cy={pinA.v}
                        r={0.012}
                        className="motion-pin pin-a"
                        vectorEffect="non-scaling-stroke"
                      />
                      <text
                        x={pinA.u + 0.016}
                        y={pinA.v - 0.012}
                        className="motion-pin-label"
                      >
                        A
                      </text>
                    </g>
                  )}
                  {pinB && (
                    <g>
                      <circle
                        cx={pinB.u}
                        cy={pinB.v}
                        r={0.012}
                        className="motion-pin pin-b"
                        vectorEffect="non-scaling-stroke"
                      />
                      <text
                        x={pinB.u + 0.016}
                        y={pinB.v - 0.012}
                        className="motion-pin-label"
                      >
                        B
                      </text>
                    </g>
                  )}
                </svg>
              )}
            </div>            <div className="image-date mono">{img.label}</div>
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
        {data.source_type === "spherex-irsa" ? (
          <span className="archive-watermark">
            NASA / IPAC IRSA SPHEREx DR1+QR3 ARCHIVE
          </span>
        ) : (
          <span className="synthetic-watermark">
            SYNTHETIC / NOT TELESCOPE DATA
          </span>
        )}
        {loading && (
          <div className="viewer-loading" role="status">
            <span className="spinner" />
            Generating registered observations…
          </div>
        )}
        {!loading && images.some((img) => imageStatus[img.src] === "failed") ? (
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
        ) : !loading && images.some((img) => !imageStatus[img.src]) ? (
          <div className="viewer-loading" role="status">
            <span className="spinner" />
            Loading image…
          </div>
        ) : null}
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
          <button
            aria-pressed={tool === "lasso"}
            onClick={() => {
              setDraft(null);
              setTool((t) => (t === "lasso" ? "pan" : "lasso"));
            }}
            title="Lasso: draw around a patch of sky to focus on it (L)"
            aria-label="Lasso select region"
          >
            <LassoSelect size={16} />
          </button>
          <button
            aria-pressed={maskOverlay}
            onClick={() => setMaskOverlay((v) => !v)}
            title="Toggle data quality & footprint mask overlay (M)"
            aria-label="Toggle data quality mask overlay"
          >
            <ShieldAlert size={16} />
          </button>
          <button
            aria-pressed={tool === "track"}
            onClick={() => {
              setDraft(null);
              setTool((t) => (t === "track" ? "pan" : "track"));
            }}
            title="Track celestial motion: click source in Epoch A then Epoch B (T)"
            aria-label="Track celestial motion"
          >
            <Waypoints size={16} />
          </button>
        </div>
        {tool === "lasso" ? (
          <span className="pan-hint lasso-hint">
            <LassoSelect size={13} /> Draw around the objects to focus on · Esc
            to cancel
          </span>
        ) : tool === "track" ? (
          <span className="pan-hint lasso-hint">
            <Waypoints size={13} /> Click source position in Epoch A, then in
            Epoch B to measure Δθ and proper motion μ
          </span>
        ) : mode === "difference" ? (
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
      {summary && (
        <div className="region-bar" role="group" aria-label="Selected region">
          <div className="region-stats mono">
            <span className="region-tag">Region</span>
            <span>
              Centre RA {summary.centroid.ra.toFixed(4)}° · Dec{" "}
              {summary.centroid.dec.toFixed(4)}°
            </span>
            <span>
              RA {summary.raRange[0].toFixed(4)}–{summary.raRange[1].toFixed(4)}°
              · Dec {summary.decRange[0].toFixed(4)}–
              {summary.decRange[1].toFixed(4)}°
            </span>
            <span>
              {summary.areaArcmin2 < 10
                ? summary.areaArcmin2.toFixed(2)
                : summary.areaArcmin2.toFixed(1)}{" "}
              arcmin² · {(summary.fractionOfField * 100).toFixed(1)}% of field
            </span>
          </div>
          <div className="region-actions">
            <button className="button secondary" onClick={focusRegion}>
              <ScanSearch size={15} /> Zoom to region
            </button>
            <button
              className="button secondary"
              aria-pressed={hideOutside}
              onClick={() => setHideOutside((h) => !h)}
              title={
                hideOutside
                  ? "Show the surrounding field dimmed"
                  : "Hide everything outside the region"
              }
            >
              {hideOutside ? <Eye size={15} /> : <EyeOff size={15} />}
              {hideOutside ? "Dim outside" : "Hide outside"}
            </button>
            <button
              className="button secondary"
              onClick={clearRegion}
              aria-label="Clear region"
            >
              <X size={15} /> Clear
            </button>
          </div>
        </div>
      )}
      {(pinA || pinB) && (
        <div
          className="region-bar motion-bar"
          role="group"
          aria-label="Celestial motion tracker"
        >
          <div className="region-stats mono">
            <span className="region-tag">Motion tracker</span>
            {pinA && !pinB ? (
              <span>
                Pin A set ({pinA.label}) · Switch to Epoch B and click source to
                compute Δθ and proper motion μ
              </span>
            ) : motion && pinA && pinB ? (
              <>
                <span>
                  Δθ = {motion.separationArcsec.toFixed(2)}″ (
                  {Math.round(motion.separationMas)} mas) · PA{" "}
                  {motion.positionAngleDeg.toFixed(1)}°
                </span>
                <span>
                  μ ={" "}
                  {pinA.frameId === pinB.frameId
                    ? "N/A (same epoch)"
                    : motion.properMotionMasYr !== null
                      ? `${motion.properMotionMasYr.toFixed(1)} mas/yr`
                      : "N/A"}
                  {motion.baselineDays !== null
                    ? ` · Δt ${motion.baselineDays.toFixed(1)} d`
                    : ""}
                </span>
                <span>
                  A [{pinA.label}] ({motion.pinA.ra.toFixed(4)}°,{" "}
                  {motion.pinA.dec.toFixed(4)}°) → B [{pinB.label}] (
                  {motion.pinB.ra.toFixed(4)}°, {motion.pinB.dec.toFixed(4)}°)
                </span>
              </>
            ) : null}
          </div>
          <div className="region-actions">
            <button
              className="button secondary"
              onClick={() => {
                setPinA(null);
                setPinB(null);
              }}
              aria-label="Clear pins"
            >
              <X size={15} /> Clear pins
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
