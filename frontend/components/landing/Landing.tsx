"use client";
import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowUpRight } from "lucide-react";
import Hero from "./Hero";
import ScrollStory from "./ScrollStory";
import SpectralSection from "./SpectralSection";
import HowItWorks from "./HowItWorks";
import TargetsGallery from "./TargetsGallery";
import { Footer } from "../ui/Navigation";
export default function Landing() {
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .from(".hero-art", {
            clipPath: "inset(0 0 100% 0)",
            scale: 1.08,
            duration: 1.3,
          })
          .from(
            ".heading-mask>span",
            { yPercent: 110, duration: 1, stagger: 0.13 },
            0.3,
          )
          .from(".hero-kicker", { opacity: 0, y: 18, duration: 0.7 }, 0.65)
          .from(".hero-support", { opacity: 0, y: 25, duration: 0.8 }, 0.95)
          .from(
            ".hero-orbit-link",
            { scale: 0.65, rotation: -20, opacity: 0, duration: 1 },
            1.05,
          );
        gsap.from(".targets-heading h2", {
          y: 55,
          scrollTrigger: {
            trigger: ".targets-heading",
            start: "top 90%",
            end: "top 55%",
            scrub: true,
          },
        });
      }, root);
      return () => ctx.revert();
    });
    mm.add(
      "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
      () => {
        const ctx = gsap.context(() => {
          // A: independently moving Earth, text, shade and a masked deep-space reveal.
          const a = gsap.timeline({
            scrollTrigger: {
              trigger: ".hero-journey",
              start: "top top",
              end: "bottom bottom",
              scrub: 0.7,
              invalidateOnRefresh: true,
            },
          });
          a.to(".hero-art", { scale: 1.28, yPercent: 10, ease: "none" }, 0)
            .to(".hero-copy", { yPercent: -28, opacity: 0, duration: 0.45 }, 0)
            .to(
              ".hero-orbit-link",
              { xPercent: 60, yPercent: 35, opacity: 0, duration: 0.4 },
              0,
            )
            .to(".hero-shade", { opacity: 1, duration: 0.4 }, 0)
            .fromTo(
              ".hero-deep",
              { clipPath: "inset(100% 0% 0% 0%)", scale: 1.12 },
              { clipPath: "inset(0% 0% 0% 0%)", scale: 1, duration: 0.65 },
              0.2,
            )
            .to(".hero-deep-shade", { opacity: 1, duration: 0.5 }, 0.35)
            .fromTo(
              ".journey-title",
              { opacity: 0, y: 85 },
              { opacity: 1, y: 0, duration: 0.4 },
              0.55,
            )
            .to(".hero-edge", { yPercent: -40, opacity: 0 }, 0);
          // C: an inset monochrome window expands; the display treatment crossfades,
          // then the array explanation enters independently. No science data is altered.
          const c = gsap.timeline({
            scrollTrigger: {
              trigger: ".infrared-section",
              start: "top top",
              end: "bottom bottom",
              scrub: 0.65,
              invalidateOnRefresh: true,
            },
          });
          c.fromTo(
            ".infrared-image-wrap",
            { clipPath: "inset(18% 19% 12% 19%)", scale: 0.83 },
            { clipPath: "inset(0% 0% 0% 0%)", scale: 1, duration: 0.65 },
            0,
          )
            .to(".infrared-monochrome", { opacity: 0, duration: 0.55 }, 0.15)
            .to(
              ".infrared-heading",
              { xPercent: -14, yPercent: -35, opacity: 0.12, duration: 0.5 },
              0.15,
            )
            .fromTo(
              ".detector-overlay",
              { xPercent: 30, opacity: 0 },
              { xPercent: 0, opacity: 1, duration: 0.5 },
              0.43,
            );
          // D: a wide photographic scene becomes an unpopulated instrument preview.
          const d = gsap.timeline({
            scrollTrigger: {
              trigger: ".observatory-bridge",
              start: "top top",
              end: "bottom bottom",
              scrub: 0.7,
              invalidateOnRefresh: true,
            },
          });
          d.fromTo(
            ".preview-shell",
            { scale: 1.75, xPercent: 32, yPercent: 4 },
            { scale: 1, xPercent: 0, yPercent: 0, duration: 0.6 },
            0,
          )
            .fromTo(
              ".bridge-photo",
              { opacity: 1 },
              { opacity: 0, duration: 0.35 },
              0.35,
            )
            .fromTo(
              ".preview-ui",
              { opacity: 0 },
              { opacity: 1, duration: 0.35 },
              0.4,
            )
            .fromTo(
              ".bridge-orbits span",
              { scale: 1.45, rotation: -25, opacity: 0.7 },
              {
                scale: 1,
                rotation: 0,
                opacity: 0.18,
                stagger: 0.08,
                duration: 0.7,
              },
              0,
            )
            .fromTo(
              ".bridge-copy",
              { y: 85, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.45 },
              0.5,
            )
            .fromTo(
              ".preview-caption",
              { opacity: 0 },
              { opacity: 1, duration: 0.2 },
              0.7,
            );
        }, root);
        return () => ctx.revert();
      },
    );
    return () => mm.revert();
  }, []);
  return (
    <main id="main" ref={root} className="landing">
      <Hero />
      <div className="editorial-intro">
        <span>
          SEE THE SKY
          <br />
          IN MOTION.
        </span>
        <p>
          A moment tells us where.
          <br />
          Time tells us what changes.
        </p>
        <Link href="/about" className="text-link">
          Meet the mission <ArrowUpRight />
        </Link>
      </div>
      <ScrollStory />
      <SpectralSection />
      <HowItWorks />
      <TargetsGallery />
      <section className="final-cta">
        <div className="final-circle" aria-hidden="true" />
        <p className="eyebrow">A new perspective is waiting.</p>
        <h2>
          LOOK UP.
          <br />
          LOOK AGAIN.
        </h2>
        <Link href="/explore" className="final-link">
          Enter the explorer <ArrowUpRight size={36} />
        </Link>
      </section>
      <Footer />
    </main>
  );
}
