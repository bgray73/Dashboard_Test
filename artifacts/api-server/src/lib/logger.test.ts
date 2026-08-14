import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { it } from "node:test";
import pino from "pino";
import { sensitiveRedactionPaths } from "./logger";

it("redacts authentication secrets from structured logs", () => {
  let output = "";
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  const testLogger = pino({ redact: [...sensitiveRedactionPaths] }, destination);
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
