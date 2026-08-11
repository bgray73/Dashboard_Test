import { applicationSettingsTable, db, notificationDeliveriesTable } from "@workspace/db";
import { and, asc, eq, lte } from "drizzle-orm";
import { logger } from "./logger";
import { MAX_WEBHOOK_ATTEMPTS, nextWebhookAttempt } from "./webhook-retry-policy";

export type WebhookEvent = "incident.opened" | "incident.resolved" | "webhook.test";
export type WebhookPayload = {
  event: WebhookEvent;
  occurredAt: string;
  incidentId?: number;
  device: { id: number; hostname: string; managementIp: string };
  incident?: { status: string; startedAt: string; resolvedAt?: string | null; durationSeconds?: number | null; peakFailures: number; errorMessage?: string | null; resolutionReason?: string | null };
};

async function webhookSettings() {
  const [settings] = await db.select({ enabled: applicationSettingsTable.webhookEnabled, url: applicationSettingsTable.webhookUrl }).from(applicationSettingsTable).limit(1);
  return settings;
}

export async function attemptWebhookDelivery(deliveryId: number) {
  const [delivery] = await db.select().from(notificationDeliveriesTable).where(eq(notificationDeliveriesTable.id, deliveryId)).limit(1);
  if (!delivery) throw new Error("Webhook delivery not found.");
  if (delivery.status === "delivered") throw new Error("Delivered webhooks cannot be retried.");
  const settings = await webhookSettings();
  if (!settings?.enabled || !settings.url) throw new Error("Webhook notifications are disabled.");
  const attemptedAt = new Date();
  const attemptCount = delivery.attemptCount + 1;
  let status = "failed"; let responseStatus: number | null = null; let errorMessage: string | null = null;
  try {
    const response = await fetch(settings.url, {
      method: "POST", headers: { "content-type": "application/json", "user-agent": "LabOps-Webhook/1.0" },
      body: JSON.stringify(delivery.payload), signal: AbortSignal.timeout(5000),
    });
    responseStatus = response.status;
    status = response.ok ? "delivered" : "failed";
    if (!response.ok) errorMessage = `Webhook returned HTTP ${response.status}.`;
  } catch (error) { errorMessage = error instanceof Error ? error.message : "Webhook delivery failed."; }
  const nextAttemptAt = status === "failed" ? nextWebhookAttempt(attemptCount, attemptedAt) : null;
  if (nextAttemptAt) status = "retrying";
  const [updated] = await db.update(notificationDeliveriesTable).set({
    destination: new URL(settings.url).origin, status, responseStatus, errorMessage,
    attemptCount, nextAttemptAt, attemptedAt, deliveredAt: status === "delivered" ? attemptedAt : null,
  }).where(eq(notificationDeliveriesTable.id, deliveryId)).returning();
  if (status !== "delivered") logger.warn({ deliveryId, attemptCount, responseStatus, errorMessage, nextAttemptAt }, "Webhook delivery failed");
  return updated;
}

export async function sendWebhook(payload: WebhookPayload, incidentId?: number) {
  const [settings] = await db.select({ enabled: applicationSettingsTable.webhookEnabled, url: applicationSettingsTable.webhookUrl }).from(applicationSettingsTable).limit(1);
  if (!settings?.enabled || !settings.url) return undefined;
  const [delivery] = await db.insert(notificationDeliveriesTable).values({
    incidentId, eventType: payload.event, destination: new URL(settings.url).origin, status: "pending", payload,
  }).returning();
  return attemptWebhookDelivery(delivery.id);
}

let retrying = false;
export function startWebhookRetries() {
  const tick = async () => {
    if (retrying) return;
    retrying = true;
    try {
      const settings = await webhookSettings();
      if (!settings?.enabled || !settings.url) return;
      const due = await db.select({ id: notificationDeliveriesTable.id }).from(notificationDeliveriesTable)
        .where(and(eq(notificationDeliveriesTable.status, "retrying"), lte(notificationDeliveriesTable.nextAttemptAt, new Date())))
        .orderBy(asc(notificationDeliveriesTable.nextAttemptAt)).limit(25);
      for (const delivery of due) {
        try { await attemptWebhookDelivery(delivery.id); }
        catch (error) { logger.warn({ err: error, deliveryId: delivery.id }, "Webhook retry failed"); }
      }
    } catch (error) { logger.warn({ err: error }, "Webhook retry cycle failed"); }
    finally { retrying = false; }
  };
  void tick();
  const timer = setInterval(() => void tick(), 15_000);
  timer.unref();
  logger.info({ maxAttempts: MAX_WEBHOOK_ATTEMPTS }, "Webhook retry scheduler started");
}
