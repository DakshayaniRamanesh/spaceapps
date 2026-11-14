import test from "node:test";
import assert from "node:assert/strict";
import {
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
  assert.equal(isUsableRegion([{ u: 0.5, v: 0.5 }, { u: 0.51, v: 0.5 }]), false);
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
