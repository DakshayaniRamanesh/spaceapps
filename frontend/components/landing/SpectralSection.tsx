"use client";
import { useState } from "react";
import { detectors, ranges } from "@/lib/types";
const explanations = [
  "The short-wavelength edge of the survey. This array covers a range of infrared wavelengths, rather than a single color.",
  "A different part of the near-infrared spectrum. Wavelength varies across the detector behind a linear variable filter.",
  "Repeated pointings build spectral coverage. A source is measured at different wavelengths as its position changes on the array.",
  "Longer wavelengths offer another view of the sky. Comparable epochs must be selected at matching spectral regions.",
  "The array range describes coverage, not a measured spectrum of the image shown here.",
  "The long-wavelength end of SPHEREx’s coverage. Real observations require wavelength calibration, masks and uncertainty information.",
];
export default function SpectralSection() {
  const [d, setD] = useState(0);
  return (
    <section
      className="infrared-section"
      id="spectrum"
      aria-label="Infrared discovery"
    >
      <div className="infrared-sticky">
        <div className="infrared-image-wrap">
          <img
            src="/images/deep-space.jpg"
            className="infrared-image"
            alt="Deep starry sky and Milky Way"
          />
          <img
            src="/images/deep-space.jpg"
            className="infrared-monochrome"
            alt=""
            aria-hidden="true"
          />
          <div className="infrared-shade" />
        </div>
        <div className="infrared-heading">
          <p className="eyebrow">02 — Infrared discovery</p>
          <h2>
            BEYOND
            <br />
            WHAT THE EYE
            <br />
            CAN SEE.
          </h2>
        </div>
        <div className="detector-overlay">
          <span className="spectrum-number" aria-hidden="true">
            102
          </span>
          <p className="spectrum-intro">
            Spectral bands.
            <br />A wider view of the universe.
          </p>
          <div
            className="spectral-selectors"
            role="group"
            aria-label="Detector arrays"
          >
            {detectors.map((det, i) => (
              <button
                key={det}
                className={i === d ? "selected" : ""}
                aria-pressed={i === d}
                onClick={() => setD(i)}
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
            <span style={{ transform: `translateX(${d * 100}%)` }} />
          </div>
          <div className="wavelength-labels">
            <span>0.75 µm</span>
            <span>5.00 µm</span>
          </div>
          <p className="caption">
            Six arrays, not six RGB filters. The background is a Webb composite;
            its scroll transition is an editorial treatment, not spectral
            processing.
          </p>
        </div>
        <p className="infrared-credit">Deep sky starfield</p>
      </div>
    </section>
  );
}
