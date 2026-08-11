import { eq, lt } from "drizzle-orm";
import { db, devicesTable, monitoringHistoryTable } from "@workspace/db";
import { logger } from "./logger";
import { performPing } from "./reachability";

const FAILURE_THRESHOLD = 3;
const RETENTION_DAYS = Math.max(1, Number(process.env.MONITORING_RETENTION_DAYS) || 30);
let polling = false;

export async function recordDeviceCheck(device: typeof devicesTable.$inferSelect, timeoutSeconds: number, source: "manual" | "automated") {
  const result = await performPing(device.managementIp, timeoutSeconds);
  const failures = result.status === "online" ? 0 : result.status === "offline" ? device.consecutiveFailures + 1 : device.consecutiveFailures;
  const effectiveStatus = result.status === "offline" && failures < FAILURE_THRESHOLD ? "unknown" : result.status;
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
    return rows;
  });
  return { device: updated, ...result, status: effectiveStatus };
}

async function pollDueDevices(timeoutSeconds: number) {
  if (polling) return;
  polling = true;
  try {
    const now = Date.now();
    const devices = await db.select().from(devicesTable).where(eq(devicesTable.monitoringEnabled, true));
    const due = devices.filter((device) => !device.lastCheckedAt || now - device.lastCheckedAt.getTime() >= device.monitoringIntervalSeconds * 1000);
    await Promise.allSettled(due.map((device) => recordDeviceCheck(device, timeoutSeconds, "automated")));
  } finally { polling = false; }
}

export function startMonitoring(getTimeoutSeconds: () => Promise<number>) {
  const tick = () => void getTimeoutSeconds().then(pollDueDevices).catch((error) => logger.error({ err: error }, "Monitoring poll failed"));
  tick();
  const pollTimer = setInterval(tick, 10_000);
  pollTimer.unref();
  const cleanup = () => void db.delete(monitoringHistoryTable).where(lt(monitoringHistoryTable.checkedAt, new Date(Date.now() - RETENTION_DAYS * 86_400_000))).catch((error) => logger.error({ err: error }, "Monitoring retention cleanup failed"));
  cleanup();
  const cleanupTimer = setInterval(cleanup, 86_400_000);
  cleanupTimer.unref();
}
