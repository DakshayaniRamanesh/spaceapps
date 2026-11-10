"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
const chapters = [
  {
    number: "01",
    title: "One sky.\nMany moments.",
    body: "A single image is a moment. A sequence tells a story. Return to the same field and see what time reveals.",
  },
  {
    number: "02",
    title: "A subtle shift can\nreveal a new world.",
    body: "Against a steady background, a moving source leaves a trace. Watch the marked point change position across eight simulated epochs.",
  },
  {
    number: "03",
    title: "Compare the past.\nDiscover the unseen.",
    body: "Blink between observations or subtract one image from another. Motion and changing brightness become easier to see.",
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
      "(min-width: 900px) and (prefers-reduced-motion: no-preference)",
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
        }, root);
        return () => ctx.revert();
      },
    );
    return () => mm.revert();
  }, []);
  const mx = (0.5 + (-0.48 + frame * 0.14) / 6) * 100,
    my = (0.5 + (0.3 - frame * 0.075) / 6) * 100;
  return (
    <section id="story" className="scroll-story" ref={root}>
      <div className="story-sticky">
        <div className="story-copy">
          <p className="eyebrow">01 / A UNIVERSE THAT MOVES</p>
          <div className="chapter-number">
            {chapters[stage].number}
            <span> / 03</span>
          </div>
          <h2 key={stage}>
            {chapters[stage].title.split("\n").map((s, i) => (
              <span key={i}>
                {s}
                <br />
              </span>
            ))}
          </h2>
          <p>{chapters[stage].body}</p>
          <div className="chapter-tabs" aria-label="Story chapters">
            {chapters.map((c, i) => (
              <button
                key={c.number}
                aria-label={`Chapter ${c.number}: ${c.title}`}
                aria-pressed={stage === i}
                className={stage === i ? "selected" : ""}
                onClick={() => {
                  setStage(i);
                  setFrame(i === 0 ? 0 : i === 1 ? 4 : 7);
                }}
              >
                {c.number}
              </button>
            ))}
          </div>
        </div>
        <div className="story-visual reveal-image">
          <div className="visual-topline">
            <span>TIME DOMAIN / FIELD 001</span>
            <span className="demo-badge">
              <i /> SIMULATION
            </span>
          </div>
          <div className="story-frame">
            {Array.from({ length: 8 }, (_, i) => (
              <img
                src={`/demo/frame-${i}.png`}
                alt={
                  i === frame
                    ? "Backend-generated starfield with a moving and variable source"
                    : ""
                }
                aria-hidden={i !== frame}
                key={i}
                style={{ opacity: frame === i ? 1 : 0 }}
              />
            ))}
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <path
                d={`M 42 55 L ${mx} ${my}`}
                fill="none"
                stroke="#7ddde8"
                strokeWidth=".18"
                strokeDasharray=".6 .6"
              />
              <circle
                cx={mx}
                cy={my}
                r="3.5"
                fill="none"
                stroke="#7ddde8"
                strokeWidth=".18"
              />
            </svg>
            <span
              className="tracking-label"
              style={{ left: `${mx + 5}%`, top: `${my - 1}%` }}
            >
              MOVING SOURCE
              <br />
              <b>TRACK {String(frame + 1).padStart(2, "0")}</b>
            </span>
            <span className="image-corner tl" />
            <span className="image-corner br" />
          </div>
          <div className="story-timeline">
            {Array.from({ length: 8 }, (_, i) => (
              <button
                onClick={() => setFrame(i)}
                className={i === frame ? "selected" : ""}
                key={i}
                aria-label={`Story epoch ${i + 1}`}
              >
                0{i + 1}
              </button>
            ))}
          </div>
          <p className="caption">
            8 simulated epochs · motion exaggerated for clarity
          </p>
        </div>
      </div>
    </section>
  );
}
