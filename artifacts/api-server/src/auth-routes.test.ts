import assert from "node:assert/strict";
import { createServer } from "node:http";
import { describe, it } from "node:test";
import { createApp, type AuthDependencies } from "./app";
import { IdentityNotProvisionedError } from "./lib/auth-store";
import type { RuntimeConfig } from "./lib/runtime-config";

const config: RuntimeConfig = {
  port: 5000,
  host: "127.0.0.1",
  databaseUrl: "postgresql://127.0.0.1/test",
  corsAllowedOrigins: [],
  trustProxy: false,
  jsonBodyLimit: "100kb",
  urlencodedBodyLimit: "100kb",
  reachabilityProvider: "local-icmp",
  auth: {
    issuerUrl: "https://id.example",
    clientId: "labops",
    clientSecret: "secret",
    clientAuthMethod: "client_secret_basic",
    publicBaseUrl: "https://lab.example",
    bootstrapIssuer: "https://id.example",
    bootstrapSubject: "approved",
    sessionIdleTtlSeconds: 1800,
    sessionAbsoluteTtlSeconds: 43200,
    flowTtlSeconds: 600,
    httpTimeoutMs: 5000,
    secureCookies: false,
  },
};

function fakes(): AuthDependencies & {
  lookups: string[];
  issuedPrior: Array<string | undefined>;
  revoked: string[];
} {
  const lookups: string[] = [],
    issuedPrior: Array<string | undefined> = [],
    revoked: string[] = [];
  return {
    lookups,
    issuedPrior,
    revoked,
    oidc: {
      beginLogin: async () =>
        new URL("https://id.example/authorize?state=safe"),
      completeCallback: async () => ({
        issuer: "https://id.example",
        subject: "approved",
        displayName: "Approved",
      }),
    },
    store: {
      lookupSession: async (token: string) => {
        lookups.push(token);
        return token === "valid-token"
          ? {
              sessionId: 1,
              user: { id: 7, displayName: "Approved", email: null },
            }
          : undefined;
      },
      mapIdentity: async () => ({ id: 7 }),
      issueSession: async (_userId: number, prior?: string) => {
        issuedPrior.push(prior);
        return {
          token: "new-session-token-0000000000000000000000000",
          absoluteExpiresAt: new Date(),
        };
      },
      revokeSession: async (token: string) => {
        revoked.push(token);
      },
    },
  };
}

