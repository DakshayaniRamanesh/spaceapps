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
            <svg viewBox="0 0 100 100" aria-hidden="true" className="motion-reticle-svg">
              <defs>
                <linearGradient id="trackGrad" x1="42%" y1="55%" x2={`${mx}%`} y2={`${my}%`}>
                  <stop offset="0%" stopColor="#9b72f2" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#f7f4ff" stopOpacity="0.9" />
                </linearGradient>
              </defs>
              <path
                d={`M42 55 L${mx} ${my}`}
                stroke="url(#trackGrad)"
                strokeWidth=".3"
                strokeDasharray=".8 .8"
              />
              {/* Historical epoch tick marks */}
              {Array.from({ length: frame + 1 }, (_, k) => {
                const kx = (0.5 + (-0.48 + k * 0.14) / 6) * 100;
                const ky = (0.5 + (0.3 - k * 0.075) / 6) * 100;
                return (
                  <circle
                    key={k}
                    cx={kx}
                    cy={ky}
                    r={k === frame ? "0.8" : "0.5"}
                    fill={k === frame ? "#ffffff" : "#bfa1ff"}
                    opacity={k === frame ? 1 : 0.6}
                  />
                );
              })}
              {/* Targeting reticle */}
              <circle
                cx={mx}
                cy={my}
                r="3.5"
                fill="none"
                stroke="#9b72f2"
                strokeWidth=".28"
                opacity="0.85"
              />
              <circle
                cx={mx}
                cy={my}
                r="5.5"
                fill="none"
                stroke="#d4b8ff"
                strokeWidth=".18"
                strokeDasharray="1.2 1.5"
                opacity="0.65"
              />
              {/* Crosshair marks */}
              <line x1={mx - 6.5} y1={my} x2={mx - 4.2} y2={my} stroke="#f7f4ff" strokeWidth=".2" />
              <line x1={mx + 4.2} y1={my} x2={mx + 6.5} y2={my} stroke="#f7f4ff" strokeWidth=".2" />
              <line x1={mx} y1={my - 6.5} x2={mx} y2={my - 4.2} stroke="#f7f4ff" strokeWidth=".2" />
              <line x1={mx} y1={my + 4.2} x2={mx} y2={my + 6.5} stroke="#f7f4ff" strokeWidth=".2" />
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
