"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, RefreshCw } from "lucide-react";

interface StepData {
  id: string;
  step: string;
  title: string;
  subtitle: string;
  summary: string;
  explanation: string;
  insight: string;
}

const STEPS: StepData[] = [
  {
    id: "fits",
    step: "01",
    title: "Radiometric Sensor Data",
    subtitle: "Calibrated 32-bit floating-point arrays",
    summary:
      "Astronomical space telescopes do not capture compressed color photographs. Every raw observation is an array of physical photon counts.",
    explanation:
      "In missions like SPHEREx, detectors record calibrated surface brightness (in megaJanskys per steradian) paired with per-pixel uncertainty arrays and astrometric geometry. A single pixel is not a color value—it is a quantitative measurement of physical radiation from deep space.",
    insight:
      "Every pixel stores physical flux density, preserving radiometric accuracy across vast dynamic ranges.",
  },
  {
    id: "wcs",
    step: "02",
    title: "Astrometric Co-Registration",
    subtitle: "World Coordinate System (WCS) alignment",
    summary:
      "Between separate survey passes, spacecraft roll, orbital motion, and thermal flexing shift telescope pointings by multiple arcseconds.",
    explanation:
      "Direct pixel subtraction of unaligned frames produces catastrophic edge artifacts. Astrometric World Coordinate Systems map telescope detector pixels to absolute celestial coordinates (Right Ascension and Declination), allowing observations from different months to be resampled onto a common sky grid.",
    insight:
      "Sub-pixel distortion modeling maps raw sensor pixels to true celestial coordinates before comparison.",
  },
  {
    id: "spectral",
    step: "03",
    title: "Spectral Passband Matching",
    subtitle: "Spectrophotometric channel parity",
    summary:
      "Infrared sources radiate with drastically different spectral slopes across 0.75 to 5.0 micrometers.",
    explanation:
      "SPHEREx surveys the universe through Linear Variable Filters across 102 continuous channels. If an epoch at 1.4 µm is compared directly to one at 2.8 µm, cooler stars appear falsely bright simply due to their spectral energy distribution. Genuine time-domain changes require observations taken in matching spectral channels.",
    insight:
      "Filtering across identical wavelength passbands eliminates false variables caused by stellar temperature curves.",
  },
  {
    id: "diff",
    step: "04",
    title: "Difference Imaging (B − A)",
    subtitle: "Isolating transient and moving phenomena",
    summary:
      "When two calibrated, spatially registered, and spectrally matched observations are subtracted, the static universe vanishes.",
    explanation:
      "Billions of static stars and galaxies cancel to zero net flux. Fast-moving asteroids and high-proper-motion stars produce a distinctive dual-lobed signature: a dark negative residual where the object used to be, and a bright positive residual where it has moved.",
    insight:
      "Subtracting identical sky frames isolates pure time-domain variance: asteroids, comets, and pulsating stars.",
  },
];

