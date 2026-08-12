import { hostname } from "node:os";

export const COLLECTOR_VERSION = "0.1.0";
export const COLLECTOR_CAPABILITIES = Object.freeze(["icmp"] as const);
export const COLLECTOR_PATHS = Object.freeze({
  heartbeat: "/api/collector/v1/heartbeat",
  claim: "/api/collector/v1/jobs/claim",
  result: (jobId: string | number) => `/api/collector/v1/jobs/${encodeURIComponent(String(jobId))}/result`,
});

export type CollectorConfig = {
  baseUrl: URL;
  collectorId: number;
  token: string;
  hostname: string;
  idleDelayMs: number;
  heartbeatIntervalMs: number;
  requestTimeoutMs: number;
  maxBackoffMs: number;
};

function positiveInteger(value: string | undefined, name: string): number {
  const parsed = value && /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 2_147_483_647) {
    throw new Error(`${name} must be an integer from 1 through 2147483647.`);
  }
  return parsed;
}

export function isLoopbackHost(value: string): boolean {
  return value === "localhost" || value === "127.0.0.1" || value === "[::1]" || value === "::1";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): CollectorConfig {
  const rawUrl = env.LABOPS_URL;
  if (!rawUrl) throw new Error("LABOPS_URL is required.");
  const baseUrl = new URL(rawUrl);
  if (baseUrl.protocol !== "https:" && !(baseUrl.protocol === "http:" && isLoopbackHost(baseUrl.hostname))) {
    throw new Error("LABOPS_URL must use HTTPS unless it points to the local loopback interface.");
  }
  if (baseUrl.username || baseUrl.password) throw new Error("LABOPS_URL must not contain credentials.");
  if (baseUrl.pathname !== "/" && baseUrl.pathname !== "") throw new Error("LABOPS_URL must not include a path prefix.");
  if (!env.LABOPS_COLLECTOR_TOKEN) throw new Error("LABOPS_COLLECTOR_TOKEN is required.");
  baseUrl.pathname = baseUrl.pathname.replace(/\/$/, "");
  return {
    baseUrl,
    collectorId: positiveInteger(env.LABOPS_COLLECTOR_ID, "LABOPS_COLLECTOR_ID"),
    token: env.LABOPS_COLLECTOR_TOKEN,
    hostname: hostname(),
    idleDelayMs: 2000,
    heartbeatIntervalMs: 30000,
    requestTimeoutMs: 15000,
    maxBackoffMs: 30000,
  };
}
