import Link from "next/link";
import { ArrowUpRight, ArrowDown } from "lucide-react";
export default function Hero() {
  return (
    <section className="hero-journey" aria-label="From Earth to the stars">
      <div className="hero-panel">
        <img
          className="hero-art"
          src="/images/earth-horizon.webp"
          alt="Sunset over the horizon of Earth, photographed from the International Space Station"
          fetchPriority="high"
        />
        <div className="hero-shade" />
        <img
          className="hero-deep"
          src="/images/carina.webp"
          alt="The Cosmic Cliffs in the Carina Nebula, a James Webb Space Telescope infrared composite"
        />
        <div className="hero-deep-shade" />
        <span className="hero-edge" aria-hidden="true">
          IN CONSTANT MOTION
        </span>
        <div className="hero-copy">
          <p className="hero-kicker">A new perspective on the universe</p>
          <h1>
            <span className="heading-mask">
              <span>THE SKY IS</span>
            </span>
            <span className="heading-mask">
              <span>NEVER STILL.</span>
            </span>
          </h1>
          <div className="hero-support">
            <p>
              Explore the changing
              <br />
              infrared universe.
            </p>
            <Link className="button primary" href="/explore">
              ENTER THE EXPLORER <ArrowUpRight />
            </Link>
          </div>
        </div>
        <Link
          href="#story"
          className="hero-orbit-link"
          aria-label="Discover the changing universe"
        >
          <span>
            Look again.
            <br />
            See what changes.
          </span>
          <ArrowUpRight size={30} />
        </Link>
        <div className="journey-title" aria-hidden="true">
          <span>BEYOND</span>
          <span>THE HORIZON.</span>
        </div>
        <div className="hero-footer">
          <a href="#story">
            <ArrowDown size={18} /> Scroll to explore
          </a>
          <span className="hero-credit">
            Earth: NASA · Nebula: NASA, ESA, CSA, STScI
            <br />
            Editorial imagery / not SPHEREx data
          </span>
          <span>01 / 04</span>
        </div>
      </div>
    </section>
  );
}
