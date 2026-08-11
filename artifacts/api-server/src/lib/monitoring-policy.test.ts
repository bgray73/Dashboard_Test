import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateMonitoringState, isDeviceDue, retentionCutoff } from "./monitoring-policy";

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
