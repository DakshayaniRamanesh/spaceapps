import Link from "next/link";
import { ArrowUpRight, ArrowDown } from "lucide-react";
export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-art" />
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-topline">
        <span>AN OBSERVATORY FOR THE CURIOUS</span>
        <span>SPHEREx INSPIRED / 01</span>
      </div>
      <div className="hero-copy">
        <p className="eyebrow hero-reveal">
          <span className="small-line" /> A DIFFERENT WAY TO SEE
        </p>
        <h1>
          <span className="hero-reveal">THE SKY IS</span>
          <span className="hero-reveal">
            NEVER <em>STILL.</em>
          </span>
        </h1>
        <div className="hero-bottom-copy hero-reveal">
          <p>
            Travel through time using infrared observations.
            <br />
            Follow celestial motion. Find what changes.
          </p>
          <Link className="button primary" href="/explore">
            Launch Sky Explorer <ArrowUpRight size={18} />
          </Link>
          <Link className="text-link" href="/about">
            Discover the mission <span>↗</span>
          </Link>
        </div>
      </div>
      <div className="hero-reticle" aria-hidden="true">
        <div className="reticle-circle" />
        <span className="reticle-point" />
        <span className="reticle-label">
          THE UNIVERSE IS
          <br />A WORK IN MOTION.
        </span>
        <div className="reticle-coordinate">
          α 17h 57m 48s
          <br />δ +04° 41′ 36″
          <br />
          <small>REFERENCE FIELD · J2000</small>
        </div>
      </div>
      <div className="hero-footer">
        <a href="#story" className="scroll-indicator">
          <ArrowDown size={17} /> SCROLL TO DISCOVER
        </a>
        <span className="motion-headline">SEE THE SKY IN MOTION.</span>
        <span className="art-label">ORIGINAL PROCEDURAL ARTWORK</span>
      </div>
    </section>
  );
}
