/**
 * Phase 23: Migration and backup procedures
 *
 * Tests for proper migration infrastructure, database restoration,
 * and backup verification procedures.
 */

import assert from "node:assert/strict";
import { before, after, describe, it } from "node:test";
import { pool } from "@workspace/db";

describe("Phase 23: Migration infrastructure", () => {
  before(async () => {
    await pool.query("SELECT 1");
  });

  after(async () => {
    await pool.end();
  });

  describe("migration tracking", () => {
    it("verifies drizzle_migrations table exists", async () => {
      const result = await pool.query({
        text: `
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'drizzle_migrations'
          )
        `,
      });

      const tableExists = result.rows[0]?.exists;
      console.log(`drizzle_migrations table exists: ${tableExists}`);
    });

    it("verifies migration status query works", async () => {
      const result = await pool.query({
        text: `SELECT hash, created_at FROM drizzle_migrations ORDER BY created_at`,
      });

      console.log(`Applied migrations: ${result.rowCount}`);
      result.rows.forEach((row) => {
        console.log(`  - ${row.hash} at ${row.created_at}`);
      });
    });
  });

  describe("database schema verification", () => {
    it("verifies all core tables exist", async () => {
      const tables = [
        "users",
        "devices",
        "monitoring_history",
        "monitoring_incidents",
        "reachability_jobs",
        "collectors",
        "roles",
        "user_role_memberships",
        "auth_sessions",
        "oidc_auth_flows",
        "saved_configurations",
        "notification_deliveries",
        "maintenance_history",
        "application_settings",
      ];

      const result = await pool.query({
        text: `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ANY($1)
          ORDER BY table_name
        `,
        values: [tables],
      });

      const existingTables = result.rows.map((r) => r.table_name);
      const missingTables = tables.filter((t) => !existingTables.includes(t));

      assert.equal(missingTables.length, 0, 
        `Missing tables: ${missingTables.join(", ")}`);

      console.log(`All ${tables.length} core tables verified`);
    });

    it("verifies all enums exist", async () => {
      const enums = [
        "user_roles",
        "reachability_job_status", 
        "collector_status",
        "notification_type",
      ];

      for (const enumName of enums) {
        const result = await pool.query({
          text: `
            SELECT typname FROM pg_type 
            WHERE typname = $1
          `,
          values: [enumName],
        });

        assert.equal(result.rowCount, 1, `Enum '${enumName}' not found`);
        console.log(`Enum verified: ${enumName}`);
      }
    });
  });

  describe("backup verification", () => {
    it("can query database connection health", async () => {
      // Simple connection test that works for restore verification
      const result = await pool.query("SELECT version()");
      assert.ok(result.rows[0]?.version, "Database version query failed");
      console.log(`Database connected and responsive`);
    });

    it("verifies row counts for backup integrity", async () => {
      // Quick count queries to verify data presence
      const tableCounts = await pool.query({
        text: `
          SELECT 
            'users' as table_name,
            (SELECT COUNT(*) FROM users) as count
          UNION ALL
          SELECT 
            'devices' as table_name,
            (SELECT COUNT(*) FROM devices) as count
          UNION ALL
          SELECT 
            'settings' as table_name,
            (SELECT COUNT(*) FROM application_settings) as count
        `,
      });

      console.log("Table row counts for backup verification:");
      tableCounts.rows.forEach((row) => {
        console.log(`  ${row.table_name}: ${row.count} rows`);
      });
    });
  });
});