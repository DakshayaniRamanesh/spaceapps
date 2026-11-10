import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import presets from "@/lib/presets.json";
export default function TargetsGallery() {
  return (
    <section id="targets" className="targets section-pad">
      <div className="targets-heading">
        <div>
          <p className="eyebrow">04 / A PLACE TO BEGIN</p>
          <h2>
            Objects worth
            <br />
            <em>watching.</em>
          </h2>
        </div>
        <p>
          Five remarkable targets. Five reasons to look again.
          <br />
          Reference coordinates, with simulated observations.
        </p>
      </div>
      <div className="target-grid">
        {presets.map((p, i) => (
          <Link
            className="target-card"
            key={p.id}
            href={`/explore?ra=${p.ra}&dec=${p.dec}&fov=12&detector=D${(i % 6) + 1}`}
          >
            <div className={`target-art target-${i}`}>
              <img src={`/demo/frame-${i}.png`} alt="" />
              <span className="target-source" />
              <span className="target-number">0{i + 1}</span>
              <span className="target-type">{p.phenomenon}</span>
            </div>
            <div className="target-card-copy">
              <p className="eyebrow">{p.classification}</p>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <span className="target-action">
                Explore target <ArrowUpRight size={17} />
              </span>
            </div>
          </Link>
        ))}
      </div>
      <p className="caption">
        Illustrative thumbnails. SIMBAD J2000 reference positions, except WISE
        0855: supplied coordinates, epoch unspecified.
      </p>
    </section>
  );
}
