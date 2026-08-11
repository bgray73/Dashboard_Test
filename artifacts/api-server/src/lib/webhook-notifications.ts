import { applicationSettingsTable, db, notificationDeliveriesTable } from "@workspace/db";
import { logger } from "./logger";

export type WebhookEvent = "incident.opened" | "incident.resolved" | "webhook.test";
export type WebhookPayload = {
  event: WebhookEvent;
  occurredAt: string;
  incidentId?: number;
  device: { id: number; hostname: string; managementIp: string };
  incident?: { status: string; startedAt: string; resolvedAt?: string | null; durationSeconds?: number | null; peakFailures: number; errorMessage?: string | null; resolutionReason?: string | null };
};

export async function sendWebhook(payload: WebhookPayload, incidentId?: number) {
  const [settings] = await db.select({ enabled: applicationSettingsTable.webhookEnabled, url: applicationSettingsTable.webhookUrl }).from(applicationSettingsTable).limit(1);
  if (!settings?.enabled || !settings.url) return undefined;
  const attemptedAt = new Date();
  let status = "failed"; let responseStatus: number | null = null; let errorMessage: string | null = null;
  try {
    const response = await fetch(settings.url, {
      method: "POST", headers: { "content-type": "application/json", "user-agent": "LabOps-Webhook/1.0" },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(5000),
    });
    responseStatus = response.status;
    status = response.ok ? "delivered" : "failed";
    if (!response.ok) errorMessage = `Webhook returned HTTP ${response.status}.`;
  } catch (error) { errorMessage = error instanceof Error ? error.message : "Webhook delivery failed."; }
  const destination = new URL(settings.url).origin;
  const [delivery] = await db.insert(notificationDeliveriesTable).values({ incidentId, eventType: payload.event, destination, status, responseStatus, errorMessage, payload, attemptedAt }).returning();
  if (status === "failed") logger.warn({ incidentId, responseStatus, errorMessage }, "Webhook delivery failed");
  return delivery;
}
