import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { collectorsTable, db, reachabilityJobsTable } from "@workspace/db";
import type { ReachabilityProvider, ReachabilityResult } from "./reachability";

export type CollectorResultInput = {
  leaseId: string;
  status: "online" | "offline" | "unknown";
  latencyMs: number | null;
  errorCode?: string;
  message?: string;
  startedAt: string;
  completedAt: string;
};

export class CollectorJobConflictError extends Error {}

const collectorCapabilities = Object.freeze({ protocol: "icmp" as const, executionLocation: "collector" as const, supportsLatency: true as const, requiresSystemBinary: "ping" as const, availability: "runtime-detected" as const });
export const collectorProviderMetadata = Object.freeze({
  id: "collector-icmp" as const,
  label: "Local collector ICMP",
  description: "Queues an ICMP check for an authenticated outbound-polling LabOps collector.",
  capabilities: collectorCapabilities,
});

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createCollectorReachabilityProvider(deviceId: number, collectorId?: number): ReachabilityProvider {
  return {
    metadata: collectorProviderMetadata,
    async check(target, timeoutSeconds) {
      if (!collectorId) return { status: "unknown", latencyMs: null, message: "Collector monitoring requires a configured active collector ID." };
      const [collector] = await db.select({ id: collectorsTable.id }).from(collectorsTable)
        .where(and(eq(collectorsTable.id, collectorId), eq(collectorsTable.status, "active"))).limit(1);
      if (!collector) return { status: "unknown", latencyMs: null, message: "The configured collector is unavailable or revoked." };
      const timeoutMs = Math.max(1_000, Math.min(30_000, timeoutSeconds * 1_000));
      try {
        const job = await db.transaction(async (tx) => {
          await tx.execute(sql`select pg_advisory_xact_lock(1818322245)`);
          await tx.update(reachabilityJobsTable).set({ status: "expired" }).where(and(
            inArray(reachabilityJobsTable.status, ["queued", "leased"]),
            lt(reachabilityJobsTable.expiresAt, sql`now()`),
          ));
          const [[pending], [existing]] = await Promise.all([
            tx.select({ rows: count() }).from(reachabilityJobsTable).where(inArray(reachabilityJobsTable.status, ["queued", "leased"])),
            tx.select({ id: reachabilityJobsTable.id }).from(reachabilityJobsTable).where(and(eq(reachabilityJobsTable.deviceId, deviceId), inArray(reachabilityJobsTable.status, ["queued", "leased"]))).limit(1),
          ]);
          if (existing || pending.rows >= 1000) return null;
          const [created] = await tx.insert(reachabilityJobsTable).values({
            deviceId, target, timeoutMs, collectorId,
            expiresAt: sql`now() + (${timeoutMs + 15_000} * interval '1 millisecond')`,
          }).returning({ id: reachabilityJobsTable.id, expiresAt: reachabilityJobsTable.expiresAt });
          return created;
        });
        if (!job) return { status: "unknown" as const, latencyMs: null, message: "Collector capacity is currently unavailable for this device." };
        return await waitForCollectorJob(job.id, timeoutMs + 15_000);
      } catch (error) {
        const code = (error as { code?: string; cause?: { code?: string } }).code ?? (error as { cause?: { code?: string } }).cause?.code;
        if (code === "23505") return { status: "unknown", latencyMs: null, message: "A collector check is already active for this device." };
        throw error;
      }
    },
  };
}

async function waitForCollectorJob(jobId: number, maximumWaitMs: number): Promise<ReachabilityResult> {
      const started = performance.now();
      while (performance.now() - started < maximumWaitMs) {
        const [current] = await db.select().from(reachabilityJobsTable).where(eq(reachabilityJobsTable.id, jobId)).limit(1);
        if (current?.status === "completed") return {
          status: current.resultStatus as "online" | "offline" | "unknown",
          latencyMs: current.latencyMs,
          message: current.errorMessage ?? (current.resultStatus === "online" ? "LabOps collector reached the device successfully." : "LabOps collector could not reach the device."),
        };
        await wait(250);
      }
      const [expired] = await db.update(reachabilityJobsTable).set({ status: "expired" })
        .where(and(eq(reachabilityJobsTable.id, jobId), or(eq(reachabilityJobsTable.status, "queued"), eq(reachabilityJobsTable.status, "leased")))).returning({ id: reachabilityJobsTable.id });
      if (!expired) {
        const [completed] = await db.select().from(reachabilityJobsTable).where(eq(reachabilityJobsTable.id, jobId)).limit(1);
        if (completed?.status === "completed") return {
          status: completed.resultStatus as "online" | "offline" | "unknown",
          latencyMs: completed.latencyMs,
          message: completed.errorMessage ?? (completed.resultStatus === "online" ? "LabOps collector reached the device successfully." : "LabOps collector could not reach the device."),
        };
      }
      return { status: "unknown", latencyMs: null, message: "No collector completed the reachability check before its deadline." };
}

