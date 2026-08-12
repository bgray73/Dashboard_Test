#!/usr/bin/env node
import { CollectorClient } from "./client.js";
import { loadConfig } from "./config.js";
import { runCollector } from "./runner.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const controller = new AbortController();
  const shutdown = () => controller.abort();
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  await runCollector(config, new CollectorClient(config), controller.signal);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Collector stopped unexpectedly.");
  process.exitCode = 1;
});
