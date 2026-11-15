import { test, expect, type Page } from "@playwright/test";

test.beforeEach(() =>
  test.skip(!!process.env.SKYTRACE_TEST_DEMO, "Archive spectral controls only"),
);

async function mockArchive(page: Page, missingMetadata = false) {
  const queries: URLSearchParams[] = [];
  await page.route("**/health", (route) =>
    route.fulfill({
      json: { status: "ok", source: "spherex-irsa", real_data_enabled: true },
    }),
  );
  await page.route("**/api/observations?*", (route) => {
    const q = new URL(route.request().url()).searchParams;
    queries.push(q);
    const min = q.has("min_wavelength_um")
      ? Number(q.get("min_wavelength_um"))
      : null;
    const max = q.has("max_wavelength_um")
      ? Number(q.get("max_wavelength_um"))
      : null;
    const request = {
      ra: Number(q.get("ra")),
      dec: Number(q.get("dec")),
      fov_arcmin: Number(q.get("fov_arcmin")),
      detector: q.get("detector"),
      min_wavelength_um: min,
      max_wavelength_um: max,
    };
    return route.fulfill({
      json: {
        source_type: "spherex-irsa",
        dataset_id: "spectral-test",
        request,
        width: 384,
        height: 384,
        wavelength_range_um: [0.75, 1.09],
        intensity_unit: "MJy / sr",
        notice: "Spectral browser test fixture",
        frames: [0, 1].map((i) => ({
          id: `spx.${request.detector}.test${i}`,
          timestamp: `2025-05-0${i + 1}T00:00:00Z`,
          image_url: `/api/frames/test${i}.png`,
          detector: request.detector,
          source: "spherex-irsa",
          wavelength_um: missingMetadata
            ? null
            : min != null && max != null
              ? min + (max - min) * (i ? 0.75 : 0.25)
              : i
                ? 0.95
                : 0.81,
          bandwidth_um: missingMetadata ? null : i ? 0.024 : 0.02,
          wavelength_source: missingMetadata ? null : "wcs-wave",
          quality: {
            registration: "Test WCS grid",
            noise_sigma: 0.5,
            masked_fraction: 0,
            calibrated: true,
          },
        })),
      },
    });
  });
  await page.route("**/api/frames/*.png", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="384" height="384"><rect width="384" height="384" fill="black"/></svg>',
    }),
  );
  return queries;
}

async function openControls(page: Page) {
  if (!(await page.getByLabel("Right ascension").isVisible()))
    await page.getByText("Observation controls", { exact: true }).click();
}

test("channel windows, displayed epoch metadata, sharing and detector changes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const queries = await mockArchive(page);
  await page.goto(
    "/explore?ra=304.6935&dec=42.4436&detector=D1&limit=24&spread=1&start=2025-01-01&end=2026-01-01",
  );
  await expect(
    page.getByRole("button", { name: "Next frame", exact: true }),
  ).toBeEnabled();
  await openControls(page);
  const indicator = page.getByLabel("Displayed spectral metadata");
  await expect(indicator).toContainText("λ₀ 0.8100 µm");
  await page.getByRole("button", { name: "Next frame", exact: true }).click();
  await expect(indicator).toContainText("λ₀ 0.9500 µm");
  await expect(indicator).toContainText("Δλ 0.0240 µm");
  await page.getByRole("button", { name: "Blink", exact: true }).click();
  await expect(indicator).toContainText("λ₀ 0.8100 µm");
  await page.getByRole("button", { name: "Start blink", exact: true }).click();
  await expect(indicator).toContainText("λ₀ 0.9500 µm");
  await page.getByRole("button", { name: "Pause blink", exact: true }).click();
  await page.getByRole("button", { name: "Single frame", exact: true }).click();
  await expect(indicator).toContainText("λ₀ 0.9500 µm");
  await page.getByLabel("Nominal channel").selectOption("1");
  await expect(page.getByLabel("Minimum λ")).toHaveValue("0.743");
  await expect(page.getByLabel("Maximum λ")).toHaveValue("0.762");
  await expect(indicator).toContainText("λ₀ 0.9500 µm");
  await page
    .getByRole("button", { name: "Check for observations", exact: true })
    .click();
  await expect(page).toHaveURL(
    /min_wavelength_um=0.743&max_wavelength_um=0.762/,
  );
  await expect(indicator).toContainText("λ₀ 0.7478 µm");
  expect(queries.at(-1)?.get("min_wavelength_um")).toBe("0.743");
  expect(queries.at(-1)?.get("max_wavelength_um")).toBe("0.762");
  expect(queries.at(-1)?.get("limit")).toBe("24");
  expect(queries.at(-1)?.get("spread")).toBe("true");
  expect(queries.at(-1)?.get("start_date")).toBe("2025-01-01");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as Window & { sharedField?: string }).sharedField = text;
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Share field", exact: true }).click();
  const shared = await page.evaluate(
    () => (window as Window & { sharedField?: string }).sharedField,
  );
  expect(shared).toContain("min_wavelength_um=0.743&max_wavelength_um=0.762");
  await page.goto(shared!);
  await expect(
    page.getByRole("button", { name: "Next frame", exact: true }),
  ).toBeEnabled();
  await openControls(page);
  await expect(page.getByLabel("Nominal channel")).toHaveValue("1");
  await expect(page.getByLabel("Minimum λ")).toHaveValue("0.743");
  await page.getByRole("button", { name: "D3", exact: true }).click();
  await expect(page.getByLabel("Minimum λ")).toHaveValue("");
  await expect(page.getByLabel("Maximum λ")).toHaveValue("");
  await expect(indicator).toContainText("Displayed epoch · D1");
  await expect(indicator).toContainText("λ₀ 0.7478 µm");
  await expect(
    page.getByLabel("Nominal channel").locator("option"),
  ).toHaveCount(18);
  await page.getByRole("button", { name: "Short λ", exact: true }).click();
  await expect(page.getByLabel("Minimum λ")).toHaveValue("1.636");
  await page.getByRole("button", { name: "All λ", exact: true }).click();
  await expect(page.getByLabel("Minimum λ")).toHaveValue("");
  await page.locator(".spectral-controls").screenshot({
    path: `test-results/spectral-${test.info().project.name}.png`,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("invalid windows never query the archive and missing metadata stays unavailable", async ({
  page,
}) => {
  const queries = await mockArchive(page, true);
  await page.goto("/explore");
  await expect(
    page.getByRole("button", { name: "Next frame", exact: true }),
  ).toBeEnabled();
  await openControls(page);
  await expect(page.getByLabel("Displayed spectral metadata")).toContainText(
    "λ₀ unavailable",
  );
  await expect(page.getByLabel("Displayed spectral metadata")).toContainText(
    "Δλ unavailable",
  );
  const before = queries.length;
  await page.getByLabel("Minimum λ").fill("1");
  await page.getByLabel("Maximum λ").fill("0.9");
  await page
    .getByRole("button", { name: "Check for observations", exact: true })
    .click();
  await expect(page.locator("#field-error")).toContainText(
    "Minimum wavelength must not exceed maximum wavelength",
  );
  expect(queries).toHaveLength(before);
});
