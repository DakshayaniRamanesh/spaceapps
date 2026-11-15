import test from "node:test";
import assert from "node:assert/strict";
import {
  selectedPair,
  differenceAllowed,
  pause,
  checkedJson,
} from "../lib/observations.ts";
import { mayRequestObservations } from "../lib/source-policy.ts";

test("real-data access requires a healthy recognized provider", () => {
  assert.equal(
    mayRequestObservations(
      { status: "ok", source: "spherex-irsa", real_data_enabled: true },
      false,
    ),
    true,
  );
  assert.equal(
    mayRequestObservations(
      {
        status: "unavailable",
        source: "spherex-irsa",
        real_data_enabled: true,
      },
      false,
    ),
    false,
  );
  assert.equal(
    mayRequestObservations(
      { status: "ok", source: "unknown", real_data_enabled: true },
      false,
    ),
    false,
  );
});
test("pair lookup supports either order; real subtraction remains disabled", () => {
  const pair = {
    a: "a",
    b: "b",
    difference_allowed: true,
    comparison_status: "comparable",
    checks: [],
  };
  const data = {
    source_type: "spherex-irsa",
    frames: [{ id: "a" }, { id: "b" }],
    pairs: [pair],
  };
  assert.equal(selectedPair(data, 1, 0), pair);
  assert.equal(differenceAllowed(data, 0, 1), false);
  assert.equal(
    differenceAllowed({ ...data, source_type: "synthetic" }, 0, 1),
    true,
  );
});
test("polling delay responds to request cancellation", async () => {
  const controller = new AbortController();
  const waiting = pause(10000, controller.signal);
  controller.abort();
  await assert.rejects(waiting, { name: "AbortError" });
});
test("proxy failures produce a useful message instead of a JSON parser error", async () => {
  await assert.rejects(
    checkedJson(new Response("Bad Gateway", { status: 502 })),
    /Observation service returned 502/,
  );
});
