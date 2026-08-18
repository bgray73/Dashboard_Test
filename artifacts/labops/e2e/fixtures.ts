import { test as base, type Page } from "@playwright/test";
import type { AuthState } from "./src/components/auth-gate";

/**
 * Custom test fixtures for LabOps E2E tests.
 *
 * The `authPage` fixture provides a pre-authenticated page session by
 * injecting an authenticated AuthState into localStorage before navigation.
 * This avoids hitting a real OIDC provider in tests.
 */
export interface LabOpsFixtures {
  authPage: Page;
}

export const test = base.extend<LabOpsFixtures>({
  authPage: async ({ page }, use) => {
    // Inject an authenticated session into localStorage before the app boots.
    // The AuthGate component reads from localStorage on first load.
    const authState: AuthState = { status: "authenticated", user: { id: 1, displayName: "Test Operator" } };
    await page.addInitScript(() => {
      window.localStorage.setItem("labops:auth-user", JSON.stringify({ id: 1, displayName: "Test Operator" }));
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await use(page);
  },
});

export { expect } from "@playwright/test";
