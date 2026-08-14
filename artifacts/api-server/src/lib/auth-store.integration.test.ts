import assert from "node:assert/strict";
import { before, beforeEach, describe, it } from "node:test";
import { pool } from "@workspace/db";
import { AuthStore, checkAuthSchemaReady, IdentityNotProvisionedError } from "./auth-store";
import { hashOpaqueToken } from "./auth-token";

const store = new AuthStore(pool, { idleTtlSeconds: 1800, absoluteTtlSeconds: 43200 });

before(async () => checkAuthSchemaReady(pool));
beforeEach(async () => {
  await pool.query("TRUNCATE oidc_auth_flows, auth_sessions, users RESTART IDENTITY CASCADE");
});

describe("PostgreSQL authentication store", () => {
  it("bootstraps only the exact configured first identity under concurrency", async () => {
    const identity = { issuer: "https://id.example", subject: "CaseSensitive", displayName: "First", email: "first@example.test", emailVerified: true };
    const results = await Promise.allSettled([
      store.mapIdentity(identity, { issuer: identity.issuer, subject: identity.subject }),
      store.mapIdentity(identity, { issuer: identity.issuer, subject: identity.subject }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 2);
    const count = await pool.query("SELECT count(*)::int AS count FROM users");
    assert.equal(count.rows[0].count, 1);

    await assert.rejects(
      store.mapIdentity({ ...identity, subject: "other", email: "first@example.test" }, { issuer: identity.issuer, subject: identity.subject }),
      IdentityNotProvisionedError,
    );
  });

  it("refuses first-request-wins when bootstrap is absent or mismatched", async () => {
    await assert.rejects(
      store.mapIdentity({ issuer: "https://id.example", subject: "intruder" }, {}),
      IdentityNotProvisionedError,
    );
    const count = await pool.query("SELECT count(*)::int AS count FROM users");
    assert.equal(count.rows[0].count, 0);
  });

  it("issues only a token hash, rotates an old session, and looks up locally", async () => {
    const user = await store.mapIdentity(
      { issuer: "https://id.example", subject: "approved", displayName: "Approved" },
      { issuer: "https://id.example", subject: "approved" },
    );
    const old = await store.issueSession(user.id);
    const current = await store.issueSession(user.id, old.token);
    assert.notEqual(current.token, old.token);
    assert.equal(await store.lookupSession(old.token), undefined);
    const found = await store.lookupSession(current.token);
    assert.deepEqual(found?.user, { id: user.id, displayName: "Approved", email: null });

    const rows = await pool.query("SELECT token_hash, row_to_json(auth_sessions)::text AS raw FROM auth_sessions ORDER BY id");
    assert.equal(rows.rows[1].token_hash, hashOpaqueToken(current.token));
    assert(!rows.rows.some((row) => row.raw.includes(current.token) || row.raw.includes(old.token)));
  });

  it("rejects revoked, idle-expired, and absolute-expired sessions and revokes logout immediately", async () => {
    const user = await store.mapIdentity({ issuer: "https://id.example", subject: "approved" }, { issuer: "https://id.example", subject: "approved" });
    for (const column of ["revoked_at", "idle_expires_at", "absolute_expires_at"] as const) {
      const issued = await store.issueSession(user.id);
      if (column === "absolute_expires_at") {
        await pool.query("UPDATE auth_sessions SET idle_expires_at=now()-interval '1 second', absolute_expires_at=now()-interval '1 second' WHERE token_hash=$1", [hashOpaqueToken(issued.token)]);
      } else {
        await pool.query(`UPDATE auth_sessions SET ${column} = now() - interval '1 second' WHERE token_hash = $1`, [hashOpaqueToken(issued.token)]);
      }
      assert.equal(await store.lookupSession(issued.token), undefined);
    }
    const logout = await store.issueSession(user.id);
    await store.revokeSession(logout.token);
    assert.equal(await store.lookupSession(logout.token), undefined);
  });

  it("throttles idle touches, caps them at absolute expiry, and cleans invalid rows", async () => {
    const user = await store.mapIdentity({ issuer: "https://id.example", subject: "approved" }, { issuer: "https://id.example", subject: "approved" });
    const issued = await store.issueSession(user.id);
    const hash = hashOpaqueToken(issued.token);
    const before = await pool.query("SELECT last_seen_at FROM auth_sessions WHERE token_hash=$1", [hash]);
    await store.lookupSession(issued.token);
    const untouched = await pool.query("SELECT last_seen_at FROM auth_sessions WHERE token_hash=$1", [hash]);
    assert.equal(untouched.rows[0].last_seen_at.getTime(), before.rows[0].last_seen_at.getTime());
    await pool.query("UPDATE auth_sessions SET last_seen_at=now()-interval '6 minutes', absolute_expires_at=now()+interval '10 minutes', idle_expires_at=now()+interval '10 minutes' WHERE token_hash=$1", [hash]);
    await store.lookupSession(issued.token);
    const touched = await pool.query("SELECT idle_expires_at <= absolute_expires_at AS capped, last_seen_at > now()-interval '1 minute' AS fresh FROM auth_sessions WHERE token_hash=$1", [hash]);
    assert.deepEqual(touched.rows[0], { capped: true, fresh: true });
    await store.revokeSession(issued.token);
    assert((await store.cleanup()).sessions >= 1);
  });
});
