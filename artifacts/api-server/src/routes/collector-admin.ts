/**
 * Phase 23: Collector Lifecycle Management API
 *
 * Administrator-only CRUD endpoints for managing collectors.
 */

import type { RequestHandler } from "express";
import type { Logger } from "pino";
import { db } from "@workspace/db";
import { collectorsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

/**
 * GET /api/collectors - List all collectors with statistics
 */
export async function listCollectors(req: any, res: any): Promise<void> {
  const collectors = await db
    .select({
      id: collectorsTable.id,
      name: collectorsTable.name,
      hostname: collectorsTable.hostname,
      status: collectorsTable.status,
      capabilities: collectorsTable.capabilities,
      lastSeenAt: collectorsTable.lastSeenAt,
      revokedAt: collectorsTable.revokedAt,
      createdAt: collectorsTable.createdAt,
      updatedAt: collectorsTable.updatedAt,
    })
    .from(collectorsTable)
    .orderBy(desc(collectorsTable.lastSeenAt));

  const activeCount = collectors.filter((c) => c.status === "active").length;
  const revokedCount = collectors.filter((c) => c.status === "revoked").length;

  res.json({
    collectors,
    summary: {
      total: collectors.length,
      active: activeCount,
      revoked: revokedCount,
    },
  });
}

/**
 * GET /api/collectors/:id - Get collector details
 */
export async function getCollector(req: any, res: any): Promise<void> {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid collector ID" });
    return;
  }

  const [collector] = await db
    .select()
    .from(collectorsTable)
    .where(eq(collectorsTable.id, id))
    .limit(1);

  if (!collector) {
    res.status(404).json({ error: "Collector not found" });
    return;
  }

  res.json({ collector });
}

/**
 * DELETE /api/collectors/:id - Revoke a collector
 *
 * This endpoint marks a collector as revoked, preventing it from
 * authenticating with the API in the future.
 *
 * Requires administrator role (enforced by authorization middleware).
 */
export async function revokeCollector(req: any, res: any): Promise<void> {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid collector ID" });
    return;
  }

  // Check if collector exists
  const [existing] = await db
    .select({ id: collectorsTable.id, status: collectorsTable.status })
    .from(collectorsTable)
    .where(eq(collectorsTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Collector not found" });
    return;
  }

  if (existing.status === "revoked") {
    res.json({ message: "Collector already revoked" });
    return;
  }

  // Revoke the collector
  await db
    .update(collectorsTable)
    .set({
      status: "revoked",
      revokedAt: new Date(),
    })
    .where(eq(collectorsTable.id, id));

  res.json({ id, status: "revoked", success: true });
}

/**
 * Create the collector administration router
 */
export function createCollectorAdminRouter(options: { logger: Logger }): { routes: Array<{ path: string; method: string; handler: RequestHandler }> } {
  return {
    routes: [
      { path: "/api/collectors", method: "get", handler: listCollectors },
      { path: "/api/collectors/:id", method: "get", handler: getCollector },
      { path: "/api/collectors/:id", method: "delete", handler: revokeCollector },
    ],
  };
}