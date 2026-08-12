import app from "./app";
import { logger } from "./lib/logger";
import { db, applicationSettingsTable } from "@workspace/db";
import { startMonitoring } from "./lib/monitoring";
import { startWebhookRetries } from "./lib/webhook-notifications";
import { cleanupCollectorJobs } from "./lib/collector-jobs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);
const host = process.env["HOST"] ?? "0.0.0.0";
const reachabilityProvider = process.env.LABOPS_REACHABILITY_PROVIDER ?? "local-icmp";
const collectorId = Number(process.env.LABOPS_COLLECTOR_ID);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}
if (!['local-icmp', 'collector'].includes(reachabilityProvider)) {
  throw new Error(`Invalid LABOPS_REACHABILITY_PROVIDER value: "${reachabilityProvider}"`);
}
if (reachabilityProvider === "collector" && (
  !/^\d+$/.test(process.env.LABOPS_COLLECTOR_ID ?? "")
  || !Number.isSafeInteger(collectorId)
  || collectorId < 1
  || collectorId > 2_147_483_647
)) {
  throw new Error("LABOPS_COLLECTOR_ID must be an integer from 1 through 2147483647 when collector monitoring is enabled.");
}

app.listen(port, host, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ host, port }, "Server listening");
  startWebhookRetries();
  startMonitoring(async () => {
    const [settings] = await db.select({ pingTimeoutSeconds: applicationSettingsTable.pingTimeoutSeconds }).from(applicationSettingsTable).limit(1);
    return settings?.pingTimeoutSeconds ?? 3;
  });
  void cleanupCollectorJobs().catch((error) => logger.error({ err: error }, "Collector job cleanup failed"));
  const collectorCleanupTimer = setInterval(() => void cleanupCollectorJobs().catch((error) => logger.error({ err: error }, "Collector job cleanup failed")), 86_400_000);
  collectorCleanupTimer.unref();
});
