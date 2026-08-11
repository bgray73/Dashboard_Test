import app from "./app";
import { logger } from "./lib/logger";
import { db, applicationSettingsTable } from "@workspace/db";
import { startMonitoring } from "./lib/monitoring";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startMonitoring(async () => {
    const [settings] = await db.select({ pingTimeoutSeconds: applicationSettingsTable.pingTimeoutSeconds }).from(applicationSettingsTable).limit(1);
    return settings?.pingTimeoutSeconds ?? 3;
  });
});
