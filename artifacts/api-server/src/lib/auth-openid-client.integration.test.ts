import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { createServer } from "node:http";
import { it } from "node:test";
import { OpenidClientV6Protocol } from "./auth-oidc";
import type { AuthRuntimeConfig } from "./runtime-config";

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

it("completes a real openid-client v6 authorization-code exchange against a conforming issuer", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" });
  let issuer = "";
  let expectedNonce = "";
  const server = createServer(async (req, res) => {
    if (req.url === "/.well-known/openid-configuration") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
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
      }));
      return;
    }
    if (req.url === "/jwks") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ keys: [{ ...jwk, use: "sig", alg: "RS256", kid: "phase18-test" }] }));
      return;
    }
    if (req.url === "/token" && req.method === "POST") {
      for await (const _chunk of req) { /* consume the request */ }
      const now = Math.floor(Date.now() / 1_000);
      const header = encode({ alg: "RS256", kid: "phase18-test", typ: "JWT" });
      const payload = encode({ iss: issuer, sub: "approved", aud: "labops-test", iat: now, exp: now + 300, nonce: expectedNonce, name: "Approved User" });
      const input = `${header}.${payload}`;
      const signature = sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url");
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ access_token: "discarded-access-token", token_type: "Bearer", expires_in: 300, id_token: `${input}.${signature}` }));
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    issuer = `http://127.0.0.1:${address.port}`;
    const settings: AuthRuntimeConfig = {
      issuerUrl: issuer,
      clientId: "labops-test",
      clientSecret: "test-only-placeholder",
      clientAuthMethod: "client_secret_basic",
      publicBaseUrl: "http://localhost:5000",
      sessionIdleTtlSeconds: 1_800,
      sessionAbsoluteTtlSeconds: 43_200,
      flowTtlSeconds: 600,
      httpTimeoutMs: 5_000,
      secureCookies: false,
    };
    const protocol = new OpenidClientV6Protocol(settings);
    const metadata = await protocol.discover();
    assert.equal(metadata.issuer, issuer);
    const authorization = await protocol.createAuthorization();
    expectedNonce = authorization.nonce;
    assert.equal(authorization.url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(authorization.url.searchParams.get("state"), authorization.state);
    assert.equal(authorization.url.searchParams.get("nonce"), authorization.nonce);

    const identity = await protocol.exchange(
      new URL(`http://localhost:5000/api/auth/callback?code=valid&state=${authorization.state}`),
      { state: authorization.state, nonce: authorization.nonce, verifier: authorization.verifier },
    );
    assert.deepEqual(identity, {
      issuer,
      subject: "approved",
      displayName: "Approved User",
      email: undefined,
      emailVerified: undefined,
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
