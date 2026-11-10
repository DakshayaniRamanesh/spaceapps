import Link from "next/link";
import { ArrowUpRight, Crosshair, Play, SlidersHorizontal } from "lucide-react";
export default function HowItWorks() {
  return (
    <section
      className="observatory-bridge"
      id="workflow"
      aria-label="Enter the observatory"
    >
      <div className="bridge-sticky">
        <p className="eyebrow bridge-kicker">03 — Enter the observatory</p>
        <div className="bridge-orbits" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="preview-shell">
          <img
            className="bridge-photo"
            src="/images/carina.webp"
            alt="Cosmic Cliffs, used as editorial context for the observatory introduction"
          />
          <div className="preview-ui">
            <div className="preview-nav">
              <strong>skytrace</strong>
              <span>Observatory</span>
              <span>No data connected</span>
            </div>
            <div className="preview-workspace">
              <div className="preview-controls">
                <SlidersHorizontal />
                <span>Observation controls</span>
                <div />
                <div />
                <div />
              </div>
              <div className="preview-ready">
                <Crosshair size={48} strokeWidth={1} />
                <h3>Observatory ready.</h3>
                <p>Your next perspective starts here.</p>
              </div>
            </div>
            <div className="preview-filmstrip">
              <Play size={16} />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <span className="preview-caption">
            Interface preview · no observation data displayed
          </span>
        </div>
        <div className="bridge-copy">
          <h2>
            YOUR WINDOW
            <br />
            INTO A CHANGING
            <br />
            <span>UNIVERSE.</span>
          </h2>
          <p>
            Choose a field. Move through time.
            <br />
            Bring the changing sky into focus.
          </p>
          <Link className="button primary" href="/explore">
            Enter the explorer <ArrowUpRight />
          </Link>
        </div>
      </div>
    </section>
  );
}
