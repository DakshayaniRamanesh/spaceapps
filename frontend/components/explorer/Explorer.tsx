"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, ArrowUpRight, AlertCircle } from "lucide-react";
import Link from "next/link";
import presets from "@/lib/presets.json";
import {
  Field,
  Detector,
  ObservationSet,
  Mode,
  DEFAULT_FIELD,
  fieldQuery,
  validateField,
} from "@/lib/types";
import ObservationControls from "./ObservationControls";
import SkyViewer from "./SkyViewer";
import Timeline from "./Timeline";
import MetadataPanel from "./MetadataPanel";
import ComparisonModes from "./ComparisonModes";
export default function Explorer() {
  const [field, setField] = useState<Field>(DEFAULT_FIELD),
    [data, setData] = useState<ObservationSet | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [mode, setMode] = useState<Mode>("single"),
    [a, setA] = useState(0),
    [b, setB] = useState(7),
    [blinkIndex, setBlinkIndex] = useState(0),
    [blinkSpeed, setBlinkSpeed] = useState(500),
    [copied, setCopied] = useState(false),
    [shareFallback, setShareFallback] = useState("");
  const controller = useRef<AbortController | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(async (f: Field, writeUrl = true) => {
    const invalid = validateField(f);
    if (invalid) {
      setError(invalid);
      setLoading(false);
      return;
    }
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setLoading(true);
    setError("");
    setPlaying(false);
    setField(f);
    try {
      const q = new URLSearchParams({
        ra: String(f.ra),
        dec: String(f.dec),
        fov_arcmin: String(f.fov_arcmin),
        detector: f.detector,
      });
      const res = await fetch(`/api/observations?${q}`, { signal: c.signal });
      if (!res.ok)
        throw new Error(
          res.status === 503
            ? "The selected data provider is unavailable. Set OBSERVATION_SOURCE=synthetic on the API."
            : `Observation request failed (${res.status}). Check the Python API and try again.`,
        );
      const result: ObservationSet = await res.json();
      if (c.signal.aborted) return;
      setData(result);
      setField(result.request);
      setIndex(0);
      setA(0);
      setB(result.frames.length - 1);
      setMode("single");
      setBlinkIndex(0);
      if (writeUrl)
        window.history.replaceState(
          null,
          "",
          `/explore?${fieldQuery(result.request)}`,
        );
    } catch (err) {
      if (!c.signal.aborted)
        setError(
          err instanceof Error
            ? err.message
            : "Cannot reach the observation API. Start the backend and try again.",
        );
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    function fromUrl() {
      const q = new URLSearchParams(window.location.search);
      const num = (k: string, d: number) =>
        q.has(k) ? (q.get(k)?.trim() ? Number(q.get(k)) : NaN) : d;
      const f: Field = {
        ra: num("ra", DEFAULT_FIELD.ra),
        dec: num("dec", DEFAULT_FIELD.dec),
        fov_arcmin: num("fov", 12),
        detector: (q.get("detector") || "D1") as Detector,
      };
      void load(f);
    }
    fromUrl();
    window.addEventListener("popstate", fromUrl);
    return () => {
      controller.current?.abort();
      window.removeEventListener("popstate", fromUrl);
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, [load]);
  useEffect(() => {
    if (!playing || !data || loading || mode !== "single") return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % data.frames.length),
      1000 / speed,
    );
    return () => clearInterval(id);
  }, [playing, data, speed, loading, mode]);
  useEffect(() => {
    if (mode !== "blink" || loading || !playing) return;
    const id = setInterval(() => setBlinkIndex((i) => 1 - i), blinkSpeed);
    return () => clearInterval(id);
  }, [mode, blinkSpeed, loading, playing]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  const chooseIndex = useCallback(
    (i: number) => {
      setPlaying(false);
      setIndex(i);
      if (mode !== "single") setMode("single");
    },
    [mode],
  );
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        !data ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.shiftKey ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLButtonElement ||
        e.target instanceof HTMLAnchorElement
      )
        return;
      if (e.code === "Space" && (mode === "single" || mode === "blink")) {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        chooseIndex((index + 1) % data.frames.length);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        chooseIndex((index + data.frames.length - 1) % data.frames.length);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [data, index, chooseIndex, mode]);
  async function share() {
    if (!data) return;
    const url = `${window.location.origin}/explore?${fieldQuery(data.request)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      setShareFallback(url);
    }
  }
  const target = data
    ? presets.find(
        (p) =>
          Math.abs(p.ra - data.request.ra) < 0.00001 &&
          Math.abs(p.dec - data.request.dec) < 0.00001,
      )
    : null;
  return (
    <main id="main" className="explorer">
      <div className="explorer-title">
        <div>
          <div className="eyebrow">YOUR WINDOW INTO THE CHANGING SKY</div>
          <h1>
            Sky Explorer<span className="muted"> / </span>
            <span>{target?.name || "Custom field"}</span>
          </h1>
        </div>
        <button className="button secondary" disabled={!data} onClick={share}>
          <Copy size={15} />
          {copied ? "Link copied" : "Share field"}
        </button>
      </div>
      <p className="sr-only" role="status">
        {copied ? "Observation URL copied to clipboard" : ""}
      </p>
      {shareFallback && (
        <label className="share-fallback">
          Copy this observation URL
          <input
            readOnly
            value={shareFallback}
            onFocus={(e) => e.target.select()}
          />
          <button onClick={() => setShareFallback("")}>Close</button>
        </label>
      )}
      {error && (
        <div className="api-error" role="alert">
          <AlertCircle size={19} />
          <span>{error}</span>
          <button onClick={() => load(field)}>Retry</button>
        </div>
      )}
      <div className="observatory">
        <ObservationControls field={field} onLoad={load} loading={loading} />
        <div className="observatory-center">
          {data ? (
            <>
              <ComparisonModes
                mode={mode}
                onMode={(m) => {
                  setPlaying(false);
                  setBlinkIndex(0);
                  setMode(m);
                }}
                frames={data.frames}
                a={a}
                b={b}
                onPair={(x, y) => {
                  setPlaying(false);
                  setBlinkIndex(0);
                  setA(x);
                  setB(y);
                }}
                blinkSpeed={blinkSpeed}
                onBlinkSpeed={setBlinkSpeed}
              />
              {mode === "blink" && (
                <div className="blink-status">
                  <span>
                    Blink comparator · {playing ? "running" : "paused"}
                  </span>
                  <button onClick={() => setPlaying((p) => !p)}>
                    {playing ? "Pause blink" : "Start blink"}
                  </button>
                </div>
              )}
              <SkyViewer
                data={data}
                index={index}
                mode={mode}
                a={a}
                b={b}
                blinkIndex={blinkIndex}
                loading={loading}
              />
              <Timeline
                frames={data.frames}
                index={index}
                onIndex={chooseIndex}
                playing={playing && mode === "single"}
                onPlay={() => setPlaying((p) => !p)}
                speed={speed}
                onSpeed={setSpeed}
                disabled={mode !== "single" || loading}
              />
            </>
          ) : (
            <div className="viewer-skeleton panel" role="status">
              <div className="skeleton-orbit" />
              <h2>
                {loading
                  ? "Bringing the sky into focus."
                  : "Ready when you are."}
              </h2>
              <p>
                {loading
                  ? "Generating eight aligned synthetic epochs…"
                  : "Enter valid coordinates and load observations."}
              </p>
            </div>
          )}
        </div>
        {data && (
          <MetadataPanel
            data={data}
            index={
              mode === "blink"
                ? blinkIndex
                  ? b
                  : a
                : mode === "difference" || mode === "split"
                  ? b
                  : index
            }
            mode={mode}
          />
        )}
      </div>
      <div className="explorer-foot">
        <span>
          <i /> SYNTHETIC PROVIDER · {data?.frames.length || 0} EPOCHS · NO LIVE
          NASA DATA
        </span>
        <Link href="/about#methodology">
          Understand the simulation <ArrowUpRight size={13} />
        </Link>
      </div>
    </main>
  );
}
