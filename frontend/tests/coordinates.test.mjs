import test from "node:test";
import assert from "node:assert/strict";
import { validateField, fieldQuery, DEFAULT_FIELD } from "../lib/types.ts";
test("valid field accepts inclusive declination and FOV boundaries", () => {
  for (const dec of [-90, 0, 90])
    for (const fov_arcmin of [2, 12, 60])
      assert.equal(
        validateField({ ...DEFAULT_FIELD, ra: 0, dec, fov_arcmin }),
        undefined,
      );
});
test("invalid coordinates are rejected before fetching", () => {
  for (const ra of [-1, 360, Infinity, NaN])
    assert.ok(validateField({ ...DEFAULT_FIELD, ra }));
  for (const dec of [-91, 91, NaN])
    assert.ok(validateField({ ...DEFAULT_FIELD, dec }));
});
test("invalid FOV and detector are rejected", () => {
  for (const fov_arcmin of [0, 1.99, 60.01, Infinity])
    assert.ok(validateField({ ...DEFAULT_FIELD, fov_arcmin }));
  assert.ok(validateField({ ...DEFAULT_FIELD, detector: "D7" }));
});
test("shared field query round-trips without losing precision", () => {
  const field = {
    ra: 133.79512917,
    dec: -7.24514722,
    fov_arcmin: 6,
    detector: "D6",
  };
  const q = new URLSearchParams(fieldQuery(field));
  assert.deepEqual(
    {
      ra: Number(q.get("ra")),
      dec: Number(q.get("dec")),
      fov_arcmin: Number(q.get("fov")),
      detector: q.get("detector"),
    },
    field,
  );
});
