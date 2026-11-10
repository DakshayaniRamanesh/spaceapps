import { test, expect } from "@playwright/test";
test.beforeEach(() =>
  test.skip(!!process.env.SKYTRACE_TEST_DEMO, "Default production state only"),
);
test("default explorer never requests synthetic observations and shares field settings", async ({
  page,
}) => {
  const observationRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/observations"))
      observationRequests.push(request.url());
  });
  await page.goto("/explore?ra=133.79512917&dec=-7.24514722&fov=6&detector=D6");
  await expect(
    page.getByRole("heading", { name: "OBSERVATORY READY." }),
  ).toBeVisible();
  await expect(
    page.getByText("Awaiting a validated observation source"),
  ).toBeVisible();
  for (const name of [
    "Play observations",
    "Next frame",
    "Blink",
    "Difference",
    "Zoom in",
  ])
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
  await expect(page.locator(".observation-image")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Share field" })).toBeEnabled();
  if (!(await page.getByLabel("Right ascension").isVisible()))
    await page.getByText("Observation controls", { exact: true }).click();
  await expect(page.getByLabel("Right ascension")).toHaveValue("133.79512917");
  await page.getByLabel("Right ascension").fill("130");
  await page.getByRole("button", { name: "Check for observations" }).click();
  await expect(page).toHaveURL(/ra=130&dec=-7.24514722&fov=6&detector=D6/);
  await expect(
    page.getByText("Awaiting a validated observation source"),
  ).toBeVisible();
  expect(observationRequests).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/ready-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("landing scrolls forward and backward without hidden final sections", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  for (const selector of [
    ".hero-journey",
    ".motion-story",
    ".infrared-section",
    ".observatory-bridge",
    ".targets-gallery",
  ]) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    await expect(page.locator(selector)).toBeVisible();
  }
  await page.getByRole("button", { name: "WISE 0855", exact: false }).click();
  await expect(
    page.getByRole("link", { name: "Explore WISE 0855", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(
    page.getByRole("heading", { name: /THE SKY IS.*NEVER STILL/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `test-results/landing-${test.info().project.name}.png`,
    fullPage: true,
  });
});
