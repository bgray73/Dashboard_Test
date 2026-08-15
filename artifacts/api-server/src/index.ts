import { runtimeConfig } from "./lib/config";
import { createApp, createDefaultAuthDependencies } from "./app";
import { logger } from "./lib/logger";
import { db, pool, applicationSettingsTable } from "@workspace/db";
import { startMonitoring } from "./lib/monitoring";
import { startWebhookRetries } from "./lib/webhook-notifications";
import { cleanupCollectorJobs } from "./lib/collector-jobs";
import { checkAuthSchemaReady } from "./lib/auth-store";

async function main(): Promise<void> {
  await checkAuthSchemaReady(pool);
  const auth = createDefaultAuthDependencies(runtimeConfig);
  await auth.store.cleanup();
  const app = createApp(runtimeConfig, auth);

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
        .select({
          pingTimeoutSeconds: applicationSettingsTable.pingTimeoutSeconds,
        })
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

    const authCleanupTimer = setInterval(
      () =>
        void auth.store
          .cleanup()
          .catch((error) =>
            logger.error({ err: error }, "Authentication cleanup failed"),
          ),
      3_600_000,
    );
    authCleanupTimer.unref();
  });
}

void main().catch((error) => {
  logger.fatal({ err: error }, "Server startup failed");
  process.exit(1);
});
