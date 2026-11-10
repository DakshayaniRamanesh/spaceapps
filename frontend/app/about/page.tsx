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
          The Earth horizon photograph is from NASA’s International Space
          Station wallpaper collection. The Cosmic Cliffs infrared composite is
          credited to NASA, ESA, CSA and STScI. Both are editorial imagery, not
          SPHEREx observations. Images are locally stored, resized and
          compressed; dark overlays and a grayscale-to-color transition serve
          the page design. Typography uses Archivo, DM Sans and IBM Plex Mono
          under their bundled open font licenses.
        </p>
        <ul className="source-links">
          <li>
            <a href="https://www.nasa.gov/international-space-station/desktop-and-mobile-wallpapers/">
              Earth horizon — NASA / ISS ↗
            </a>
          </li>
          <li>
            <a href="https://science.nasa.gov/asset/webb/cosmic-cliffs-in-the-carina-nebula-nircam-and-miri-composite-image/">
              Cosmic Cliffs — NASA, ESA, CSA, STScI ↗
            </a>
          </li>
        </ul>
        <p>
          The moving-source story and target gallery use clearly labeled
          synthetic illustrations. They do not depict measured motion, spectral
          behavior, or observations of the named targets.
        </p>
        <h3>Target coordinates</h3>
        <p>
          These are reference field centers, not predicted positions at the
          simulated observation dates. Proper motion has not been applied. The
          displayed sources do not model the actual target.
        </p>
        <div className="source-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Target</th>
                <th>RA / Dec (degrees)</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {presets.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="mono">
                    {p.ra.toFixed(6)} / {p.dec.toFixed(6)}
                  </td>
                  <td>
                    {p.verified ? (
                      <a href={p.source} target="_blank" rel="noreferrer">
                        SIMBAD · ICRS J2000 ↗
                      </a>
                    ) : (
                      "User-supplied · epoch unspecified"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="source-links">
          <li>
            <a href="https://spherex.caltech.edu/page/instrument">
              SPHEREx instrument — Caltech ↗
            </a>
          </li>
          <li>
            <a href="https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/overview.html">
              SPHEREx Data Explorer documentation — NASA/IPAC IRSA ↗
            </a>
          </li>
          <li>
            <a href="https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/">
              SPHEREx archive data products — IPAC ↗
            </a>
          </li>
        </ul>
        <p className="caption">
          Independent project concept. Not operated, endorsed, or certified by
          NASA, JPL, Caltech, or the Space Apps organizers.
        </p>
      </section>
      <Footer />
    </main>
  );
}
