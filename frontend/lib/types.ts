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
  source: "synthetic";
  quality: {
    registration: string;
    noise_sigma: number;
    masked_fraction: number;
    calibrated: boolean;
  };
};
export type ObservationSet = {
  source_type: "synthetic";
  dataset_id: string;
  request: Field;
  frames: Frame[];
  notice: string;
  width: number;
  height: number;
  wavelength_range_um: [number, number];
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
export function validateField(f: Field): string | undefined {
  if (!Number.isFinite(f.ra) || f.ra < 0 || f.ra >= 360)
    return "Right ascension must be 0° to less than 360°.";
  if (!Number.isFinite(f.dec) || f.dec < -90 || f.dec > 90)
    return "Declination must be between −90° and +90°.";
  if (!Number.isFinite(f.fov_arcmin) || f.fov_arcmin < 2 || f.fov_arcmin > 60)
    return "Field of view must be between 2 and 60 arcminutes.";
  if (!detectors.includes(f.detector))
    return "Choose a detector from D1 to D6.";
}
