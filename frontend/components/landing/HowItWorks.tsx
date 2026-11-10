import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export default function HowItWorks() {
  return (
    <section className="workflow-section section-pad" id="workflow">
      <div className="workflow-heading">
        <p className="eyebrow">03 / YOUR PATH TO DISCOVERY</p>
        <h2>
          A coordinate.
          <br />A moment.
          <br />
          <em>A discovery.</em>
        </h2>
        <Link href="/explore" className="text-link">
          Enter the observatory <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="workflow-panels">
        {[
          {
            n: "01",
            title: "Locate",
            label: "RIGHT ASCENSION / DECLINATION",
            text: "Choose a region of the sky. Start with a known target or follow your own coordinates.",
            cls: "locate",
          },
          {
            n: "02",
            title: "Observe",
            label: "TIME-SERIES / EIGHT EPOCHS",
            text: "Move through successive observations. Let time reveal the changes in a seemingly still sky.",
            cls: "observe",
          },
          {
            n: "03",
            title: "Compare",
            label: "BLINK / SUBTRACT / DISCOVER",
            text: "Place moments side by side. Separate subtle motion from a changing source of light.",
            cls: "compare",
          },
        ].map((item) => (
          <article
            className={`workflow-panel reveal-image ${item.cls}`}
            key={item.n}
          >
            <div className="workflow-diagram" aria-hidden="true">
              {item.cls === "locate" ? (
                <>
                  <div className="orbit-ring" />
                  <div className="orbit-ring smaller" />
                  <span className="diagram-plus">+</span>
                  <span className="diagram-coordinate">
                    269.452077°
                    <br />
                    +04.693365°
                  </span>
                </>
              ) : item.cls === "observe" ? (
                <>
                  {[0, 3, 7].map((n, i) => (
                    <img
                      key={n}
                      src={`/demo/frame-${n}.png`}
                      style={{
                        transform: `translate(${i * 38}px,${i * 15}px) rotate(${i * 5 - 6}deg)`,
                      }}
                      alt=""
                    />
                  ))}
                </>
              ) : (
                <>
                  <span className="residual-negative" />
                  <span className="residual-positive" />
                  <div className="residual-line" />
                  <span className="residual-equation">B − A</span>
                </>
              )}
            </div>
            <div className="workflow-panel-copy">
              <span className="eyebrow">
                {item.n} — {item.label}
              </span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
