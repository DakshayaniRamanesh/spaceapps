import { test, expect } from "@playwright/test";

test.beforeEach(() =>
  test.skip(!!process.env.SKYTRACE_TEST_DEMO, "Real provider only"),
);

test("featured NASA exposures load, blink and retain provenance; subtraction is blocked", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const jobs: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("observation-jobs"))
      jobs.push(r.url());
  });
  await page.goto("/explore");
  await expect(page.locator(".frame-thumb")).toHaveCount(2);
  const viewer = page.locator(".observation-image");
  await expect
    .poll(() => viewer.evaluate((i) => (i as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  // Cached images may load before mount effects. Reload must not leave a
  // permanent spinner over a successfully decoded NASA frame.
  await page.reload();
  await expect(page.locator(".frame-thumb")).toHaveCount(2);
  await expect(page.locator(".viewer-loading")).toHaveCount(0);
  await expect(page.locator(".synthetic-watermark")).toContainText(
    "SPHEREx / NASA",
  );
  await expect(
    page.getByRole("button", { name: "Difference", exact: true }),
  ).toBeDisabled();
  const first = await viewer.getAttribute("src");
  await page.getByRole("button", { name: "Next frame", exact: true }).click();
  await expect(viewer).not.toHaveAttribute("src", first!);
  await page.getByRole("button", { name: "Blink", exact: true }).click();
  await page.getByRole("button", { name: "Start blink", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause blink", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause blink", exact: true }).click();
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  await expect(viewer).toHaveCount(2);
  await page.locator(".science-passport summary").click();
  await expect(
    page.getByRole("link", {
      name: "Download provenance and processing manifest",
    }),
  ).toBeVisible();
  const result = await request.get(
    "/api/observations?ra=248.16761083&dec=66.75497942&fov_arcmin=12&detector=D3",
  );
  expect(result.ok()).toBeTruthy();
  const data = await result.json();
  const difference = await request.get(
    `/api/difference?frame_a=${data.frames[0].id}&frame_b=${data.frames[1].id}`,
  );
  expect(difference.status()).toBe(422);
  expect(data.frames[0].access_url).toContain("https://irsa.ipac.caltech.edu/");
  expect(jobs).toHaveLength(2);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/real-explorer-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("custom-coordinate job reports pending and archive failure without inventing observations", async ({
  page,
}) => {
  await page.route("**/api/observation-jobs", (route) =>
    route.fulfill({
      status: 202,
      json: {
        job_id: "test-job",
        status: "queued",
        stage: "Searching NASA archive",
        cache_hit: false,
      },
    }),
  );
  await page.route("**/api/jobs/test-job", (route) =>
    route.fulfill({
      json: {
        job_id: "test-job",
        status: "failed",
        stage: "Archive unavailable",
        error_code: "archive_unavailable",
        message: "NASA archive is temporarily unavailable. Please retry.",
        cache_hit: false,
      },
    }),
  );
  await page.goto("/explore?ra=31&dec=10&fov=6&detector=D2");
  await expect(
    page.getByText("Searching NASA archive. First searches", { exact: false }),
  ).toBeVisible();
  await expect(
    page.locator('[role="alert"]:not(#__next-route-announcer__)'),
  ).toContainText("NASA archive is temporarily unavailable");
  await expect(page.locator(".observation-image")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Difference", exact: true }),
  ).toBeDisabled();
  await expect(page).toHaveURL(/ra=31&dec=10&fov=6&detector=D2/);
});

test("completed empty search is distinct from a failed or pending search", async ({
  page,
}) => {
  await page.route("**/api/observation-jobs", (route) =>
    route.fulfill({
      json: {
        job_id: "empty",
        status: "ready",
        stage: "Complete",
        result_url: "/api/observation-sets/empty-test",
        cache_hit: true,
      },
    }),
  );
  await page.route("**/api/observation-sets/empty-test", (route) =>
    route.fulfill({
      json: {
        source_type: "spherex-irsa",
        dataset_id: "empty-test",
        frames: [],
        warnings: [],
        notice:
          "No archive exposures cover this coordinate in the searched collections.",
        availability: "no_coverage",
        search_complete: true,
      },
    }),
  );
  await page.goto("/explore?ra=31&dec=10&fov=6&detector=D2");
  await expect(
    page.getByText("No archive exposures cover this coordinate", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.locator('[role="alert"]:not(#__next-route-announcer__)'),
  ).toHaveCount(0);
  await expect(page.locator(".observation-image")).toHaveCount(0);
});

test("invalid coordinates do not start a new job", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.locator(".frame-thumb")).toHaveCount(2);
  if (!(await page.getByLabel("Right ascension").isVisible()))
    await page.getByText("Observation controls", { exact: true }).click();
  let posts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("observation-jobs")) posts++;
  });
  await page.getByLabel("Right ascension").fill("360");
  await page
    .getByRole("button", { name: "Check for observations", exact: true })
    .click();
  await expect(
    page.locator('[role="alert"]:not(#__next-route-announcer__)'),
  ).toContainText("less than 360");
  expect(posts).toBe(0);
});

test("all five challenge presets resolve to bundled real-data snapshots", async ({
  page,
}) => {
  await page.goto("/explore");
  await expect(page.locator(".frame-thumb")).toHaveCount(2);
  if (!(await page.getByLabel("Target preset").isVisible()))
    await page.getByText("Observation controls", { exact: true }).click();
  for (const id of ["barnard", "epsilon", "wise", "rw-aur", "r-dra"]) {
    const response = page.waitForResponse(
      (r) =>
        r.url().includes("/api/observation-jobs") &&
        r.request().method() === "POST",
    );
    await page.getByLabel("Target preset").selectOption(id);
    const job = await (await response).json();
    expect(job.status).toBe("ready");
    expect(job.cache_hit).toBe(true);
    await expect(
      page.getByRole("button", { name: "Check for observations", exact: true }),
    ).toBeEnabled();
    await expect
      .poll(() => page.locator(".frame-thumb").count())
      .toBeGreaterThan(1);
    await expect(page.locator(".synthetic-watermark")).toContainText(
      "SPHEREx / NASA",
    );
  }
});
