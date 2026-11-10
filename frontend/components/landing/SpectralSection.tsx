"use client";
import { useState } from "react";
import { detectors, ranges } from "@/lib/types";
const explanations = [
  "Explore the short-wavelength edge of the survey. The demonstration emphasizes a different mix of stellar responses.",
  "The same sky, with a new balance of source intensities. All changes here are generated, not measured spectra.",
  "Continue into the near-infrared. Our simulation keeps source positions fixed while changing their modeled responses.",
  "At longer infrared wavelengths, cool sources can tell a different story. This is an illustrative response only.",
  "Inspect another simulated detector response. A common display stretch makes intensity differences visible.",
  "Reach the long-wavelength end of SPHEREx’s coverage. This visualization is not an instrument calibration.",
];
export default function SpectralSection() {
  const [d, setD] = useState(0);
  return (
    <section className="spectral section-pad" id="spectrum">
      <div className="section-heading">
        <p className="eyebrow">02 / BEYOND VISIBLE LIGHT</p>
        <h2>
          102 WINDOWS
          <br />
          INTO THE <em>UNIVERSE.</em>
        </h2>
        <p>
          There is more to the sky than meets the eye.
          <br />
          Explore six arrays. Imagine a wider spectrum.
        </p>
      </div>
      <div className="spectral-grid">
        <div className="spectral-art reveal-image">
          <div
            className="spectral-nebula"
            style={{
              filter: `hue-rotate(${d * 13}deg) brightness(${0.75 + d * 0.06})`,
            }}
          />
          <div className="spectral-data">
            {detectors.map((det, i) => (
              <img
                key={det}
                src={`/demo/detector-${i + 1}.png`}
                alt={i === d ? `Synthetic intensity response for ${det}` : ""}
                aria-hidden={i !== d}
                style={{ opacity: i === d ? 1 : 0 }}
              />
            ))}
            <span className="mono">{detectors[d]} / SIMULATED INTENSITY</span>
          </div>
          <span className="spectral-art-note">
            ARTISTIC CONTEXT + SYNTHETIC FIELD INSET
          </span>
        </div>
        <div className="spectral-controls">
          <p className="eyebrow">SELECT A DETECTOR ARRAY</p>
          <div className="spectral-selectors">
            {detectors.map((det, i) => (
              <button
                onClick={() => setD(i)}
                aria-pressed={d === i}
                className={i === d ? "selected" : ""}
                key={det}
              >
                {det}
              </button>
            ))}
          </div>
          <div className="wavelength-number">
            {ranges[d]} <span>µm</span>
          </div>
          <p className="spectral-explanation" aria-live="polite">
            {explanations[d]}
          </p>
          <div className="wavelength-track">
            <span style={{ left: `${(d / 6) * 100}%`, width: `${100 / 6}%` }} />
          </div>
          <div className="wavelength-labels mono">
            <span>0.75 µm</span>
            <span>5.00 µm</span>
          </div>
          <p className="spectral-note">
            Six detector arrays, not six RGB filters. SPHEREx uses linear
            variable filters: wavelength changes with position on each detector.
            Infrared colors here are assigned for visualization.
          </p>
        </div>
      </div>
    </section>
  );
}
