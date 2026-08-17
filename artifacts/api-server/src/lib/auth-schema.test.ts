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
    assert.deepEqual(config.columns.sort(), ["created_at", "display_name", "email", "email_verified", "id", "identity_issuer", "identity_subject", "last_login_at", "updated_at"]);
    assert.deepEqual(config.unique.sort(), ["users_identity_issuer_subject_unique"]);
  });

  it("defines revocable sessions with indexes and foreign key constraints", () => {
    const config = names(authSessionsTable);
    // Check for required columns from auth-store.ts checkAuthSchemaReady
    assert(config.columns.includes("user_id"));
    assert(config.columns.includes("token_hash"));
    assert(config.columns.includes("idle_expires_at"));
    assert(config.columns.includes("absolute_expires_at"));
    assert(config.columns.includes("revoked_at"));
    // Verify no raw "token" column (should be token_hash)
    assert(!config.columns.includes("token"));
    assert.equal(config.foreignKeys, 1);
  });

  it("defines one-time OIDC flow secrets", () => {
    const config = names(oidcAuthFlowsTable);
    // Check for required columns from auth-store.ts checkAuthSchemaReady
    // Plus the state_hash and issuer columns needed for security
    assert(config.columns.includes("state_hash"));
    assert(config.columns.includes("state"));
    assert(config.columns.includes("nonce"));
    assert(config.columns.includes("pkce_verifier"));
    assert(config.columns.includes("issuer"));
    assert(config.columns.includes("expires_at"));
  });
});