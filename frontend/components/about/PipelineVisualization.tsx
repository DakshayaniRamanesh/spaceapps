"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChevronDown, ArrowRight, ArrowLeft } from "lucide-react";

interface Scene {
  num: string;
  category: string;
  headline: string;
  summary: string;
  detail: string;
  note?: string;
}

const SCENES: Scene[] = [
  {
    num: "01",
    category: "RADIOMETRIC SENSOR ARRAYS",
    headline: "MORE THAN A PHOTOGRAPH.",
    summary:
      "Astronomical space telescopes do not produce simple color pictures. Every observation is a calibrated numerical grid of physical photon measurements.",
    detail:
      "Beneath the visual splendor lies a continuous surface-brightness field recorded in physical units. Each detector pixel captures discrete radiation levels paired with optical geometry and uncertainty estimates.",
  },
  {
    num: "02",
    category: "CELESTIAL CO-REGISTRATION",
    headline: "ONE SKY. ONE REFERENCE.",
    summary:
      "Between separate survey epochs, spacecraft orientation, orbital precession, and thermal expansion shift telescope pointings across the field.",
    detail:
      "Before observations can be meaningfully compared, astrometric coordinate systems mathematically resample raw detector pixels onto an identical celestial tangent grid, aligning background reference stars across time.",
  },
  {
    num: "03",
    category: "SPECTROPHOTOMETRIC PARITY",
    headline: "COMPARE WHAT CAN BE COMPARED.",
    summary:
      "Infrared sources emit vastly different energies across wavelengths from 0.75 to 5.0 micrometers depending on their stellar temperature.",
    detail:
      "Because SPHEREx continuously filters light across 102 spectral channels, comparing mismatched wavelengths creates false brightness shifts. Reliable time-domain discovery requires observations sampled in compatible passbands.",
  },
  {
    num: "04",
    category: "TIME-DOMAIN RESIDUALS",
    headline: "WHEN IMAGES MEET, CHANGE EMERGES.",
    summary:
      "Pixel-by-pixel subtraction removes the steady universe of stationary stars and distant galaxies, isolating motion and transient brightness.",
    detail:
      "A moving body produces a distinctive positive and negative residual dipole between epochs. In genuine astronomical pipelines, optical blur and detector noise also leave subtle residual traces alongside true cosmic transients.",
    note: "Conceptual scientific demonstration · Distinguishes educational principles from operational SPHEREx Level-2 datasets.",
  },
];

