import { pool } from "./index.js";
import { readFileSync, readdirSync } from "node:fs";
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

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query("SELECT hash FROM drizzle_migrations");
  return new Set(result.rows.map((row: { hash: string }) => row.hash));
}

function getMigrationFiles(): string[] {
  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.map((f) => path.join(migrationsDir, f));
}

function extractHash(filename: string): string {
  // Hash is everything between the timestamp prefix and _.sql
  const match = filename.match(/_(.+)\.sql$/);
  return match ? match[1] : filename;
}

async function runMigration(filePath: string): Promise<void> {
  const filename = path.basename(filePath);
  const hash = extractHash(filename);
  const sql = readFileSync(filePath, "utf-8");
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      "INSERT INTO drizzle_migrations (hash, created_at) VALUES ($1, NOW())",
      [hash]
    );
    await client.query("COMMIT");
    console.log(`✓ Applied migration: ${filename}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const rollback = process.argv.includes("--rollback");

  try {
    await createMigrationsTable();

    const appliedMigrations = await getAppliedMigrations();
    const migrationFiles = getMigrationFiles();

    if (migrationFiles.length === 0) {
      console.log("No migration files found.");
      return;
    }

    console.log(`\nFound ${migrationFiles.length} migration file(s)`);
    console.log(`Applied migrations: ${appliedMigrations.size}\n`);

    if (rollback) {
      // Rollback mode: remove the last migration
      if (appliedMigrations.size === 0) {
        console.log("No migrations to rollback.");
        return;
      }

      const lastMigration = Array.from(appliedMigrations).pop();
      const migrationFile = migrationFiles.find((f) =>
        extractHash(path.basename(f)) === lastMigration
      );

      if (!migrationFile) {
        console.log(`Cannot find migration file for hash: ${lastMigration}`);
        process.exit(1);
      }

      console.log(`Rolling back: ${path.basename(migrationFile)}`);
      await pool.query("DELETE FROM drizzle_migrations WHERE hash = $1", [
        lastMigration,
      ]);
      console.log("Rollback complete. Manual schema cleanup may be required.");
      return;
    }

    if (dryRun) {
      console.log("Dry run - migrations that would be applied:");
      let count = 0;
      for (const file of migrationFiles) {
        const hash = extractHash(path.basename(file));
        if (!appliedMigrations.has(hash)) {
          console.log(`  ${path.basename(file)}`);
          count++;
        }
      }
      console.log(`\nTotal: ${count} migration(s) would be applied`);
      return;
    }

    // Apply pending migrations
    let applied = 0;
    for (const file of migrationFiles) {
      const hash = extractHash(path.basename(file));
      if (!appliedMigrations.has(hash)) {
        await runMigration(file);
        applied++;
      }
    }

    if (applied === 0) {
      console.log("All migrations already applied.");
    } else {
      console.log(`\nSuccessfully applied ${applied} migration(s).`);
    }
  } catch (error) {
    console.error("Migration failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();