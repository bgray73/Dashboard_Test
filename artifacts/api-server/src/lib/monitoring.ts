import { and, count, desc, eq, gte, lt, min } from "drizzle-orm";
import { applicationSettingsTable, db, devicesTable, incidentActivityTable, monitoringHistoryTable, monitoringIncidentsTable } from "@workspace/db";
import { logger } from "./logger";
import { performPing } from "./reachability";
import { calculateMonitoringState, isDeviceDue, retentionCutoff } from "./monitoring-policy";
import { incidentDurationSeconds } from "./availability-policy";
import { sendWebhook, type WebhookPayload } from "./webhook-notifications";
import { isDeviceInMaintenance } from "./maintenance-policy";

let polling = false;
let retentionCleanup: Promise<{ retentionDays: number; cutoff: string; completedAt: string; deletedRows: number }> | null = null;
let lastRetentionCleanup: { completedAt: string; deletedRows: number } | null = null;

async function retentionDays() {
  const [settings] = await db.select({ days: applicationSettingsTable.monitoringRetentionDays }).from(applicationSettingsTable).limit(1);
  return settings?.days ?? 30;
}

export async function getRetentionStatus() {
  const days = await retentionDays();
  const cutoff = retentionCutoff(Date.now(), days);
  const [[eligible], [retained]] = await Promise.all([
    db.select({ rows: count() }).from(monitoringHistoryTable).where(lt(monitoringHistoryTable.checkedAt, cutoff)),
    db.select({ rows: count(), oldestCheckAt: min(monitoringHistoryTable.checkedAt) }).from(monitoringHistoryTable).where(gte(monitoringHistoryTable.checkedAt, cutoff)),
  ]);
  return { retentionDays: days, cutoff: cutoff.toISOString(), eligibleRows: eligible.rows, retainedRows: retained.rows, oldestRetainedCheckAt: retained.oldestCheckAt, lastCleanup: lastRetentionCleanup };
}

export async function cleanupMonitoringHistory() {
  if (retentionCleanup) return retentionCleanup;
  retentionCleanup = (async () => {
    const days = await retentionDays();
    const cutoff = retentionCutoff(Date.now(), days);
    const [eligible] = await db.select({ rows: count() }).from(monitoringHistoryTable).where(lt(monitoringHistoryTable.checkedAt, cutoff));
    await db.delete(monitoringHistoryTable).where(lt(monitoringHistoryTable.checkedAt, cutoff));
    lastRetentionCleanup = { completedAt: new Date().toISOString(), deletedRows: eligible.rows };
    return { retentionDays: days, cutoff: cutoff.toISOString(), ...lastRetentionCleanup };
  })().finally(() => { retentionCleanup = null; });
  return retentionCleanup;
}

