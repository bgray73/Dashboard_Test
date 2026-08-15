import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { pool } from "@workspace/db";
import * as openidClient from "openid-client";
import {
  classifyOidcExchangeError,
  OidcService,
  ProviderUnavailableError,
  InvalidCallbackError,
  type OidcProtocol,
} from "./auth-oidc";

const metadata = {
  issuer: "https://id.example/tenant",
  authorizationEndpoint: "https://id.example/authorize",
  tokenEndpoint: "https://id.example/token",
  responseTypesSupported: ["code"],
  pkceMethodsSupported: ["S256"],
  tokenAuthMethodsSupported: ["client_secret_basic"],
};

class FakeProtocol implements OidcProtocol {
  unavailable = false;
  exchanges: Array<Record<string, unknown>> = [];
  async discover() {
    if (this.unavailable) throw new Error("secret upstream detail");
    return metadata;
  }
  async createAuthorization() {
    return {
      url: new URL(
        "https://id.example/authorize?redirect_uri=https%3A%2F%2Flab.example%2Fapi%2Fauth%2Fcallback&scope=openid+profile+email&response_type=code&code_challenge=challenge&code_challenge_method=S256&state=stored-state&nonce=stored-nonce",
      ),
      state: "stored-state",
      nonce: "stored-nonce",
      verifier: "stored-verifier",
    };
  }
  async exchange(
    callbackUrl: URL,
    expected: { state: string; nonce: string; verifier: string },
  ) {
    this.exchanges.push({ callbackUrl: callbackUrl.toString(), ...expected });
    return {
      issuer: metadata.issuer,
      subject: "approved",
      displayName: "Approved",
      providerTokensDisposed: true,
    };
  }
}

beforeEach(async () =>
  pool.query(
    "TRUNCATE oidc_auth_flows, auth_sessions, users RESTART IDENTITY CASCADE",
  ),
);

