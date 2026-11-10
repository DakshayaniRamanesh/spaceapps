"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
const chapters = [
  {
    title: "One sky. Many moments.",
    body: "Time adds another dimension to an image. A familiar field becomes a story when you look again.",
  },
  {
    title: "A small shift. A different story.",
    body: "Against a steady background, one source changes position. Follow the highlighted point across this educational sequence.",
  },
  {
    title: "The change is the discovery.",
    body: "Compare two moments. Motion and changing brightness become easier to see when the background stays aligned.",
  },
];
export default function ScrollStory() {
  const root = useRef<HTMLElement>(null);
  const [frame, setFrame] = useState(0),
    [stage, setStage] = useState(0);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add(
      "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
      () => {
        const ctx = gsap.context(() => {
          ScrollTrigger.create({
            trigger: root.current,
            start: "top top",
            end: "bottom bottom",
            onUpdate: (self) => {
              setFrame(Math.min(7, Math.floor(self.progress * 8)));
              setStage(Math.min(2, Math.floor(self.progress * 3)));
            },
          });
          gsap.to(".motion-field", {
            scale: 1.08,
            xPercent: -3,
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: "bottom bottom",
              scrub: true,
            },
          });
        }, root);
        return () => ctx.revert();
      },
    );
    return () => mm.revert();
  }, []);
  const mx = (0.5 + (-0.48 + frame * 0.14) / 6) * 100,
    my = (0.5 + (0.3 - frame * 0.075) / 6) * 100;
  return (
    <section
      id="story"
      ref={root}
      className="motion-story"
      aria-label="The moving universe"
    >
      <div className="motion-sticky">
        <div className="motion-heading">
          <p className="eyebrow">01 — The moving universe</p>
          <h2>
            NOTHING
            <small>IN THE UNIVERSE</small>
            STANDS
            <br />
            <span>STILL.</span>
          </h2>
          <p className="motion-subtitle">
            Nothing in the universe stands still.
          </p>
        </div>
        <div className="motion-field">
          <div className="motion-frame">
            {Array.from({ length: 8 }, (_, i) => (
              <img
                key={i}
                src={`/demo/frame-${i}.png`}
                alt={
                  i === frame
                    ? "Educational starfield illustration showing a moving source"
                    : ""
                }
                aria-hidden={i !== frame}
                style={{ opacity: i === frame ? 1 : 0 }}
              />
            ))}
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <path
                d={`M42 55 L${mx} ${my}`}
                stroke="#f7f4ff"
                strokeWidth=".2"
                strokeDasharray=".7 .8"
              />
              <circle
                cx={mx}
                cy={my}
                r="4"
                fill="none"
                stroke="#bfa1ff"
                strokeWidth=".25"
              />
            </svg>
            <span
              className="moving-label"
              style={{ left: `${mx + 6}%`, top: `${my}%` }}
            >
              Moving source
              <br />
              <b>Moment {String(frame + 1).padStart(2, "0")}</b>
            </span>
          </div>
          <div className="motion-epochs" aria-label="Illustration epochs">
            {Array.from({ length: 8 }, (_, i) => (
              <button
                key={i}
                aria-label={`Story epoch ${i + 1}`}
                aria-pressed={frame === i}
                className={frame === i ? "selected" : ""}
                onClick={() => {
                  setFrame(i);
                  setStage(Math.min(2, Math.floor(i / 3)));
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </button>
            ))}
          </div>
          <p className="caption">
            Educational illustration · synthetic frames · exaggerated motion
          </p>
        </div>
        <div className="motion-caption" key={stage}>
          <span className="chapter-counter">0{stage + 1} / 03</span>
          <h3>{chapters[stage].title}</h3>
          <p>{chapters[stage].body}</p>
        </div>
      </div>
    </section>
  );
}
