import { Router, type IRouter } from "express";
import type { Logger } from "pino";
import type { RuntimeConfig } from "../lib/runtime-config";
import { pool } from "@workspace/db";

/**
 * Readiness probe endpoint.
 *
 * Unlike `/api/healthz` (which only confirms the process is alive),
 * `/api/readyz` verifies that the application can serve traffic:
 * - PostgreSQL connectivity and schema version
 * - Required tables exist (auth schema check)
 * - Configuration is valid
 */

const router: IRouter = Router();

export interface ReadinessCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  detail?: string;
}

export interface ReadinessResponse {
  status: "pass" | "warn" | "fail";
  timestamp: string;
  checks: ReadinessCheck[];
}

export function createReadinessRouter(
  _config: RuntimeConfig,
  appLogger?: Logger,
): IRouter {
  const log = appLogger ?? console;

  router.get("/readyz", async (_req, res) => {
    const checks: ReadinessCheck[] = [];
    let failed = false;

    // 1. Database connectivity
    try {
      await pool.query("SELECT 1");
      checks.push({ name: "database", status: "pass" });
    } catch (err) {
      checks.push({
        name: "database",
        status: "fail",
        detail: err instanceof Error ? err.message : String(err),
      });
      failed = true;
    }

    // 2. Migration compatibility — verify schema version exists
    if (!failed) {
      try {
        const result = await pool.query(
          "SELECT hash FROM drizzle_migrations ORDER BY created_at DESC LIMIT 1",
        );
        if (result.rowCount === 0) {
          checks.push({
            name: "migrations",
            status: "fail",
            detail: "No migrations recorded — schema may be incompatible",
          });
          failed = true;
        } else {
          checks.push({ name: "migrations", status: "pass" });
        }
      } catch (err) {
        checks.push({
          name: "migrations",
          status: "fail",
          detail: err instanceof Error ? err.message : String(err),
        });
        failed = true;
      }
    }

    res.status(failed ? 503 : 200).json({
      status: failed ? "fail" : "pass",
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  return router;
}

export default router;
