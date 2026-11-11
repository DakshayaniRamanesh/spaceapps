import Link from "next/link";
import { ArrowUpRight, Orbit, Waves, ScanLine } from "lucide-react";
import { Footer } from "@/components/ui/Navigation";
import presets from "@/lib/presets.json";
export const metadata = { title: "The Mission & Methodology" };
export default function About() {
  return (
    <main id="main">
      <section className="about-hero section-pad">
        <p className="eyebrow">THE SCIENCE BEHIND THE EXPERIENCE</p>
        <h1>
          A wider spectrum.
          <br />
          <em>A deeper perspective.</em>
        </h1>
        <p>
          SkyTrace is an independent exploration of the time-domain sky,
          inspired by NASA’s SPHEREx mission and conceived for the NASA Space
          Apps Challenge 2026.
        </p>
        <Link href="/explore" className="button primary">
          Open the observatory <ArrowUpRight size={17} />
        </Link>
      </section>
      <section className="about-content section-pad">
        <div className="about-intro">
          <p className="eyebrow">WHY THE INFRARED?</p>
          <h2>
            Light carries
            <br />
            more than an image.
          </h2>
          <p>
            SPHEREx surveys the sky across 102 spectral bands spanning
            approximately 0.75–5 micrometers. Its measurements help explore the
            history of galaxies, the early universe, and the ingredients of
            life.
          </p>
          <p>
            Six detector arrays use linear variable filters. Wavelength depends
            on position across each array; repeated pointings build spectral
            coverage. A detector image is not simply a photograph at one
            wavelength.
          </p>
          <a
            href="https://spherex.caltech.edu/page/instrument"
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            Explore the instrument at Caltech ↗
          </a>
        </div>
        <div className="about-facts">
          <article>
            <Orbit />
            <strong>All sky</strong>
            <p>A broad view of the infrared universe.</p>
          </article>
          <article>
            <Waves />
            <strong>102 bands</strong>
            <p>Spectral information beyond a conventional color image.</p>
          </article>
          <article>
            <ScanLine />
            <strong>Time matters</strong>
            <p>Repeated observations help us notice what changes.</p>
          </article>
        </div>
      </section>
      <section id="methodology" className="methodology section-pad">
        <p className="eyebrow">DATA TRANSPARENCY</p>
        <h2>
          An open observatory.
          <br />
          <em>Ready for real data.</em>
        </h2>
        <p className="methodology-lead">
          There are no connected SPHEREx observations in this release. The
          Explorer opens in an empty ready state. Synthetic observations are
          available only through an explicit development setting; their dates,
          motions, brightness variations and quality indicators describe a
          simulation.
        </p>
        <div className="methodology-grid">
          <article>
            <span>01</span>
            <h3>Repeatable development data</h3>
            <p>
              A coordinate-derived seed creates a stable synthetic star
              catalogue. Eight epochs share a common grid, with Gaussian
              point-spread functions and independent seeded Gaussian noise.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Meaningful comparisons</h3>
            <p>
              One source moves and one changes brightness. Difference mode
              calculates B − A from floating-point arrays before applying an
              amber–violet display scale. All epochs use a fixed image stretch.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Honest limitations</h3>
            <p>
              Motion is exaggerated. Intensities use arbitrary units. The
              synthetic scene is not a catalogue reconstruction, a measured
              light curve, a physical source spectrum, or a calibrated SPHEREx
              instrument model.
            </p>
          </article>
          <article id="integration">
            <span>04</span>
            <h3>Ready for a real provider</h3>
            <p>
              The observation API separates data acquisition from the interface.
              The IRSA adapter is disabled until FITS, WCS, wavelength matching,
              registration, masks, and uncertainty handling are implemented and
              validated.
            </p>
          </article>
        </div>
        <div className="data-notice">
          <strong>Field of view changes the sky extent.</strong>
          <p>
            Stars have fixed angular offsets in a local synthetic field. A wider
            view reveals a larger area; it does not merely change the label.
            Different coordinate centers seed independent fields. Overlapping
            requests do not form a globally consistent sky catalogue. Pixel
            scale and PSF are illustrative.
          </p>
        </div>
      </section>
      <section id="credits" className="sources section-pad">
        <p className="eyebrow">PROVENANCE & CREDITS</p>
        <h2>Know what you’re looking at.</h2>
        <p>
          SkyTrace maintains rigorous boundaries between scientific survey data
          and artistic editorial context. Every visual asset in this experience is
          curated or algorithmically generated for educational clarity.
        </p>

        <div className="credits-section-block">
          <h3>Editorial Image Credits</h3>
          <p>
            Background images are locally bundled and optimized. They provide atmospheric
            and cosmic perspective and are <strong>not</strong> SPHEREx survey measurements:
          </p>
          <ul className="source-links">
            <li>
              <a
                href="https://www.nasa.gov/international-space-station/desktop-and-mobile-wallpapers/"
                target="_blank"
                rel="noreferrer"
              >
                Earth orbital horizon — NASA / ISS Expedition 30 Wallpaper Collection ↗
              </a>
            </li>
            <li>
              <a
                href="https://science.nasa.gov/"
                target="_blank"
                rel="noreferrer"
              >
                Deep space starfield & Milky Way — Astrophotography Composite ↗
              </a>
            </li>
            <li>
              <a
                href="https://science.nasa.gov/asset/webb/cosmic-cliffs-in-the-carina-nebula-nircam-and-miri-composite-image/"
                target="_blank"
                rel="noreferrer"
              >
                Cosmic Cliffs in Carina Nebula — NASA, ESA, CSA, STScI (JWST NIRCam/MIRI) ↗
              </a>
            </li>
          </ul>
          <p className="credit-subtext">
            Educational starfield sequences (1024×1024 px) and target showcase plates are
            algorithmically synthesized using Gaussian point-spread functions (PSF) and arcsinh
            photometric stretches. They model mathematical motion and variability concepts and do
            not represent observed measurements of the named objects.
          </p>
        </div>

        <div className="credits-section-block">
          <h3>Scientific Sources & Mission Documentation</h3>
          <p>
            The SPHEREx mission architecture and data specifications are guided by official
            mission publications:
          </p>
          <ul className="source-links">
            <li>
              <a
                href="https://spherex.caltech.edu/page/instrument"
                target="_blank"
                rel="noreferrer"
              >
                SPHEREx Instrument & Spectral Coverage — Caltech ↗
              </a>
            </li>
            <li>
              <a
                href="https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/overview.html"
                target="_blank"
                rel="noreferrer"
              >
                SPHEREx Data Explorer Documentation — NASA/IPAC IRSA ↗
              </a>
            </li>
            <li>
              <a
                href="https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/"
                target="_blank"
                rel="noreferrer"
              >
                SPHEREx Archive Data Products & Level-2 Pipeline — IPAC ↗
              </a>
            </li>
          </ul>
        </div>

        <div className="credits-section-block">
          <h3>Astronomical Target Coordinates</h3>
          <p>
            Reference field coordinates are drawn from the CDS SIMBAD astronomical database
            (ICRS J2000 epoch). Proper motion has not been propagated to the simulated observation
            epochs:
          </p>
          <div className="source-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Target</th>
                  <th>RA / Dec (degrees)</th>
                  <th>Astrometric Reference</th>
                </tr>
              </thead>
              <tbody>
                {presets.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td className="mono">
                      {p.ra.toFixed(6)}° / {p.dec.toFixed(6)}°
                    </td>
                    <td>
                      {p.verified ? (
                        <a href={p.source} target="_blank" rel="noreferrer">
                          SIMBAD · ICRS J2000 ↗
                        </a>
                      ) : (
                        "Project brief reference · epoch unspecified"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="caption">
          Independent concept for the NASA Space Apps Challenge 2026. Not affiliated with,
          endorsed by, or certified by NASA, Caltech, JPL, or the Space Apps organizers.
        </p>
      </section>
      <Footer />
    </main>
  );
}