export async function heartbeatCollector(collectorId: number, hostname: string, capabilities: string[]) {
  await db.update(collectorsTable).set({ hostname, capabilities, lastSeenAt: new Date(), updatedAt: new Date() })
    .where(and(eq(collectorsTable.id, collectorId), eq(collectorsTable.status, "active")));
}

export async function claimCollectorJob(collectorId: number) {
  return db.transaction(async (tx) => {
    const [{ now }] = await tx.select({ now: sql<Date>`now()` }).from(collectorsTable).where(eq(collectorsTable.id, collectorId)).limit(1);
    await tx.update(reachabilityJobsTable).set({ status: "expired" })
      .where(and(inArray(reachabilityJobsTable.status, ["queued", "leased"]), lt(reachabilityJobsTable.expiresAt, now)));
    const [job] = await tx.select().from(reachabilityJobsTable)
      .where(and(eq(reachabilityJobsTable.status, "queued"), gt(reachabilityJobsTable.expiresAt, now), or(isNull(reachabilityJobsTable.collectorId), eq(reachabilityJobsTable.collectorId, collectorId))))
      .orderBy(reachabilityJobsTable.queuedAt).limit(1).for("update", { skipLocked: true });
    if (!job) return null;
    const leaseId = randomBytes(16).toString("hex");
    const leaseExpiresAt = job.expiresAt ?? new Date(now.getTime() + job.timeoutMs + 10_000);
    await tx.update(reachabilityJobsTable).set({
      status: "leased", collectorId, leaseId, leaseExpiresAt, leasedAt: now, attemptCount: job.attemptCount + 1,
    }).where(eq(reachabilityJobsTable.id, job.id));
    return { jobId: job.id, leaseId, leaseExpiresAt: leaseExpiresAt.toISOString(), kind: "icmp" as const, target: job.target, timeoutMs: job.timeoutMs };
  });
}

function resultDigest(input: CollectorResultInput): string {
  return createHash("sha256").update(JSON.stringify([
    input.leaseId, input.status, input.latencyMs, input.errorCode ?? null,
    input.message ?? null, input.startedAt, input.completedAt,
  ])).digest("hex");
}

export async function completeCollectorJob(collectorId: number, jobId: number, input: CollectorResultInput) {
  const digest = resultDigest(input);
  return db.transaction(async (tx) => {
    const [{ now }] = await tx.select({ now: sql<Date>`now()` }).from(collectorsTable).where(eq(collectorsTable.id, collectorId)).limit(1);
    const [job] = await tx.select().from(reachabilityJobsTable).where(eq(reachabilityJobsTable.id, jobId)).limit(1).for("update");
    if (!job) return "not-found" as const;
    if (job.status === "completed") {
      if (job.resultDigest === digest) return "duplicate" as const;
      throw new CollectorJobConflictError("A different result was already recorded for this job.");
    }
    if (job.status !== "leased" || job.collectorId !== collectorId || job.leaseId !== input.leaseId || !job.leaseExpiresAt || job.leaseExpiresAt < now) {
      throw new CollectorJobConflictError("The collector lease is invalid or expired.");
    }
    await tx.update(reachabilityJobsTable).set({
      status: "completed", resultStatus: input.status, latencyMs: input.latencyMs,
      errorCode: input.errorCode ?? null, errorMessage: input.message ?? null,
      resultDigest: digest, completedAt: now,
    }).where(eq(reachabilityJobsTable.id, jobId));
    return "completed" as const;
  });
}

export async function cleanupCollectorJobs(retentionDays = 7) {
  await db.update(reachabilityJobsTable).set({ status: "expired" }).where(and(
    inArray(reachabilityJobsTable.status, ["queued", "leased"]),
    lt(reachabilityJobsTable.expiresAt, sql`now()`),
  ));
  await db.delete(reachabilityJobsTable).where(and(
    inArray(reachabilityJobsTable.status, ["completed", "expired"]),
    lt(reachabilityJobsTable.expiresAt, sql`now() - (${retentionDays} * interval '1 day')`),
  ));
}
