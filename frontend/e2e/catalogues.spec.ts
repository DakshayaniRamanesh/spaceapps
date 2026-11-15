import { test, expect, type Page } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "../backend/data/featured");
const directory = readdirSync(root).find((name) => name.startsWith("irsa-"))!;
const data = JSON.parse(
  readFileSync(path.join(root, directory, "manifest.json"), "utf8"),
);

function overlay(catalogue: string, dataset = data) {
  const x = catalogue === "gaia" ? dataset.width * 0.21 : dataset.width * 0.78;
  const y =
    catalogue === "gaia" ? dataset.height * 0.29 : dataset.height * 0.73;
  return {
    dataset_id: dataset.dataset_id,
    catalogue,
    release:
      catalogue === "gaia" ? "Gaia DR3" : "WISE / AllWISE Source Catalog",
    width: dataset.width,
    height: dataset.height,
    frames: Object.fromEntries(
      dataset.frames.map((f: any) => [f.id, f.timestamp]),
    ),
    retrieved_at: "2026-01-01T00:00:00Z",
    provenance_url: "https://www.cosmos.esa.int/web/gaia/dr3",
    result_limit: 500,
    preselection_count: 500,
    truncated: catalogue === "wise",
    completeness: "Limited reference subset",
    warnings: [],
    sources: [0, 1].map((i) => ({
      source_id: `${catalogue}-900719925474099312${i}`,
      ra: 30,
      dec: 10,
      reference_epoch: catalogue === "gaia" ? 2016 : null,
      pmra: null,
      pmdec: null,
      proper_motion_unit: "mas/yr; pmra includes cos(dec)",
      magnitudes: {
        [catalogue === "gaia" ? "Gaia G" : "WISE W1 (3.4 μm)"]: 12,
      },
      quality: { test_fixture: "For browser tests only" },
      warnings: [],
      positions: Object.fromEntries(
        dataset.frames.map((f: any, frame: number) => [
          f.id,
          {
            x: x + frame * 2,
            y,
            ra: 30,
            dec: 10,
            treatment: "catalogue_position",
          },
        ]),
      ),
    })),
  };
}

async function prepare(page: Page, dataset = data) {
  await page.route("**/health", (route) =>
    route.fulfill({
      json: { status: "ok", real_data_enabled: true, source: "spherex-irsa" },
    }),
  );
  await page.route("**/api/observation-jobs", (route) =>
    route.fulfill({
      json: {
        status: "ready",
        result_url: "/api/observation-sets/browser-fixture",
      },
    }),
  );
  await page.route("**/api/observation-sets/browser-fixture", (route) =>
    route.fulfill({ json: dataset }),
  );
}

test.beforeEach(() =>
  test.skip(!!process.env.SKYTRACE_TEST_DEMO, "Real-provider overlay tests"),
);

