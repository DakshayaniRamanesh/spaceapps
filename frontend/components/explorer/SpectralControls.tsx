"use client";
import type { Detector, Frame } from "@/lib/types";
import { spectralChannels, spectralSubBands } from "@/lib/spectral";

export default function SpectralControls({
  detector,
  min,
  max,
  onChange,
  disabled,
  activeFrame,
}: {
  detector: Detector;
  min: string;
  max: string;
  onChange: (min: string, max: string) => void;
  disabled: boolean;
  activeFrame?: Frame;
}) {
  const channels = spectralChannels(detector);
  const matches = (low: number, high: number) =>
    min.trim() !== "" &&
    max.trim() !== "" &&
    Number(min) === low &&
    Number(max) === high;
  const channel = channels.find((c) =>
    matches(c.min_wavelength_um, c.max_wavelength_um),
  );
  return (
    <section
      className="spectral-controls"
      aria-label="Spectral wavelength controls"
    >
      <fieldset disabled={disabled}>
        <legend>Wavelength window · {detector}</legend>
        <div
          className="spectral-tabs"
          role="group"
          aria-label="Wavelength intervals"
        >
          <button
            type="button"
            aria-pressed={!min && !max}
            onClick={() => onChange("", "")}
          >
            All λ
          </button>
          {spectralSubBands(detector).map((band) => (
            <button
              type="button"
              key={band.label}
              aria-pressed={matches(
                band.min_wavelength_um,
                band.max_wavelength_um,
              )}
              title={`${band.min_wavelength_um}–${band.max_wavelength_um} µm`}
              onClick={() =>
                onChange(
                  String(band.min_wavelength_um),
                  String(band.max_wavelength_um),
                )
              }
            >
              {band.label}
            </button>
          ))}
        </div>
        <label htmlFor="spectral-channel">
          Nominal channel <span>1–17</span>
        </label>
        <select
          id="spectral-channel"
          value={channel?.channel ?? ""}
          onChange={(e) => {
            const selected = channels.find(
              (c) => c.channel === Number(e.target.value),
            );
            onChange(
              selected ? String(selected.min_wavelength_um) : "",
              selected ? String(selected.max_wavelength_um) : "",
            );
          }}
        >
          <option value="">
            {min || max ? "Custom / sub-band window" : "All wavelengths"}
          </option>
          {channels.map((c) => (
            <option value={c.channel} key={c.channel}>
              C{String(c.channel).padStart(2, "0")} · {c.min_wavelength_um}–
              {c.max_wavelength_um} µm
            </option>
          ))}
        </select>
        <div className="spectral-bounds">
          <div>
            <label htmlFor="min-wavelength">
              Minimum λ <span>µm</span>
            </label>
            <input
              id="min-wavelength"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={min}
              onChange={(e) => onChange(e.target.value, max)}
            />
          </div>
          <div>
            <label htmlFor="max-wavelength">
              Maximum λ <span>µm</span>
            </label>
            <input
              id="max-wavelength"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={max}
              onChange={(e) => onChange(min, e.target.value)}
            />
          </div>
        </div>
      </fieldset>
      <p className="hint">
        {disabled
          ? "Synthetic frames have no measured wavelengths; spectral filtering requires archive data."
          : "17 nominal channel windows per detector (102 total). Windows can overlap. The inclusive bounds filter field-center λ₀ after epoch shortlisting; increase Max epochs if needed."}
      </p>
      <div
        className="spectral-indicator"
        aria-label="Displayed spectral metadata"
      >
        <strong>
          {activeFrame
            ? `Displayed epoch · ${activeFrame.detector}`
            : "Field-center spectrum"}
        </strong>
        {activeFrame?.source === "spherex-irsa" ? (
          <>
            <span>
              λ₀{" "}
              {activeFrame.wavelength_um != null
                ? `${activeFrame.wavelength_um.toFixed(4)} µm`
                : "unavailable"}
            </span>
            <span>
              Δλ{" "}
              {activeFrame.bandwidth_um != null
                ? `${activeFrame.bandwidth_um.toFixed(4)} µm`
                : "unavailable"}
            </span>
            <small>
              WCS-WAVE · visualization estimate. Matching λ₀ alone does not
              ensure identical spectral response.
            </small>
          </>
        ) : (
          <span>
            {activeFrame
              ? "Unavailable for synthetic frames."
              : "Load an archive epoch to view λ₀ and Δλ."}
          </span>
        )}
      </div>
    </section>
  );
}
