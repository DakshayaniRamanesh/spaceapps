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
  const real = data.source_type === "spherex-irsa";
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
              <dd className="amber">
                {real
                  ? "NASA/IPAC IRSA · SPHEREx"
                  : "Synthetic development data"}
              </dd>
              <dt>Detector</dt>
              <dd>{data.request.detector}</dd>
              <dt>Array range</dt>
              <dd className="numeric">
                {data.wavelength_range_um.join("–")} µm
              </dd>
              {real && (
                <>
                  <dt>Center wavelength</dt>
                  <dd>{f.lambda_um?.toFixed(4) ?? "Unknown"} µm</dd>
                  <dt>Center bandwidth</dt>
                  <dd>{f.bandwidth_um?.toFixed(4) ?? "Unknown"} µm</dd>
                  <dt>Wavelength basis</dt>
                  <dd>{f.wavelength_origin}</dd>
                </>
              )}
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
              {real
                ? "Common celestial grid; see pair checks"
                : "Common registered grid"}
            </p>
            <p>
              <i />
              {real
                ? "Conservative pixel-quality mask"
                : "Gaussian PSF + seeded noise"}
            </p>
            <dl>
              <dt>Noise σ</dt>
              <dd className="numeric">
                {f.quality.noise_sigma?.toPrecision(3) ?? "Unknown"}{" "}
                {real ? "MJy/sr" : "a.u."}
              </dd>
              <dt>Masked fraction</dt>
              <dd className="numeric">
                {(f.quality.masked_fraction * 100).toFixed(1)}%
              </dd>
              {real && (
                <>
                  <dt>Center-region coverage</dt>
                  <dd>
                    {f.quality.center_region_valid_fraction == null
                      ? "Unknown"
                      : `${(f.quality.center_region_valid_fraction * 100).toFixed(0)}% valid`}
                  </dd>
                </>
              )}
              <dt>Calibration</dt>
              <dd>
                {f.quality.calibrated
                  ? "Archive-calibrated image"
                  : "Not photometrically calibrated"}
              </dd>
            </dl>
          </section>
          {real && (
            <section className="metadata-group provenance">
              <h4>Archive provenance</h4>
              <dl>
                <dt>Observation ID</dt>
                <dd>{f.obs_id}</dd>
                <dt>Collection</dt>
                <dd>{f.collection}</dd>
                <dt>Pipeline version</dt>
                <dd>{f.product_version}</dd>
                <dt>SkyTrace processing</dt>
                <dd>{data.processing_version}</dd>
                <dt>Cutout SHA-256</dt>
                <dd>
                  <code>{f.sha256}</code>
                </dd>
              </dl>
              <p>
                <a
                  href={f.access_url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  Original NASA FITS product ↗
                </a>
              </p>
              <p>
                <a
                  href={f.cutout_url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  Exact archive cutout ↗
                </a>
              </p>
              <p>
                <a href={`/api/frames/${f.id}/original.fits`}>
                  Download cached original FITS
                </a>
              </p>
              <p>
                <a href={`/api/frames/${f.id}/science.npz`}>
                  Download aligned arrays and mask
                </a>
              </p>
            </section>
          )}
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
              {real
                ? "Blink to inspect differences. Wavelength, image blur, masks and background can also change appearance; the evidence panel explains limitations."
                : mode === "difference"
                  ? "Amber pixels gained intensity. Violet pixels lost intensity. A moving source leaves a positive and negative pair."
                  : mode === "blink"
                    ? "Alternate two epochs. Steady stars stay fixed; the moving source appears to jump."
                    : "Two bright sources near the center demonstrate motion and variability. Zoom in, then compare epochs."}
            </p>
            <span>
              {real
                ? "These are real exposures. No discovery or measured target motion is claimed."
                : "Illustrative motion is exaggerated. No measured target data."}
            </span>
          </div>
        </div>
      </details>
    </aside>
  );
}
