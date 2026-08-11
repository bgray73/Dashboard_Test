import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateMonitoringState, isDeviceDue, retentionCutoff } from "./monitoring-policy";
import { pingArguments } from "./reachability";
import { availabilityForWindow, incidentDurationSeconds } from "./availability-policy";
import { isAllowedWebhookUrl } from "./webhook-policy";

describe("monitoring state policy", () => {
  it("keeps the first two failures unknown", () => {
    assert.deepEqual(calculateMonitoringState("offline", 0), { consecutiveFailures: 1, effectiveStatus: "unknown" });
    assert.deepEqual(calculateMonitoringState("offline", 1), { consecutiveFailures: 2, effectiveStatus: "unknown" });
  });

  it("marks the third consecutive failure offline", () => {
    assert.deepEqual(calculateMonitoringState("offline", 2), { consecutiveFailures: 3, effectiveStatus: "offline" });
  });

  it("resets failures after recovery", () => {
    assert.deepEqual(calculateMonitoringState("online", 7), { consecutiveFailures: 0, effectiveStatus: "online" });
  });

  it("does not count unavailable ICMP as a device failure", () => {
    assert.deepEqual(calculateMonitoringState("unknown", 2), { consecutiveFailures: 2, effectiveStatus: "unknown" });
  });
});

describe("poll scheduling policy", () => {
  const now = Date.parse("2026-08-10T12:00:00Z");

  it("polls devices that have never been checked", () => assert.equal(isDeviceDue(null, 60, now), true));
  it("waits until the configured interval", () => assert.equal(isDeviceDue(new Date(now - 59_999), 60, now), false));
  it("polls at the interval boundary", () => assert.equal(isDeviceDue(new Date(now - 60_000), 60, now), true));
  it("calculates a deterministic retention cutoff", () => assert.equal(retentionCutoff(now, 30).toISOString(), "2026-07-11T12:00:00.000Z"));
});

describe("ping platform arguments", () => {
  it("uses a millisecond timeout without Linux-only IPv4 flags on macOS", () => {
    assert.deepEqual(pingArguments("127.0.0.1", 5, "darwin"), ["-c", "1", "-W", "5000", "127.0.0.1"]);
  });

  it("uses seconds for Linux iputils", () => {
    assert.deepEqual(pingArguments("127.0.0.1", 5, "linux"), ["-4", "-c", "1", "-W", "5", "127.0.0.1"]);
  });

  it("uses Windows timeout syntax", () => {
    assert.deepEqual(pingArguments("127.0.0.1", 5, "win32"), ["-n", "1", "-w", "5000", "127.0.0.1"]);
  });
});

describe("availability and incident policy", () => {
  const now = new Date("2026-08-10T12:00:00Z");
  const samples = [
    { status: "online", checkedAt: new Date("2026-08-10T11:00:00Z") },
    { status: "online", checkedAt: new Date("2026-08-10T11:01:00Z") },
    { status: "offline", checkedAt: new Date("2026-08-10T11:02:00Z") },
    { status: "unknown", checkedAt: new Date("2026-08-10T11:03:00Z") },
    { status: "online", checkedAt: new Date("2026-07-01T11:00:00Z") },
  ];

  it("calculates availability from observed online and offline checks", () => {
    assert.deepEqual(availabilityForWindow(samples, new Date(now.getTime() - 86_400_000)), {
      percentage: 66.67, onlineChecks: 2, offlineChecks: 1, observedChecks: 3,
    });
  });

  it("returns null when a window has no observed checks", () => {
    assert.equal(availabilityForWindow([], new Date(now.getTime() - 86_400_000)).percentage, null);
  });

  it("calculates a non-negative incident duration", () => {
    assert.equal(incidentDurationSeconds(new Date("2026-08-10T11:00:00Z"), now), 3600);
    assert.equal(incidentDurationSeconds(now, new Date("2026-08-10T11:00:00Z")), 0);
  });
});

describe("webhook URL policy", () => {
  it("allows HTTPS and local HTTP development endpoints", () => {
    assert.equal(isAllowedWebhookUrl("https://hooks.example.com/labops"), true);
    assert.equal(isAllowedWebhookUrl("http://localhost:9000/hook"), true);
  });

  it("rejects insecure remote and non-HTTP destinations", () => {
    assert.equal(isAllowedWebhookUrl("http://example.com/hook"), false);
    assert.equal(isAllowedWebhookUrl("file:///tmp/hook"), false);
    assert.equal(isAllowedWebhookUrl("not-a-url"), false);
  });
});
