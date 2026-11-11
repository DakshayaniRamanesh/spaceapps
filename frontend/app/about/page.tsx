import Link from "next/link";
import { ArrowUpRight, Compass, Eye, Sparkles, Orbit, Waves, Layers } from "lucide-react";
import { Footer } from "@/components/ui/Navigation";
import PipelineVisualization from "@/components/about/PipelineVisualization";

export const metadata = {
  title: "Our Mission — The Science Behind SkyTrace",
  description:
    "Explore the astronomical science, infrared principles, and time-domain difference imaging pipeline behind SkyTrace.",
};

export default function AboutPage() {
  return (
    <main id="main" className="about-page-main">
      {/* SECTION 1: MISSION INTRODUCTION */}
      <section className="about-hero section-pad" aria-labelledby="mission-title">
        <div className="about-hero-backdrop" aria-hidden="true" />
        <div className="about-hero-content">
          <p className="eyebrow">THE SCIENCE BEHIND THE EXPERIENCE</p>
          <h1 id="mission-title">
            A wider spectrum.
            <br />
            <em>A deeper perspective.</em>
          </h1>
          <p className="about-hero-lead">
            SkyTrace is an independent aerospace visualization platform exploring the
            time-domain sky. Inspired by NASA’s SPHEREx mission and created for the
            NASA Space Apps Challenge 2026, it transforms multi-epoch infrared surveys
            into intuitive, scientifically grounded celestial discovery.
          </p>
          <div className="about-hero-actions">
            <Link href="/explore" className="button primary">
              Open the observatory <ArrowUpRight size={17} />
            </Link>
            <a
              href="#pipeline"
              className="button secondary"
            >
              Explore the data pipeline ↓
            </a>
          </div>
        </div>
      </section>

      {/* SECTION 2: WHY INFRARED MATTERS */}
      <section className="about-science section-pad" aria-labelledby="infrared-title">
        <div className="about-science-grid">
          <div className="about-science-narrative">
            <p className="eyebrow">WHY THE INFRARED?</p>
            <h2 id="infrared-title">
              Light carries
              <br />
              more than an image.
            </h2>
            <p>
              Visible light reveals only the surfaces illuminated by glowing stars. But
              the universe’s most profound transitions — the birth of solar systems
              enshrouded in dense dust, prebiotic molecules frozen onto interstellar
              grains, and the earliest galaxies stretched by cosmic expansion — whisper
              almost entirely in the infrared.
            </p>
            <p>
              By observing infrared wavelengths across 102 continuous spectral channels,
              all-sky surveys unlock chemical fingerprints, cosmological inflation
              traces, and temperature gradients that no single-color telescope can capture.
            </p>
            <a
              href="https://spherex.caltech.edu/page/instrument"
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              Explore the SPHEREx instrument at Caltech ↗
            </a>
          </div>

          <div className="about-science-pillars">
            <article className="science-pillar-card">
              <div className="pillar-icon-wrap">
                <Eye size={20} />
              </div>
              <h3>Dust Penetration</h3>
              <p>
                Infrared waves slip past interstellar dust grains that scatter optical
                light, unmasking hidden stellar nurseries and galactic cores.
              </p>
            </article>

            <article className="science-pillar-card">
              <div className="pillar-icon-wrap">
                <Sparkles size={20} />
              </div>
              <h3>Molecular Signatures</h3>
              <p>
                Water ice, carbon monoxide, and organic precursors absorb and emit at
                diagnostic infrared resonances between 0.75 and 5.0 µm.
              </p>
            </article>

            <article className="science-pillar-card">
              <div className="pillar-icon-wrap">
                <Orbit size={20} />
              </div>
              <h3>Cosmic Expansion</h3>
              <p>
                As light travels across billions of years of expanding spacetime, ancient
                optical and UV photons stretch into the near-infrared spectrum.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* SECTION 3: BEHIND THE DATA — THE IMAGE IS ONLY THE BEGINNING */}
      <section id="pipeline" className="about-pipeline section-pad" aria-labelledby="pipeline-title">
        <div className="pipeline-header">
          <p className="eyebrow">BEHIND THE DATA</p>
          <h2 id="pipeline-title">THE IMAGE IS ONLY THE BEGINNING.</h2>
          <p className="pipeline-lead">
            Before observations from different moments can reveal meaningful changes,
            they must be brought into the same scientific frame of reference.
          </p>
        </div>

        {/* 4-Stage Interactive Visualization */}
        <PipelineVisualization />
      </section>

      {/* SECTION 4: SOURCES & CREDITS */}
      <section id="credits" className="about-credits section-pad" aria-labelledby="credits-title">
        <div className="credits-header">
          <p className="eyebrow">PROVENANCE & CREDITS</p>
          <h2 id="credits-title">Rigorous boundaries. Full transparency.</h2>
          <p className="credits-lead">
            SkyTrace maintains strict boundaries between scientific survey data and
            curated editorial context.
          </p>
        </div>

        <div className="credits-triptych">
          {/* Column 1: Editorial Image Credits */}
          <article className="credits-col">
            <div className="credits-col-header">
              <Layers size={18} />
              <h3>Editorial Image Credits</h3>
            </div>
            <p className="credits-col-desc">
              Curated, high-resolution backgrounds provide atmospheric and astronomical
              context. They are <strong>not</strong> SPHEREx survey measurements:
            </p>
            <ul className="credits-links-list">
              <li>
                <a
                  href="https://www.nasa.gov/international-space-station/desktop-and-mobile-wallpapers/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Earth Orbital Horizon — NASA ISS Expedition 30 ↗
                </a>
              </li>
              <li>
                <a
                  href="https://science.nasa.gov/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Deep Space Starfield — Astrophotography Composite ↗
                </a>
              </li>
              <li>
                <a
                  href="https://science.nasa.gov/asset/webb/cosmic-cliffs-in-the-carina-nebula-nircam-and-miri-composite-image/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Cosmic Cliffs in Carina — NASA, ESA, CSA, STScI (JWST) ↗
                </a>
              </li>
            </ul>
          </article>

          {/* Column 2: Scientific References */}
          <article className="credits-col">
            <div className="credits-col-header">
              <Compass size={18} />
              <h3>Scientific References</h3>
            </div>
            <p className="credits-col-desc">
              All-sky survey principles, spectral bands, and Level-2 pipeline
              architectures reference published documentation:
            </p>
            <ul className="credits-links-list">
              <li>
                <a
                  href="https://spherex.caltech.edu/page/instrument"
                  target="_blank"
                  rel="noreferrer"
                >
                  SPHEREx Instrument & LVF Design — Caltech ↗
                </a>
              </li>
              <li>
                <a
                  href="https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/overview.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  SPHEREx Data Access Architecture — NASA/IPAC IRSA ↗
                </a>
              </li>
              <li>
                <a
                  href="https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Level-2 Pipeline & Data Products Guide — IPAC ↗
                </a>
              </li>
            </ul>
          </article>

          {/* Column 3: Project Acknowledgment */}
          <article className="credits-col">
            <div className="credits-col-header">
              <Waves size={18} />
              <h3>Project Acknowledgment</h3>
            </div>
            <p className="credits-col-desc">
              Independent concept created for the NASA Space Apps Challenge 2026.
            </p>
            <div className="credits-disclaimer-box">
              <p>
                Not affiliated with, endorsed by, or certified by NASA, Caltech,
                JPL, or the Space Apps Challenge organizers. SPHEREx is a NASA
                Astrophysics Medium-Class Explorer (MIDEX) mission managed by JPL.
              </p>
            </div>
          </article>
        </div>
      </section>

      <Footer />
    </main>
  );
}
