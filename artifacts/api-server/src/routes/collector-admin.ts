/**
 * Phase 23: Collector Lifecycle Management
 * 
 * Admin-only endpoints for managing collectors
 */

import { eq, desc } from "drizzle-orm";
import { collectorsTable, db } from "@workspace/db";
import type { RequestHandler } from "express";

interface CollectorResponse {
  id: number;
  name: string;
  hostname: string | null;
  status: "active" | "revoked";
  capabilities: string[];
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CollectorsListResponse {
  collectors: CollectorResponse[];
  total: number;
  activeCount: number;
  revokedCount: number;
}

// GET /api/collectors - List all collectors
export const listCollectors: RequestHandler = async (_req, res) => {
  const collectors = await db.select().from(collectorsTable).orderBy(desc(collectorsTable.createdAt));
  
  const response: CollectorsListResponse = {
    collectors: collectors.map((c: typeof collectorsTable.$inferSelect) => ({
      id: c.id,
      name: c.name,
      hostname: c.hostname,
      status: c.status,
      capabilities: c.capabilities,
      lastSeenAt: c.lastSeenAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    total: collectors.length,
    activeCount: collectors.filter((c: typeof collectorsTable.$inferSelect) => c.status === "active").length,
    revokedCount: collectors.filter((c: typeof collectorsTable.$inferSelect) => c.status === "revoked").length,
  };
  
  res.json(response);
};

// GET /api/collectors/:id - Get collector details
export const getCollector: RequestHandler = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Collector ID must be a positive integer." });
    return;
  }
  
  const [collector] = await db.select().from(collectorsTable).where(eq(collectorsTable.id, id)).limit(1);
  
  if (!collector) {
    res.status(404).json({ error: "Collector not found." });
    return;
  }
  
  res.json({
    id: collector.id,
    name: collector.name,
    hostname: collector.hostname,
    status: collector.status,
    capabilities: collector.capabilities,
    lastSeenAt: collector.lastSeenAt,
    revokedAt: collector.revokedAt,
    createdAt: collector.createdAt,
    updatedAt: collector.updatedAt,
  });
};

// DELETE /api/collectors/:id - Revoke a collector
export const revokeCollector: RequestHandler = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Collector ID must be a positive integer." });
    return;
  }
  
  const [existing] = await db.select().from(collectorsTable).where(eq(collectorsTable.id, id)).limit(1);
  
  if (!existing) {
    res.status(404).json({ error: "Collector not found." });
    return;
  }
  
  if (existing.status === "revoked") {
    res.status(409).json({ error: "Collector is already revoked." });
    return;
  }
  
  await db.update(collectorsTable)
    .set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(collectorsTable.id, id))
    .execute();
  
  res.status(204).send();
};