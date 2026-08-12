import { Router, type Request, type Response } from "express";
import { authenticateCollector } from "../lib/collector-auth";
import { claimCollectorJob, CollectorJobConflictError, completeCollectorJob, heartbeatCollector, type CollectorResultInput } from "../lib/collector-jobs";

const router = Router();
const CAPABILITIES = ["icmp"];

async function authenticated(req: Request, res: Response) {
  const collectorId = Number(req.header("x-labops-collector-id"));
  const collector = await authenticateCollector(collectorId, req.header("authorization"));
  if (!collector) res.status(401).json({ error: "Collector authentication failed." });
  return collector;
}

router.post("/heartbeat", async (req, res): Promise<void> => {
  const collector = await authenticated(req, res);
  if (!collector) return;
  const body = req.body as Record<string, unknown>;
  const hostname = typeof body.hostname === "string" ? body.hostname.trim() : "";
  const capabilities = Array.isArray(body.capabilities) ? body.capabilities.filter((value): value is string => typeof value === "string") : [];
  if (typeof body.version !== "string" || !body.version.trim() || body.version.length > 64 || !hostname || hostname.length > 255 || /[\s\u0000-\u001f\u007f]/u.test(hostname) || capabilities.length !== 1 || capabilities[0] !== "icmp") {
    res.status(400).json({ error: "Invalid collector heartbeat." }); return;
  }
  await heartbeatCollector(collector.id, hostname, CAPABILITIES);
  res.json({ serverTime: new Date().toISOString(), pollAfterMs: 2_000 });
});

router.post("/jobs/claim", async (req, res): Promise<void> => {
  const collector = await authenticated(req, res);
  if (!collector) return;
  const body = req.body as Record<string, unknown>;
  if (body.maxJobs !== 1 || body.waitSeconds !== 0 || !Array.isArray(body.capabilities) || body.capabilities.length !== 1 || body.capabilities[0] !== "icmp") {
    res.status(400).json({ error: "Collector claims are limited to one ICMP job." }); return;
  }
  const job = await claimCollectorJob(collector.id);
  if (!job) { res.status(204).send(); return; }
  res.json(job);
});

router.post("/jobs/:jobId/result", async (req, res): Promise<void> => {
  const collector = await authenticated(req, res);
  if (!collector) return;
  const jobId = Number(req.params.jobId);
  const body = req.body as Partial<CollectorResultInput>;
  const startedAt = new Date(body.startedAt ?? "");
  const completedAt = new Date(body.completedAt ?? "");
  if (!Number.isInteger(jobId) || jobId <= 0 || typeof body.leaseId !== "string" || !/^[a-f0-9]{32}$/.test(body.leaseId) || !["online", "offline", "unknown"].includes(body.status ?? "") || (body.latencyMs !== null && (!Number.isInteger(body.latencyMs) || (body.latencyMs ?? -1) < 0 || (body.latencyMs ?? 0) > 3_600_000)) || (body.message !== undefined && (typeof body.message !== "string" || body.message.length > 512)) || (body.errorCode !== undefined && (typeof body.errorCode !== "string" || body.errorCode.length > 64)) || Number.isNaN(startedAt.getTime()) || Number.isNaN(completedAt.getTime()) || completedAt < startedAt) {
    res.status(400).json({ error: "Invalid collector result." }); return;
  }
  try {
    const normalized = { ...body, startedAt: startedAt.toISOString(), completedAt: completedAt.toISOString() } as CollectorResultInput;
    const outcome = await completeCollectorJob(collector.id, jobId, normalized);
    if (outcome === "not-found") { res.status(404).json({ error: "Collector job not found." }); return; }
    res.status(204).send();
  } catch (error) {
    if (!(error instanceof CollectorJobConflictError)) throw error;
    res.status(409).json({ error: error.message });
  }
});

export default router;
