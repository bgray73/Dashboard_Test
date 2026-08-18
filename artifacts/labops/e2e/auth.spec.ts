import { test, expect } from "./fixtures";

/**
 * E2E tests for authentication flows: login and logout.
 *
 * These tests verify that the auth gate correctly displays the sign-in
 * screen when no session is present, and transitions to the authenticated
 * state when a session exists.
 */

test.describe("Authentication", () => {
  test("shows sign-in screen when unauthenticated", async ({ page }) => {
    await page.goto("/");

    // Should show the auth screen with sign-in button
    await expect(page.locator("text=Sign in to LabOps")).toBeVisible();
    await expect(page.locator("a[href='/api/auth/login']")).toBeVisible();
    await expect(page.locator("a[href='/api/auth/login']")).toHaveText("Sign in");
  });

  test("shows authenticated workspace when session is valid", async ({ authPage }) => {
    // Should see the main navigation and dashboard content
    await expect(authPage.locator("text=LABOPS")).toBeVisible();
    await expect(authPage.locator("h1")).toContainText("Dashboard");
  });

  test("can open settings and see preferences", async ({ authPage }) => {
    await authPage.click('[data-testid="link-settings"]');
    await expect(authPage.locator("h1")).toContainText("Settings");
    await expect(authPage.locator("text=Application name")).toBeVisible();
    await expect(authPage.locator("text=Webhook URL")).toBeVisible();
  });

  test("can navigate between main sections", async ({ authPage }) => {
    // Navigate to devices
    await authPage.click('[data-testid="link-nav-devices"]');
    await expect(authPage.locator("h1")).toContainText("Device inventory");

    // Navigate to monitoring
    await authPage.click('[data-testid="link-nav-monitoring"]');
    await expect(authPage.locator("h1")).toContainText("Monitoring");

    // Navigate to reports
    await authPage.click('[data-testid="link-nav-reports"]');
    await expect(authPage.locator("h1")).toContainText("Operational reports");

    // Navigate to config generator
    await authPage.click('[data-testid="link-nav-config-generator"]');
    await expect(authPage.locator("h1")).toContainText("Configuration generator");

    // Navigate to tools
    await authPage.click('[data-testid="link-nav-network-tools"]');
    await expect(authPage.locator("h1")).toContainText("Network tools");
  });
});
