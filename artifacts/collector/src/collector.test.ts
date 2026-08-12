import assert from "node:assert/strict";
import test from "node:test";
import { CollectorClient, type CollectorJob } from "./client.js";
import { COLLECTOR_PATHS, loadConfig, type CollectorConfig } from "./config.js";
import { checkIcmp, pingArguments } from "./reachability.js";
import { backoffDelay, runCollector } from "./runner.js";

const baseConfig: CollectorConfig = {
  baseUrl: new URL("https://labops.example/"), collectorId: 7, token: "top-secret-token", hostname: "collector-a",
  idleDelayMs: 1, heartbeatIntervalMs: 30000, requestTimeoutMs: 1000, maxBackoffMs: 30000,
};

test("configuration requires HTTPS except for loopback HTTP", () => {
  assert.throws(() => loadConfig({ LABOPS_URL: "http://labops.example", LABOPS_COLLECTOR_ID: "1", LABOPS_COLLECTOR_TOKEN: "x" }), /HTTPS/);
  assert.equal(loadConfig({ LABOPS_URL: "http://127.0.0.1:5002", LABOPS_COLLECTOR_ID: "2", LABOPS_COLLECTOR_TOKEN: "x" }).collectorId, 2);
  assert.throws(() => loadConfig({ LABOPS_URL: "https://labops.example", LABOPS_COLLECTOR_ID: "0", LABOPS_COLLECTOR_TOKEN: "x" }), /1 through 2147483647/);
  assert.throws(() => loadConfig({ LABOPS_URL: "https://labops.example", LABOPS_COLLECTOR_ID: "2147483648", LABOPS_COLLECTOR_TOKEN: "x" }), /1 through 2147483647/);
  assert.throws(() => loadConfig({ LABOPS_URL: "https://user:pass@labops.example", LABOPS_COLLECTOR_ID: "1", LABOPS_COLLECTOR_TOKEN: "x" }), /credentials/);
  assert.throws(() => loadConfig({ LABOPS_URL: "https://labops.example/prefix", LABOPS_COLLECTOR_ID: "1", LABOPS_COLLECTOR_TOKEN: "x" }), /path prefix/);
});

test("client uses versioned routes, scoped auth, and one-job claims", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    calls.push({ url: String(input), init: init ?? {} });
    const path = new URL(String(input)).pathname;
    if (path === COLLECTOR_PATHS.claim) return new Response(JSON.stringify({ jobId: 3, leaseId: "lease", leaseExpiresAt: new Date().toISOString(), kind: "icmp", target: "127.0.0.1", timeoutMs: 1000 }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(null, { status: 204 });
  };
  const client = new CollectorClient(baseConfig, fetchImpl as typeof fetch);
  await client.heartbeat();
  const job = await client.claim();
  await client.report(3, { leaseId: "lease", status: "online", latencyMs: 2, startedAt: "a", completedAt: "b" });
  assert.equal(job?.jobId, 3);
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [COLLECTOR_PATHS.heartbeat, COLLECTOR_PATHS.claim, COLLECTOR_PATHS.result(3)]);
  assert.equal(new Headers(calls[0].init.headers).get("authorization"), "Bearer top-secret-token");
  assert.equal(new Headers(calls[0].init.headers).get("x-labops-collector-id"), "7");
  assert.deepEqual(JSON.parse(String(calls[1].init.body)), { maxJobs: 1, waitSeconds: 0, capabilities: ["icmp"] });
});

test("client treats 204 claim as no work", async () => {
  const client = new CollectorClient(baseConfig, (async () => new Response(null, { status: 204 })) as typeof fetch);
  assert.equal(await client.claim(), null);
});

test("native ICMP produces bounded platform arguments and honest states", async () => {
  assert.deepEqual(pingArguments("host", 60, "linux"), ["-4", "-c", "1", "-W", "30", "host"]);
  let clock = 10;
  const success = await checkIcmp("host", 1, async () => { clock = 14; }, () => clock);
  assert.deepEqual(success, { status: "online", latencyMs: 4, errorMessage: null });
  const unavailable = await checkIcmp("host", 1, async () => { throw Object.assign(new Error("missing"), { code: "ENOENT" }); });
  assert.equal(unavailable.status, "unknown");
  const offline = await checkIcmp("host", 1, async () => { throw new Error("timeout"); });
  assert.equal(offline.status, "offline");
  assert.equal((await checkIcmp("bad target!", 1)).status, "unknown");
});

test("backoff is bounded exponential jitter", () => {
  assert.equal(backoffDelay(0, 30000, () => 0), 500);
  assert.equal(backoffDelay(4, 30000, () => 1), 16000);
  assert.equal(backoffDelay(20, 30000, () => 1), 30000);
});

test("runner processes one job fully before claiming another and stops gracefully", async () => {
  const events: string[] = [];
  const controller = new AbortController();
  const jobs: Array<CollectorJob | null> = [{ jobId: 1, leaseId: "a".repeat(32), leaseExpiresAt: new Date(Date.now() + 10_000).toISOString(), kind: "icmp", target: "host", timeoutMs: 1500 }, null];
  const client = {
    heartbeat: async () => { events.push("heartbeat"); },
    claim: async () => { events.push("claim"); return jobs.shift() ?? null; },
    report: async (_id: number, result: { message?: string }) => { events.push(`report:${result.message?.length ?? 0}`); },
  };
  await runCollector(baseConfig, client as unknown as CollectorClient, controller.signal, {
    logger: { info() {}, warn() {}, error() {} },
    check: async () => { events.push("check"); return { status: "offline", latencyMs: null, errorMessage: "x".repeat(600) }; },
    sleep: async () => { events.push("sleep"); controller.abort(); },
  });
  assert.deepEqual(events, ["heartbeat", "claim", "check", "report:512", "claim", "sleep"]);
});

test("runner retries without logging secrets", async () => {
  const messages: string[] = [];
  const controller = new AbortController();
  let attempts = 0;
  const client = { heartbeat: async () => { attempts += 1; throw new Error(baseConfig.token); } };
  await runCollector(baseConfig, client as unknown as CollectorClient, controller.signal, {
    logger: { info() {}, warn(message) { messages.push(String(message)); }, error() {} },
    random: () => 0,
    sleep: async () => { controller.abort(); },
  });
  assert.equal(attempts, 1);
  assert.equal(messages.some((message) => message.includes(baseConfig.token)), false);
});
