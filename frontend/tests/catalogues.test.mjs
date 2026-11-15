import test from "node:test";
import assert from "node:assert/strict";
import { imageFit, unavailableReason } from "../lib/catalogues.ts";

test("image rectangle fits portrait, landscape, split and resized ports without stretching", () => {
  assert.deepEqual(imageFit(800, 400, 200, 100), { width: 800, height: 400 });
  assert.deepEqual(imageFit(800, 400, 100, 100), { width: 400, height: 400 });
  assert.deepEqual(imageFit(200, 400, 100, 100), { width: 200, height: 200 });
  assert.deepEqual(imageFit(390, 320, 200, 100), { width: 390, height: 195 });
});

test("synthetic, empty and old manifests have honest unavailable states", () => {
  assert.match(unavailableReason({ source_type: "synthetic" }), /synthetic/);
  assert.match(
    unavailableReason({ source_type: "spherex-irsa", frames: [] }),
    /No observation/,
  );
  assert.match(
    unavailableReason({ source_type: "spherex-irsa", frames: [{}] }),
    /no common celestial WCS/,
  );
  assert.equal(
    unavailableReason({
      source_type: "spherex-irsa",
      frames: [{}],
      grid: { CTYPE1: "RA---TAN", CRPIX1: 5 },
    }),
    "",
  );
});
