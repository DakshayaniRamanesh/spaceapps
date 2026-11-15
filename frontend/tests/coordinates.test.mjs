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

test("field query round-trips epoch selection", () => {
  const field = {
    ra: 10,
    dec: 20,
    fov_arcmin: 12,
    detector: "D1",
    limit: 24,
    spread: true,
    start_date: "2025-06-01",
    end_date: "2026-01-01",
  };
  const query = new URLSearchParams(fieldQuery(field));
  assert.equal(query.get("limit"), "24");
  assert.equal(query.get("spread"), "1");
  assert.equal(query.get("start"), "2025-06-01");
  assert.equal(query.get("end"), "2026-01-01");
});

test("default epoch selection keeps shared URLs clean", () => {
  const query = new URLSearchParams(
    fieldQuery({ ...DEFAULT_FIELD, limit: 12 }),
  );
  assert.equal(query.get("limit"), null);
  assert.equal(query.get("spread"), null);
});

test("nullable dates returned in real manifests do not disable valid field sharing", () => {
  const field = {
    ...DEFAULT_FIELD,
    start_date: null,
    end_date: null,
    min_wavelength_um: null,
    max_wavelength_um: null,
  };
  assert.equal(validateField(field), undefined);
  const query = new URLSearchParams(fieldQuery(field));
  assert.equal(query.has("start"), false);
  assert.equal(query.has("end"), false);
});

test("field validation rejects invalid epoch selections and dates", () => {
  for (const limit of [1, 51, 2.5, NaN])
    assert.ok(validateField({ ...DEFAULT_FIELD, limit }));
  for (const start_date of ["2025-02-30", "2025-2-03", "not-a-date"])
    assert.ok(validateField({ ...DEFAULT_FIELD, start_date }));
  assert.ok(
    validateField({
      ...DEFAULT_FIELD,
      start_date: "2026-01-01",
      end_date: "2025-12-31",
    }),
  );
  assert.equal(
    validateField({ ...DEFAULT_FIELD, limit: 24, spread: true }),
    undefined,
  );
});
