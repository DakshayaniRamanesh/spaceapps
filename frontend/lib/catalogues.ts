import type { ObservationSet } from "./types";

export type Catalogue = "gaia" | "wise";
export type Position = {
  x: number;
  y: number;
  ra: number;
  dec: number;
  treatment: string;
};
export type CatalogueSource = {
  source_id: string;
  ra: number;
  dec: number;
  reference_epoch: number | null;
  pmra: number | null;
  pmdec: number | null;
  proper_motion_unit: string;
  magnitudes: Record<string, number | null>;
  quality: Record<string, string | number | null>;
  warnings: string[];
  positions: Record<string, Position>;
};
export type Overlay = {
  dataset_id: string;
  catalogue: Catalogue;
  release: string;
  sources: CatalogueSource[];
  frames: Record<string, string>;
  width: number;
  height: number;
  retrieved_at: string;
  provenance_url: string;
  service_url: string;
  result_limit: number;
  preselection_count: number;
  truncated: boolean;
  completeness: string;
  warnings: string[];
};
export type Hit = {
  overlay: Overlay;
  source: CatalogueSource;
  frameId: string;
};
export function unavailableReason(data: ObservationSet) {
  if (data.source_type === "synthetic")
    return "Real catalogue overlays are disabled for synthetic fields.";
  if (!data.frames.length) return "No observation frames are available.";
  if (!data.grid?.CTYPE1 || !data.grid?.CRPIX1)
    return "Catalogue overlays unavailable: this manifest has no common celestial WCS grid.";
  return "";
}

// Contains the exact image rectangle, including its pixel centers, inside a letterboxed port.
export function imageFit(
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number,
) {
  const scale = Math.min(width / imageWidth, height / imageHeight);
  return { width: imageWidth * scale, height: imageHeight * scale };
}
