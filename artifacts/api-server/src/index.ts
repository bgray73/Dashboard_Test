import { runtimeConfig } from "./lib/config";
import { createApp } from "./app";
import { logger } from "./lib/logger";
import { db, applicationSettingsTable } from "@workspace/db";
import { startMonitoring } from "./lib/monitoring";
import { startWebhookRetries } from "./lib/webhook-notifications";
import { cleanupCollectorJobs } from "./lib/collector-jobs";

const app = createApp(runtimeConfig);

app.listen(runtimeConfig.port, runtimeConfig.host, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info(
    { host: runtimeConfig.host, port: runtimeConfig.port },
    "Server listening",
  );
  startWebhookRetries();
  startMonitoring(async () => {
    const [settings] = await db
      .select({ pingTimeoutSeconds: applicationSettingsTable.pingTimeoutSeconds })
      .from(applicationSettingsTable)
      .limit(1);
    return settings?.pingTimeoutSeconds ?? 3;
  });
  void cleanupCollectorJobs().catch((error) =>
    logger.error({ err: error }, "Collector job cleanup failed"),
  );
  const collectorCleanupTimer = setInterval(
    () =>
      void cleanupCollectorJobs().catch((error) =>
        logger.error({ err: error }, "Collector job cleanup failed"),
      ),
    86_400_000,
  );
  collectorCleanupTimer.unref();
});
