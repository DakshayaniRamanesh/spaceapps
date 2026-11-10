import { test, expect } from "@playwright/test";
test("landing, target navigation and all comparison modes", async ({
  page,
}) => {
  test.skip(
    !process.env.SKYTRACE_TEST_DEMO,
    "Requires explicit development demo setting",
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /THE SKY IS.*NEVER STILL\./ }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/landing-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Explore Barnard's Star", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Next frame", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".frame-thumb")).toHaveCount(8);
  const viewer = page.locator(".observation-image");
  const original = await viewer.getAttribute("src");
  await page.getByRole("button", { name: "Next frame", exact: true }).click();
  await expect(viewer).not.toHaveAttribute("src", original!);
  await page
    .getByRole("button", { name: "Play observations", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause playback" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause playback" }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator(".zoom-controls")).toContainText("150%");
  await page.getByRole("button", { name: "Fit to view", exact: true }).click();
  await expect(page.locator(".zoom-controls")).toContainText("100%");
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  await expect(viewer).toHaveCount(2);
  await page.getByRole("button", { name: "Difference", exact: true }).click();
  await expect(viewer).toHaveAttribute("src", /\/api\/difference/);
  await expect
    .poll(() =>
      viewer.evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBe(384);
  await page.getByRole("button", { name: "Blink", exact: true }).click();
  await page.getByRole("button", { name: "Start blink", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause blink", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause blink", exact: true }).click();
  await page.getByRole("button", { name: "Single frame", exact: true }).click();
  await page.screenshot({
    path: `test-results/explorer-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("URL state, invalid input, detector and FOV", async ({ page }) => {
  test.skip(
    !process.env.SKYTRACE_TEST_DEMO,
    "Requires explicit development demo setting",
  );
  await page.goto("/explore?ra=133.79512917&dec=-7.24514722&fov=6&detector=D6");
  await expect(
    page.getByRole("button", { name: "Next frame", exact: true }),
  ).toBeEnabled();
  if (!(await page.getByLabel("Right ascension").isVisible()))
    await page.getByText("Observation controls", { exact: true }).click();
  await expect(page.getByLabel("Field of view")).toHaveValue("6");
  await expect(
    page.getByRole("button", { name: "D6", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  let apiCalls = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/observations")) apiCalls++;
  });
  await page.getByLabel("Right ascension").fill("360");
  await page
    .getByRole("button", { name: "Load observations", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("less than 360");
  expect(apiCalls).toBe(0);
  await page.getByLabel("Right ascension").fill("130");
  await page.getByLabel("Field of view").selectOption("24");
  await page.getByRole("button", { name: "D3", exact: true }).click();
  await page
    .getByRole("button", { name: "Load observations", exact: true })
    .click();
  await expect(page).toHaveURL(/ra=130&dec=-7.245147&fov=24&detector=D3/);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("reduced motion and mobile story remain usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /THE SKY IS.*NEVER STILL\./ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Story epoch 8", exact: true })
    .click();
  await expect(page.locator(".moving-label")).toContainText("Moment 08");
  await page.getByRole("button", { name: "D6", exact: true }).click();
  await expect(page.locator(".wavelength-number")).toContainText("4.42–5.00");
});
