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
  FEATURED_FIELD,
  Job,
  fieldQuery,
  validateField,
} from "@/lib/types";
import ObservationControls from "./ObservationControls";
import CatalogueExplorer from "./CatalogueExplorer";
import Timeline from "./Timeline";
import MetadataPanel from "./MetadataPanel";
import ComparisonModes from "./ComparisonModes";
import EmptyObservatory from "./EmptyObservatory";
import PairEvidence from "./PairEvidence";
import { checkedJson, pause, differenceAllowed } from "@/lib/observations";
import {
  developmentDemoEnabled,
  mayRequestObservations,
  mayDisplaySource,
  ProviderHealth,
} from "@/lib/source-policy";
export default function Explorer() {
  const [field, setField] = useState<Field>(
      developmentDemoEnabled ? DEFAULT_FIELD : FEATURED_FIELD,
    ),
    [data, setData] = useState<ObservationSet | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [archiveUnavailable, setArchiveUnavailable] = useState(false),
    [resultOrigin, setResultOrigin] = useState(""),
    [progress, setProgress] = useState("Checking the observation service…"),
    [emptyNotice, setEmptyNotice] = useState(""),
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
  const lastRefresh = useRef(false);
  const load = useCallback(async (f: Field, writeUrl = true, refresh = false) => {
    const invalid = validateField(f, developmentDemoEnabled ? 60 : 30);
    if (invalid) {
      setError(invalid);
      setLoading(false);
      return;
    }
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setLoading(true);
    setEmptyNotice("");
    setProgress("Checking the observation service…");
    setError("");
    setArchiveUnavailable(false);
    setResultOrigin("");
    lastRefresh.current = refresh;
    setPlaying(false);
    setField(f);
    setData(null);
    if (writeUrl)
      window.history.replaceState(null, "", `/explore?${fieldQuery(f)}`);
    try {
      const healthResponse = await fetch("/health", {
        signal: c.signal,
        cache: "no-store",
      });
      if (!healthResponse.ok)
        throw new Error(
          "The observation service is unavailable. Your field is saved; reconnect the service and retry.",
        );
      const health: ProviderHealth = await healthResponse.json();
      if (!mayRequestObservations(health, developmentDemoEnabled)) {
        setEmptyNotice(
          "The observation source is unavailable. Synthetic data requires explicit development opt-in.",
        );
        return;
      }
      if (health.real_data_enabled && f.fov_arcmin > 30)
        throw new Error(
          "Real-data fields must be between 2 and 30 arcminutes.",
        );
      const q = new URLSearchParams({
        ra: String(f.ra),
        dec: String(f.dec),
        fov_arcmin: String(f.fov_arcmin),
        detector: f.detector,
        limit: String(f.limit ?? 12),
      });
      if (f.spread) q.set("spread", "true");
      if (f.start_date) q.set("start_date", f.start_date);
      if (f.end_date) q.set("end_date", f.end_date);
      if (f.min_wavelength_um != null)
        q.set("min_wavelength_um", String(f.min_wavelength_um));
      if (f.max_wavelength_um != null)
        q.set("max_wavelength_um", String(f.max_wavelength_um));
      let result: ObservationSet;
      if (health.real_data_enabled) {
        let job = await checkedJson<Job>(
          await fetch(`/api/observation-jobs${refresh ? "?refresh=true" : ""}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(f),
            signal: c.signal,
          }),
        );
        const deadline = Date.now() + 300_000;
        while (job.status === "queued" || job.status === "running") {
          setProgress(`${job.stage}. First searches can take several minutes.`);
          await pause(2000, c.signal);
          if (Date.now() > deadline)
            throw new Error(
              "The search is still running. Retry to reconnect to the same job; no duplicate work will be started.",
            );
          job = await checkedJson<Job>(
            await fetch(`/api/jobs/${job.job_id}`, {
              signal: c.signal,
              cache: "no-store",
            }),
          );
        }
        if (job.status === "failed") {
          if (!c.signal.aborted)
            setArchiveUnavailable(job.error_code === "archive_unavailable");
          throw new Error(
            job.message || "The archive search failed. Please retry.",
          );
        }
        if (!job.result_url)
          throw new Error("The observation job returned no result.");
        result = await checkedJson<ObservationSet>(
          await fetch(job.result_url, { signal: c.signal }),
        );
        if (!c.signal.aborted)
          setResultOrigin(job.cache_hit
            ? "Cached preview · use Check latest archive to search for updates."
            : "Archive queried this session · bounded DR1/QR3 wide-survey sample; not all available exposures.");
      } else {
        result = await checkedJson<ObservationSet>(
          await fetch(`/api/observations?${q}`, { signal: c.signal }),
        );
      }
      if (c.signal.aborted) return;
      if (!mayDisplaySource(result.source_type, developmentDemoEnabled)) return;
      if (!result.frames.length) {
        setEmptyNotice(`${result.notice} ${result.warnings?.join(" ") || ""}`);
        return;
      }
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
      const defaults = developmentDemoEnabled ? DEFAULT_FIELD : FEATURED_FIELD;
      const f: Field = {
        ra: num("ra", defaults.ra),
        dec: num("dec", defaults.dec),
        fov_arcmin: num("fov", 12),
        detector: (q.get("detector") || defaults.detector) as Detector,
        limit: num("limit", 12),
        spread: q.get("spread") === "1",
        start_date: q.get("start") || undefined,
        end_date: q.get("end") || undefined,
        min_wavelength_um: q.has("min_wavelength_um")
          ? num("min_wavelength_um", NaN)
          : undefined,
        max_wavelength_um: q.has("max_wavelength_um")
          ? num("max_wavelength_um", NaN)
          : undefined,
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
    if (
      !playing ||
      !data ||
      data.frames.length < 2 ||
      loading ||
      mode !== "single"
    )
      return;
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
        data.frames.length < 2 ||
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
    const selectedField = data?.request || field;
    if (validateField(selectedField, developmentDemoEnabled ? 60 : 30)) return;
    const url = `${window.location.origin}/explore?${fieldQuery(selectedField)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      setShareFallback(url);
    }
  }
  const target = presets.find(
    (p) =>
      Math.abs(p.ra - field.ra) < 0.00001 &&
      Math.abs(p.dec - field.dec) < 0.00001,
  );
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
        <button
          className="button secondary"
          disabled={!!validateField(field, developmentDemoEnabled ? 60 : 30)}
          onClick={share}
        >
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
          <span>
            {error}
            {archiveUnavailable &&
              " This field requires live archive access. The bundled featured field is available without IRSA."}
          </span>
          <button onClick={() => load(field, true, lastRefresh.current)}>Retry</button>
          {archiveUnavailable && (
            <button onClick={() => load({ ...FEATURED_FIELD })}>
              Load featured field
            </button>
          )}
        </div>
      )}
      {!developmentDemoEnabled && (
        <div className="archive-refresh">
          <p>{resultOrigin || "Search published SPHEREx DR1/QR3 exposures. New archive data is ingested weekly; SIA search can lag by about a day."}</p>
          <button className="button secondary" disabled={loading || !!validateField(field, 30)}
            onClick={() => load(field, true, true)}>
            Check latest archive
          </button>
        </div>
      )}
      <div className="observatory">
        <ObservationControls
          field={field}
          onLoad={load}
          loading={loading}
          demoEnabled={developmentDemoEnabled}
          activeFrame={
            data?.frames[
              mode === "blink"
                ? blinkIndex
                  ? b
                  : a
                : mode === "split" || mode === "difference"
                  ? b
                  : index
            ]
          }
        />
        <div className="observatory-center">
          {data ? (
            <>
              <PairEvidence data={data} a={a} b={b} />
              <ComparisonModes
                allowDifference={differenceAllowed(data, a, b)}
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
              <CatalogueExplorer
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
                totalCandidates={data.total_candidates ?? data.archive_records}
              />
            </>
          ) : (
            <EmptyObservatory
              loading={loading}
              message={loading ? progress : emptyNotice || error}
            />
          )}
        </div>
        {data ? (
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
        ) : (
          <aside className="intelligence empty-inspector">
            <h2>Observation details</h2>
            <p>Details appear when an observation is connected.</p>
            <div>
              <h3>Image properties</h3>
              <p>No image loaded</p>
            </div>
            <div>
              <h3>Data quality</h3>
              <p>Awaiting source metadata</p>
            </div>
            <div>
              <h3>Comparison information</h3>
              <p>Connect two or more epochs to compare.</p>
            </div>
          </aside>
        )}
      </div>
      <div className="explorer-foot">
        <span>
          <i />{" "}
          {data
            ? `${data.source_type === "synthetic" ? "Synthetic development data" : "NASA/IPAC IRSA · SPHEREx"} · ${data.frames.length} exposures`
            : "No observation data connected"}
        </span>
        <Link href="/about#methodology">
          Data & methodology <ArrowUpRight size={13} />
        </Link>
      </div>
    </main>
  );
}
