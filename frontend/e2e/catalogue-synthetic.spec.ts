import { test, expect } from "@playwright/test";

test("synthetic development images explicitly disable real catalogue overlays", async ({
  page,
}) => {
  test.skip(
    !process.env.SKYTRACE_TEST_DEMO,
    "Explicit synthetic development mode only",
  );
  await page.goto("/explore");
  await expect(page.getByRole("checkbox", { name: "Gaia DR3" })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: /WISE/ })).toBeDisabled();
  await expect(
    page.getByText(
      "Real catalogue overlays are disabled for synthetic fields.",
    ),
  ).toBeVisible();
  await expect(page.locator(".catalogue-marker")).toHaveCount(0);
  await expect(page.locator(".synthetic-watermark")).toContainText("SYNTHETIC");
});
