/**
 * Lasso region helpers for the registered observation grid.
 *
 * Every frame (and every difference image) for a field is reprojected by the
 * backend onto the same tangent-plane (TAN) grid centred on the requested
 * RA/Dec with a square field of view. A region drawn once in normalised image
 * coordinates (u, v in [0, 1], origin top-left of the displayed PNG) therefore
 * refers to the same patch of sky in every epoch and comparison mode.
 *
 * Legacy/synthetic grid convention (science/registration.py::make_target_wcs):
 *   CDELT = [-scale, +scale], CRPIX at the grid centre, no image flip on
 *   PNG encoding — so +u (right) is decreasing RA and +v (down the PNG) is
 *   increasing pixel row, i.e. increasing Dec. Real preview PNGs instead use
 *   the explicit manifest WCS and a FITS-to-PNG vertical flip (gridToSky below).
 */

export type RegionPoint = { u: number; v: number };

export type SkyGeometry = {
  ra: number;
  dec: number;
  fov_arcmin: number;
  grid?: Record<string, string | number>;
  width?: number;
  height?: number;
};

export type RegionSummary = {
  vertices: number;
  centroid: { ra: number; dec: number };
  raRange: [number, number];
  decRange: [number, number];
  areaArcmin2: number;
  fractionOfField: number;
};

const DEG = Math.PI / 180;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Signed shoelace area in normalised units (fraction of the field). */
export function polygonArea(points: RegionPoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    sum += p.u * q.v - q.u * p.v;
  }
  return Math.abs(sum) / 2;
}

export function polygonBounds(points: RegionPoint[]) {
  let minU = 1,
    minV = 1,
    maxU = 0,
    maxV = 0;
  for (const p of points) {
    minU = Math.min(minU, p.u);
    maxU = Math.max(maxU, p.u);
    minV = Math.min(minV, p.v);
    maxV = Math.max(maxV, p.v);
  }
  return { minU, minV, maxU, maxV };
}

/** Area-weighted polygon centroid (falls back to the vertex mean when degenerate). */
export function polygonCentroid(points: RegionPoint[]): RegionPoint {
  let a = 0,
    cu = 0,
    cv = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const cross = p.u * q.v - q.u * p.v;
    a += cross;
    cu += (p.u + q.u) * cross;
    cv += (p.v + q.v) * cross;
  }
  if (Math.abs(a) < 1e-12) {
    const n = Math.max(points.length, 1);
    return {
      u: points.reduce((s, p) => s + p.u, 0) / n,
      v: points.reduce((s, p) => s + p.v, 0) / n,
    };
  }
  return { u: cu / (3 * a), v: cv / (3 * a) };
}

/** Even-odd ray casting test. */
export function pointInPolygon(
  pt: RegionPoint,
  points: RegionPoint[],
): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (
      a.v > pt.v !== b.v > pt.v &&
      pt.u < ((b.u - a.u) * (pt.v - a.v)) / (b.v - a.v) + a.u
    )
      inside = !inside;
  }
  return inside;
}

/** Drop vertices closer than `minDistance` (normalised units) to the previous kept one. */
export function simplifyPath(
  points: RegionPoint[],
  minDistance = 0.006,
): RegionPoint[] {
  const out: RegionPoint[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.u - last.u, p.v - last.v) >= minDistance)
      out.push(p);
  }
  return out;
}

/** A finished lasso must be a real enclosed area, not a click or a scribble line. */
export function isUsableRegion(points: RegionPoint[]): boolean {
  return points.length >= 3 && polygonArea(points) >= 0.0004;
}

/** Inverse gnomonic (TAN) projection from normalised grid coordinates to ICRS degrees. */
export function gridToSky(pt: RegionPoint, geom: SkyGeometry) {
  const fovDeg = geom.fov_arcmin / 60;
  // Intermediate world coordinates (degrees) relative to the tangent point.
  let xi = -(pt.u - 0.5) * fovDeg * DEG;
  let eta = (pt.v - 0.5) * fovDeg * DEG;
  const grid =
    geom.grid?.CTYPE1 === "RA---TAN" && geom.grid?.CTYPE2 === "DEC--TAN"
      ? geom.grid
      : undefined;
  if (grid && geom.width && geom.height) {
    // Real PNGs flip FITS rows. Fractions are relative to image pixel edges.
    const dx = pt.u * geom.width + 0.5 - Number(grid.CRPIX1);
    const dy = (1 - pt.v) * geom.height + 0.5 - Number(grid.CRPIX2);
    const cd11 = Number(
      grid.CD1_1 ?? Number(grid.CDELT1) * Number(grid.PC1_1 ?? 1),
    );
    const cd12 = Number(
      grid.CD1_2 ?? Number(grid.CDELT1) * Number(grid.PC1_2 ?? 0),
    );
    const cd21 = Number(
      grid.CD2_1 ?? Number(grid.CDELT2) * Number(grid.PC2_1 ?? 0),
    );
    const cd22 = Number(
      grid.CD2_2 ?? Number(grid.CDELT2) * Number(grid.PC2_2 ?? 1),
    );
    xi = (cd11 * dx + cd12 * dy) * DEG;
    eta = (cd21 * dx + cd22 * dy) * DEG;
  }
  const ra0 = Number(grid?.CRVAL1 ?? geom.ra) * DEG;
  const dec0 = Number(grid?.CRVAL2 ?? geom.dec) * DEG;
  const denom = Math.cos(dec0) - eta * Math.sin(dec0);
  let ra = ra0 + Math.atan2(xi, denom);
  const dec = Math.atan2(
    Math.sin(dec0) + eta * Math.cos(dec0),
    Math.hypot(xi, denom),
  );
  ra = (((ra / DEG) % 360) + 360) % 360;
  return { ra, dec: dec / DEG };
}

