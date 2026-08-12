import { COLLECTOR_CAPABILITIES, COLLECTOR_PATHS, COLLECTOR_VERSION, type CollectorConfig } from "./config.js";

export type CollectorJob = { jobId: number; leaseId: string; leaseExpiresAt: string; kind: "icmp"; target: string; timeoutMs: number };
export type CollectorJobResult = {
  leaseId: string;
  status: "online" | "offline" | "unknown";
  latencyMs: number | null;
  errorCode?: string;
  message?: string;
  startedAt: string;
  completedAt: string;
};
type Fetch = typeof fetch;

export class CollectorApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export class CollectorClient {
  constructor(private readonly config: CollectorConfig, private readonly fetchImpl: Fetch = fetch) {}

  private async request(path: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try {
      const response = await this.fetchImpl(new URL(path, this.config.baseUrl), {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.token}`,
          "content-type": "application/json",
          "x-labops-collector-id": String(this.config.collectorId),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) throw new CollectorApiError(response.status, `LabOps returned HTTP ${response.status}.`);
      if (response.status === 204) return null;
      return response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async heartbeat(): Promise<void> {
    await this.request(COLLECTOR_PATHS.heartbeat, { version: COLLECTOR_VERSION, capabilities: COLLECTOR_CAPABILITIES, hostname: this.config.hostname });
  }

  async claim(): Promise<CollectorJob | null> {
    const response = await this.request(COLLECTOR_PATHS.claim, { maxJobs: 1, waitSeconds: 0, capabilities: COLLECTOR_CAPABILITIES }) as { job?: CollectorJob | null; jobs?: CollectorJob[] } | CollectorJob | null;
    if (!response) return null;
    if ("jobs" in response) return response.jobs?.[0] ?? null;
    if ("job" in response) return response.job ?? null;
    return response as CollectorJob;
  }

  async report(jobId: string | number, result: CollectorJobResult): Promise<void> {
    await this.request(COLLECTOR_PATHS.result(jobId), result);
  }
}
