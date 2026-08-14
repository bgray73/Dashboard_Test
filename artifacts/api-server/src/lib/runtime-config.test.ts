import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRuntimeConfig } from "./runtime-config";

const databaseUrl = "postgresql://labops:secret@127.0.0.1:5432/labops";

describe("parseRuntimeConfig", () => {
  it("uses secure local defaults", () => {
    const config = parseRuntimeConfig({ DATABASE_URL: databaseUrl });

    assert.deepEqual(config, {
      port: 5000,
      host: "127.0.0.1",
      databaseUrl,
      corsAllowedOrigins: [],
      trustProxy: false,
      jsonBodyLimit: "100kb",
      urlencodedBodyLimit: "100kb",
      reachabilityProvider: "local-icmp",
      collectorId: undefined,
    });
  });

  it("parses explicit deployment settings", () => {
    const config = parseRuntimeConfig({
      PORT: "8080",
      HOST: "0.0.0.0",
      DATABASE_URL: databaseUrl,
      CORS_ALLOWED_ORIGINS: "https://lab.example, https://ops.example",
      TRUST_PROXY: "loopback, 10.0.0.0/8",
      JSON_BODY_LIMIT: "256kb",
      URLENCODED_BODY_LIMIT: "64kb",
      LABOPS_REACHABILITY_PROVIDER: "collector",
      LABOPS_COLLECTOR_ID: "42",
    });

    assert.equal(config.port, 8080);
    assert.equal(config.host, "0.0.0.0");
    assert.deepEqual(config.corsAllowedOrigins, [
      "https://lab.example",
      "https://ops.example",
    ]);
    assert.deepEqual(config.trustProxy, ["loopback", "10.0.0.0/8"]);
    assert.equal(config.jsonBodyLimit, "256kb");
    assert.equal(config.urlencodedBodyLimit, "64kb");
    assert.equal(config.reachabilityProvider, "collector");
    assert.equal(config.collectorId, 42);
  });

  for (const [name, environment] of Object.entries({
    "missing DATABASE_URL": {},
    "invalid PORT": { DATABASE_URL: databaseUrl, PORT: "0" },
    "invalid CORS origin": {
      DATABASE_URL: databaseUrl,
      CORS_ALLOWED_ORIGINS: "https://lab.example/path",
    },
    "wildcard CORS origin": {
      DATABASE_URL: databaseUrl,
      CORS_ALLOWED_ORIGINS: "*",
    },
    "invalid body limit": { DATABASE_URL: databaseUrl, JSON_BODY_LIMIT: "huge" },
    "invalid reachability provider": {
      DATABASE_URL: databaseUrl,
      LABOPS_REACHABILITY_PROVIDER: "magic",
    },
    "collector without an ID": {
      DATABASE_URL: databaseUrl,
      LABOPS_REACHABILITY_PROVIDER: "collector",
    },
  })) {
    it(`rejects ${name}`, () => {
      assert.throws(() => parseRuntimeConfig(environment), /Invalid runtime configuration/);
    });
  }
});
