import { test, expect } from "@playwright/test";

test("lasso, mask and manual tracking coexist on the registered real preview", async ({
  page,
}) => {
  test.skip(!!process.env.SKYTRACE_TEST_DEMO, "Real WCS preview integration");
  await page.goto("/explore");
  await expect(page.locator(".frame-thumb")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Share field", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(() =>
      page
        .locator(".observation-image")
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(
    page.getByRole("button", { name: "Difference", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Lasso select region" }).click();
  const canvas = page.locator(".registered-image");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
  await page.mouse.down();
  for (const [u, v] of [
    [0.6, 0.25],
    [0.6, 0.6],
    [0.25, 0.6],
    [0.25, 0.25],
  ])
    await page.mouse.move(box.x + box.width * u, box.y + box.height * v, {
      steps: 4,
    });
  await page.mouse.up();
  await expect(
    page.getByRole("group", { name: "Selected region" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zoom to region" }).click();
  await expect(page.locator(".zoom-controls")).not.toContainText("100%");
  await page.getByRole("button", { name: "Clear region", exact: true }).click();
  await page
    .getByRole("button", { name: "Toggle data quality mask overlay" })
    .click();
  await expect(page.locator(".observation-image")).toHaveAttribute(
    "src",
    /overlay=mask/,
  );
  await expect(page.locator(".viewer-loading")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Toggle data quality mask overlay" })
    .click();
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  await page.getByRole("button", { name: "Track celestial motion" }).click();
  const canvases = page.locator(".registered-image");
  await canvases.nth(0).click({ position: { x: 40, y: 55 } });
  await canvases.nth(1).click({ position: { x: 60, y: 65 } });
  const tracker = page.getByRole("group", { name: "Celestial motion tracker" });
  await expect(tracker).toContainText("Manual displacement estimate");
  await expect(tracker).toContainText("do not establish source identity");
  await expect(page.getByRole("checkbox", { name: "Gaia DR3" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.screenshot({
    path: `test-results/combined-tools-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("spectral and date filters work on bundled previews without an upstream search", async ({
  page,
}) => {
  test.skip(
    !!process.env.SKYTRACE_TEST_DEMO,
    "Real cached preview integration",
  );
  await page.goto("/explore");
  await expect(page.locator(".frame-thumb")).toHaveCount(2);
  if (!(await page.locator("#ra").isVisible()))
    await page.locator(".controls summary").click();
  await page.getByLabel("Minimum λ").fill("1.8");
  await page.getByLabel("Maximum λ").fill("1.9");
  await page.locator("#start").fill("2025-01-01");
  await page.locator("#end").fill("2025-12-31");
  await page
    .getByRole("button", { name: "Check for observations", exact: true })
    .click();
  await expect(page.locator(".frame-thumb")).toHaveCount(1);
  await page.locator(".science-passport summary").click();
  await expect(
    page.getByText("Filtered cached SPHEREx preview.", { exact: false }),
  ).toBeVisible();
  await expect(page).toHaveURL(/min_wavelength_um=1.8/);
});
