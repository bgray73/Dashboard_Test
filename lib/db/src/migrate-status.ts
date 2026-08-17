import { pool } from "./index.js";
import { readdirSync } from "node:fs";
import path from "node:path";

async function createMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(): Promise<Array<{ hash: string; created_at: string }>> {
  const result = await pool.query(
    "SELECT hash, created_at FROM drizzle_migrations ORDER BY created_at"
  );
  return result.rows.map((row: { hash: string; created_at: string }) => ({
    hash: row.hash,
    created_at: row.created_at,
  }));
}

function getMigrationFiles(): string[] {
  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files;
}

function extractHash(filename: string): string {
  const match = filename.match(/_(.+)\.sql$/);
  return match ? match[1] : filename;
}

function printUsage(): never {
  console.log(`
Usage: pnpm --filter @workspace/db db:migrate:status [options]

Options:
  --json       Output as JSON
  --pending    Show only pending migrations
  --applied    Show only applied migrations
  --help       Show this help

Examples:
  pnpm --filter @workspace/db db:migrate:status
  pnpm --filter @workspace/db db:migrate:status --pending
`);
  process.exit(0);
}

async function main() {
  const args = process.argv.slice(2);
  const showJson = args.includes("--json");
  const showPending = args.includes("--pending");
  const showApplied = args.includes("--applied");
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
  }

  try {
    await createMigrationsTable();

    const appliedMigrations = await getAppliedMigrations();
    const appliedHashes = new Set(
      appliedMigrations.map((m) => m.hash)
    );
    const migrationFiles = getMigrationFiles();

    const report = {
      total_migrations: migrationFiles.length,
      applied_count: appliedMigrations.length,
      pending_count: migrationFiles.length - appliedMigrations.length,
      migrations: migrationFiles.map((filename) => {
        const hash = extractHash(filename);
        const isApplied = appliedHashes.has(hash);
        const appliedInfo = appliedMigrations.find((m) => m.hash === hash);

        return {
          filename,
          hash,
          status: isApplied ? "applied" : "pending",
          applied_at: isApplied ? appliedInfo!.created_at : null,
        };
      }),
    };

    if (showJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log("\n=== Migration Status ===\n");
      console.log(`Total migrations: ${report.total_migrations}`);
      console.log(`Applied: ${report.applied_count}`);
      console.log(`Pending: ${report.pending_count}\n`);

      if (showApplied || (!showPending && !showApplied)) {
        console.log("Applied migrations:");
        appliedMigrations.forEach((m) => {
          console.log(`  ✓ ${m.hash} - ${m.created_at}`);
        });
        console.log();
      }

      if (showPending || (!showApplied && !showPending)) {
        const pending = report.migrations.filter((m) => m.status === "pending");
        if (pending.length > 0) {
          console.log("Pending migrations:");
          pending.forEach((m) => {
            console.log(`  ○ ${m.filename}`);
          });
        } else {
          console.log("All migrations applied.");
        }
      }
    }
  } catch (error) {
    console.error("Status check failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();