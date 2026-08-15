import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cookiePolicy, generateSessionToken, hashOpaqueToken } from "./auth-token";

describe("opaque session tokens and cookies", () => {
  it("generates independent 256-bit base64url tokens and hashes deterministically", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();
    assert.match(first, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(first, second);
    assert.equal(hashOpaqueToken("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("uses the host-only secure production cookie and exact clearing attributes", () => {
    const policy = cookiePolicy(true, 43_200);
    assert.equal(policy.name, "__Host-labops_session");
    assert.deepEqual(policy.set, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 43_200_000 });
    assert.deepEqual(policy.clear, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  });

  it("uses a non-Secure local cookie without weakening other flags", () => {
    const policy = cookiePolicy(false, 1800);
    assert.equal(policy.name, "labops_session");
    assert.equal(policy.set.secure, false);
    assert.equal(policy.set.httpOnly, true);
    assert.equal(policy.set.sameSite, "lax");
  });
});
