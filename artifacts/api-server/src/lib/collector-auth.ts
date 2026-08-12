import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { collectorsTable, db } from "@workspace/db";

export function collectorTokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function hashesEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function authenticateCollector(collectorId: number, authorization: string | undefined) {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!Number.isInteger(collectorId) || collectorId <= 0 || !token) return null;
  const [collector] = await db.select().from(collectorsTable).where(eq(collectorsTable.id, collectorId)).limit(1);
  if (!collector || collector.status !== "active" || !hashesEqual(collector.tokenHash, collectorTokenHash(token))) return null;
  return collector;
}
