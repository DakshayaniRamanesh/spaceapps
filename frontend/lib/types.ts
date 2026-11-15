export type Detector = "D1" | "D2" | "D3" | "D4" | "D5" | "D6";
export const detectors: Detector[] = ["D1", "D2", "D3", "D4", "D5", "D6"];
export const ranges = [
  "0.75–1.09",
  "1.10–1.62",
  "1.63–2.41",
  "2.42–3.82",
  "3.83–4.41",
  "4.42–5.00",
];
export const DEFAULT_LIMIT = 12;
export const EPOCH_LIMITS = [12, 24, 36, 50] as const;

export type Field = {
  ra: number;
  dec: number;
  fov_arcmin: number;
  detector: Detector;
  min_wavelength_um?: number | null;
  max_wavelength_um?: number | null;
  /** Epoch shortlisting (Issue #2). Optional; omitted = backend defaults. */
  limit?: number;
  spread?: boolean;
  start_date?: string; // ISO YYYY-MM-DD, inclusive
  end_date?: string;
};
export type Frame = {
  id: string;
  timestamp: string;
  image_url: string;
  detector: Detector;
  source: "synthetic" | "spherex-irsa";
  product_id?: string;
  provenance_url?: string;
  wavelength_um?: number | null;
  bandwidth_um?: number | null;
  wavelength_source?: "wcs-wave" | null;
  quality: {
    registration: string;
    noise_sigma: number;
    masked_fraction: number;
    calibrated: boolean;
    flags?: string[];
    notes?: string[];
  };
};
export type EpochSelection = {
  limit: number;
  spread: boolean;
  start_mjd?: number | null;
  end_mjd?: number | null;
};
export type ObservationSet = {
  source_type: "synthetic" | "spherex-irsa";
  dataset_id: string;
  request: Field;
  frames: Frame[];
  notice: string;
  width: number;
  height: number;
  wavelength_range_um: [number, number];
  intensity_unit?: string;
  release?: string;
  total_candidates?: number;
  epoch_selection?: EpochSelection;
};
export type Mode = "single" | "blink" | "split" | "difference";
export const DEFAULT_FIELD: Field = {
  ra: 269.452077,
  dec: 4.693365,
  fov_arcmin: 12,
  detector: "D1",
};
export function fieldQuery(f: Field) {
  const p = new URLSearchParams({
    ra: String(f.ra),
    dec: String(f.dec),
    fov: String(f.fov_arcmin),
    detector: f.detector,
  });
  if (f.limit !== undefined && f.limit !== DEFAULT_LIMIT)
    p.set("limit", String(f.limit));
  if (f.spread) p.set("spread", "1");
  if (f.start_date) p.set("start", f.start_date);
  if (f.end_date) p.set("end", f.end_date);
  if (f.min_wavelength_um != null)
    p.set("min_wavelength_um", String(f.min_wavelength_um));
  if (f.max_wavelength_um != null)
    p.set("max_wavelength_um", String(f.max_wavelength_um));
  return p.toString();
}
export function dateLabel(t: string) {
  return new Date(t).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function validateField(f: Field): string | undefined {
  if (!Number.isFinite(f.ra) || f.ra < 0 || f.ra >= 360)
    return "Right ascension must be 0° to less than 360°.";
  if (!Number.isFinite(f.dec) || f.dec < -90 || f.dec > 90)
    return "Declination must be between −90° and +90°.";
  if (!Number.isFinite(f.fov_arcmin) || f.fov_arcmin < 2 || f.fov_arcmin > 60)
    return "Field of view must be between 2 and 60 arcminutes.";
  if (!detectors.includes(f.detector))
    return "Choose a detector from D1 to D6.";
  for (const wavelength of [f.min_wavelength_um, f.max_wavelength_um]) {
    if (wavelength != null && (!Number.isFinite(wavelength) || wavelength <= 0))
      return "Wavelength bounds must be positive, finite values in µm.";
  }
  if (
    f.min_wavelength_um != null &&
    f.max_wavelength_um != null &&
    f.min_wavelength_um > f.max_wavelength_um
  )
    return "Minimum wavelength must not exceed maximum wavelength.";
  if (
    f.limit !== undefined &&
    (!Number.isInteger(f.limit) || f.limit < 2 || f.limit > 50)
  )
    return "Epoch limit must be a whole number between 2 and 50.";
  for (const d of [f.start_date, f.end_date]) {
    if (d === undefined || d === "") continue;
    if (!ISO_DATE.test(d)) return "Dates must be valid ISO dates (YYYY-MM-DD).";
    const parsed = new Date(`${d}T00:00:00.000Z`);
    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== d
    )
      return "Dates must be valid ISO dates (YYYY-MM-DD).";
  }
  if (f.start_date && f.end_date && f.start_date >= f.end_date)
    return "Start date must be before end date.";
}
