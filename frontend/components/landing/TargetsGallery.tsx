"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import presets from "@/lib/presets.json";
export default function TargetsGallery() {
  const [selected, setSelected] = useState(0);
  const p = presets[selected];
  return (
    <section id="targets" className="targets-gallery section-pad">
      <div className="targets-heading">
        <p className="eyebrow">04 — The changing sky</p>
        <h2>
          FIVE REASONS
          <br />
          TO LOOK AGAIN.
        </h2>
        <p>
          Remarkable objects.
          <br />
          Different stories written in light.
        </p>
      </div>
      <div className="target-showcase">
        <div className="target-feature">
          <div
            className="target-visual"
            aria-label="Illustrative astronomical target, not an image of the named object"
          >
            {presets.map((item, i) => (
              <div
                key={item.id}
                className={`target-scene target-scene-${i}`}
                aria-hidden="true"
                style={{ opacity: selected === i ? 1 : 0 }}
              >
                <img src={`/demo/frame-${i}.png`} alt="" />
                <span className="target-orb" />
                <span className="target-orbit" />
              </div>
            ))}
            <span className="target-visual-label">
              Illustrative field / not target observations
            </span>
            <span className="target-feature-number">0{selected + 1}</span>
          </div>
          <div className="target-feature-copy" key={p.id}>
            <span className="target-phenomenon">{p.phenomenon}</span>
            <h3>{p.classification}</h3>
            <p>{p.description}</p>
            <Link
              className="text-link"
              href={`/explore?ra=${p.ra}&dec=${p.dec}&fov=12&detector=D1`}
            >
              Explore {p.name} <ArrowUpRight />
            </Link>
          </div>
        </div>
        <div
          className="target-list"
          role="group"
          aria-label="Choose an astronomical target"
        >
          {presets.map((item, i) => (
            <button
              key={item.id}
              aria-pressed={selected === i}
              className={selected === i ? "selected" : ""}
              onClick={() => setSelected(i)}
              onFocus={() => setSelected(i)}
              onMouseEnter={() => {
                if (window.matchMedia("(hover: hover)").matches) setSelected(i);
              }}
            >
              <span className="target-list-index">0{i + 1}</span>
              <span>{item.name}</span>
              <ArrowUpRight />
            </button>
          ))}
          <p className="caption">
            Verified SIMBAD reference positions for four targets. WISE 0855 uses
            the supplied coordinates; its epoch is unspecified. Selecting a
            field does not imply real observations are connected.
          </p>
        </div>
      </div>
    </section>
  );
}