export default function PipelineVisualization() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeScene, setActiveScene] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const mm = gsap.matchMedia();

    // Only apply scroll pinning on desktop with no reduced motion preference
    mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      const el = containerRef.current;
      if (!el) return;

      // Calibrated to 220vh total height for a responsive, brisk, non-trapping scroll experience
      const st = ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.3,
        onUpdate: (self) => {
          const p = self.progress;
          setScrollProgress(p);
          const index = Math.min(3, Math.floor(p * 4));
          setActiveScene(index);
        },
      });

      return () => {
        st.kill();
      };
    });

    return () => mm.revert();
  }, []);

  const goToScene = (idx: number) => {
    setActiveScene(idx);
    setScrollProgress(idx / 3.2);

    // If on desktop with ScrollTrigger, also smoothly scroll to that scene's approximate position
    if (window.innerWidth >= 1024 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const startY = rect.top + scrollTop;
      const totalHeight = rect.height - window.innerHeight;
      if (totalHeight > 0) {
        const targetY = startY + (idx / 3.2) * totalHeight;
        window.scrollTo({ top: targetY, behavior: "smooth" });
      }
    }
  };

  // Interpolation parameters
  const alignFactor =
    activeScene === 1 ? Math.max(0, Math.min(1, (scrollProgress - 0.22) / 0.16 || 1)) : activeScene > 1 ? 1 : 0;
  const waveFactor =
    activeScene === 2 ? Math.max(0, Math.min(1, (scrollProgress - 0.48) / 0.16 || 1)) : activeScene > 2 ? 1 : 0;
  const diffFactor =
    activeScene === 3 ? Math.max(0, Math.min(1, (scrollProgress - 0.72) / 0.16 || 1)) : 0;

  const scene = SCENES[activeScene];

  return (
    <div ref={containerRef} className="science-exhibition-root" id="pipeline-story">
      {/* Pinned Sticky Stage */}
      <div className="science-sticky-stage">
        {/* Ambient Cosmic Radial Glow */}
        <div className="stage-deep-sky-bg" aria-hidden="true" />

        {/* Section Intro Eyebrow & Nav Header */}
        <header className="stage-header-bar">
          <div className="stage-title-wrap">
            <span className="stage-eyebrow">BEHIND THE DATA</span>
            <span className="stage-subtitle">The image is only the beginning</span>
          </div>

          {/* Interactive Chapter Nav Pills */}
          <nav className="stage-nav-strip" aria-label="Science storytelling chapters">
            {SCENES.map((s, i) => (
              <button
                key={s.num}
                onClick={() => goToScene(i)}
                className={`stage-nav-item ${activeScene === i ? "active" : ""}`}
                aria-current={activeScene === i ? "step" : undefined}
              >
                <span className="nav-index">{s.num}</span>
                <span className="nav-label">{s.category}</span>
                <span className="nav-indicator-line" />
              </button>
            ))}
          </nav>
        </header>

        {/* Centerpiece Exhibition Arena */}
        <div className="stage-arena">
          {/* Central Astronomical Visual Canvas */}
          <div className="stage-visual-frame" aria-label="Astronomical data pipeline visualization">
            {/* Visual Plate 1: High-Resolution Deep Space Astrophotography */}
            <div
              className="canvas-image-layer"
              style={{
                opacity: 1 - diffFactor * 0.82,
                filter:
                  waveFactor > 0.05
                    ? `hue-rotate(${waveFactor * -35}deg) saturate(${1 + waveFactor * 0.4})`
                    : "none",
              }}
            >
              <Image
                src="/images/deep-space.jpg"
                alt="Astronomical starfield observation plate"
                fill
                sizes="(max-width: 1200px) 94vw, 1080px"
                className="plate-asset"
                priority
              />
            </div>

            {/* Visual Plate 2: Astrometric Offset Layer (Epoch B before/during alignment) */}
            <div
              className="canvas-drift-layer"
              style={{
                opacity: activeScene === 1 ? 1 : 0,
                transform: `translate(${(1 - alignFactor) * 26}px, ${(1 - alignFactor) * -20}px) rotate(${(1 - alignFactor) * 1.8}deg)`,
              }}
            >
              <div className="drift-stars-cluster">
                <span className="drift-star ds1" />
                <span className="drift-star ds2" />
                <span className="drift-star ds3" />
                <span className="drift-star ds4" />
              </div>
            </div>

            {/* Visual Plate 3: Celestial Tangent Coordinate Grid Overlay */}
            <svg
              className="canvas-coordinate-grid"
              viewBox="0 0 600 400"
              aria-hidden="true"
              style={{
                opacity: activeScene === 1 ? 0.35 + alignFactor * 0.45 : activeScene === 2 ? 0.25 : 0.08,
              }}
            >
              <line x1="80" y1="40" x2="80" y2="360" stroke="#ba98f4" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="200" y1="40" x2="200" y2="360" stroke="#ba98f4" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="320" y1="40" x2="320" y2="360" stroke="#ba98f4" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="440" y1="40" x2="440" y2="360" stroke="#ba98f4" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="560" y1="40" x2="560" y2="360" stroke="#ba98f4" strokeWidth="1" strokeDasharray="3 3" />

              <line x1="40" y1="80" x2="560" y2="80" stroke="#ba98f4" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="40" y1="160" x2="560" y2="160" stroke="#ba98f4" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="40" y1="240" x2="560" y2="240" stroke="#ba98f4" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="40" y1="320" x2="560" y2="320" stroke="#ba98f4" strokeWidth="1" strokeDasharray="3 3" />

              {/* Astrometric Registration Reticle */}
              <circle cx="320" cy="200" r="28" stroke="#ffffff" strokeWidth="1.2" fill="none" opacity={alignFactor} />
              <circle cx="320" cy="200" r="3" fill="#f5c77d" opacity={alignFactor} />
            </svg>

            {/* Scene 1 Overlay: Pixel Level Measurement Overlay */}
            <div
              className="canvas-pixel-discretization"
              style={{
                opacity: activeScene === 0 ? 0.8 : 0,
              }}
            >
              <div className="pixel-sampler-lens">
                <div className="lens-grid" />
                <span className="lens-tag">Discrete Quantitative Flux Grid</span>
              </div>
            </div>

            {/* Scene 3 Overlay: Infrared Passband Wavelength Ribbon */}
            <div
              className="canvas-wavelength-ribbon"
              style={{
                opacity: activeScene === 2 ? 1 : 0,
                transform: `translateY(${activeScene === 2 ? 0 : 20}px)`,
              }}
            >
              <div className="ribbon-header">
                <span>0.75 µm Near-IR</span>
                <span className="ribbon-center-tag">SPHEREx 102-Band LVF Survey</span>
                <span>5.00 µm Mid-IR</span>
              </div>
              <div className="ribbon-spectrum-bar">
                <div className="ribbon-passband-window" style={{ left: "44%" }}>
                  <span className="passband-notch" />
                  <span className="passband-label">Matched Passband</span>
                </div>
              </div>
            </div>

            {/* Scene 4 Overlay: Signed Difference (B − A) Residual Features */}
            <div
              className="canvas-difference-overlay"
              style={{
                opacity: activeScene === 3 ? 1 : diffFactor,
              }}
            >
              {/* Proper-Motion Moving Source Dipole */}
              <div className="diff-dipole-system">
                <div className="dipole-pole negative-pole" title="Departed position: Negative flux residual">
                  <span className="pole-sign">−</span>
                </div>
                <div className="dipole-motion-track" />
                <div className="dipole-pole positive-pole" title="Current position: Positive flux residual">
                  <span className="pole-sign">+</span>
                </div>
                <span className="dipole-annotation">Signed Residual Dipole</span>
              </div>

              {/* Variable Star Residual */}
              <div className="diff-variable-system">
                <div className="variable-flux-glow" />
                <div className="variable-core" />
                <span className="variable-annotation">Transient Variability (+ΔF)</span>
              </div>

              {/* Realistic Background Noise and Imperfect Residual Hint */}
              <div className="subtle-noise-residuals" aria-hidden="true" />
            </div>

            {/* Visual Frame Status / Caption */}
            <div className="frame-footer-caption">
              <span className="caption-phase-indicator">
                STAGE {scene.num} · {scene.category}
              </span>
              <span className="caption-subtext">
                {activeScene === 0 && "Quantitative radiometric image array"}
                {activeScene === 1 && (alignFactor > 0.8 ? "Astrometrically aligned to celestial frame" : "Demonstrating spacecraft pointing offset")}
                {activeScene === 2 && "Synchronizing compatible infrared spectral channels"}
                {activeScene === 3 && "Isolating time-domain motion and flux residuals"}
              </span>
            </div>
          </div>

          {/* Editorial Narrative Card */}
          <div className="stage-editorial-card">
            <div className="editorial-eyebrow">
              <span className="eyebrow-accent" />
              <span>STAGE {scene.num} · {scene.category}</span>
            </div>

            <h2 className="editorial-headline">{scene.headline}</h2>

            <p className="editorial-lead">{scene.summary}</p>
            <p className="editorial-body">{scene.detail}</p>

            {scene.note && (
              <p className="editorial-disclaimer">
                {scene.note}
              </p>
            )}

            {/* Editorial Quick Controls & Step Navigation */}
            <div className="editorial-step-controls">
              <button
                onClick={() => goToScene(Math.max(0, activeScene - 1))}
                disabled={activeScene === 0}
                className="step-ctrl-btn"
                aria-label="Previous scene"
              >
                <ArrowLeft size={16} />
              </button>

              <div className="editorial-step-dots">
                {SCENES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToScene(i)}
                    className={`step-dot ${activeScene === i ? "active" : ""}`}
                    aria-label={`Jump to scene ${i + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={() => goToScene(Math.min(SCENES.length - 1, activeScene + 1))}
                disabled={activeScene === SCENES.length - 1}
                className="step-ctrl-btn"
                aria-label="Next scene"
              >
                <ArrowRight size={16} />
              </button>

              <span className="step-counter-text">
                {scene.num} / 04
              </span>
            </div>
          </div>
        </div>

        {/* Subtle Scroll Hint */}
        <div className="stage-scroll-hint" aria-hidden="true">
          <span>Scroll to explore stages</span>
          <ChevronDown size={14} />
        </div>
      </div>
    </div>
  );
}
