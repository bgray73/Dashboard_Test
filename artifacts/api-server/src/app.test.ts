import assert from "node:assert/strict";
import { createServer } from "node:http";
import { describe, it } from "node:test";
import { createApp } from "./app";
import type { RuntimeConfig } from "./lib/runtime-config";

const baseConfig: RuntimeConfig = {
  port: 5000,
  host: "127.0.0.1",
  databaseUrl: "postgresql://labops:secret@127.0.0.1:5432/labops",
  corsAllowedOrigins: [],
  trustProxy: false,
  jsonBodyLimit: "100kb",
  urlencodedBodyLimit: "100kb",
  reachabilityProvider: "local-icmp",
};

async function request(
  config: RuntimeConfig,
  path: string,
  init: RequestInit = {},
  exposeRequestInfo = false,
) {
  const app = createApp(config);
  app.post("/__body", (_req, res) => res.sendStatus(204));
  if (exposeRequestInfo) {
    app.get("/__request-info", (req, res) => {
      res.json({ ip: req.ip, protocol: req.protocol });
    });
  }
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    return await fetch(`http://127.0.0.1:${address.port}${path}`, init);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

describe("API HTTP hardening", () => {
  it("omits CORS headers when no origins are configured", async () => {
    const response = await request(baseConfig, "/api/healthz", {
      headers: { Origin: "https://unlisted.example" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  });

  it("allows only an exact configured CORS origin", async () => {
    const config = { ...baseConfig, corsAllowedOrigins: ["https://lab.example"] };
    const allowed = await request(config, "/api/healthz", {
      headers: { Origin: "https://lab.example" },
    });
    const unlisted = await request(config, "/api/healthz", {
      headers: { Origin: "https://evil.example" },
    });

    assert.equal(allowed.headers.get("access-control-allow-origin"), "https://lab.example");
    assert.equal(unlisted.headers.get("access-control-allow-origin"), null);
  });

  it("sets Helmet security headers", async () => {
    const response = await request(baseConfig, "/api/healthz");

    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'self'/);
    assert.equal(response.headers.get("x-powered-by"), null);
  });

  it("returns 413 for JSON over the configured limit", async () => {
    const response = await request(
      { ...baseConfig, jsonBodyLimit: "1kb" },
      "/__body",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: "a".repeat(2_000) }),
      },
    );

    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { error: "Payload too large." });
  });

  it("returns 413 for form data over the configured limit", async () => {
    const response = await request(
      { ...baseConfig, urlencodedBodyLimit: "1kb" },
      "/__body",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ target: "a".repeat(2_000) }),
      },
    );

    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { error: "Payload too large." });
  });

  it("preserves the collector 16kb JSON limit", async () => {
    const response = await request(
      { ...baseConfig, jsonBodyLimit: "32kb" },
      "/api/collector/v1/heartbeat",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ padding: "a".repeat(17 * 1_024) }),
      },
    );

    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { error: "Payload too large." });
  });

  it("ignores forwarded headers by default", async () => {
    const response = await request(
      baseConfig,
      "/__request-info",
      { headers: { "x-forwarded-for": "203.0.113.10", "x-forwarded-proto": "https" } },
      true,
    );

    assert.deepEqual(await response.json(), { ip: "127.0.0.1", protocol: "http" });
  });

  it("honors forwarded headers from an explicitly trusted proxy", async () => {
    const response = await request(
      { ...baseConfig, trustProxy: ["loopback"] },
      "/__request-info",
      { headers: { "x-forwarded-for": "203.0.113.10", "x-forwarded-proto": "https" } },
      true,
    );

    assert.deepEqual(await response.json(), { ip: "203.0.113.10", protocol: "https" });
  });
});
