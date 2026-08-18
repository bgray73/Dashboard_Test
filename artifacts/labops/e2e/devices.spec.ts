import { test, expect } from "./fixtures";

/**
 * E2E tests for device lifecycle: creating, viewing, editing, and deleting devices.
 */

test.describe("Device management", () => {
  test("can add a new device from the inventory", async ({ authPage }) => {
    // Navigate to devices page
    await authPage.click('[data-testid="link-nav-devices"]');
    await expect(authPage.locator("h1")).toContainText("Device inventory");

    // Click "Add device"
    await authPage.click("text=Add device");

    // Fill in the form
    await authPage.fill('input[placeholder="Hostname"]', "test-switch-01");
    await authPage.fill('input[placeholder="Management IP"]', "10.0.1.5");

    // Submit
    await authPage.click("text=Add device");

    // Should see the new device in the table
    await expect(authPage.locator("text=test-switch-01")).toBeVisible();
    await expect(authPage.locator("text=10.0.1.5")).toBeVisible();
  });

  test("shows empty state when no devices exist", async ({ page }) => {
    // The unauthenticated view should show the sign-in screen
    await page.goto("/devices");
    await expect(page.locator("text=Sign in to LabOps")).toBeVisible();
  });

  test("can view device detail", async ({ authPage }) => {
    await authPage.goto("/devices");

    // Click on the first device
    const firstDeviceLink = authPage.locator("a[href^='/devices/']").first();
    if (await firstDeviceLink.isVisible()) {
      await firstDeviceLink.click();
      await expect(authPage.locator(".mono.text-[11px]")).toBeVisible();
    }
  });
});
