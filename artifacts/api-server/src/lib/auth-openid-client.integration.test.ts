import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { afterEach, describe, it } from "node:test";
import {
  InvalidCallbackError,
  OpenidClientV6Protocol,
  ProviderUnavailableError,
} from "./auth-oidc";
import type { AuthRuntimeConfig } from "./runtime-config";

const signingKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const untrustedKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = signingKeys.publicKey.export({ format: "jwk" });
const openServers = new Set<ReturnType<typeof createServer>>();

type IssuerBehavior =
  | "valid"
  | "nonce-mismatch"
  | "wrong-audience"
  | "wrong-signature"
  | "missing-sub"
  | "token-timeout"
  | "jwks-timeout";

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function settings(issuerUrl: string, httpTimeoutMs = 500): AuthRuntimeConfig {
  return {
    issuerUrl,
    clientId: "labops-test",
    clientSecret: "test-only-placeholder",
    clientAuthMethod: "client_secret_basic",
    publicBaseUrl: "http://localhost:5000",
    sessionIdleTtlSeconds: 1_800,
    sessionAbsoluteTtlSeconds: 43_200,
    flowTtlSeconds: 600,
    httpTimeoutMs,
    secureCookies: false,
  };
}

function discoveryDocument(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    jwks_uri: `${issuer}/jwks`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_basic"],
  };
}

async function listen(
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>,
) {
  const server = createServer(handler);
  openServers.add(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  return {
    server,
    issuer: `http://127.0.0.1:${address.port}`,
  };
}

async function close(server: ReturnType<typeof createServer>) {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  openServers.delete(server);
}

afterEach(async () => {
  await Promise.all([...openServers].map(close));
});

async function createIssuer(behavior: IssuerBehavior) {
  let issuer = "";
  let expectedNonce = "";
  let discoveryRequests = 0;
  let tokenRequests = 0;
  let jwksRequests = 0;
  const running = await listen(async (req, res) => {
    if (req.url === "/.well-known/openid-configuration") {
      discoveryRequests += 1;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(discoveryDocument(issuer)));
      return;
    }
    if (req.url === "/jwks") {
      jwksRequests += 1;
      if (behavior === "jwks-timeout") return;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          keys: [
            { ...publicJwk, use: "sig", alg: "RS256", kid: "phase18-test" },
          ],
        }),
      );
      return;
    }
    if (req.url === "/token" && req.method === "POST") {
      tokenRequests += 1;
      for await (const _chunk of req) {
        // Consume the request before returning a deterministic provider response.
      }
      if (behavior === "token-timeout") return;
      const now = Math.floor(Date.now() / 1_000);
      const claims: Record<string, unknown> = {
        iss: issuer,
        sub: "approved",
        aud: behavior === "wrong-audience" ? "different-client" : "labops-test",
        iat: now,
        exp: now + 300,
        nonce:
          behavior === "nonce-mismatch" ? "different-nonce" : expectedNonce,
        name: "Approved User",
      };
      if (behavior === "missing-sub") delete claims.sub;
      const header = encode({ alg: "RS256", kid: "phase18-test", typ: "JWT" });
      const payload = encode(claims);
      const input = `${header}.${payload}`;
      const key =
        behavior === "wrong-signature"
          ? untrustedKeys.privateKey
          : signingKeys.privateKey;
      const signature = sign("RSA-SHA256", Buffer.from(input), key).toString(
        "base64url",
      );
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          access_token: "discarded-access-token",
          token_type: "Bearer",
          expires_in: 300,
          id_token: `${input}.${signature}`,
        }),
      );
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  issuer = running.issuer;
  return {
    ...running,
    setExpectedNonce(value: string) {
      expectedNonce = value;
    },
    counts() {
      return { discoveryRequests, tokenRequests, jwksRequests };
    },
  };
}

async function authorization(protocol: OpenidClientV6Protocol) {
  const result = await protocol.createAuthorization();
  return {
    result,
    callback: new URL(
      `http://localhost:5000/api/auth/callback?code=valid&state=${result.state}`,
    ),
  };
}

