import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateRouteRole,
  createAuthorizationMiddleware,
  routeRequiresRole,
  type Role,
} from "./authorization";

describe("Phase 19 authorization", () => {
  describe("routeRequiresRole", () => {
    it("returns public for healthz endpoint", () => {
      assert.equal(routeRequiresRole("/api/healthz", "GET"), "public");
    });

    it("returns public for auth endpoints", () => {
      const authRoutes = [
        "/api/auth/login",
        "/api/auth/callback",
        "/api/auth/me",
        "/api/auth/logout",
      ];
      for (const route of authRoutes) {
        assert.equal(routeRequiresRole(route, "GET"), "public");
        assert.equal(routeRequiresRole(route, "POST"), "public");
      }
    });

    it("returns viewer for dashboard summary", () => {
      assert.equal(routeRequiresRole("/api/dashboard/summary", "GET"), "viewer");
    });

    it("returns viewer for reports", () => {
      const reportRoutes = [
        "/api/reports/summary",
        "/api/reports/availability",
        "/api/reports/devices.csv",
      ];
      for (const route of reportRoutes) {
        assert.equal(routeRequiresRole(route, "GET"), "viewer");
      }
    });

    it("returns operator for incident acknowledgment", () => {
      assert.equal(
        routeRequiresRole("/api/incidents/1/acknowledgment", "PATCH"),
        "operator",
      );
    });

    it("returns administrator for settings mutations", () => {
      assert.equal(routeRequiresRole("/api/settings", "PATCH"), "administrator");
    });

    it("returns viewer for devices list", () => {
      assert.equal(routeRequiresRole("/api/devices", "GET"), "viewer");
    });

    it("returns operator for device ping", () => {
      assert.equal(
        routeRequiresRole("/api/devices/1/ping", "POST"),
        "operator",
      );
    });

    it("parameterized routes inherit role from prefix", () => {
      assert.equal(
        routeRequiresRole("/api/devices/123", "GET"),
        "viewer",
      );
      assert.equal(
        routeRequiresRole("/api/incidents/456/activity", "GET"),
        "viewer",
      );
    });
  });

  describe("aggregateRouteRole", () => {
    it("returns correct aggregated roles for all protected routes", () => {
      const routes = [
        { path: "/api/dashboard/summary", method: "GET", expected: "viewer" },
        { path: "/api/dashboard/recent-status", method: "GET", expected: "viewer" },
        { path: "/api/devices", method: "GET", expected: "viewer" },
        { path: "/api/devices", method: "POST", expected: "administrator" },
        { path: "/api/devices/1", method: "GET", expected: "viewer" },
        { path: "/api/devices/1", method: "PATCH", expected: "administrator" },
        { path: "/api/devices/1", method: "DELETE", expected: "administrator" },
        { path: "/api/settings", method: "GET", expected: "viewer" },
        { path: "/api/settings", method: "PATCH", expected: "administrator" },
        { path: "/api/saved-configurations", method: "POST", expected: "administrator" },
      ];

      for (const { path, method, expected } of routes) {
        assert.equal(
          aggregateRouteRole(path, method),
          expected,
          `${method} ${path} should require ${expected}`,
        );
      }
    });
  });
});