import app from "./app";
import { logger } from "./lib/logger";
import { db, applicationSettingsTable } from "@workspace/db";
import { startMonitoring } from "./lib/monitoring";
import { startWebhookRetries } from "./lib/webhook-notifications";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);
const host = process.env["HOST"] ?? "0.0.0.0";

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
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
});
