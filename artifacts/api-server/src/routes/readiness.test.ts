import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { pool } from "@workspace/db";
import { createServer } from "http";
import { createApp } from "../../src/app";
import { parseRuntimeConfig } from "../../src/lib/runtime-config";
import { renderMetrics } from "../../src/lib/metrics";

/**
 * Phase 26: Readiness and observability tests
 *
 * Tests that the /api/readyz endpoint correctly reports readiness
 * based on database connectivity and migration state.
 */

const config = parseRuntimeConfig({
  ...process.env,
  NODE_ENV: "test",
});

describe("Phase 26: Readiness endpoint", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;

  before(async () => {
    const app = createApp(config);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as any).port;
  });

  after(async () => {
    server.close();
    await pool.end();
  });

  it("/api/healthz returns ok status", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/healthz`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data, { status: "ok" });
  });

  it("/api/readyz returns pass when database is healthy", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/readyz`);
    assert.equal(res.status, 200);
    const data = await res.json() as { status: string; checks: Array<{ name: string; status: string }> };
    assert.equal(data.status, "pass");
    assert.ok(Array.isArray(data.checks));
    const dbCheck = data.checks.find((c) => c.name === "database");
    assert.equal(dbCheck?.status, "pass");
    const migrationCheck = data.checks.find((c) => c.name === "migrations");
    assert.equal(migrationCheck?.status, "pass");
  });

  it("/api/metrics returns Prometheus-format output", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/metrics`);
    assert.equal(res.status, 200);
    assert.ok(
      res.headers.get("content-type")?.includes("text/plain"),
      "Content-Type should be text/plain",
    );
    const text = await res.text();
    assert.ok(text.includes("# HELP labops_http_requests_total"));
    assert.ok(text.includes("# TYPE labops_http_requests_total counter"));
  });
});