export default function PipelineVisualization() {
  const [currentStep, setCurrentStep] = useState(0);
  const [wcsAligned, setWcsAligned] = useState(true);
  const [diffSubtracted, setDiffSubtracted] = useState(true);

  const step = STEPS[currentStep];

  return (
    <div className="pipeline-experience">
      {/* Sleek Step Progress Track */}
      <nav className="pipeline-timeline" aria-label="Scientific methodology steps">
        {STEPS.map((s, index) => {
          const isActive = currentStep === index;
          const isPassed = currentStep > index;
          return (
            <button
              key={s.id}
              onClick={() => setCurrentStep(index)}
              className={`timeline-step ${isActive ? "active" : ""} ${isPassed ? "completed" : ""}`}
              aria-current={isActive ? "step" : undefined}
            >
              <div className="step-bar-wrap">
                <span className="step-bar" />
              </div>
              <div className="step-label">
                <span className="step-num">{s.step}</span>
                <span className="step-name">{s.title}</span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Main Interactive Stage Display */}
      <div className="pipeline-display-grid">
        {/* Left Column: Human Editorial Storytelling */}
        <div className="pipeline-narrative-panel">
          <div className="narrative-meta">
            <span className="narrative-index">STEP {step.step} OF 04</span>
            <span className="narrative-subtitle">{step.subtitle}</span>
          </div>

          <h3 className="narrative-title">{step.title}</h3>

          <p className="narrative-lead">{step.summary}</p>
          <p className="narrative-body">{step.explanation}</p>

          <div className="narrative-insight">
            <div className="insight-line" />
            <p>{step.insight}</p>
          </div>

          <div className="narrative-nav-controls">
            <button
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className="narrative-nav-btn"
              aria-label="Previous methodology step"
            >
              <ArrowLeft size={16} />
              <span>Previous</span>
            </button>

            <span className="nav-counter">
              {step.step} / 04
            </span>

            <button
              onClick={() => setCurrentStep((prev) => Math.min(STEPS.length - 1, prev + 1))}
              disabled={currentStep === STEPS.length - 1}
              className="narrative-nav-btn primary-nav-btn"
              aria-label="Next methodology step"
            >
              <span>Next Step</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Right Column: Visual Demonstration */}
        <div className="pipeline-interactive-canvas">
          {/* STEP 1: Radiometric Sensor Data */}
          {currentStep === 0 && (
            <div className="canvas-view stage-radiometric">
              <div className="radiometric-preview">
                <div className="radiometric-stars-layer">
                  <div className="sim-star star-1" />
                  <div className="sim-star star-2" />
                  <div className="sim-star star-3" />
                  <div className="sim-star star-center" />
                </div>
                <div className="radiometric-mesh">
                  <div className="pixel-overlay">
                    {Array.from({ length: 48 }).map((_, i) => (
                      <span key={i} className="sensor-pixel" />
                    ))}
                  </div>
                </div>
                <div className="radiometric-crosshair">
                  <div className="crosshair-target" />
                  <div className="crosshair-readout">
                    <span className="readout-title">Calibrated Flux Density</span>
                    <span className="readout-val">148.65 ± 0.42 MJy/sr</span>
                  </div>
                </div>
              </div>
              <div className="canvas-caption">
                <p>
                  Linear infrared detector array measuring quantitative photon emission,
                  rather than aesthetic RGB coloration.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: Astrometric Co-Registration */}
          {currentStep === 1 && (
            <div className="canvas-view stage-wcs">
              <div className="wcs-interactive-container">
                {/* Visual Sky Canvas */}
                <div className="wcs-sky-frame">
                  {/* Celestial Reference Grid */}
                  <svg className="wcs-grid-svg" viewBox="0 0 400 260" aria-hidden="true">
                    <line x1="50" y1="20" x2="50" y2="240" stroke="rgba(155, 114, 242, 0.15)" strokeWidth="1" />
                    <line x1="150" y1="20" x2="150" y2="240" stroke="rgba(155, 114, 242, 0.15)" strokeWidth="1" />
                    <line x1="250" y1="20" x2="250" y2="240" stroke="rgba(155, 114, 242, 0.15)" strokeWidth="1" />
                    <line x1="350" y1="20" x2="350" y2="240" stroke="rgba(155, 114, 242, 0.15)" strokeWidth="1" />
                    <line x1="20" y1="65" x2="380" y2="65" stroke="rgba(155, 114, 242, 0.15)" strokeWidth="1" />
                    <line x1="20" y1="130" x2="380" y2="130" stroke="rgba(155, 114, 242, 0.15)" strokeWidth="1" />
                    <line x1="20" y1="195" x2="380" y2="195" stroke="rgba(155, 114, 242, 0.15)" strokeWidth="1" />
                  </svg>

                  {/* Fixed Reference Stars (Epoch 1) */}
                  <div className="epoch-stars epoch-1">
                    <span className="star-point p1" />
                    <span className="star-point p2" />
                    <span className="star-point p3" />
                    <span className="star-point p4" />
                  </div>

                  {/* Epoch 2 Stars (Drifting when unaligned, locked when aligned) */}
                  <div className={`epoch-stars epoch-2 ${wcsAligned ? "aligned" : "drifted"}`}>
                    <span className="star-point p1" />
                    <span className="star-point p2" />
                    <span className="star-point p3" />
                    <span className="star-point p4" />
                  </div>
                </div>

                {/* Interactive Alignment Toggle */}
                <div className="wcs-control-bar">
                  <button
                    type="button"
                    onClick={() => setWcsAligned(!wcsAligned)}
                    className="wcs-toggle-btn"
                  >
                    <RefreshCw size={14} className={wcsAligned ? "" : "spin-subtle"} />
                    <span>
                      {wcsAligned
                        ? "Registered: Celestial Tangent Plane"
                        : "Raw: Telescope Pointing Drift"}
                    </span>
                  </button>
                  <span className="wcs-hint">
                    {wcsAligned ? "Stars aligned to < 0.05 pixel" : "Spacecraft orientation offset"}
                  </span>
                </div>
              </div>
              <div className="canvas-caption">
                <p>
                  Astrometric World Coordinate Systems mathematically cancel orbital pointing
                  drift, aligning background reference stars to sub-pixel precision.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: Spectral Passband Matching */}
          {currentStep === 2 && (
            <div className="canvas-view stage-spectral">
              <div className="spectral-visual-showcase">
                <div className="spectrum-range-header">
                  <span>0.75 µm (Near Infrared)</span>
                  <span>5.00 µm (Mid Infrared)</span>
                </div>

                <div className="spectrum-gradient-track">
                  <div className="spectrum-lvf-zone zone-active">
                    <span className="zone-indicator">Matched Passband</span>
                    <span className="zone-label">Channel 42 · 2.15 µm</span>
                  </div>
                </div>

                <div className="spectral-comparison-cards">
                  <div className="spectral-epoch-item matched">
                    <span className="epoch-tag">Epoch 1 (Spring)</span>
                    <strong>Detector 3 · 2.15 µm</strong>
                    <span className="match-status">Passband Matched</span>
                  </div>
                  <div className="spectral-epoch-item matched">
                    <span className="epoch-tag">Epoch 2 (Autumn)</span>
                    <strong>Detector 3 · 2.15 µm</strong>
                    <span className="match-status">Passband Matched</span>
                  </div>
                </div>
              </div>
              <div className="canvas-caption">
                <p>
                  Spectrally matched comparisons ensure that brightness differences reflect
                  true physical changes rather than stellar temperature gradients.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: Difference Imaging (B − A) */}
          {currentStep === 3 && (
            <div className="canvas-view stage-diff">
              <div className="diff-showcase-container">
                <div className={`diff-view-canvas ${diffSubtracted ? "subtracted" : "raw"}`}>
                  {/* Static background stars (fade to near-zero when subtracted) */}
                  <span className="diff-bg-star s1" />
                  <span className="diff-bg-star s2" />
                  <span className="diff-bg-star s3" />
                  <span className="diff-bg-star s4" />

                  {/* Moving Body / Proper Motion Dipole */}
                  <div className="diff-dipole-pair">
                    <span className="dipole-neg" title="Prior Position: Departed (Negative Flux)" />
                    <span className="dipole-arrow" />
                    <span className="dipole-pos" title="Current Position: Arrived (Positive Flux)" />
                    <span className="dipole-text">Proper-Motion Dipole</span>
                  </div>

                  {/* Pulsating Variable Star */}
                  <div className="diff-variable-star">
                    <span className="variable-glow" />
                    <span className="variable-label">Variable Star (+ΔF)</span>
                  </div>
                </div>

                <div className="diff-mode-toggle">
                  <button
                    type="button"
                    onClick={() => setDiffSubtracted(!diffSubtracted)}
                    className="diff-toggle-btn"
                  >
                    <Eye size={14} />
                    <span>{diffSubtracted ? "Difference Mode (B − A)" : "Raw Survey Frame (Epoch B)"}</span>
                  </button>
                  <span className="diff-hint">
                    {diffSubtracted ? "Static stars cancelled" : "Static stars visible"}
                  </span>
                </div>
              </div>
              <div className="canvas-caption">
                <p>
                  Pixel-by-pixel subtraction removes stationary celestial objects, instantly
                  revealing moving asteroids and variable sources against deep space.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
