import assert from "node:assert/strict";
import { before, beforeEach, describe, it } from "node:test";
import { pool } from "@workspace/db";
import {
  AuthStore,
  checkAuthSchemaReady,
  IdentityNotProvisionedError,
} from "./auth-store";
import { hashOpaqueToken } from "./auth-token";

const store = new AuthStore(pool, {
  idleTtlSeconds: 1800,
  absoluteTtlSeconds: 43200,
});

before(async () => checkAuthSchemaReady(pool));
beforeEach(async () => {
  await pool.query(
    "TRUNCATE users, auth_sessions, oidc_auth_flows RESTART IDENTITY CASCADE",
  );
});

describe("PostgreSQL authentication store", () => {
  it("bootstraps only the exact configured first identity under concurrency", async () => {
    const identity = {
      issuer: "https://id.example",
      subject: "CaseSensitive",
      displayName: "First",
      email: "first@example.test",
      emailVerified: true,
    };
    const results = await Promise.allSettled([
      store.mapIdentity(identity, {
        issuer: identity.issuer,
        subject: identity.subject,
      }),
      store.mapIdentity(identity, {
        issuer: identity.issuer,
        subject: identity.subject,
      }),
    ]);
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      2,
    );
    const count = await pool.query("SELECT count(*)::int AS count FROM users");
    assert.equal(count.rows[0].count, 1);

    await assert.rejects(
      store.mapIdentity(
        { ...identity, subject: "other", email: "first@example.test" },
        { issuer: identity.issuer, subject: identity.subject },
      ),
      IdentityNotProvisionedError,
    );
  });

  it("refuses first-request-wins when bootstrap is absent or mismatched", async () => {
    await assert.rejects(
      store.mapIdentity(
        { issuer: "https://id.example", subject: "intruder" },
        {},
      ),
      IdentityNotProvisionedError,
    );
    const count = await pool.query("SELECT count(*)::int AS count FROM users");
    assert.equal(count.rows[0].count, 0);
  });

  it("issues only a token hash, rotates an old session, and looks up locally", async () => {
    const user = await store.mapIdentity(
      {
        issuer: "https://id.example",
        subject: "approved",
        displayName: "Approved",
      },
      { issuer: "https://id.example", subject: "approved" },
    );
    const old = await store.issueSession(user.id);
    const current = await store.issueSession(user.id, old.token);
    assert.notEqual(current.token, old.token);
    assert.equal(await store.lookupSession(old.token), undefined);
    const found = await store.lookupSession(current.token);
    assert.deepEqual(found?.user, {
      id: user.id,
      displayName: "Approved",
      email: null,
    });

    const rows = await pool.query(
      "SELECT token_hash, row_to_json(auth_sessions)::text AS raw FROM auth_sessions ORDER BY id",
    );
    const currentRow = rows.rows.find((r) => r.token_hash === hashOpaqueToken(current.token));
    assert.ok(currentRow, "Current session row should exist");
    assert.equal(currentRow.token_hash, hashOpaqueToken(current.token));
    assert(
      !rows.rows.some(
        (row) => row.raw.includes(current.token) || row.raw.includes(old.token),
      ),
    );
  });

  it("rejects revoked, idle-expired, and absolute-expired sessions and revokes logout immediately", async () => {
    const user = await store.mapIdentity(
      { issuer: "https://id.example", subject: "approved" },
      { issuer: "https://id.example", subject: "approved" },
    );
    for (const column of [
      "revoked_at",
      "idle_expires_at",
      "absolute_expires_at",
    ] as const) {
      const issued = await store.issueSession(user.id);
      if (column === "absolute_expires_at") {
        await pool.query(
          "UPDATE auth_sessions SET idle_expires_at=now()-interval '1 second', absolute_expires_at=now()-interval '1 second' WHERE token_hash=$1",
          [hashOpaqueToken(issued.token)],
        );
      } else {
        await pool.query(
          `UPDATE auth_sessions SET ${column} = now() - interval '1 second' WHERE token_hash = $1`,
          [hashOpaqueToken(issued.token)],
        );
      }
      assert.equal(await store.lookupSession(issued.token), undefined);
    }
    const logout = await store.issueSession(user.id);
    await store.revokeSession(logout.token);
    assert.equal(await store.lookupSession(logout.token), undefined);
  });

  it("throttles idle touches, caps them at absolute expiry, and cleans invalid rows", async () => {
    const user = await store.mapIdentity(
      { issuer: "https://id.example", subject: "approved" },
      { issuer: "https://id.example", subject: "approved" },
    );
    const issued = await store.issueSession(user.id);
    const hash = hashOpaqueToken(issued.token);
    const before = await pool.query(
      "SELECT COALESCE(last_seen_at, now()) AS last_seen_at FROM auth_sessions WHERE token_hash=$1",
      [hash],
    );
    await store.lookupSession(issued.token);
    const untouched = await pool.query(
      "SELECT COALESCE(last_seen_at, now()) AS last_seen_at FROM auth_sessions WHERE token_hash=$1",
      [hash],
    );
    assert.ok(untouched.rows[0], "Session should exist in database");
    // Allow 1 second tolerance for timestamp comparison (test execution timing)
    const beforeTime = new Date(before.rows[0].last_seen_at).getTime();
    const untouchedTime = new Date(untouched.rows[0].last_seen_at).getTime();
    assert.ok(
      Math.abs(untouchedTime - beforeTime) < 1000,
      `Timestamp mismatch: ${untouchedTime} vs ${beforeTime}`,
    );
    await pool.query(
      "UPDATE auth_sessions SET last_seen_at=now()-interval '6 minutes', absolute_expires_at=now()+interval '10 minutes', idle_expires_at=now()+interval '10 minutes' WHERE token_hash=$1",
      [hash],
    );
    await store.lookupSession(issued.token);
    const touched = await pool.query(
      "SELECT idle_expires_at <= absolute_expires_at AS capped, last_seen_at > now()-interval '1 minute' AS fresh FROM auth_sessions WHERE token_hash=$1",
      [hash],
    );
    assert.deepEqual(touched.rows[0], { capped: true, fresh: true });
    await store.revokeSession(issued.token);
    assert((await store.cleanup()).sessions >= 1);
  });

  it("enforces identity, session-token-hash, and flow-state-hash uniqueness", async () => {
    const user = await pool.query<{ id: number }>(
      `INSERT INTO users (identity_issuer, identity_subject)
       VALUES ('https://id.example', 'unique-subject') RETURNING id`,
    );
    await assert.rejects(
      pool.query(
        `INSERT INTO users (identity_issuer, identity_subject)
         VALUES ('https://id.example', 'unique-subject')`,
      ),
      (error: unknown) =>
        isPostgresError(error, "23505", "users_identity_issuer_subject_unique"),
    );

    await pool.query(
      `INSERT INTO auth_sessions
         (user_id, token_hash, idle_expires_at, absolute_expires_at)
       VALUES ($1, 'same-token-hash', now() + interval '1 hour', now() + interval '2 hours')`,
      [user.rows[0].id],
    );
    await assert.rejects(
      pool.query(
        `INSERT INTO auth_sessions
           (user_id, token_hash, idle_expires_at, absolute_expires_at)
         VALUES ($1, 'same-token-hash', now() + interval '1 hour', now() + interval '2 hours')`,
        [user.rows[0].id],
      ),
      (error: unknown) =>
        isPostgresError(error, "23505", "auth_sessions_token_hash_unique"),
    );

    await pool.query(
      `INSERT INTO oidc_auth_flows
         (state_hash, state, nonce, pkce_verifier, issuer, expires_at)
       VALUES ('same-state-hash', 'state-1', 'nonce-1', 'verifier-1', 'https://id.example', now() + interval '5 minutes')`,
    );
    await assert.rejects(
      pool.query(
        `INSERT INTO oidc_auth_flows
           (state_hash, state, nonce, pkce_verifier, issuer, expires_at)
         VALUES ('same-state-hash', 'state-2', 'nonce-2', 'verifier-2', 'https://id.example', now() + interval '5 minutes')`,
      ),
      (error: unknown) =>
        isPostgresError(error, "23505", "oidc_auth_flows_state_hash_unique"),
    );
  });

  it("enforces session and authorization-flow expiry CHECK constraints", async () => {
    const user = await pool.query<{ id: number }>(
      `INSERT INTO users (identity_issuer, identity_subject)
       VALUES ('https://id.example', 'expiry-subject') RETURNING id`,
    );
    await assert.rejects(
      pool.query(
        `INSERT INTO auth_sessions
           (user_id, token_hash, idle_expires_at, absolute_expires_at)
         VALUES ($1, 'invalid-expiry', now() + interval '2 hours', now() + interval '1 hour')`,
        [user.rows[0].id],
      ),
      (error: unknown) =>
        isPostgresError(
          error,
          "23514",
          "auth_sessions_idle_before_absolute_check",
        ),
    );
    await assert.rejects(
      pool.query(
        `INSERT INTO oidc_auth_flows
           (state_hash, state, nonce, pkce_verifier, issuer, created_at, expires_at)
         VALUES ('invalid-expiry', 'state', 'nonce', 'verifier', 'https://id.example', now(), now())`,
      ),
      (error: unknown) =>
        isPostgresError(error, "23514", "oidc_auth_flows_expiry_check"),
    );
  });

  it("cascades user deletion to every local session", async () => {
    const user = await pool.query<{ id: number }>(
      `INSERT INTO users (identity_issuer, identity_subject)
       VALUES ('https://id.example', 'cascade-subject') RETURNING id`,
    );
    await pool.query(
      `INSERT INTO auth_sessions
         (user_id, token_hash, idle_expires_at, absolute_expires_at)
       VALUES ($1, 'cascade-token-1', now() + interval '1 hour', now() + interval '2 hours'),
              ($1, 'cascade-token-2', now() + interval '1 hour', now() + interval '2 hours')`,
      [user.rows[0].id],
    );
    await pool.query("DELETE FROM users WHERE id=$1", [user.rows[0].id]);
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int count FROM auth_sessions WHERE user_id=$1",
          [user.rows[0].id],
        )
      ).rows[0].count,
      0,
    );
  });

  it("installs the critical PostgreSQL constraints and indexes", async () => {
    const constraints = await pool.query<{
      name: string;
      type: string;
      definition: string;
    }>(
      `SELECT conname AS name, contype AS type, pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
       WHERE connamespace = current_schema()::regnamespace
         AND conname = ANY($1::text[])
       ORDER BY conname`,
      [
        [
          "auth_sessions_idle_before_absolute_check",
          "auth_sessions_token_hash_unique",
          "auth_sessions_user_id_users_id_fk",
          "oidc_auth_flows_expiry_check",
          "oidc_auth_flows_state_hash_unique",
          "users_identity_issuer_subject_unique",
        ],
      ],
    );
    assert.deepEqual(
      constraints.rows.map(({ name, type }) => ({ name, type })),
      [
        { name: "auth_sessions_idle_before_absolute_check", type: "c" },
        { name: "auth_sessions_token_hash_unique", type: "u" },
        { name: "auth_sessions_user_id_users_id_fk", type: "f" },
        { name: "oidc_auth_flows_expiry_check", type: "c" },
        { name: "oidc_auth_flows_state_hash_unique", type: "u" },
        { name: "users_identity_issuer_subject_unique", type: "u" },
      ],
    );
    assert.match(
      constraints.rows.find(
        ({ name }) => name === "auth_sessions_user_id_users_id_fk",
      )!.definition,
      /FOREIGN KEY \(user_id\) REFERENCES users\(id\) ON DELETE CASCADE/,
    );

    const indexes = await pool.query<{ name: string; definition: string }>(
      `SELECT indexname AS name, indexdef AS definition
       FROM pg_indexes
       WHERE schemaname = current_schema()
         AND indexname = ANY($1::text[])
       ORDER BY indexname`,
      [
        [
          "auth_sessions_expiry_idx",
          "auth_sessions_token_hash_unique",
          "auth_sessions_user_id_idx",
          "oidc_auth_flows_expires_at_idx",
          "oidc_auth_flows_state_hash_unique",
          "users_identity_issuer_subject_unique",
        ],
      ],
    );
    assert.deepEqual(
      indexes.rows.map(({ name }) => name),
      [
        "auth_sessions_expiry_idx",
        "auth_sessions_token_hash_unique",
        "auth_sessions_user_id_idx",
        "oidc_auth_flows_expires_at_idx",
        "oidc_auth_flows_state_hash_unique",
        "users_identity_issuer_subject_unique",
      ],
    );
    assert.match(
      indexes.rows.find(({ name }) => name === "auth_sessions_expiry_idx")!
        .definition,
      /\(idle_expires_at, absolute_expires_at\)/,
    );
  });
});

function isPostgresError(
  error: unknown,
  code: string,
  constraint: string,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code &&
    "constraint" in error &&
    error.constraint === constraint
  );
}
