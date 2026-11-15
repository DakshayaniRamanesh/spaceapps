"use client";
import { useEffect, useRef, useState } from "react";
import { Crosshair, RotateCcw, ArrowRight } from "lucide-react";
import presets from "@/lib/presets.json";
import SpectralControls from "./SpectralControls";
import {
  detectors,
  Field,
  Frame,
  Detector,
  DEFAULT_FIELD,
  FEATURED_FIELD,
  EPOCH_LIMITS,
  validateField,
} from "@/lib/types";
export default function ObservationControls({
  field,
  onLoad,
  loading,
  demoEnabled = false,
  statusMessage,
  activeFrame,
}: {
  field: Field;
  onLoad: (f: Field) => void;
  loading: boolean;
  demoEnabled?: boolean;
  statusMessage?: string;
  activeFrame?: Frame;
}) {
  const raInput = useRef<HTMLInputElement>(null);
  const [custom, setCustom] = useState(false);
  const [ra, setRa] = useState(String(field.ra)),
    [dec, setDec] = useState(String(field.dec)),
    [fov, setFov] = useState(String(field.fov_arcmin)),
    [detector, setDetector] = useState<Detector>(field.detector),
    [limit, setLimit] = useState(String(field.limit ?? 12)),
    [spread, setSpread] = useState(Boolean(field.spread)),
    [startDate, setStartDate] = useState(field.start_date ?? ""),
    [endDate, setEndDate] = useState(field.end_date ?? ""),
    [minWave, setMinWave] = useState(
      field.min_wavelength_um == null ? "" : String(field.min_wavelength_um),
    ),
    [maxWave, setMaxWave] = useState(
      field.max_wavelength_um == null ? "" : String(field.max_wavelength_um),
    ),
    [error, setError] = useState("");
  useEffect(() => {
    if (field.ra !== Number(ra) || field.dec !== Number(dec)) setCustom(false);
    setRa(String(field.ra));
    setDec(String(field.dec));
    setFov(String(field.fov_arcmin));
    setDetector(field.detector);
    setLimit(String(field.limit ?? 12));
    setSpread(Boolean(field.spread));
    setStartDate(field.start_date ?? "");
    setEndDate(field.end_date ?? "");
    setMinWave(
      field.min_wavelength_um == null ? "" : String(field.min_wavelength_um),
    );
    setMaxWave(
      field.max_wavelength_um == null ? "" : String(field.max_wavelength_um),
    );
  }, [field]);
  const selected = custom
    ? undefined
    : presets.find(
        (p) =>
          Math.abs(p.ra - Number(ra)) < 0.00001 &&
          Math.abs(p.dec - Number(dec)) < 0.00001,
      );
  const selectedLimit = Number(limit);
  const epochOptions = [
    ...new Set([
      ...EPOCH_LIMITS,
      ...(Number.isInteger(selectedLimit) &&
      selectedLimit >= 2 &&
      selectedLimit <= 50
        ? [selectedLimit]
        : []),
    ]),
  ].sort((a, b) => a - b);
  function submit() {
    const f = {
      ra: ra.trim() ? Number(ra) : NaN,
      dec: dec.trim() ? Number(dec) : NaN,
      fov_arcmin: fov.trim() ? Number(fov) : NaN,
      detector,
      limit: Number(limit),
      spread,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      min_wavelength_um: minWave.trim() ? Number(minWave) : undefined,
      max_wavelength_um: maxWave.trim() ? Number(maxWave) : undefined,
    };
    const err = validateField(f, demoEnabled ? 60 : 30);
    setError(err || "");
    if (!err) onLoad(f);
  }
  return (
    <aside className="controls panel">
      <details open>
        <summary>
          <Crosshair size={16} /> Observation controls
        </summary>
        <div className="controls-body">
          <label htmlFor="target">Target preset</label>
          <select
            id="target"
            value={selected?.id || ""}
            onChange={(e) => {
              const p = presets.find((p) => p.id === e.target.value);
              setError("");
              if (!p) {
                setCustom(true);
                raInput.current?.focus();
                raInput.current?.select();
                return;
              }
              const next: Field = {
                ra: p.ra,
                dec: p.dec,
                fov_arcmin:
                  Number(fov) >= 2 && Number(fov) <= (demoEnabled ? 60 : 30)
                    ? Number(fov)
                    : 12,
                detector,
                limit: Number(limit),
                spread,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
                min_wavelength_um: minWave.trim()
                  ? Number(minWave)
                  : undefined,
                max_wavelength_um: maxWave.trim()
                  ? Number(maxWave)
                  : undefined,
              };
              const invalid = validateField(next, demoEnabled ? 60 : 30);
              if (invalid) {
                setError(invalid);
                return;
              }
              setCustom(false);
              onLoad(next);
            }}
          >
            <option value="">Custom sky region</option>
            {presets.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {selected ? (
            <p className="preset-note">
              {selected.classification}
              <br />
              {selected.verified
                ? "ICRS · J2000 reference position"
                : "Brief-supplied position · epoch unspecified"}
            </p>
          ) : (
            <p className="preset-note" id="custom-region-help">
              Enter an ICRS center in decimal degrees: RA from 0° to less than
              360°, Dec from −90° to +90°. The field of view sets the width and
              height of the square sky region. Choose a detector, then check for
              observations.
            </p>
          )}
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="field-heading">
              Point your observatory<span>01</span>
            </div>
            <label
              htmlFor="ra"
              title="Right ascension: celestial longitude, in decimal degrees"
            >
              Right ascension <span>deg</span>
            </label>
            <input
              id="ra"
              ref={raInput}
              inputMode="decimal"
              type="number"
              value={ra}
              onChange={(e) => {
                setCustom(true);
                setRa(e.target.value);
              }}
              min="0"
              max="359.999999"
              step="any"
              aria-describedby={
                error
                  ? "field-error"
                  : !selected
                    ? "custom-region-help"
                    : undefined
              }
            />
            <label
              htmlFor="dec"
              title="Declination: angle north or south of the celestial equator"
            >
              Declination <span>deg</span>
            </label>
            <input
              id="dec"
              inputMode="decimal"
              type="number"
              value={dec}
              onChange={(e) => {
                setCustom(true);
                setDec(e.target.value);
              }}
              aria-describedby={
                error
                  ? "field-error"
                  : !selected
                    ? "custom-region-help"
                    : undefined
              }
              min="-90"
              max="90"
              step="any"
            />
            <label htmlFor="fov">
              Field of view <span>arcmin</span>
            </label>
            {!selected ? (
              <input
                id="fov"
                type="number"
                inputMode="decimal"
                min="2"
                max={demoEnabled ? 60 : 30}
                step="any"
                value={fov}
                onChange={(e) => setFov(e.target.value)}
                aria-describedby={error ? "field-error" : "custom-region-help"}
              />
            ) : (
              <select
                id="fov"
                value={fov}
                onChange={(e) => setFov(e.target.value)}
              >
                {[
                  2,
                  6,
                  12,
                  24,
                  30,
                  ...(demoEnabled ? [60] : []),
                  ...(![2, 6, 12, 24, 30, 60].includes(Number(fov))
                    ? [Number(fov)]
                    : []),
                ]
                  .sort((a, b) => a - b)
                  .map((n) => (
                    <option key={n} value={n}>
                      {n}′ × {n}′
                    </option>
                  ))}
              </select>
            )}
            <label htmlFor="limit">
              Max epochs <span>2–50</span>
            </label>
            <select
              id="limit"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            >
              {epochOptions.map((n) => (
                <option key={n} value={n}>
                  {n} exposures
                </option>
              ))}
            </select>
            <label htmlFor="spread" className="checkbox-label">
              <input
                id="spread"
                type="checkbox"
                checked={spread}
                onChange={(e) => setSpread(e.target.checked)}
              />
              Spread epochs across the survey (~monthly)
            </label>
            <div className="epoch-dates">
              <div>
                <label htmlFor="start">
                  From <span>optional</span>
                </label>
                <input
                  id="start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="end">
                  To <span>optional</span>
                </label>
                <input
                  id="end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <p className="hint">
              More epochs lengthen the first load; cached frames return
              instantly. Monthly sampling is a SkyTrace heuristic, not a mission
              standard.
            </p>
            <div className="field-heading">
              Detector array<span>02</span>
            </div>
            <div className="detector-grid">
              {detectors.map((d) => {
                const isSelected = detector === d;
                const isCurrent = field.detector === d;
                return (
                  <button
                    type="button"
                    key={d}
                    className={`${isSelected ? "selected" : ""} ${isCurrent ? "current-detector" : ""}`}
                    aria-pressed={isSelected}
                    aria-label={d}
                    title={
                      isCurrent && !isSelected
                        ? `${d}: Currently displayed (unsubmitted selection is ${detector})`
                        : isCurrent
                          ? `${d}: Currently displayed detector`
                          : isSelected
                            ? `${d}: Selected (not yet submitted)`
                            : d
                    }
                    onClick={() => {
                      if (d !== detector) {
                        setMinWave("");
                        setMaxWave("");
                      }
                      setDetector(d);
                    }}
                  >
                    <span>{d}</span>
                    {isCurrent && (
                      <span className="detector-badge">ACTIVE</span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="hint">
              {detector !== field.detector
                ? `Detector ${detector} selected (unsubmitted) — click ${demoEnabled ? "Load observations" : "Check for observations"} to switch.`
                : demoEnabled
                  ? "Simulated array responses. Assigned colors are not visible light."
                  : "Select a SPHEREx detector array (D1–D6) to query observations."}
            </p>
            <SpectralControls
              detector={detector}
              min={minWave}
              max={maxWave}
              onChange={(min, max) => {
                setMinWave(min);
                setMaxWave(max);
              }}
              disabled={demoEnabled}
              activeFrame={activeFrame}
            />
            {error && (
              <p className="error" id="field-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button primary load-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Checking observations…"
                : demoEnabled
                  ? "Load observations"
                  : "Check for observations"}
              <ArrowRight size={16} />
            </button>
            <button
              className="reset-button"
              type="button"
              onClick={() => {
                setError("");
                setCustom(false);
                onLoad({ ...(demoEnabled ? DEFAULT_FIELD : FEATURED_FIELD) });
              }}
            >
              <RotateCcw size={13} /> Reset field
            </button>
          </form>
          <div className="simulation-note">
            <span className="eyebrow">A NOTE ON THE DATA</span>
            <p>
              {statusMessage ||
                (loading
                  ? "Querying SPHEREx observation records from NASA / IPAC IRSA archive…"
                  : demoEnabled
                    ? "Development mode uses generated starfields, not observations of the selected target."
                    : "Real SPHEREx DR1/QR3 previews. Custom fields use a bounded archive worker; initial searches can take several minutes.")}
            </p>
          </div>
        </div>
      </details>
    </aside>
  );
}
