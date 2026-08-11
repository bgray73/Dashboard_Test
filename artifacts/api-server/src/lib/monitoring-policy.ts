export const FAILURE_THRESHOLD = 3;

export type MonitoringStatus = "online" | "offline" | "unknown";

export function calculateMonitoringState(status: MonitoringStatus, currentFailures: number) {
  const consecutiveFailures = status === "online"
    ? 0
    : status === "offline"
      ? currentFailures + 1
      : currentFailures;
  const effectiveStatus = status === "offline" && consecutiveFailures < FAILURE_THRESHOLD
    ? "unknown"
    : status;
  return { consecutiveFailures, effectiveStatus };
}

export function isDeviceDue(lastCheckedAt: Date | null, intervalSeconds: number, nowMs: number): boolean {
  return lastCheckedAt === null || nowMs - lastCheckedAt.getTime() >= intervalSeconds * 1000;
}

export function retentionCutoff(nowMs: number, retentionDays: number): Date {
  return new Date(nowMs - retentionDays * 86_400_000);
}
