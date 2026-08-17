import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { authSessionsTable, oidcAuthFlowsTable, usersTable } from "@workspace/db";

function names(table: Parameters<typeof getTableConfig>[0]) {
  const config = getTableConfig(table);
  return {
    columns: config.columns.map((column) => column.name),
    indexes: config.indexes.map((index) => index.config.name),
    unique: config.uniqueConstraints.map((constraint) => constraint.name),
    checks: config.checks.map((check) => check.name),
    foreignKeys: config.foreignKeys.length,
  };
}

describe("authentication database schema", () => {
  it("exports the stable OIDC user identity with a composite unique constraint", () => {
    const config = names(usersTable);
    assert.deepEqual(config.columns, ["id", "identity_issuer", "identity_subject", "email", "display_name", "email_verified", "created_at", "updated_at", "last_login_at"]);
    assert.deepEqual(config.unique, ["users_identity_issuer_subject_unique"]);
  });

  it("defines revocable sessions with indexes and foreign key constraints", () => {
    const config = names(authSessionsTable);
    assert(config.columns.includes("revoked"));
    assert(!config.columns.includes("token"));
    assert.equal(config.foreignKeys, 1);
    assert.deepEqual(config.indexes.sort(), ["auth_sessions_expiry_idx", "auth_sessions_last_seen_idx", "auth_sessions_user_id_idx"]);
  });

  it("defines one-time OIDC flow secrets", () => {
    const config = names(oidcAuthFlowsTable);
    // Current schema has: id, state, nonce, pkce_verifier, created_at, expires_at
    assert.deepEqual(config.columns.sort(), ["created_at", "expires_at", "id", "nonce", "pkce_verifier", "state"]);
  });
});