/** Smallest RA span covering all values (handles the 0°/360° wrap). */
function raSpan(values: number[]): [number, number] {
  const sorted = [...values].sort((a, b) => a - b);
  let gapStart = sorted[sorted.length - 1];
  let gapEnd = sorted[0] + 360;
  let biggest = gapEnd - gapStart;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > biggest) {
      biggest = gap;
      gapStart = sorted[i - 1];
      gapEnd = sorted[i];
    }
  }
  return [gapEnd % 360, gapStart];
}

export function regionSummary(
  points: RegionPoint[],
  geom: SkyGeometry,
): RegionSummary {
  const sky = points.map((p) => gridToSky(p, geom));
  const fraction = polygonArea(points);
  return {
    vertices: points.length,
    centroid: gridToSky(polygonCentroid(points), geom),
    raRange: raSpan(sky.map((s) => s.ra)),
    decRange: [
      Math.min(...sky.map((s) => s.dec)),
      Math.max(...sky.map((s) => s.dec)),
    ],
    areaArcmin2: fraction * geom.fov_arcmin * geom.fov_arcmin,
    fractionOfField: fraction,
  };
}

/** Zoom/pan that frames the region's bounding box inside a square canvas of `size` px. */
export function frameRegion(points: RegionPoint[], size: number) {
  const b = polygonBounds(points);
  const extent = Math.max(b.maxU - b.minU, b.maxV - b.minV, 1e-3);
  const zoom = Math.min(8, Math.max(1, 0.85 / extent));
  const cu = (b.minU + b.maxU) / 2;
  const cv = (b.minV + b.maxV) / 2;
  return {
    zoom,
    pan: { x: -(cu - 0.5) * size * zoom, y: -(cv - 0.5) * size * zoom },
  };
}

export const polygonAttr = (points: RegionPoint[]) =>
  points.map((p) => `${p.u.toFixed(4)},${p.v.toFixed(4)}`).join(" ");

export type MotionMetrics = {
  pinA: { ra: number; dec: number };
  pinB: { ra: number; dec: number };
  separationArcsec: number;
  separationMas: number;
  deltaRaArcsec: number;
  deltaDecArcsec: number;
  positionAngleDeg: number;
  baselineDays: number | null;
  baselineYears: number | null;
  properMotionMasYr: number | null;
};

/**
 * Spherical angular separation (arcsec) using the Vincenty atan2 form of the
 * spherical law of cosines for high precision at sub-arcsecond scales.
 */
export function angularSeparationArcsec(
  a: { ra: number; dec: number },
  b: { ra: number; dec: number },
): number {
  const dAlpha = (b.ra - a.ra) * DEG;
  const dec1 = a.dec * DEG;
  const dec2 = b.dec * DEG;
  const sinD1 = Math.sin(dec1),
    cosD1 = Math.cos(dec1);
  const sinD2 = Math.sin(dec2),
    cosD2 = Math.cos(dec2);
  const cosDA = Math.cos(dAlpha),
    sinDA = Math.sin(dAlpha);
  const y = Math.hypot(cosD2 * sinDA, cosD1 * sinD2 - sinD1 * cosD2 * cosDA);
  const x = sinD1 * sinD2 + cosD1 * cosD2 * cosDA;
  const thetaRad = Math.atan2(y, x);
  return (thetaRad / DEG) * 3600;
}

/**
 * Compute angular displacement and proper motion (mas/yr) between two
 * normalized grid pin coordinates in Epoch A and Epoch B.
 */
export function computeMotionMetrics(
  pinA: RegionPoint,
  pinB: RegionPoint,
  geom: SkyGeometry,
  timestampA?: string,
  timestampB?: string,
): MotionMetrics {
  const skyA = gridToSky(pinA, geom);
  const skyB = gridToSky(pinB, geom);
  const separationArcsec = angularSeparationArcsec(skyA, skyB);
  const separationMas = separationArcsec * 1000;
  const meanDecRad = ((skyA.dec + skyB.dec) / 2) * DEG;
  const dRaDeg = ((skyB.ra - skyA.ra + 540) % 360) - 180;
  const deltaRaArcsec = dRaDeg * Math.cos(meanDecRad) * 3600;
  const deltaDecArcsec = (skyB.dec - skyA.dec) * 3600;
  const positionAngleDeg =
    ((Math.atan2(deltaRaArcsec, deltaDecArcsec) * 180) / Math.PI + 360) % 360;

  const tA = timestampA ? Date.parse(timestampA) : NaN;
  const tB = timestampB ? Date.parse(timestampB) : NaN;
  let baselineDays: number | null = null;
  let baselineYears: number | null = null;
  let properMotionMasYr: number | null = null;

  if (Number.isFinite(tA) && Number.isFinite(tB) && Math.abs(tB - tA) > 0) {
    baselineDays = Math.abs(tB - tA) / (86400 * 1000);
    baselineYears = baselineDays / 365.25;
    properMotionMasYr =
      baselineYears > 1e-6 ? separationMas / baselineYears : null;
  }

  return {
    pinA: skyA,
    pinB: skyB,
    separationArcsec,
    separationMas,
    deltaRaArcsec,
    deltaDecArcsec,
    positionAngleDeg,
    baselineDays,
    baselineYears,
    properMotionMasYr,
  };
}
