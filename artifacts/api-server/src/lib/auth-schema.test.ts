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

  it("defines hashed revocable sessions with expiry constraints and indexes", () => {
    const config = names(authSessionsTable);
    assert(config.columns.includes("token_hash"));
    assert(!config.columns.includes("token"));
    assert.equal(config.foreignKeys, 1);
    assert(config.unique.includes("auth_sessions_token_hash_unique"));
    assert.deepEqual(config.indexes.sort(), ["auth_sessions_expiry_idx", "auth_sessions_last_seen_idx", "auth_sessions_user_id_idx"]);
    assert.deepEqual(config.checks, ["auth_sessions_idle_before_absolute_check"]);
  });

  it("defines one-time OIDC flow secrets with hash uniqueness and expiry constraint", () => {
    const config = names(oidcAuthFlowsTable);
    assert.deepEqual(config.columns, ["id", "state_hash", "state", "nonce", "pkce_verifier", "issuer", "created_at", "expires_at"]);
    assert(config.unique.includes("oidc_auth_flows_state_hash_unique"));
    assert.deepEqual(config.indexes, ["oidc_auth_flows_expires_at_idx"]);
    assert.deepEqual(config.checks, ["oidc_auth_flows_expiry_check"]);
  });
});
