"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Orbit } from "lucide-react";
export default function Navigation() {
  const path = usePathname();
  return (
    <header className="navigation">
      <Link href="/" className="brand" aria-label="SkyTrace home">
        <Orbit size={29} strokeWidth={1.4} />
        <span>
          SKYTRACE<span className="brand-dot">.</span>
        </span>
      </Link>
      <nav aria-label="Main navigation">
        <Link className={path === "/explore" ? "active" : ""} href="/explore">
          Explorer
        </Link>
        <Link className={path === "/about" ? "active" : ""} href="/about">
          The mission
        </Link>
        <a href="/#targets">Targets</a>
      </nav>
      <div className="nav-end">
        <span className="demo-badge">
          <i /> Synthetic demo
        </span>
        {path != "/explore" && (
          <Link
            className="nav-launch"
            href="/explore"
            aria-label="Launch explorer"
          >
            <ArrowUpRight size={20} />
          </Link>
        )}
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <Link className="brand" href="/">
        SKYTRACE<span className="brand-dot">.</span>
      </Link>
      <span>See the sky in motion.</span>
      <p>
        Independent Space Apps concept · Synthetic data · No NASA endorsement
      </p>
      <Link href="/about#methodology">Data & methodology ↗</Link>
    </footer>
  );
}
