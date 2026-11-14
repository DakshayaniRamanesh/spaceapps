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
export type Field = {
  ra: number;
  dec: number;
  fov_arcmin: number;
  detector: Detector;
};
export type Frame = {
  id: string;
  timestamp: string;
  image_url: string;
  detector: Detector;
  source: "synthetic" | "spherex-irsa";
  quality: {
    registration: string;
    noise_sigma: number | null;
    masked_fraction: number;
    calibrated: boolean;
    valid_fraction?: number | null;
    flag_policy?: string | null;
    background_mjy_sr?: number | null;
    center_valid?: boolean | null;
    center_region_valid_fraction?: number | null;
  };
  obs_id?: string | null;
  collection?: string | null;
  access_url?: string | null;
  cutout_url?: string | null;
  sha256?: string | null;
  product_version?: string | null;
  downloaded_at?: string | null;
  lambda_um?: number | null;
  bandwidth_um?: number | null;
  wavelength_origin?: string | null;
};
export type Pair = {
  a: string;
  b: string;
  comparison_status: "comparable" | "preview" | "blocked";
  difference_allowed: boolean;
  reason: string;
  checks: {
    name: string;
    status: "pass" | "review" | "blocked";
    reason: string;
    value: number | null;
  }[];
  spectral_overlap_fraction: number | null;
  overlap_fraction: number | null;
};
export type Job = {
  job_id: string;
  status: "queued" | "running" | "ready" | "failed";
  stage: string;
  result_url?: string | null;
  dataset_id?: string | null;
  error_code?: string | null;
  message?: string | null;
  cache_hit: boolean;
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
  coordinate_system?: string;
  processing_version?: string;
  availability?: string;
  search_complete?: boolean;
  archive_records?: number;
  assessed_records?: number;
  created_at?: string | null;
  warnings?: string[];
  pairs?: Pair[];
};
export const FEATURED_FIELD: Field = {
  ra: 248.16761083,
  dec: 66.75497942,
  fov_arcmin: 12,
  detector: "D3",
};
export type Mode = "single" | "blink" | "split" | "difference";
export const DEFAULT_FIELD: Field = {
  ra: 269.452077,
  dec: 4.693365,
  fov_arcmin: 12,
  detector: "D1",
};
export function fieldQuery(f: Field) {
  return new URLSearchParams({
    ra: String(f.ra),
    dec: String(f.dec),
    fov: String(f.fov_arcmin),
    detector: f.detector,
  }).toString();
}
export function dateLabel(t: string) {
  return new Date(t).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
export function validateField(f: Field, maxFov = 60): string | undefined {
  if (!Number.isFinite(f.ra) || f.ra < 0 || f.ra >= 360)
    return "Right ascension must be 0° to less than 360°.";
  if (!Number.isFinite(f.dec) || f.dec < -90 || f.dec > 90)
    return "Declination must be between −90° and +90°.";
  if (
    !Number.isFinite(f.fov_arcmin) ||
    f.fov_arcmin < 2 ||
    f.fov_arcmin > maxFov
  )
    return `Field of view must be between 2 and ${maxFov} arcminutes.`;
  if (!detectors.includes(f.detector))
    return "Choose a detector from D1 to D6.";
}