async function request(path: string, init: RequestInit, deps = fakes()) {
  const server = createServer(createApp(config, deps));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    return {
      response: await fetch(`http://127.0.0.1:${address.port}${path}`, {
        redirect: "manual",
        ...init,
      }),
      deps,
    };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const protectedRoutes: Array<[string, string]> = [
  ["GET", "/api/dashboard/summary"],
  ["GET", "/api/dashboard/recent-status"],
  ["GET", "/api/reports/summary"],
  ["GET", "/api/reports/devices.csv"],
  ["GET", "/api/reports/incidents.csv"],
  ["GET", "/api/reports/monitoring-history.csv"],
  ["GET", "/api/reports/availability"],
  ["GET", "/api/reports/availability.csv"],
  ["POST", "/api/dashboard/check-monitored"],
  ["GET", "/api/monitoring"],
  ["GET", "/api/maintenance-history"],
  ["GET", "/api/incidents"],
  ["GET", "/api/incidents/1/activity"],
  ["PATCH", "/api/incidents/1/acknowledgment"],
  ["GET", "/api/devices/1/monitoring-history"],
  ["GET", "/api/devices"],
  ["POST", "/api/devices"],
  ["GET", "/api/devices/1"],
  ["PATCH", "/api/devices/1"],
  ["DELETE", "/api/devices/1"],
  ["POST", "/api/devices/1/ping"],
  ["GET", "/api/saved-configurations"],
  ["POST", "/api/saved-configurations"],
  ["DELETE", "/api/saved-configurations/1"],
  ["GET", "/api/settings"],
  ["GET", "/api/settings/retention-status"],
  ["POST", "/api/settings/retention-cleanup"],
  ["PATCH", "/api/settings"],
  ["GET", "/api/notifications/deliveries"],
  ["POST", "/api/notifications/test"],
  ["POST", "/api/notifications/deliveries/1/retry"],
  ["POST", "/api/tools/ping"],
  ["GET", "/api/tools/reachability-capabilities"],
];

describe("authentication routes and default guard", () => {
  it("guards every inventoried main route before handler/database logic", async () => {
    for (const [method, path] of protectedRoutes) {
      const { response, deps } = await request(path, {
        method,
        headers: { authorization: "Bearer collector-token" },
      });
      assert.equal(response.status, 401, `${method} ${path}`);
      assert.deepEqual(await response.json(), {
        error: "Authentication required.",
      });
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(deps.lookups, []);
    }
  });

  it("keeps health public and collector auth isolated from browser cookies", async () => {
    assert.equal(
      (await request("/api/healthz", { method: "GET" })).response.status,
      200,
    );
    const collector = await request("/api/collector/v1/heartbeat", {
      method: "POST",
      headers: {
        cookie: "labops_session=valid-token",
        "content-type": "application/json",
      },
      body: "{}",
    });
    assert.equal(collector.response.status, 401);
    assert.deepEqual(collector.deps.lookups, []);
  });

  it("redirects login with no-store and reports provider outage generically", async () => {
    const ok = await request("/api/auth/login", { method: "GET" });
    assert.equal(ok.response.status, 302);
    assert.equal(
      ok.response.headers.get("location"),
      "https://id.example/authorize?state=safe",
    );
    assert.equal(ok.response.headers.get("cache-control"), "no-store");
    const deps = fakes();
    deps.oidc.beginLogin = async () => {
      throw new Error("provider URL secret");
    };
    const failed = await request("/api/auth/login", { method: "GET" }, deps);
    assert.equal(failed.response.status, 503);
    assert.deepEqual(await failed.response.json(), {
      error: "Authentication provider unavailable.",
    });
    assert.equal(failed.response.headers.get("retry-after"), "30");
  });

  it("validates callback shape, rotates a pre-existing session, and disposes details", async () => {
    const deps = fakes();
    const result = await request(
      "/api/auth/callback?code=opaque&state=stored",
      { method: "GET", headers: { cookie: "labops_session=old-session" } },
      deps,
    );
    assert.equal(result.response.status, 303);
    assert.equal(
      result.response.headers.get("location"),
      "https://lab.example/",
    );
    assert.deepEqual(deps.issuedPrior, ["old-session"]);
    assert.match(
      result.response.headers.get("set-cookie") ?? "",
      /^labops_session=.*HttpOnly.*SameSite=Lax/,
    );
    const duplicate = await request(
      "/api/auth/callback?code=a&state=x&state=y",
      { method: "GET" },
    );
    assert.equal(duplicate.response.status, 400);
    assert.deepEqual(await duplicate.response.json(), {
      error: "Invalid authentication callback.",
    });
  });

  it("returns local me during provider outage and clears invalid sessions", async () => {
    const deps = fakes();
    deps.oidc.beginLogin = async () => {
      throw new Error("offline");
    };
    const me = await request(
      "/api/auth/me",
      { method: "GET", headers: { cookie: "labops_session=valid-token" } },
      deps,
    );
    assert.equal(me.response.status, 200);
    assert.deepEqual(await me.response.json(), {
      id: 7,
      displayName: "Approved",
      email: null,
    });
    const missing = await request(
      "/api/auth/me",
      { method: "GET", headers: { cookie: "labops_session=expired" } },
      deps,
    );
    assert.equal(missing.response.status, 401);
    assert.match(missing.response.headers.get("set-cookie") ?? "", /Max-Age=0/);
  });

  it("logs out idempotently and remains local during provider outage", async () => {
    const deps = fakes();
    deps.oidc.beginLogin = async () => {
      throw new Error("offline");
    };
    const result = await request(
      "/api/auth/logout",
      { method: "POST", headers: { cookie: "labops_session=valid-token" } },
      deps,
    );
    assert.equal(result.response.status, 204);
    assert.deepEqual(deps.revoked, ["valid-token"]);
    assert.match(result.response.headers.get("set-cookie") ?? "", /Max-Age=0/);
  });

  it("returns generic 403 for an unprovisioned callback identity", async () => {
    const deps = fakes();
    deps.store.mapIdentity = async () => {
      throw new IdentityNotProvisionedError();
    };
    const result = await request(
      "/api/auth/callback?code=opaque&state=stored",
      { method: "GET" },
      deps,
    );
    assert.equal(result.response.status, 403);
    assert.deepEqual(await result.response.json(), {
      error: "Identity is not provisioned.",
    });
  });
});
