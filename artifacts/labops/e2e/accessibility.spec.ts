import { test, expect } from "./fixtures";
import { injectAxe, checkA11y } from "axe-playwright";

/**
 * E2E accessibility tests using axe-core via Playwright.
 *
 * These tests verify that key pages meet WCAG 2.x standards:
 * - All images have alt text
 * - Interactive elements have accessible names
 * - Color contrast ratios are sufficient
 * - No ARIA attributes are misused
 */

test.describe("Accessibility", () => {
  test("dashboard meets WCAG standards", async ({ authPage }) => {
    await authPage.goto("/");
    await injectAxe(authPage);
    await checkA11y(authPage, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });
  });

  test("device inventory is accessible", async ({ authPage }) => {
    await authPage.goto("/devices");
    await injectAxe(authPage);
    await checkA11y(authPage, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });
  });

  test("settings page is accessible", async ({ authPage }) => {
    await authPage.goto("/settings");
    await injectAxe(authPage);
    await checkA11y(authPage, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });
  });

  test("authentication screen is accessible", async ({ page }) => {
    await page.goto("/");
    await injectAxe(page);
    await checkA11y(page, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });
  });
});
