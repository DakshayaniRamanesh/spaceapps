"use client";
import { useEffect, useRef, useState } from "react";
import { Crosshair, RotateCcw, ArrowRight } from "lucide-react";
import presets from "@/lib/presets.json";
import {
  detectors,
  Field,
  Detector,
  DEFAULT_FIELD,
  validateField,
} from "@/lib/types";
export default function ObservationControls({
  field,
  onLoad,
  loading,
}: {
  field: Field;
  onLoad: (f: Field) => void;
  loading: boolean;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (window.matchMedia("(max-width: 620px)").matches && disclosure.current)
      disclosure.current.open = false;
  }, []);
  const [ra, setRa] = useState(String(field.ra)),
    [dec, setDec] = useState(String(field.dec)),
    [fov, setFov] = useState(String(field.fov_arcmin)),
    [detector, setDetector] = useState<Detector>(field.detector),
    [error, setError] = useState("");
  useEffect(() => {
    setRa(String(field.ra));
    setDec(String(field.dec));
    setFov(String(field.fov_arcmin));
    setDetector(field.detector);
  }, [field]);
  const selected = presets.find(
    (p) =>
      Math.abs(p.ra - Number(ra)) < 0.00001 &&
      Math.abs(p.dec - Number(dec)) < 0.00001,
  );
  function submit() {
    const f = {
      ra: ra.trim() ? Number(ra) : NaN,
      dec: dec.trim() ? Number(dec) : NaN,
      fov_arcmin: fov.trim() ? Number(fov) : NaN,
      detector,
    };
    const err = validateField(f);
    setError(err || "");
    if (!err) onLoad(f);
  }
  return (
    <aside className="controls panel">
      <details open ref={disclosure}>
        <summary>
          <Crosshair size={16} /> Observation controls
        </summary>
        <div className="controls-body">
          <label htmlFor="target">TARGET PRESET</label>
          <select
            id="target"
            value={selected?.id || ""}
            onChange={(e) => {
              const p = presets.find((p) => p.id === e.target.value);
              if (p) {
                setError("");
                onLoad({
                  ra: p.ra,
                  dec: p.dec,
                  fov_arcmin:
                    Number(fov) >= 2 && Number(fov) <= 60 ? Number(fov) : 12,
                  detector,
                });
              }
            }}
          >
            <option value="">Custom sky region</option>
            {presets.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {selected && (
            <p className="preset-note">
              {selected.classification}
              <br />
              {selected.verified
                ? "ICRS · J2000 reference position"
                : "Brief-supplied position · epoch unspecified"}
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
              POINT YOUR OBSERVATORY<span>01</span>
            </div>
            <label
              htmlFor="ra"
              title="Right ascension: celestial longitude, in decimal degrees"
            >
              Right ascension <span>deg</span>
            </label>
            <input
              id="ra"
              inputMode="decimal"
              type="number"
              value={ra}
              onChange={(e) => setRa(e.target.value)}
              min="0"
              max="359.999999"
              step="any"
              aria-describedby={error ? "field-error" : undefined}
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
              onChange={(e) => setDec(e.target.value)}
              min="-90"
              max="90"
              step="any"
            />
            <label htmlFor="fov">
              Field of view <span>arcmin</span>
            </label>
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
                60,
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
            <div className="field-heading">
              DETECTOR ARRAY<span>02</span>
            </div>
            <div className="detector-grid">
              {detectors.map((d) => (
                <button
                  type="button"
                  key={d}
                  className={detector === d ? "selected" : ""}
                  aria-pressed={detector === d}
                  onClick={() => setDetector(d)}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="hint">
              Simulated array responses.
              <br />
              Assigned colors are not visible light.
            </p>
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
              {loading ? "Generating field…" : "Load observations"}
              <ArrowRight size={16} />
            </button>
            <button
              className="reset-button"
              type="button"
              onClick={() => {
                setError("");
                onLoad({ ...DEFAULT_FIELD });
              }}
            >
              <RotateCcw size={13} /> Reset field
            </button>
          </form>
          <div className="simulation-note">
            <span className="eyebrow">A NOTE ON THE DATA</span>
            <p>
              Every starfield is generated on the server. These are
              demonstrations, not observations of the selected target.
            </p>
          </div>
        </div>
      </details>
    </aside>
  );
}
