"use client";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import SkyViewer from "./SkyViewer";
import { checkedJson } from "@/lib/observations";
import {
  unavailableReason,
  type Catalogue,
  type Hit,
  type Overlay,
} from "@/lib/catalogues";

function useLayer(
  datasetId: string,
  catalogue: Catalogue,
  unavailable: string,
) {
  const [enabled, setEnabled] = useState(false);
  const [result, setResult] = useState<Overlay>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const cached = useRef<Overlay | undefined>(undefined);
  useEffect(() => {
    if (!enabled || unavailable) {
      setLoading(false);
      return;
    }
    if (cached.current) {
      setResult(cached.current);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const response = await fetch(
          `/api/observation-sets/${encodeURIComponent(datasetId)}/catalogues/${catalogue}`,
          { signal: controller.signal },
        );
        const value = await checkedJson<Overlay>(response);
        if (
          controller.signal.aborted ||
          value.dataset_id !== datasetId ||
          value.catalogue !== catalogue
        )
          return;
        cached.current = value;
        setResult(value);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Catalogue request failed.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [enabled, unavailable, datasetId, catalogue, attempt]);
  return {
    enabled,
    setEnabled,
    result,
    error,
    loading,
    retry: () => setAttempt((n) => n + 1),
  };
}

type ViewerProps = Omit<
  ComponentProps<typeof SkyViewer>,
  "overlays" | "onSelect"
>;
export default function CatalogueExplorer(props: ViewerProps) {
  // The dataset key discards pending requests, cached sources and selections immediately.
  return <CatalogueField key={props.data.dataset_id} {...props} />;
}
function CatalogueField(props: ViewerProps) {
  const { data, mode, index, a, b, blinkIndex } = props;
  const unavailable = unavailableReason(data);
  const gaia = useLayer(data.dataset_id, "gaia", unavailable);
  const wise = useLayer(data.dataset_id, "wise", unavailable);
  const [selected, setSelected] = useState<Hit>();
  const frameIds =
    mode === "split"
      ? [data.frames[a]?.id, data.frames[b]?.id]
      : [data.frames[mode === "blink" ? (blinkIndex ? b : a) : index]?.id];
  const layers = [gaia, wise];
  const overlays = layers.flatMap((layer) =>
    layer.enabled && layer.result && !unavailable ? [layer.result] : [],
  );
  const activeSelection =
    selected && overlays.includes(selected.overlay) ? selected : undefined;
  const detailFrame =
    activeSelection &&
    (mode === "split" && frameIds.includes(activeSelection.frameId)
      ? activeSelection.frameId
      : frameIds[0]);
  const position = detailFrame
    ? activeSelection?.source.positions[detailFrame]
    : undefined;
  return (
    <>
      <SkyViewer
        {...props}
        overlays={mode === "difference" ? [] : overlays}
        onSelect={setSelected}
      />
      <section
        className="catalogue-panel panel"
        aria-label="Catalogue overlays"
      >
        <h3>Catalogue overlays</h3>
        {unavailable && <p>{unavailable}</p>}
        <div className="catalogue-layers">
          {layers.map((layer, i) => (
            <div key={i}>
              <label>
                <input
                  type="checkbox"
                  checked={layer.enabled}
                  disabled={!!unavailable}
                  onChange={(e) => layer.setEnabled(e.target.checked)}
                />
                <span
                  className={`catalogue-symbol ${i ? "wise" : "gaia"}`}
                  aria-hidden="true"
                />
                {i ? "WISE · AllWISE Source Catalog" : "Gaia DR3"}
              </label>
              {layer.enabled && (
                <div className="catalogue-status" role="status">
                  {layer.loading ? (
                    "Loading catalogue…"
                  ) : layer.error ? (
                    <>
                      {layer.error}{" "}
                      <button className="text-link" onClick={layer.retry}>
                        Retry {i ? "WISE" : "Gaia"}
                      </button>
                    </>
                  ) : layer.result ? (
                    <>
                      {
                        layer.result.sources.filter((s) =>
                          frameIds.some((id) => id && s.positions[id]),
                        ).length
                      }{" "}
                      sources in view
                      {layer.result.sources.length === 0 &&
                        " · No sources returned in this field"}
                      {layer.result.truncated &&
                        ` · Truncated: brightest available subset (cap ${layer.result.result_limit} in query cone)`}
                    </>
                  ) : (
                    ""
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="catalogue-note">
          Circle: Gaia · Diamond: WISE. Catalogue markers show reference or
          predicted positions; they do not confirm a source detection in this
          image.
        </p>
        {mode === "difference" && (
          <p>Overlays are hidden in difference mode.</p>
        )}
        {overlays.length > 0 && (
          <label className="catalogue-picker">
            Inspect sources (including overlapping markers)
            <select
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                const [layerIndex, sourceIndex, frameIndex] = e.target.value
                  .split(":")
                  .map(Number);
                setSelected({
                  overlay: overlays[layerIndex],
                  source: overlays[layerIndex].sources[sourceIndex],
                  frameId: frameIds[frameIndex]!,
                });
              }}
            >
              <option value="">Choose a catalogue source</option>
              {overlays.flatMap((overlay, l) =>
                overlay.sources.flatMap((source, s) =>
                  frameIds.map((id, f) =>
                    id && source.positions[id] ? (
                      <option key={`${l}:${s}:${f}`} value={`${l}:${s}:${f}`}>
                        {overlay.release} · {source.source_id}
                        {mode === "split" ? ` · ${f ? "B" : "A"}` : ""}
                      </option>
                    ) : null,
                  ),
                ),
              )}
            </select>
          </label>
        )}
        {activeSelection && (
          <div
            className="catalogue-detail"
            aria-label="Selected catalogue source"
          >
            <button
              className="text-link"
              onClick={() => setSelected(undefined)}
            >
              Close source details
            </button>
            <h4>{activeSelection.overlay.release}</h4>
            <p className="mono">{activeSelection.source.source_id}</p>
            <dl>
              <dt>Catalogue RA / Dec (ICRS)</dt>
              <dd>
                {activeSelection.source.ra.toFixed(7)}° /{" "}
                {activeSelection.source.dec.toFixed(7)}°
              </dd>
              <dt>Reference epoch (Julian year)</dt>
              <dd>
                {activeSelection.source.reference_epoch ??
                  "Not supplied (AllWISE combines observations)"}
              </dd>
              <dt>Active observation (UTC)</dt>
              <dd>
                {detailFrame
                  ? activeSelection.overlay.frames[detailFrame]
                  : "Unavailable"}
              </dd>
              <dt>Position treatment</dt>
              <dd>
                {position?.treatment.replaceAll("_", " ") ??
                  "Outside this frame"}
              </dd>
              {position && (
                <>
                  <dt>Display RA / Dec (ICRS)</dt>
                  <dd>
                    {position.ra.toFixed(7)}° / {position.dec.toFixed(7)}°
                  </dd>
                </>
              )}
              <dt>Proper motion RA / Dec</dt>
              <dd>
                {activeSelection.source.pmra ?? "Unknown"} /{" "}
                {activeSelection.source.pmdec ?? "Unknown"} (
                {activeSelection.source.proper_motion_unit})
              </dd>
              {Object.entries(activeSelection.source.magnitudes).map(
                ([band, value]) => (
                  <div key={band}>
                    <dt>{band}</dt>
                    <dd>
                      {value === null ? "Unknown" : `${value.toFixed(3)} mag`}
                    </dd>
                  </div>
                ),
              )}
              {Object.entries(activeSelection.source.quality).map(
                ([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value ?? "Unknown"}</dd>
                  </div>
                ),
              )}
            </dl>
            <details className="catalogue-help">
              <summary>Position limits and provenance</summary>
              {[
                ...activeSelection.source.warnings,
                ...activeSelection.overlay.warnings,
              ].map((note) => (
                <p key={note}>{note}</p>
              ))}
              <p>{activeSelection.overlay.completeness}</p>
              <p>Retrieved {activeSelection.overlay.retrieved_at}</p>
              <a
                className="text-link"
                href={activeSelection.overlay.provenance_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Official catalogue documentation and query access
              </a>
            </details>
          </div>
        )}
      </section>
    </>
  );
}
