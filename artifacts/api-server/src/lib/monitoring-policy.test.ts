import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateMonitoringState, isDeviceDue, isRetentionPreviewCurrent, isValidRetentionDays, retentionCutoff } from "./monitoring-policy";
import { pingArguments } from "./reachability";
import { availabilityForWindow, availabilityReport, incidentDurationSeconds } from "./availability-policy";
import { isAllowedWebhookUrl } from "./webhook-policy";
import { isWebhookRetryDue, nextWebhookAttempt } from "./webhook-retry-policy";
import { isDeviceInMaintenance, isScheduledMaintenanceActive } from "./maintenance-policy";
import { toCsv } from "./csv";

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
  it("accepts retention from 30 through 365 days", () => {
    assert.equal(isValidRetentionDays(30), true);
    assert.equal(isValidRetentionDays(365), true);
    assert.equal(isValidRetentionDays(29), false);
    assert.equal(isValidRetentionDays(365.5), false);
  });
  it("requires cleanup to match the previewed retention", () => {
    assert.equal(isRetentionPreviewCurrent(30, 30), true);
    assert.equal(isRetentionPreviewCurrent(45, 30), false);
    assert.equal(isRetentionPreviewCurrent(29, 29), false);
  });
});

describe("maintenance scheduling policy", () => {
  const now = new Date("2026-08-10T12:00:00Z");

  it("honors the independent manual maintenance override", () => {
    assert.equal(isDeviceInMaintenance({ maintenanceMode: true }, now), true);
  });

  it("activates a scheduled window at its start and before its end", () => {
    const device = { maintenanceMode: false, maintenanceStartsAt: new Date("2026-08-10T12:00:00Z"), maintenanceEndsAt: new Date("2026-08-10T13:00:00Z") };
    assert.equal(isScheduledMaintenanceActive(device, now), true);
    assert.equal(isScheduledMaintenanceActive(device, new Date("2026-08-10T12:59:59Z")), true);
  });

  it("automatically leaves maintenance at the end boundary", () => {
    const device = { maintenanceMode: false, maintenanceStartsAt: new Date("2026-08-10T11:00:00Z"), maintenanceEndsAt: new Date("2026-08-10T12:00:00Z") };
    assert.equal(isDeviceInMaintenance(device, now), false);
  });

  it("does not activate future or incomplete windows", () => {
    assert.equal(isDeviceInMaintenance({ maintenanceMode: false, maintenanceStartsAt: new Date("2026-08-10T13:00:00Z"), maintenanceEndsAt: new Date("2026-08-10T14:00:00Z") }, now), false);
    assert.equal(isDeviceInMaintenance({ maintenanceMode: false, maintenanceStartsAt: now }, now), false);
  });

  it("accepts ISO timestamps returned by PostgreSQL drivers", () => {
    assert.equal(isDeviceInMaintenance({ maintenanceMode: false, maintenanceStartsAt: "2026-08-10T11:00:00.000Z", maintenanceEndsAt: "2026-08-10T13:00:00.000Z" }, now), true);
  });
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

  it("builds independent per-device availability windows", () => {
    const now = new Date("2026-08-12T12:00:00Z");
    const report = availabilityReport(
      [{ id: 1, hostname: "router-01", lastStatus: "online", monitoringEnabled: true }, { id: 2, hostname: "server-01", lastStatus: "unknown", monitoringEnabled: false }],
      [{ deviceId: 1, status: "online", checkedAt: new Date("2026-08-12T11:00:00Z") }, { deviceId: 1, status: "offline", checkedAt: new Date("2026-08-10T11:00:00Z") }],
      now,
    );
    assert.equal(report[0].availability24h.percentage, 100);
    assert.equal(report[0].availability7d.percentage, 50);
    assert.equal(report[1].availability30d.percentage, null);
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

describe("webhook retry policy", () => {
  const attemptedAt = new Date("2026-08-10T12:00:00Z");

  it("uses bounded one-minute and five-minute retry delays", () => {
    assert.equal(nextWebhookAttempt(1, attemptedAt)?.toISOString(), "2026-08-10T12:01:00.000Z");
    assert.equal(nextWebhookAttempt(2, attemptedAt)?.toISOString(), "2026-08-10T12:05:00.000Z");
    assert.equal(nextWebhookAttempt(3, attemptedAt), null);
  });

  it("runs only due retrying deliveries below the attempt limit", () => {
    const dueAt = new Date("2026-08-10T12:01:00Z");
    const now = new Date("2026-08-10T12:01:01Z");
    assert.equal(isWebhookRetryDue("retrying", 1, dueAt, now), true);
    assert.equal(isWebhookRetryDue("delivered", 1, dueAt, now), false);
    assert.equal(isWebhookRetryDue("retrying", 3, dueAt, now), false);
  });
});

describe("CSV export policy", () => {
  it("escapes delimiters, quotes, and newlines", () => {
    assert.equal(toCsv(["name"], [["router, \"core\"\nlab"]]), "name\r\n\"router, \"\"core\"\"\nlab\"\r\n");
  });

  it("neutralizes spreadsheet formulas", () => {
    assert.equal(toCsv(["value"], [["=1+1"], ["@SUM(A1:A2)"]]), "value\r\n'=1+1\r\n'@SUM(A1:A2)\r\n");
  });
});
