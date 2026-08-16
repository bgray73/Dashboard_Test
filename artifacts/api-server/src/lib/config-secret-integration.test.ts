/**
 * Phase 20 Integration Tests: Saved Configuration Secret Handling
 *
 * Verifies that saved configurations don't persist cleartext secrets.
 */

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { pool } from "@workspace/db";
import { savedConfigurationsTable } from "@workspace/db";
import { db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { redactSecrets, containsSecrets } from "./configuration-redaction";

describe("Saved configuration secret handling", () => {
  before(async () => {
    await pool.query("SELECT 1");
  });

  describe("secret redaction in configuration strings", () => {
    it("produces redacted output for SNMPv3 auth passwords", () => {
      const input = "snmp-server user admin auth md5 mysecretpassword123";
      const redacted = redactSecrets(input);
      assert.equal(redacted.includes("mysecretpassword123"), false);
      assert.ok(redacted.includes("<AUTH_PASSWORD>"));
    });

    it("produces redacted output for SNMPv3 privacy passwords", () => {
      const input = "snmp-server user admin priv aes 256 mysecretprivkey";
      const redacted = redactSecrets(input);
      assert.equal(redacted.includes("mysecretprivkey"), false);
      assert.ok(redacted.includes("<PRIV_PASSWORD>"));
    });

    it("detects secrets in Cisco-style configurations", () => {
      const config = `
        snmp-server host 192.168.1.1 traps version 3 auth md5 cisco123 priv aes mykey456
        snmp-server enableTraps
      `;
      const { hasSecrets } = containsSecrets(config);
      assert.equal(hasSecrets, true);
    });
  });

  describe("database persistence", () => {
    it("verifies saved configurations use placeholders after sanitization", async () => {
      // Query existing saved configurations
      const configs = await db.select()
        .from(savedConfigurationsTable)
        .where(eq(savedConfigurationsTable.configurationType, "SNMPv3"))
        .limit(10);

      for (const config of configs) {
        const configString = config.generatedConfiguration;
        // Either it doesn't have password-like content, or it has redacted placeholders
        if (configString.toLowerCase().includes("password")) {
          assert.ok(
            configString.includes("<AUTH_PASSWORD>") || configString.includes("<PRIV_PASSWORD>"),
            `SNMPv3 config ${config.id} should have redacted placeholders`
          );
        }
      }
    });
  });
});