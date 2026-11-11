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
          a.to(".hero-art", { scale: 1.08, yPercent: 6, ease: "none" }, 0)
            .to(".hero-copy", { yPercent: -32, opacity: 0, duration: 0.38, ease: "power2.in" }, 0)
            .to(
              ".hero-orbit-link",
              { scale: 0.8, xPercent: 40, yPercent: 25, opacity: 0, duration: 0.35 },
              0,
            )
            .to(".hero-shade", { opacity: 1, duration: 0.35 }, 0)
            .fromTo(
              ".hero-deep",
              { clipPath: "inset(100% 0% 0% 0%)", scale: 1.05 },
              { clipPath: "inset(0% 0% 0% 0%)", scale: 1, duration: 0.55, ease: "power2.inOut" },
              0.18,
            )
            .to(".hero-deep-shade", { opacity: 0.85, duration: 0.45 }, 0.32)
            .fromTo(
              ".journey-title",
              { opacity: 0 },
              { opacity: 1, duration: 0.1 },
              0.4,
            )
            .fromTo(
              ".journey-title .heading-mask > span",
              { yPercent: 110, opacity: 0 },
              { yPercent: 0, opacity: 1, stagger: 0.12, duration: 0.45, ease: "power3.out" },
              0.42,
            )
            .to(
              ".journey-title",
              { opacity: 0, yPercent: -20, duration: 0.25, ease: "power2.in" },
              0.82,
            )
            .to(".hero-edge", { yPercent: -40, opacity: 0 }, 0);
          // C: an inset monochrome window expands; the display treatment crossfades,
          // the heading completely fades off, and the spectral bands enter.
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
            { clipPath: "inset(16% 17% 12% 17%)", scale: 0.88 },
            { clipPath: "inset(0% 0% 0% 0%)", scale: 1.02, duration: 0.65, ease: "power2.inOut" },
            0,
          )
            .to(".infrared-monochrome", { opacity: 0, duration: 0.48 }, 0.12)
            .to(
              ".infrared-heading",
              { yPercent: -35, opacity: 0, duration: 0.32, ease: "power2.in" },
              0.08,
            )
            .fromTo(
              ".detector-overlay",
              { xPercent: 20, opacity: 0, scale: 0.96 },
              { xPercent: 0, opacity: 1, scale: 1, duration: 0.48, ease: "power2.out" },
              0.38,
            );
          // D: clean instrument preview enters smoothly alongside the copy.
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
            { scale: 0.94, y: 50, opacity: 0.35 },
            { scale: 1, y: 0, opacity: 1, duration: 0.6, ease: "power3.out" },
            0,
          )
            .fromTo(
              ".bridge-orbits span",
              { scale: 1.3, rotation: -20, opacity: 0.6 },
              {
                scale: 1,
                rotation: 8,
                opacity: 0.22,
                stagger: 0.08,
                duration: 0.7,
              },
              0,
            )
            .fromTo(
              ".bridge-copy",
              { y: 60, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.45, ease: "power3.out" },
              0.22,
            )
            .fromTo(
              ".preview-caption",
              { opacity: 0 },
              { opacity: 1, duration: 0.25 },
              0.5,
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
