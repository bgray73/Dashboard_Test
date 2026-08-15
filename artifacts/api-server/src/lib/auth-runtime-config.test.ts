import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRuntimeConfig } from "./runtime-config";

const valid = {
  DATABASE_URL: "postgresql://127.0.0.1:55432/labops_phase18",
  OIDC_ISSUER_URL: "https://id.example/tenant",
  OIDC_CLIENT_ID: "labops",
  OIDC_CLIENT_SECRET: "test-secret",
  PUBLIC_BASE_URL: "https://lab.example",
};

describe("authentication runtime configuration", () => {
  it("parses the exact authentication contract and defaults", () => {
    const config = parseRuntimeConfig(valid);
    assert.deepEqual(config.auth, {
      issuerUrl: "https://id.example/tenant",
      clientId: "labops",
      clientSecret: "test-secret",
      clientAuthMethod: "client_secret_basic",
      publicBaseUrl: "https://lab.example",
      bootstrapIssuer: undefined,
      bootstrapSubject: undefined,
      sessionIdleTtlSeconds: 1800,
      sessionAbsoluteTtlSeconds: 43200,
      flowTtlSeconds: 600,
      httpTimeoutMs: 5000,
      secureCookies: false,
    });
  });

  for (const [name, override] of Object.entries({
    "missing issuer": { OIDC_ISSUER_URL: undefined },
    "issuer query": { OIDC_ISSUER_URL: "https://id.example/tenant?bad=1" },
    "base path": { PUBLIC_BASE_URL: "https://lab.example/path" },
    "unpaired bootstrap": { AUTH_BOOTSTRAP_SUBJECT: "approved" },
    "wildcard bootstrap": { AUTH_BOOTSTRAP_ISSUER: "https://id.example/tenant", AUTH_BOOTSTRAP_SUBJECT: "*" },
    "idle over absolute": { AUTH_SESSION_IDLE_TTL_SECONDS: "5000", AUTH_SESSION_ABSOLUTE_TTL_SECONDS: "4000" },
    "unsupported auth method": { OIDC_CLIENT_AUTH_METHOD: "none" },
    "bypass variable": { AUTH_BYPASS: "true" },
  })) {
    it(`rejects ${name}`, () => {
      assert.throws(() => parseRuntimeConfig({ ...valid, ...override }), /Invalid runtime configuration/);
    });
  }

  it("requires HTTPS issuer and base URL in production", () => {
    assert.throws(() => parseRuntimeConfig({
      ...valid,
      NODE_ENV: "production",
      OIDC_ISSUER_URL: "http://127.0.0.1:9000",
      PUBLIC_BASE_URL: "http://localhost:5173",
    }), /HTTPS/);
  });

  it("trims values and accepts paired exact bootstrap values", () => {
    const config = parseRuntimeConfig({
      ...valid,
      OIDC_CLIENT_ID: " labops ",
      OIDC_CLIENT_SECRET: " secret ",
      AUTH_BOOTSTRAP_ISSUER: " https://id.example/tenant ",
      AUTH_BOOTSTRAP_SUBJECT: " Subject-A ",
    });
    assert.equal(config.auth.clientId, "labops");
    assert.equal(config.auth.clientSecret, "secret");
    assert.equal(config.auth.bootstrapSubject, "Subject-A");
  });
});
