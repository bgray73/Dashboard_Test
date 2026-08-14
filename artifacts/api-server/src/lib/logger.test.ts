import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { it } from "node:test";
import pino from "pino";
import { loggerOptions } from "./logger";

it("redacts authentication secrets from structured logs", () => {
  let output = "";
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  const testLogger = pino(loggerOptions, destination);
  testLogger.warn(
    {
      clientSecret: "client-secret-value",
      authorizationCode: "authorization-code-value",
      state: "state-value",
      nonce: "nonce-value",
      pkceVerifier: "verifier-value",
      session: {
        token: "session-token-value",
        tokenHash: "session-hash-value",
      },
      req: {
        headers: {
          authorization: "Bearer collector-secret",
          cookie: "labops_session=cookie-secret",
        },
      },
      res: { headers: { "set-cookie": "labops_session=set-cookie-secret" } },
    },
    "safe event",
  );

  for (const secret of [
    "client-secret-value",
    "authorization-code-value",
    "state-value",
    "nonce-value",
    "verifier-value",
    "session-token-value",
    "session-hash-value",
    "collector-secret",
    "cookie-secret",
    "set-cookie-secret",
  ]) {
    assert(!output.includes(secret), `log leaked ${secret}`);
  }
  assert(output.includes("safe event"));
});

it("redacts secrets from thrown and nested errors", () => {
  let output = "";
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  const testLogger = pino(loggerOptions, destination);
  const nested = new Error("provider failed with thrown-secret");
  Object.assign(nested, {
    clientSecret: "error-property-secret",
    cause: {
      oidc: {
        authorizationCode: "nested-code-secret",
        state: "nested-state-secret",
      },
    },
  });
  testLogger.error(
    {
      err: nested,
      context: {
        oidc: {
          clientSecret: "deep-client-secret",
          nonce: "deep-nonce-secret",
        },
      },
    },
    "provider failure",
  );

  const secrets = [
    "thrown-secret",
    "error-property-secret",
    "nested-code-secret",
    "nested-state-secret",
    "deep-client-secret",
    "deep-nonce-secret",
  ];
  assert.deepEqual(
    secrets.filter((secret) => output.includes(secret)),
    [],
    "log leaked thrown or nested secrets",
  );
  assert(output.includes("provider failure"));
});