export async function recordDeviceCheck(device: typeof devicesTable.$inferSelect, timeoutSeconds: number, source: "manual" | "automated") {
  const result = await performPing(device.managementIp, timeoutSeconds);
  const { consecutiveFailures: failures, effectiveStatus } = calculateMonitoringState(result.status, device.consecutiveFailures);
  const checkedAt = new Date();
  const { updated, notifications } = await db.transaction(async (tx) => {
    const notifications: Array<{ payload: WebhookPayload; incidentId: number }> = [];
    const rows = await tx.update(devicesTable).set({
      lastStatus: effectiveStatus, lastCheckedAt: checkedAt, lastLatencyMs: result.latencyMs,
      consecutiveFailures: failures, updatedAt: checkedAt,
    }).where(eq(devicesTable.id, device.id)).returning();
    await tx.insert(monitoringHistoryTable).values({
      deviceId: device.id, checkedAt, status: effectiveStatus, latencyMs: result.latencyMs,
      errorMessage: result.status === "online" ? null : result.message, consecutiveFailures: failures, source,
    });
    if (!isDeviceInMaintenance(device, checkedAt) && effectiveStatus === "offline") {
      const [incident] = await tx.select().from(monitoringIncidentsTable)
        .where(and(eq(monitoringIncidentsTable.deviceId, device.id), eq(monitoringIncidentsTable.status, "open")))
        .orderBy(desc(monitoringIncidentsTable.startedAt)).limit(1);
      if (incident) {
        await tx.update(monitoringIncidentsTable).set({
          lastFailureAt: checkedAt,
          peakFailures: Math.max(incident.peakFailures, failures),
          errorMessage: result.message,
        }).where(eq(monitoringIncidentsTable.id, incident.id));
      } else {
        const [created] = await tx.insert(monitoringIncidentsTable).values({
          deviceId: device.id, startedAt: checkedAt, lastFailureAt: checkedAt,
          peakFailures: failures, errorMessage: result.message,
        }).returning();
        await tx.insert(incidentActivityTable).values({ incidentId: created.id, eventType: "opened", actor: "System", note: result.message, occurredAt: checkedAt });
        notifications.push({ incidentId: created.id, payload: {
          event: "incident.opened", occurredAt: checkedAt.toISOString(), incidentId: created.id,
          device: { id: device.id, hostname: device.hostname, managementIp: device.managementIp },
          incident: { status: created.status, startedAt: created.startedAt.toISOString(), peakFailures: created.peakFailures, errorMessage: created.errorMessage },
        } });
      }
    } else if (effectiveStatus === "online") {
      const openIncidents = await tx.select().from(monitoringIncidentsTable)
        .where(and(eq(monitoringIncidentsTable.deviceId, device.id), eq(monitoringIncidentsTable.status, "open")));
      for (const incident of openIncidents) {
        const durationSeconds = incidentDurationSeconds(incident.startedAt, checkedAt);
        await tx.update(monitoringIncidentsTable).set({
          status: "resolved", resolvedAt: checkedAt,
          durationSeconds,
          resolutionReason: "recovered",
        }).where(eq(monitoringIncidentsTable.id, incident.id));
        await tx.insert(incidentActivityTable).values({ incidentId: incident.id, eventType: "resolved", actor: "System", note: "Device recovered.", occurredAt: checkedAt });
        notifications.push({ incidentId: incident.id, payload: {
          event: "incident.resolved", occurredAt: checkedAt.toISOString(), incidentId: incident.id,
          device: { id: device.id, hostname: device.hostname, managementIp: device.managementIp },
          incident: { status: "resolved", startedAt: incident.startedAt.toISOString(), resolvedAt: checkedAt.toISOString(), durationSeconds, peakFailures: incident.peakFailures, errorMessage: incident.errorMessage, resolutionReason: "recovered" },
        } });
      }
    }
    return { updated: rows[0], notifications };
  });
  for (const notification of notifications) void sendWebhook(notification.payload, notification.incidentId).catch((error) => logger.warn({ err: error }, "Unable to record webhook delivery"));
  return { device: updated, ...result, status: effectiveStatus };
}

async function pollDueDevices(timeoutSeconds: number) {
  if (polling) return;
  polling = true;
  try {
    const now = new Date();
    const devices = await db.select().from(devicesTable).where(eq(devicesTable.monitoringEnabled, true));
    const maintained = devices.filter((device) => isDeviceInMaintenance(device, now));
    const due = devices.filter((device) => !isDeviceInMaintenance(device, now) && isDeviceDue(device.lastCheckedAt, device.monitoringIntervalSeconds, now.getTime()));
    await Promise.allSettled(maintained.map((device) => resolveIncidentsForMaintenance(device.id, now)));
    await Promise.allSettled(due.map((device) => recordDeviceCheck(device, timeoutSeconds, "automated")));
  } finally { polling = false; }
}

export async function resolveIncidentsForMaintenance(deviceId: number, resolvedAt = new Date()) {
  const incidents = await db.select().from(monitoringIncidentsTable)
    .where(and(eq(monitoringIncidentsTable.deviceId, deviceId), eq(monitoringIncidentsTable.status, "open")));
  for (const incident of incidents) {
    await db.transaction(async (tx) => {
      await tx.update(monitoringIncidentsTable).set({
        status: "resolved", resolvedAt,
        durationSeconds: incidentDurationSeconds(incident.startedAt, resolvedAt),
        resolutionReason: "maintenance",
      }).where(eq(monitoringIncidentsTable.id, incident.id));
      await tx.insert(incidentActivityTable).values({ incidentId: incident.id, eventType: "resolved", actor: "System", note: "Resolved for maintenance.", occurredAt: resolvedAt });
    });
  }
}

export function startMonitoring(getTimeoutSeconds: () => Promise<number>) {
  const tick = () => void getTimeoutSeconds().then(pollDueDevices).catch((error) => logger.error({ err: error }, "Monitoring poll failed"));
  tick();
  const pollTimer = setInterval(tick, 10_000);
  pollTimer.unref();
  const cleanup = () => void cleanupMonitoringHistory().catch((error) => logger.error({ err: error }, "Monitoring retention cleanup failed"));
  cleanup();
  const cleanupTimer = setInterval(cleanup, 86_400_000);
  cleanupTimer.unref();
}
