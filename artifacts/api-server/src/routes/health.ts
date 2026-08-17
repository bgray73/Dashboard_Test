import { Router, type IRouter } from "express";
import { HealthCheckResponse, ReadinessCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/readyz", async (_req, res) => {
  // Readiness check - verify database connection
  try {
    // Import the db pool lazily to check connection
    const { pool } = await import("@workspace/db");
    await pool.query("SELECT 1");
    
    const data = ReadinessCheckResponse.parse({ status: "ok" });
    res.json(data);
  } catch (error) {
    res.status(503).json({ status: "unhealthy", error: "Database not ready" });
  }
});

export default router;