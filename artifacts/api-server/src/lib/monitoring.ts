import { and, desc, eq, lt } from "drizzle-orm";
import { db, devicesTable, monitoringHistoryTable, monitoringIncidentsTable } from "@workspace/db";
import { logger } from "./logger";
import { performPing } from "./reachability";
import { calculateMonitoringState, isDeviceDue, retentionCutoff } from "./monitoring-policy";
import { incidentDurationSeconds } from "./availability-policy";

const RETENTION_DAYS = Math.max(1, Number(process.env.MONITORING_RETENTION_DAYS) || 30);
let polling = false;

export async function recordDeviceCheck(device: typeof devicesTable.$inferSelect, timeoutSeconds: number, source: "manual" | "automated") {
  const result = await performPing(device.managementIp, timeoutSeconds);
  const { consecutiveFailures: failures, effectiveStatus } = calculateMonitoringState(result.status, device.consecutiveFailures);
  const checkedAt = new Date();
  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx.update(devicesTable).set({
      lastStatus: effectiveStatus, lastCheckedAt: checkedAt, lastLatencyMs: result.latencyMs,
      consecutiveFailures: failures, updatedAt: checkedAt,
    }).where(eq(devicesTable.id, device.id)).returning();
    await tx.insert(monitoringHistoryTable).values({
      deviceId: device.id, checkedAt, status: effectiveStatus, latencyMs: result.latencyMs,
      errorMessage: result.status === "online" ? null : result.message, consecutiveFailures: failures, source,
    });
    if (!device.maintenanceMode && effectiveStatus === "offline") {
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
        await tx.insert(monitoringIncidentsTable).values({
          deviceId: device.id, startedAt: checkedAt, lastFailureAt: checkedAt,
          peakFailures: failures, errorMessage: result.message,
        });
      }
    } else if (effectiveStatus === "online") {
      const openIncidents = await tx.select().from(monitoringIncidentsTable)
        .where(and(eq(monitoringIncidentsTable.deviceId, device.id), eq(monitoringIncidentsTable.status, "open")));
      for (const incident of openIncidents) {
        await tx.update(monitoringIncidentsTable).set({
          status: "resolved", resolvedAt: checkedAt,
          durationSeconds: incidentDurationSeconds(incident.startedAt, checkedAt),
          resolutionReason: "recovered",
        }).where(eq(monitoringIncidentsTable.id, incident.id));
      }
    }
    return rows;
  });
  return { device: updated, ...result, status: effectiveStatus };
}

async function pollDueDevices(timeoutSeconds: number) {
  if (polling) return;
  polling = true;
  try {
    const now = Date.now();
    const devices = await db.select().from(devicesTable).where(and(eq(devicesTable.monitoringEnabled, true), eq(devicesTable.maintenanceMode, false)));
    const due = devices.filter((device) => isDeviceDue(device.lastCheckedAt, device.monitoringIntervalSeconds, now));
    await Promise.allSettled(due.map((device) => recordDeviceCheck(device, timeoutSeconds, "automated")));
  } finally { polling = false; }
}

export async function resolveIncidentsForMaintenance(deviceId: number, resolvedAt = new Date()) {
  const incidents = await db.select().from(monitoringIncidentsTable)
    .where(and(eq(monitoringIncidentsTable.deviceId, deviceId), eq(monitoringIncidentsTable.status, "open")));
  for (const incident of incidents) {
    await db.update(monitoringIncidentsTable).set({
      status: "resolved", resolvedAt,
      durationSeconds: incidentDurationSeconds(incident.startedAt, resolvedAt),
      resolutionReason: "maintenance",
    }).where(eq(monitoringIncidentsTable.id, incident.id));
  }
}

export function startMonitoring(getTimeoutSeconds: () => Promise<number>) {
  const tick = () => void getTimeoutSeconds().then(pollDueDevices).catch((error) => logger.error({ err: error }, "Monitoring poll failed"));
  tick();
  const pollTimer = setInterval(tick, 10_000);
  pollTimer.unref();
  const cleanup = () => void db.delete(monitoringHistoryTable).where(lt(monitoringHistoryTable.checkedAt, retentionCutoff(Date.now(), RETENTION_DAYS))).catch((error) => logger.error({ err: error }, "Monitoring retention cleanup failed"));
  cleanup();
  const cleanupTimer = setInterval(cleanup, 86_400_000);
  cleanupTimer.unref();
}