async function assertNoUserOrSession() {
  const result = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM users) AS users,
       (SELECT count(*)::int FROM auth_sessions) AS sessions`,
  );
  assert.deepEqual(result.rows[0], { users: 0, sessions: 0 });
}

describe("OIDC authorization protocol coordination", () => {
  it("classifies provider callback rejection separately from provider outages", () => {
    const denied = new openidClient.AuthorizationResponseError("denied", {
      cause: new URLSearchParams("error=access_denied"),
    });
    assert(classifyOidcExchangeError(denied) instanceof InvalidCallbackError);
    assert(
      classifyOidcExchangeError(new TypeError("fetch failed")) instanceof
        ProviderUnavailableError,
    );
    assert(
      classifyOidcExchangeError(
        new DOMException("timed out", "TimeoutError"),
      ) instanceof ProviderUnavailableError,
    );
  });

  it("persists a short-lived S256/state/nonce flow and returns the exact authorization URL", async () => {
    const protocol = new FakeProtocol();
    const service = new OidcService(pool, protocol, {
      issuer: metadata.issuer,
      clientAuthMethod: "client_secret_basic",
      flowTtlSeconds: 600,
    });
    const url = await service.beginLogin();
    assert.equal(
      url.searchParams.get("redirect_uri"),
      "https://lab.example/api/auth/callback",
    );
    assert.equal(url.searchParams.get("scope"), "openid profile email");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("state"), "stored-state");
    assert.equal(url.searchParams.get("nonce"), "stored-nonce");
    const row = await pool.query(
      "SELECT state_hash,state,nonce,pkce_verifier,expires_at>created_at AS future FROM oidc_auth_flows",
    );
    assert.match(row.rows[0].state_hash, /^[a-f0-9]{64}$/);
    assert.deepEqual(
      { ...row.rows[0], state_hash: "hash" },
      {
        state_hash: "hash",
        state: "stored-state",
        nonce: "stored-nonce",
        pkce_verifier: "stored-verifier",
        future: true,
      },
    );
  });

  it("atomically consumes a flow once and supplies stored callback checks", async () => {
    const protocol = new FakeProtocol();
    const service = new OidcService(pool, protocol, {
      issuer: metadata.issuer,
      clientAuthMethod: "client_secret_basic",
      flowTtlSeconds: 600,
    });
    await service.beginLogin();
    const callback = new URL(
      "https://lab.example/api/auth/callback?code=opaque-code&state=stored-state",
    );
    const identity = await service.completeCallback(callback, "stored-state");
    assert.equal(identity.subject, "approved");
    assert.deepEqual(protocol.exchanges[0], {
      callbackUrl: callback.toString(),
      state: "stored-state",
      nonce: "stored-nonce",
      verifier: "stored-verifier",
    });
    await assert.rejects(
      () => service.completeCallback(callback, "stored-state"),
      InvalidCallbackError,
    );
    assert.equal(protocol.exchanges.length, 1);
    await assertNoUserOrSession();
  });

  it("allows exactly one winner in a real concurrent callback race", async () => {
    const protocol = new FakeProtocol();
    const service = new OidcService(pool, protocol, {
      issuer: metadata.issuer,
      clientAuthMethod: "client_secret_basic",
      flowTtlSeconds: 600,
    });
    await service.beginLogin();
    const callback = new URL(
      "https://lab.example/api/auth/callback?code=opaque-code&state=stored-state",
    );
    const results = await Promise.allSettled([
      service.completeCallback(callback, "stored-state"),
      service.completeCallback(callback, "stored-state"),
    ]);
    const fulfilled = results.filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<typeof service.completeCallback>>
      > => result.status === "fulfilled",
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    assert.equal(fulfilled.length, 1);
    assert.equal(fulfilled[0].value.subject, "approved");
    assert.equal(rejected.length, 1);
    assert(rejected[0].reason instanceof InvalidCallbackError);
    assert.equal(protocol.exchanges.length, 1);
    assert.equal(
      (await pool.query("SELECT count(*)::int count FROM oidc_auth_flows"))
        .rows[0].count,
      0,
    );
  });

  it("rejects a callback with missing state without creating a user or auth session", async () => {
    const protocol = new FakeProtocol();
    const service = new OidcService(pool, protocol, {
      issuer: metadata.issuer,
      clientAuthMethod: "client_secret_basic",
      flowTtlSeconds: 600,
    });
    await service.beginLogin();

    await assert.rejects(
      () =>
        service.completeCallback(
          new URL("https://lab.example/api/auth/callback?code=opaque-code"),
          "",
        ),
      InvalidCallbackError,
    );

    assert.equal(protocol.exchanges.length, 0);
    await assertNoUserOrSession();
  });

  it("rejects a callback with random mismatched state without creating a user or auth session", async () => {
    const protocol = new FakeProtocol();
    const service = new OidcService(pool, protocol, {
      issuer: metadata.issuer,
      clientAuthMethod: "client_secret_basic",
      flowTtlSeconds: 600,
    });
    await service.beginLogin();

    await assert.rejects(
      () =>
        service.completeCallback(
          new URL(
            "https://lab.example/api/auth/callback?code=opaque-code&state=random-state",
          ),
          "random-state",
        ),
      InvalidCallbackError,
    );

    assert.equal(protocol.exchanges.length, 0);
    await assertNoUserOrSession();
  });

  it("rejects a callback with expired state without creating a user or auth session", async () => {
    const protocol = new FakeProtocol();
    const service = new OidcService(pool, protocol, {
      issuer: metadata.issuer,
      clientAuthMethod: "client_secret_basic",
      flowTtlSeconds: 600,
    });
    await service.beginLogin();
    await pool.query(
      "UPDATE oidc_auth_flows SET created_at=now()-interval '2 seconds', expires_at=now()-interval '1 second'",
    );

    await assert.rejects(
      () =>
        service.completeCallback(
          new URL(
            "https://lab.example/api/auth/callback?code=opaque-code&state=stored-state",
          ),
          "stored-state",
        ),
      InvalidCallbackError,
    );

    assert.equal(protocol.exchanges.length, 0);
    await assertNoUserOrSession();
  });

  it("fails closed for unsupported discovery and bounds provider failures generically", async () => {
    const unsupported: OidcProtocol = {
      ...new FakeProtocol(),
      discover: async () => ({ ...metadata, pkceMethodsSupported: [] }),
      createAuthorization: async () => {
        throw new Error("not reached");
      },
      exchange: async () => {
        throw new Error("not reached");
      },
    };
    const service = new OidcService(pool, unsupported, {
      issuer: metadata.issuer,
      clientAuthMethod: "client_secret_basic",
      flowTtlSeconds: 600,
    });
    await assert.rejects(() => service.beginLogin(), ProviderUnavailableError);

    const outage = new FakeProtocol();
    outage.unavailable = true;
    const unavailable = new OidcService(pool, outage, {
      issuer: metadata.issuer,
      clientAuthMethod: "client_secret_basic",
      flowTtlSeconds: 600,
    });
    await assert.rejects(
      () => unavailable.beginLogin(),
      (error: unknown) =>
        error instanceof ProviderUnavailableError &&
        !error.message.includes("secret"),
    );
  });

  it("consumes the flow even when token exchange fails", async () => {
    const protocol = new FakeProtocol();
    protocol.exchange = async () => {
      throw new Error("provider token response secret");
    };
    const service = new OidcService(pool, protocol, {
      issuer: metadata.issuer,
      clientAuthMethod: "client_secret_basic",
      flowTtlSeconds: 600,
    });
    await service.beginLogin();
    const callback = new URL(
      "https://lab.example/api/auth/callback?code=bad&state=stored-state",
    );
    await assert.rejects(
      () => service.completeCallback(callback, "stored-state"),
      InvalidCallbackError,
    );
    assert.equal(
      (await pool.query("SELECT count(*)::int count FROM oidc_auth_flows"))
        .rows[0].count,
      0,
    );
  });
});
