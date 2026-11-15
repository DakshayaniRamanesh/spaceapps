import test from "node:test";
import assert from "node:assert/strict";
import {
  angularSeparationArcsec,
  computeMotionMetrics,
  frameRegion,
  gridToSky,
  isUsableRegion,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  regionSummary,
  simplifyPath,
} from "../lib/sky-region.ts";

const square = [
  { u: 0.25, v: 0.25 },
  { u: 0.75, v: 0.25 },
  { u: 0.75, v: 0.75 },
  { u: 0.25, v: 0.75 },
];
const barnard = { ra: 269.452077, dec: 4.693365, fov_arcmin: 12 };

test("real PNG tools use the explicit WCS, vertical flip and pixel-center convention", () => {
  const geometry = {
    ra: 0,
    dec: 0,
    fov_arcmin: 60,
    width: 60,
    height: 40,
    grid: {
      CTYPE1: "RA---TAN",
      CTYPE2: "DEC--TAN",
      CRVAL1: 30,
      CRVAL2: 10,
      CRPIX1: 31,
      CRPIX2: 21,
      CDELT1: -0.001,
      CDELT2: 0.001,
    },
  };
  const center = gridToSky({ u: 30.5 / 60, v: 19.5 / 40 }, geometry);
  assert.ok(
    Math.abs(center.ra - 30) < 1e-10 && Math.abs(center.dec - 10) < 1e-10,
  );
  const north = gridToSky({ u: 30.5 / 60, v: 3.5 / 40 }, geometry);
  const east = gridToSky({ u: 2.5 / 60, v: 19.5 / 40 }, geometry);
  assert.ok(north.dec > center.dec);
  assert.ok(east.ra > center.ra);
  assert.ok(Math.abs(north.dec - 10.015999999584) < 1e-8);
});

test("polygon area, centroid and containment on the normalised grid", () => {
  assert.ok(Math.abs(polygonArea(square) - 0.25) < 1e-12);
  const c = polygonCentroid(square);
  assert.ok(Math.abs(c.u - 0.5) < 1e-12 && Math.abs(c.v - 0.5) < 1e-12);
  assert.equal(pointInPolygon({ u: 0.5, v: 0.5 }, square), true);
  assert.equal(pointInPolygon({ u: 0.1, v: 0.5 }, square), false);
});

test("grid centre maps to the requested field centre", () => {
  const s = gridToSky({ u: 0.5, v: 0.5 }, barnard);
  assert.ok(Math.abs(s.ra - barnard.ra) < 1e-9);
  assert.ok(Math.abs(s.dec - barnard.dec) < 1e-9);
});

test("grid orientation matches the backend TAN grid (CDELT1 < 0, CDELT2 > 0)", () => {
  const right = gridToSky({ u: 1, v: 0.5 }, barnard);
  const down = gridToSky({ u: 0.5, v: 1 }, barnard);
  assert.ok(right.ra < barnard.ra, "moving right decreases RA");
  assert.ok(down.dec > barnard.dec, "moving down the PNG increases Dec");
  // Half the field (6 arcmin) from the centre along Dec.
  assert.ok(Math.abs((down.dec - barnard.dec) * 60 - 6) < 0.01);
});

test("RA wraps cleanly across 0°", () => {
  const geom = { ra: 0.01, dec: 0, fov_arcmin: 60 };
  const s = regionSummary(square, geom);
  assert.ok(s.raRange[0] > 359 && s.raRange[1] < 1, JSON.stringify(s.raRange));
});

test("region summary reports area in arcmin²", () => {
  const s = regionSummary(square, barnard);
  assert.equal(s.vertices, 4);
  assert.ok(Math.abs(s.areaArcmin2 - 36) < 1e-9);
  assert.ok(Math.abs(s.fractionOfField - 0.25) < 1e-12);
});

test("tiny scribbles are rejected and dense paths simplified", () => {
  assert.equal(
    isUsableRegion([
      { u: 0.5, v: 0.5 },
      { u: 0.51, v: 0.5 },
    ]),
    false,
  );
  assert.equal(isUsableRegion(square), true);
  const dense = Array.from({ length: 100 }, (_, i) => ({ u: i / 10000, v: 0 }));
  assert.ok(simplifyPath(dense).length < 5);
});

test("zoom to region centres the bounding box and caps zoom", () => {
  const f = frameRegion(square, 400);
  assert.ok(Math.abs(f.zoom - 1.7) < 1e-9);
  assert.ok(Math.abs(f.pan.x) < 1e-9 && Math.abs(f.pan.y) < 1e-9);
  const tiny = [
    { u: 0.9, v: 0.1 },
    { u: 0.91, v: 0.1 },
    { u: 0.91, v: 0.11 },
  ];
  const g = frameRegion(tiny, 400);
  assert.equal(g.zoom, 8);
  assert.ok(g.pan.x < 0 && g.pan.y > 0);
});

test("spherical separation and proper motion calculation", () => {
  // ~10.3 arcsec northward separation over 1 Julian year -> ~10,300 mas/yr
  const sep = angularSeparationArcsec(
    { ra: 269.452077, dec: 4.693365 },
    { ra: 269.452077, dec: 4.693365 + 10.3 / 3600 },
  );
  assert.ok(Math.abs(sep - 10.3) < 1e-4);

  const fov = 12; // 720 arcsec across v in [0, 1]
  const dv = 10.3 / (fov * 60);
  const metrics = computeMotionMetrics(
    { u: 0.5, v: 0.5 },
    { u: 0.5, v: 0.5 + dv },
    barnard,
    "2025-08-27T00:00:00Z",
    "2026-08-27T06:00:00Z",
  );
  assert.ok(Math.abs(metrics.separationArcsec - 10.3) < 0.01);
  assert.ok(metrics.properMotionMasYr !== null);
  assert.ok(Math.abs(metrics.properMotionMasYr - 10300) < 15);
  assert.ok(
    Math.abs(metrics.positionAngleDeg - 0) < 0.1 ||
      Math.abs(metrics.positionAngleDeg - 360) < 0.1,
  );

  const sameEpoch = computeMotionMetrics(
    { u: 0.5, v: 0.5 },
    { u: 0.5, v: 0.5 + dv },
    barnard,
    "2025-08-27T00:00:00Z",
    "2025-08-27T00:00:00Z",
  );
  assert.equal(sameEpoch.properMotionMasYr, null);
  assert.equal(sameEpoch.baselineDays, null);
});
