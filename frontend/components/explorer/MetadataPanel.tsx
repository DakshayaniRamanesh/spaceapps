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
    if (window.matchMedia("(max-width: 680px)").matches && disclosure.current)
      disclosure.current.open = false;
  }, []);
  const f = data.frames[index];
  const time = new Date(f.timestamp).toLocaleTimeString("en-GB", {
    timeZone: "UTC",
    hour12: false,
  });
  return (
    <aside className="intelligence">
      <details open ref={disclosure}>
        <summary>
          <Activity size={19} />
          Observation details
        </summary>
        <div className="metadata-body" key={`${index}-${mode}`}>
          <header>
            <p className="eyebrow">Current epoch</p>
            <h3>{dateLabel(f.timestamp)}</h3>
            <span className="mono muted">{time} UTC</span>
          </header>
          <section className="metadata-group">
            <h4>Observation details</h4>
            <dl>
              <dt>Data source</dt>
              <dd className={f.source === "spherex-irsa" ? "green" : "amber"}>
                {f.source === "spherex-irsa"
                  ? `SPHEREx Archive (${data.release || "DR1+QR3"})`
                  : "Synthetic development data"}
              </dd>
              {f.product_id ? (
                <>
                  <dt>Product ID</dt>
                  <dd className="numeric">{f.product_id}</dd>
                </>
              ) : null}
              {f.wavelength_um ? (
                <>
                  <dt>Wavelength</dt>
                  <dd className="numeric">{f.wavelength_um.toFixed(3)} µm</dd>
                </>
              ) : null}
              {data.intensity_unit ? (
                <>
                  <dt>Intensity unit</dt>
                  <dd className="numeric">{data.intensity_unit}</dd>
                </>
              ) : null}
              <dt>Detector</dt>
              <dd>{data.request.detector}</dd>
              <dt>Array range</dt>
              <dd className="numeric">
                {data.wavelength_range_um.join("–")} µm
              </dd>
              <dt>Center RA</dt>
              <dd className="numeric">{data.request.ra.toFixed(6)}°</dd>
              <dt>Center Dec</dt>
              <dd className="numeric">{data.request.dec.toFixed(6)}°</dd>
            </dl>
          </section>
          <section className="metadata-group">
            <h4>Image properties</h4>
            <dl>
              <dt>Field of view</dt>
              <dd className="numeric">
                {data.request.fov_arcmin}′ × {data.request.fov_arcmin}′
              </dd>
              <dt>Image size</dt>
              <dd className="numeric">
                {data.width} × {data.height} px
              </dd>
              <dt>Display stretch</dt>
              <dd>Fixed across epochs</dd>
            </dl>
          </section>
          <section className="metadata-group quality">
            <h4>Data quality</h4>
            <p>
              <i />
              Common registered grid
            </p>
            <p>
              <i />
              Gaussian PSF + seeded noise
            </p>
            <dl>
              <dt>Noise σ</dt>
              <dd className="numeric">{f.quality.noise_sigma} a.u.</dd>
              <dt>Masked fraction</dt>
              <dd className="numeric">
                {(f.quality.masked_fraction * 100).toFixed(1)}%
              </dd>
              <dt>Calibration</dt>
              <dd>
                {f.quality.calibrated
                  ? "Calibrated"
                  : "Not photometrically calibrated"}
              </dd>
            </dl>
          </section>
          <section className="metadata-group">
            <h4>Comparison information</h4>
            <dl>
              <dt>Display mode</dt>
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
              <dt>Available epochs</dt>
              <dd className="numeric">{data.frames.length}</dd>
            </dl>
          </section>
          <div className="viewer-help">
            <Info size={19} />
            <h4>Look for the change.</h4>
            <p>
              {mode === "difference"
                ? "Amber pixels gained intensity. Violet pixels lost intensity. A moving source leaves a positive and negative pair."
                : mode === "blink"
                  ? "Alternate two epochs. Steady stars stay fixed; the moving source appears to jump."
                  : "Two bright sources near the center demonstrate motion and variability. Zoom in, then compare epochs."}
            </p>
            <span>
              {f.source === "spherex-irsa"
                ? "NASA / IPAC IRSA SPHEREx DR1+QR3 calibrated observations (DOI: 10.26131/IRSA678)."
                : "Illustrative motion is exaggerated. No measured target data."}
            </span>
          </div>
        </div>
      </details>
    </aside>
  );
}
