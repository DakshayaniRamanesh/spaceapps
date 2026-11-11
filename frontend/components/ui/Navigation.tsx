"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { developmentDemoEnabled } from "@/lib/source-policy";
export default function Navigation() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        document.getElementById("menu-toggle")?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  const handleChangingSkyClick = (e: React.MouseEvent) => {
    setOpen(false);
    if (path === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBrandClick = (e: React.MouseEvent) => {
    setOpen(false);
    if (path === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <>
      <header className={`navigation ${path === "/" ? "landing-nav" : ""}`}>
        <Link
          className="brand"
          href="/"
          aria-label="SkyTrace home"
          onClick={handleBrandClick}
        >
          <span className="brand-mark" aria-hidden="true" />
          skytrace
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/explore" className={path === "/explore" ? "active" : ""}>
            Explorer
          </Link>
          <Link href="/about" className={path === "/about" ? "active" : ""}>
            Our mission
          </Link>
          <Link
            href="/"
            onClick={handleChangingSkyClick}
            className={path === "/" ? "active" : ""}
          >
            The changing sky
          </Link>
        </nav>
        <div className="nav-end">
          <span
            className={`data-badge ${developmentDemoEnabled ? "demo" : ""}`}
          >
            <i />
            {developmentDemoEnabled
              ? "Synthetic development mode"
              : "Real data not connected"}
          </span>
          {path !== "/explore" && (
            <Link
              className="nav-launch"
              href="/explore"
              aria-label="Enter the explorer"
            >
              <ArrowUpRight size={22} />
            </Link>
          )}
          <button
            id="menu-toggle"
            className="menu-toggle"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {open && (
        <nav
          id="mobile-menu"
          className="mobile-menu"
          aria-label="Mobile navigation"
        >
          <Link href="/explore">Explorer ↗</Link>
          <Link href="/about">Our mission</Link>
          <Link href="/" onClick={handleChangingSkyClick}>
            The changing sky
          </Link>
          <p>
            See the sky in motion.
            <br />
            An independent SPHEREx-inspired project.
          </p>
        </nav>
      )}
    </>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <Link href="/" className="brand">
        skytrace
      </Link>
      <span>See the sky in motion.</span>
      <p>
        Independent Space Apps 2026 concept. No NASA endorsement.
        <br />
        Editorial space imagery is separate from observation data.
      </p>
      <Link href="/about#credits">Image credits & methodology ↗</Link>
    </footer>
  );
}
