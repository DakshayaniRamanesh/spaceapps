"use client";
import { useEffect, useRef } from "react";
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
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.from(".hero-reveal", {
          y: 36,
          opacity: 0,
          duration: 1.1,
          stagger: 0.13,
          ease: "power3.out",
        });
        gsap.to(".hero-art", {
          scale: 1.1,
          yPercent: 8,
          ease: "none",
          scrollTrigger: {
            trigger: ".hero",
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
        gsap.to(".hero-copy", {
          y: 90,
          opacity: 0.2,
          scrollTrigger: {
            trigger: ".hero",
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
        gsap.utils.toArray<HTMLElement>(".reveal-image").forEach((el) =>
          gsap.from(el, {
            clipPath: "inset(10% 5% 10% 5%)",
            y: 35,
            scrollTrigger: {
              trigger: el,
              start: "top 90%",
              end: "top 45%",
              scrub: true,
            },
          }),
        );
        gsap.from(".final-cta h2", {
          y: 65,
          scrollTrigger: {
            trigger: ".final-cta",
            start: "top bottom",
            end: "center center",
            scrub: true,
          },
        });
        gsap.from(".motion-headline", {
          opacity: 0,
          y: 12,
          delay: 0.8,
          duration: 1.2,
        });
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);
  return (
    <main id="main" ref={root}>
      <Hero />
      <div className="mission-strip">
        <span>INSPIRED BY NASA’S SPHEREx MISSION</span>
        <div>
          <strong>102</strong>
          <span>SPECTRAL BANDS</span>
        </div>
        <div>
          <strong>6</strong>
          <span>DETECTOR ARRAYS</span>
        </div>
        <div>
          <strong>1</strong>
          <span>EVER-CHANGING SKY</span>
        </div>
        <Link href="/about">Meet the mission ↗</Link>
      </div>
      <ScrollStory />
      <SpectralSection />
      <HowItWorks />
      <TargetsGallery />
      <section className="final-cta">
        <p className="eyebrow">EVERY DISCOVERY STARTS WITH CURIOSITY.</p>
        <h2>
          THE NEXT DISCOVERY
          <br />
          COULD BEGIN WITH
          <br />
          <em>A SINGLE PIXEL.</em>
        </h2>
        <p>
          Step into the observatory. Choose a region.
          <br />
          Watch the universe change.
        </p>
        <Link href="/explore" className="button primary">
          Start exploring <ArrowUpRight size={18} />
        </Link>
        <div className="celestial-horizon" aria-hidden="true" />
      </section>
      <Footer />
    </main>
  );
}
