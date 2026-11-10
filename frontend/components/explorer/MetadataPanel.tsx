"use client";
import { useEffect, useRef } from "react";
import { Activity, Info } from "lucide-react";
import { ObservationSet, Mode, dateLabel } from "@/lib/types";
export default function MetadataPanel({
  data,
  index,
  mode,
}: {
  data: ObservationSet;
  index: number;
  mode: Mode;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (window.matchMedia("(max-width: 620px)").matches && disclosure.current)
      disclosure.current.open = false;
  }, []);
  const f = data.frames[index];
  return (
    <aside className="intelligence panel">
      <details open ref={disclosure}>
        <summary>
          <Activity size={16} /> Observation intelligence
        </summary>
        <div className="metadata-body">
          <span className="eyebrow">CURRENT EPOCH</span>
          <h3>{dateLabel(f.timestamp)}</h3>
          <span className="mono muted">03:24:00 UTC · simulated</span>
          <dl>
            <dt>Data source</dt>
            <dd className="amber">Synthetic demo</dd>
            <dt>Detector</dt>
            <dd>{data.request.detector}</dd>
            <dt>Array range</dt>
            <dd>{data.wavelength_range_um.join("–")} µm</dd>
            <dt>Field of view</dt>
            <dd>
              {data.request.fov_arcmin}′ × {data.request.fov_arcmin}′
            </dd>
            <dt>Image size</dt>
            <dd>
              {data.width} × {data.height} px
            </dd>
            <dt>Center RA</dt>
            <dd>{data.request.ra.toFixed(6)}°</dd>
            <dt>Center Dec</dt>
            <dd>{data.request.dec.toFixed(6)}°</dd>
            <dt>Mode</dt>
            <dd>
              {
                {
                  single: "Single frame",
                  blink: "Blink comparison",
                  split: "Side by side",
                  difference: "Difference B − A",
                }[mode]
              }
            </dd>
          </dl>
          <div className="quality">
            <span className="eyebrow">SIMULATION QUALITY</span>
            <p>
              <i /> Common registered grid
            </p>
            <p>
              <i /> Gaussian PSF + seeded noise
            </p>
            <p>
              <i /> Fixed display stretch
            </p>
            <p className="muted">
              Noise σ: {f.quality.noise_sigma} a.u.
              <br />
              Not photometrically calibrated.
            </p>
          </div>
          <div className="viewer-help">
            <Info size={17} />
            <h4>Look for the change.</h4>
            <p>
              {mode === "difference"
                ? "Amber pixels gained intensity. Violet pixels lost intensity. A moving source leaves a positive and negative pair."
                : mode === "blink"
                  ? "Alternate the first and last epochs. Steady stars stay fixed; the moving source appears to jump."
                  : "Two bright sources near the center demonstrate motion and variability. Zoom in, then compare epochs."}
            </p>
            <span>Motion is exaggerated for clarity.</span>
          </div>
        </div>
      </details>
    </aside>
  );
}
