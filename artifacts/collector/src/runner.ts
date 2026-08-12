import type { CollectorConfig } from "./config.js";
import type { CollectorClient, CollectorJob } from "./client.js";
import { checkIcmp, type ReachabilityResult } from "./reachability.js";

type Logger = Pick<Console, "info" | "warn" | "error">;
type Sleep = (milliseconds: number, signal: AbortSignal) => Promise<void>;
type Check = (target: string, timeoutSeconds: number) => Promise<ReachabilityResult>;

export function backoffDelay(attempt: number, maximumMs: number, random: () => number = Math.random): number {
  const ceiling = Math.min(maximumMs, 1000 * 2 ** Math.min(10, Math.max(0, attempt)));
  return Math.floor(ceiling * (0.5 + random() * 0.5));
}

export const sleep: Sleep = (milliseconds, signal) => new Promise((resolve) => {
  if (signal.aborted) return resolve();
  const timer = setTimeout(resolve, milliseconds);
  signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
});

function validateJob(job: CollectorJob): void {
  if (job.kind !== "icmp") throw new Error(`Unsupported job type: ${String(job.kind)}`);
  const leaseExpiresAt = new Date(job.leaseExpiresAt).getTime();
  if (!Number.isSafeInteger(job.jobId) || job.jobId < 1 || !job.target || !Number.isInteger(job.timeoutMs) || job.timeoutMs < 1 || job.timeoutMs > 30_000 || !/^[a-f0-9]{32}$/.test(job.leaseId) || !Number.isFinite(leaseExpiresAt) || leaseExpiresAt <= Date.now() || leaseExpiresAt - Date.now() < job.timeoutMs) throw new Error("Malformed or expired ICMP job.");
}

export async function runCollector(config: CollectorConfig, client: CollectorClient, signal: AbortSignal, dependencies: { logger?: Logger; sleep?: Sleep; random?: () => number; check?: Check } = {}): Promise<void> {
  const logger = dependencies.logger ?? console;
  const wait = dependencies.sleep ?? sleep;
  const random = dependencies.random ?? Math.random;
  const check = dependencies.check ?? checkIcmp;
  let failures = 0;
  let nextHeartbeatAt = 0;

  logger.info(`LabOps collector ${config.collectorId} starting.`);
  while (!signal.aborted) {
    try {
      if (Date.now() >= nextHeartbeatAt) {
        await client.heartbeat();
        nextHeartbeatAt = Date.now() + config.heartbeatIntervalMs;
      }
      const job = await client.claim();
      if (job) {
        validateJob(job);
        const startedAt = new Date().toISOString();
        const result = await check(job.target, Math.max(1, Math.ceil(job.timeoutMs / 1000)));
        await client.report(job.jobId, {
          leaseId: job.leaseId,
          status: result.status,
          latencyMs: result.latencyMs,
          ...(result.errorMessage ? { errorCode: result.status === "unknown" ? "icmp_unavailable" : "unreachable", message: result.errorMessage.slice(0, 512) } : {}),
          startedAt,
          completedAt: new Date().toISOString(),
        });
      }
      failures = 0;
      if (!job) await wait(config.idleDelayMs, signal);
    } catch (error) {
      failures += 1;
      logger.warn(`Collector request failed; retrying (attempt ${failures}).`);
      await wait(backoffDelay(failures - 1, config.maxBackoffMs, random), signal);
    }
  }
  logger.info("LabOps collector stopped.");
}
