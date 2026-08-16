/**
 * Phase 20: Database Credential Assertion Tests
 *
 * These tests verify that no cleartext credentials are persisted in the database.
 * Run as part of CI/CD to catch secret leakage.
 */

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { pool } from "@workspace/db";

const TEST_CREDENTIALS = [
  "test_auth_password_123",
  "test_privacy_key_456", 
  "snmp_secret_test",
  "admin_password_test",
  "SuperSecretSNMP2024",
];

describe("Database credential assertion tests", () => {
  before(async () => {
    await pool.query("SELECT 1");
  });

  describe("saved_configurations table", () => {
    it("should not contain any test credentials in generated_configuration column", async () => {
      const credentialPatterns = TEST_CREDENTIALS.map(c => `%${c}%`);
      
      const result = await pool.query(
        "SELECT COUNT(*) as count FROM saved_configurations WHERE generated_configuration ILIKE ANY ($1::text[])",
        [credentialPatterns]
      );
      
      const count = Number(result.rows[0].count);
      assert.equal(count, 0, `Found ${count} saved configurations containing test credentials`);
    });

    it("should have redacted placeholders in SNMPv3 configs", async () => {
      const results = await pool.query(
        "SELECT id, generated_configuration FROM saved_configurations WHERE configuration_type = 'SNMPv3' AND generated_configuration ILIKE '%password%'"
      );

      for (const row of results.rows as any[]) {
        const config = row.generated_configuration as string;
        const hasAuthPlaceholder = config.includes("<AUTH_PASSWORD>");
        const hasPrivPlaceholder = config.includes("<PRIV_PASSWORD>");
        
        assert.ok(
          hasAuthPlaceholder || hasPrivPlaceholder,
          `SNMPv3 config id=${row.id} should have redacted placeholders`
        );
      }
    });
  });

  describe("devices table", () => {
    it("should not store test credentials in device fields", async () => {
      const credentialPatterns = TEST_CREDENTIALS.map(c => `%${c}%`);
      const result = await pool.query(
        "SELECT COUNT(*) as count FROM devices WHERE CONCAT(hostname, COALESCE(notes, '')) ILIKE ANY ($1::text[])",
        [credentialPatterns]
      );

      const count = Number(result.rows[0].count);
      assert.equal(count, 0, `Found ${count} devices containing test credentials`);
    });
  });
});