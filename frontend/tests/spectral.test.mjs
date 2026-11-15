import test from "node:test";
import assert from "node:assert/strict";
import {
  detectors,
  DEFAULT_FIELD,
  fieldQuery,
  validateField,
} from "../lib/types.ts";
import {
  spectralChannels,
  spectralSubBands,
  SPECTRAL_CHANNEL_SOURCE,
} from "../lib/spectral.ts";

test("all 102 published nominal channel windows can be submitted and shared", () => {
  let count = 0;
  for (const detector of detectors) {
    const channels = spectralChannels(detector);
    assert.equal(channels.length, 17);
    for (const [i, channel] of channels.entries()) {
      count++;
      assert.equal(channel.channel, i + 1);
      assert.ok(channel.min_wavelength_um < channel.center_um);
      assert.ok(channel.center_um < channel.max_wavelength_um);
      const field = { ...DEFAULT_FIELD, detector, ...channel };
      assert.equal(validateField(field), undefined);
      const query = new URLSearchParams(fieldQuery(field));
      assert.equal(
        Number(query.get("min_wavelength_um")),
        channel.min_wavelength_um,
      );
      assert.equal(
        Number(query.get("max_wavelength_um")),
        channel.max_wavelength_um,
      );
    }
    const bands = spectralSubBands(detector);
    assert.equal(bands[0].min_wavelength_um, channels[0].min_wavelength_um);
    assert.equal(
      bands.at(-1).max_wavelength_um,
      channels.at(-1).max_wavelength_um,
    );
  }
  assert.equal(count, 102);
  assert.deepEqual(spectralChannels("D1")[0], {
    channel: 1,
    center_um: 0.753,
    min_wavelength_um: 0.743,
    max_wavelength_um: 0.762,
  });
  assert.equal(spectralChannels("D6").at(-1).max_wavelength_um, 5.0094);
  assert.match(SPECTRAL_CHANNEL_SOURCE, /cal-sch-v2-2026-229/);
});

test("invalid spectral bounds are rejected and one-sided or exact windows are valid", () => {
  for (const key of ["min_wavelength_um", "max_wavelength_um"]) {
    for (const value of [0, -1, NaN, Infinity, -Infinity]) {
      assert.ok(validateField({ ...DEFAULT_FIELD, [key]: value }));
    }
    assert.equal(validateField({ ...DEFAULT_FIELD, [key]: 0.9 }), undefined);
  }
  assert.ok(
    validateField({
      ...DEFAULT_FIELD,
      min_wavelength_um: 1,
      max_wavelength_um: 0.9,
    }),
  );
  assert.equal(
    validateField({
      ...DEFAULT_FIELD,
      min_wavelength_um: 0.9,
      max_wavelength_um: 0.9,
    }),
    undefined,
  );
  const query = new URLSearchParams(
    fieldQuery({
      ...DEFAULT_FIELD,
      min_wavelength_um: null,
      max_wavelength_um: null,
    }),
  );
  assert.equal(query.has("min_wavelength_um"), false);
  assert.equal(query.has("max_wavelength_um"), false);
});
