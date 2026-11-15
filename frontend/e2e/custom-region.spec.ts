import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  test.skip(!!process.env.SKYTRACE_TEST_DEMO, "Real provider workflow");
  await page.route("**/health", (route) =>
    route.fulfill({
      json: { status: "ok", source: "spherex-irsa", real_data_enabled: true },
    }),
  );
  await page.route("**/api/observation-jobs", (route) =>
    route.fulfill({
      json: {
        job_id: "custom",
        status: "ready",
        stage: "Complete",
        result_url: "/api/observation-sets/custom-test",
        cache_hit: true,
      },
    }),
  );
  await page.route("**/api/observation-sets/custom-test", (route) =>
    route.fulfill({
      json: {
        source_type: "spherex-irsa",
        dataset_id: "custom-test",
        frames: [],
        warnings: [],
        notice: "No archive exposures cover this coordinate.",
        availability: "no_coverage",
        search_complete: true,
      },
    }),
  );
  await page.goto("/explore");
  if (!(await page.getByLabel("Target preset").isVisible()))
    await page.getByText("Observation controls", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Check for observations", exact: true }),
  ).toBeEnabled();
});

test("custom selection stays selected, submits a precise region and restores from URL", async ({
  page,
}) => {
  const target = page.getByLabel("Target preset");
  const ra = page.getByLabel("Right ascension");
  const originalRa = await ra.inputValue();
  const posts: Record<string, unknown>[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("observation-jobs")
    )
      posts.push(request.postDataJSON());
  });
  await target.selectOption("");
  await expect(target).toHaveValue("");
  await expect(ra).toBeFocused();
  await expect(ra).toHaveValue(originalRa);
  await expect(page.locator("#custom-region-help")).toBeVisible();
  expect(posts).toHaveLength(0);
  await ra.fill("31.125");
  await page.getByLabel("Declination").fill("-10.5");
  await page.getByLabel("Field of view").fill("7.5");
  await page.getByRole("button", { name: "D2", exact: true }).click();
  await page
    .getByRole("button", { name: "Check for observations", exact: true })
    .click();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toMatchObject({
    ra: 31.125,
    dec: -10.5,
    fov_arcmin: 7.5,
    detector: "D2",
  });
  await expect(page).toHaveURL(/ra=31.125&dec=-10.5&fov=7.5&detector=D2/);
  await expect(target).toHaveValue("");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("custom-region.png"),
    fullPage: true,
  });
  await expect(
    page.getByRole("heading", { name: /Sky Explorer.*Custom field/ }),
  ).toBeVisible();
  await page.reload();
  if (!(await target.isVisible()))
    await page.getByText("Observation controls", { exact: true }).click();
  await expect(target).toHaveValue("");
  await expect(ra).toHaveValue("31.125");
  await expect(page.getByLabel("Field of view")).toHaveValue("7.5");
  await expect(
    page.getByRole("button", { name: "Check for observations", exact: true }),
  ).toBeEnabled();
  await target.selectOption("barnard");
  await expect(target).toHaveValue("barnard");
  await page.getByRole("button", { name: "Reset field" }).click();
  await expect(target).toHaveValue("r-dra");
});

test("custom region rejects blank coordinates and out-of-range coordinates and sizes", async ({
  page,
}) => {
  let posts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("observation-jobs")
    )
      posts++;
  });
  await page.getByLabel("Target preset").selectOption("");
  for (const [label, value, message, valid] of [
    ["Right ascension", "", "less than 360", "0"],
    ["Right ascension", "360", "less than 360", "0"],
    ["Declination", "-91", "−90° and +90°", "-90"],
    ["Field of view", "30.1", "between 2 and 30", "2"],
    ["Field of view", "", "between 2 and 30", "2"],
  ]) {
    await page.getByLabel(label).fill(value);
    await page
      .getByRole("button", { name: "Check for observations", exact: true })
      .click();
    await expect(page.locator("#field-error")).toContainText(message);
    await page.getByLabel(label).fill(valid);
  }
  expect(posts).toBe(0);
  await page
    .getByRole("button", { name: "Check for observations", exact: true })
    .click();
  await expect.poll(() => posts).toBe(1);
  await expect(page).toHaveURL(/ra=0&dec=-90&fov=2/);
});