describe("openid-client v6 protocol integration", () => {
  it("completes an authorization-code exchange against a signed conforming issuer", async () => {
    const fake = await createIssuer("valid");
    const protocol = new OpenidClientV6Protocol(settings(fake.issuer));
    const metadata = await protocol.discover();
    assert.equal(metadata.issuer, fake.issuer);
    const { result, callback } = await authorization(protocol);
    fake.setExpectedNonce(result.nonce);
    assert.equal(result.url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(result.url.searchParams.get("state"), result.state);
    assert.equal(result.url.searchParams.get("nonce"), result.nonce);

    assert.deepEqual(await protocol.exchange(callback, result), {
      issuer: fake.issuer,
      subject: "approved",
      displayName: "Approved User",
      email: undefined,
      emailVerified: undefined,
    });
    const counts = fake.counts();
    assert.equal(counts.discoveryRequests, 1);
    assert.equal(counts.tokenRequests, 1);
  });

  for (const behavior of [
    "nonce-mismatch",
    "wrong-audience",
    "wrong-signature",
    "missing-sub",
  ] as const) {
    it(`rejects a signed token with ${behavior.replaceAll("-", " ")}`, async () => {
      const fake = await createIssuer(behavior);
      const protocol = new OpenidClientV6Protocol(settings(fake.issuer));
      const { result, callback } = await authorization(protocol);
      fake.setExpectedNonce(result.nonce);
      await assert.rejects(
        () => protocol.exchange(callback, result),
        InvalidCallbackError,
      );
      assert.equal(fake.counts().tokenRequests, 1);
    });
  }

  it("rejects a provider authorization error without contacting the token endpoint", async () => {
    const fake = await createIssuer("valid");
    const protocol = new OpenidClientV6Protocol(settings(fake.issuer));
    const { result } = await authorization(protocol);
    const callback = new URL(
      `http://localhost:5000/api/auth/callback?error=access_denied&error_description=private&state=${result.state}`,
    );
    await assert.rejects(
      () => protocol.exchange(callback, result),
      InvalidCallbackError,
    );
    assert.equal(fake.counts().tokenRequests, 0);
  });

  for (const behavior of ["token-timeout", "jwks-timeout"] as const) {
    it(`bounds and classifies a ${behavior.replace("-", " ")}`, async () => {
      const fake = await createIssuer(behavior);
      const protocol = new OpenidClientV6Protocol(settings(fake.issuer, 50));
      const { result, callback } = await authorization(protocol);
      fake.setExpectedNonce(result.nonce);
      const startedAt = Date.now();
      await assert.rejects(
        () => protocol.exchange(callback, result),
        ProviderUnavailableError,
      );
      assert(
        Date.now() - startedAt < 1_000,
        "provider deadline was not bounded",
      );
      assert.equal(fake.counts().tokenRequests, 1);
      assert.equal(
        fake.counts().jwksRequests,
        behavior === "jwks-timeout" ? 1 : 0,
      );
    });
  }

  it("reuses cached discovery and coalesces concurrent cold discovery", async () => {
    let issuer = "";
    let discoveryRequests = 0;
    let releaseDiscovery!: () => void;
    const discoveryGate = new Promise<void>((resolve) => {
      releaseDiscovery = resolve;
    });
    const running = await listen(async (req, res) => {
      if (req.url === "/.well-known/openid-configuration") {
        discoveryRequests += 1;
        await discoveryGate;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(discoveryDocument(issuer)));
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    issuer = running.issuer;
    const protocol = new OpenidClientV6Protocol(settings(issuer));
    const first = protocol.discover();
    const second = protocol.discover();
    releaseDiscovery();
    const [firstMetadata, secondMetadata] = await Promise.all([first, second]);
    const cachedMetadata = await protocol.discover();
    assert.strictEqual(firstMetadata, secondMetadata);
    assert.strictEqual(secondMetadata, cachedMetadata);
    assert.equal(discoveryRequests, 1);
  });

  it("bounds a stalled discovery request", async () => {
    let discoveryRequests = 0;
    const running = await listen((req) => {
      if (req.url === "/.well-known/openid-configuration")
        discoveryRequests += 1;
    });
    const protocol = new OpenidClientV6Protocol(settings(running.issuer, 50));
    const startedAt = Date.now();
    await assert.rejects(
      () => protocol.discover(),
      (error: unknown) => {
        assert(error instanceof Error);
        return true;
      },
    );
    assert(
      Date.now() - startedAt < 1_000,
      "discovery deadline was not bounded",
    );
    assert.equal(discoveryRequests, 1);
  });
});
