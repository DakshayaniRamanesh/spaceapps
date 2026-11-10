import test from "node:test";
import assert from "node:assert/strict";
import {
  mayRequestObservations,
  mayDisplaySource,
} from "../lib/source-policy.ts";
const synthetic = {
  status: "ok",
  source: "synthetic",
  real_data_enabled: false,
};
test("production does not request or display synthetic data", () => {
  assert.equal(mayRequestObservations(synthetic, false), false);
  assert.equal(mayDisplaySource("synthetic", false), false);
});
test("explicit development mode retains the synthetic workflow", () => {
  assert.equal(mayRequestObservations(synthetic, true), true);
  assert.equal(mayDisplaySource("synthetic", true), true);
});
test("disabled or unavailable provider cannot generate development observations", () => {
  assert.equal(
    mayRequestObservations({ ...synthetic, status: "unavailable" }, true),
    false,
  );
  assert.equal(
    mayRequestObservations({ ...synthetic, source: "irsa" }, true),
    false,
  );
});
test("source guard rejects unexpected providers", () => {
  assert.equal(mayDisplaySource("unknown", false), false);
  assert.equal(mayDisplaySource("unknown", true), false);
});
