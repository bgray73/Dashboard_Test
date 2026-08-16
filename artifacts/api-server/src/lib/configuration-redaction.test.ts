import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { containsSecrets, redactSecrets, validateConfigurationInput } from "./configuration-redaction";

describe("configuration-redaction", () => {
  describe("containsSecrets", () => {
    it("returns false for safe configurations", () => {
      const safeConfig = `
        snmp-server host 192.168.1.1 version 3
        snmp-server enableTraps
      `;
      const result = containsSecrets(safeConfig);
      assert.equal(result.hasSecrets, false);
      assert.equal(result.patterns.length, 0);
    });

    it("returns true for SNMPv3 auth password pattern", () => {
      // Cisco-style SNMPv3 config with auth password
      const configWithAuth = `
        snmp-server user admin group networkoperator v3 auth md5 myAuthPass123
      `;
      const result = containsSecrets(configWithAuth);
      assert.equal(result.hasSecrets, true);
      assert.equal(result.patterns.includes("auth_password"), true);
    });

    it("returns true for SNMPv3 privacy password pattern", () => {
      const configWithPriv = `
        snmp-server user admin group networkoperator v3 priv aes 256 myPrivKey456
      `;
      const result = containsSecrets(configWithPriv);
      assert.equal(result.hasSecrets, true);
      assert.equal(result.patterns.includes("priv_password"), true);
    });

    it("returns true for password keyword in configuration", () => {
      const config = "snmp auth password=secret123";
      const result = containsSecrets(config);
      assert.equal(result.hasSecrets, true);
    });
  });

  describe("redactSecrets", () => {
    it("redacts SNMPv3 auth parameters", () => {
      const config = "snmp auth md5 mysecretpassword";
      const redacted = redactSecrets(config);
      assert.equal(redacted.includes("mysecretpassword"), false);
      assert.equal(redacted.includes("<AUTH_PASSWORD>"), true);
    });

    it("redacts SNMPv3 priv parameters", () => {
      const config = "snmp priv aes mysecretopensslkey";
      const redacted = redactSecrets(config);
      assert.equal(redacted.includes("mysecretopensslkey"), false);
      assert.equal(redacted.includes("<PRIV_PASSWORD>"), true);
    });

    it("redacts password= patterns", () => {
      const config = "snmp auth password=secret123";
      const redacted = redactSecrets(config);
      assert.equal(redacted.includes("secret123"), false);
      assert.equal(redacted.includes("<REDACTED>"), true);
    });

    it("redacts passphrase patterns", () => {
      const config = "snmp-server user admin auth sha1 passphrase=myprivatekey";
      const redacted = redactSecrets(config);
      assert.equal(redacted.includes("myprivatekey"), false);
    });

    it("leaves non-secret content intact", () => {
      const config = `
        snmp-server enableTraps
        snmp-server host 192.168.1.1 version 3
      `;
      const redacted = redactSecrets(config);
      assert.equal(redacted.includes("snmp-server enableTraps"), true);
      assert.equal(redacted.includes("192.168.1.1"), true);
    });
  });

  describe("validateConfigurationInput", () => {
    it("rejects direct auth password in request", () => {
      const input = {
        generatedConfiguration: "snmp config here",
        authPassword: "user-provided-password",
      };
      const result = validateConfigurationInput(input);
      assert.equal(result.valid, false);
      assert.ok(result.error!.includes("auth password"));
    });

    it("rejects direct privacy password in request", () => {
      const input = {
        generatedConfiguration: "snmp config here",
        privacyPassword: "user-provided-privacy",
      };
      const result = validateConfigurationInput(input);
      assert.equal(result.valid, false);
      assert.ok(result.error!.includes("privacy password"));
    });

    it("rejects SNMPv3 auth configuration with embedded secrets", () => {
      const input = {
        generatedConfiguration: "snmp-server user admin auth md5 mysecretpassword",
      };
      const result = validateConfigurationInput(input);
      assert.equal(result.valid, false);
      assert.ok(result.error!.includes("embedded secrets"));
    });

    it("accepts valid configuration without passwords", () => {
      const input = {
        generatedConfiguration: "snmp-server enableTraps",
      };
      const result = validateConfigurationInput(input);
      assert.equal(result.valid, true);
    });

    it("accepts empty configuration", () => {
      const input = {};
      const result = validateConfigurationInput(input);
      assert.equal(result.valid, true);
    });
  });
});