test("independent layers, exact registration, keyboard selection, cached toggles and viewer modes", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await prepare(page);
  const requests: string[] = [];
  await page.route("**/catalogues/*", (route) => {
    const catalogue = route.request().url().split("/").pop()!;
    requests.push(catalogue);
    return route.fulfill({ json: overlay(catalogue) });
  });
  await page.goto("/explore");
  await expect(page.getByRole("checkbox", { name: "Gaia DR3" })).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".observation-image")
        .first()
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.locator(".viewer-loading")).toHaveCount(0);
  await page.screenshot({
    path: `test-results/catalogues-off-${test.info().project.name}.png`,
    fullPage: true,
  });
  await expect(page.locator(".catalogue-marker")).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Gaia DR3" }).check();
  await expect(page.locator(".catalogue-marker.gaia")).toHaveCount(2);
  await page.getByRole("checkbox", { name: /WISE/ }).check();
  await expect(page.locator(".catalogue-marker.wise")).toHaveCount(2);
  await expect(page.getByText(/Truncated:/)).toBeVisible();
  async function alignment() {
    // Read both rectangles in the same browser task, after ResizeObserver settles.
    await expect
      .poll(() =>
        page.evaluate(
          ({ width, height }) => {
            const plane = document
              .querySelector(".registered-image")!
              .getBoundingClientRect();
            const marker = document
              .querySelector(".catalogue-marker.gaia")!
              .getBoundingClientRect();
            return Math.max(
              Math.abs(
                marker.x +
                  marker.width / 2 -
                  plane.x -
                  plane.width * (0.21 + 0.5 / width),
              ),
              Math.abs(
                marker.y +
                  marker.height / 2 -
                  plane.y -
                  plane.height * (0.29 + 0.5 / height),
              ),
            );
          },
          { width: data.width, height: data.height },
        ),
      )
      .toBeLessThan(0.5);
  }
  await alignment();
  const originalViewport = page.viewportSize()!;
  await page.setViewportSize({
    width: originalViewport.width + 47,
    height: originalViewport.height,
  });
  await expect
    .poll(async () =>
      Math.round(
        (await page.locator(".registered-image").first().boundingBox())!.width,
      ),
    )
    .toBeGreaterThan(0);
  await alignment();
  await page.setViewportSize(originalViewport);
  // Overlapping entries remain independently available through the source picker.
  await page.locator(".catalogue-picker select").selectOption("0:1:0");
  await expect(page.getByLabel("Selected catalogue source")).toContainText(
    "gaia-9007199254740993121",
  );
  await page.locator(".catalogue-marker.gaia").last().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Selected catalogue source")).toBeVisible();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await alignment();
  const stage = page.locator(".image-stage");
  await stage.focus();
  await page.keyboard.press("Shift+ArrowLeft");
  await alignment();
  await page.getByRole("button", { name: "Fit to view", exact: true }).click();
  await page.getByRole("checkbox", { name: "Gaia DR3" }).uncheck();
  await expect(page.locator(".catalogue-marker.gaia")).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Gaia DR3" }).check();
  await expect(page.locator(".catalogue-marker.gaia")).toHaveCount(2);
  await page.getByRole("button", { name: "Next frame", exact: true }).click();
  await expect(page.getByLabel("Selected catalogue source")).toContainText(
    data.frames[1].timestamp,
  );
  await page.getByRole("button", { name: "Blink", exact: true }).click();
  await expect(page.locator(".catalogue-marker")).toHaveCount(4);
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  await expect(page.locator(".catalogue-marker")).toHaveCount(8);
  // Split images have horizontal or vertical letterboxing, but share the same image plane.
  await alignment();
  expect(requests.sort()).toEqual(["gaia", "wise"]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/catalogues-both-fixture-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("loading, failure, retry and empty result do not block the other layer", async ({
  page,
}) => {
  await prepare(page);
  let tries = 0;
  let finishFirst: () => void = () => {};
  await page.route("**/catalogues/gaia", async (route) => {
    tries++;
    if (tries === 1) await new Promise<void>(resolve => { finishFirst = resolve; });
    return route.fulfill(
      tries === 1
        ? {
            status: 503,
            json: { detail: "Catalogue timed out. Please retry later." },
          }
        : { json: { ...overlay("gaia"), sources: [] } },
    );
  });
  await page.route("**/catalogues/wise", (route) =>
    route.fulfill({ json: overlay("wise") }),
  );
  await page.goto("/explore");
  await page.getByRole("checkbox", { name: "Gaia DR3" }).check();
  await expect(page.getByText("Loading catalogue…")).toBeVisible();
  await page.getByRole("checkbox", { name: /WISE/ }).check();
  await expect(page.locator(".catalogue-marker.wise")).toHaveCount(2);
  finishFirst();
  await page.getByRole("button", { name: "Retry Gaia" }).click();
  await expect(page.getByText(/No sources returned/)).toBeVisible();
  await expect(page.locator(".viewer-loading")).toHaveCount(0);
});

test("old manifests disable overlays without guessing a grid", async ({
  page,
}) => {
  await prepare(page, { ...data, grid: {} });
  await page.goto("/explore");
  await expect(page.getByRole("checkbox", { name: "Gaia DR3" })).toBeDisabled();
  await expect(page.getByText(/no common celestial WCS/)).toBeVisible();
  await expect(page.locator(".observation-image")).toBeVisible();
});

test("changing fields aborts a pending catalogue and clears the selected source", async ({
  page,
}) => {
  let current = data;
  await prepare(page);
  await page.route("**/api/observation-sets/browser-fixture", (route) =>
    route.fulfill({ json: current }),
  );
  let release!: () => void;
  await page.route("**/catalogues/gaia", async (route) => {
    const old = current;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({ json: overlay("gaia", old) }).catch(() => {});
  });
  await page.route("**/catalogues/wise", (route) =>
    route.fulfill({ json: overlay("wise", current) }),
  );
  await page.goto("/explore");
  await page.getByRole("checkbox", { name: /WISE/ }).check();
  await page.locator(".catalogue-picker select").selectOption("0:0:0");
  await expect(page.getByLabel("Selected catalogue source")).toBeVisible();
  await page.getByRole("checkbox", { name: "Gaia DR3" }).check();
  await expect(page.getByText("Loading catalogue…")).toBeVisible();
  current = {
    ...data,
    dataset_id: "new-field-test",
    request: { ...data.request, ra: 31 },
  };
  if (!(await page.locator("#ra").isVisible()))
    await page.locator(".controls summary").click();
  await page.locator("#ra").fill("31");
  await page.locator(".controls button[type=submit]").click();
  await expect(page.getByLabel("Selected catalogue source")).toHaveCount(0);
  release();
  await expect(page.locator(".catalogue-marker")).toHaveCount(0);
  await expect(
    page.getByRole("checkbox", { name: "Gaia DR3" }),
  ).not.toBeChecked();
  await page.getByRole("checkbox", { name: /WISE/ }).check();
  await expect(page.locator(".catalogue-marker.wise")).toHaveCount(2);
  await expect(page.locator(".catalogue-marker.gaia")).toHaveCount(0);
});
