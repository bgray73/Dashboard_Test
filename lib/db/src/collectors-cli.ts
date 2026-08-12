import { createHash, randomBytes } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db, pool } from "./index";
import { collectorsTable } from "./schema";

const NAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/i;

function usage(): never {
  throw new Error([
    "Usage:",
    "  pnpm --filter @workspace/db collectors create <name> [hostname]",
    "  pnpm --filter @workspace/db collectors list",
    "  pnpm --filter @workspace/db collectors revoke <name>",
  ].join("\n"));
}

function validatedName(value: string | undefined): string {
  const name = value?.trim();
  if (!name || !NAME_PATTERN.test(name)) {
    throw new Error("Collector name must be 1-64 characters using letters, numbers, '.', '_' or '-'.");
  }
  return name;
}

function validatedHostname(value: string | undefined): string | null {
  if (value === undefined) return null;
  const hostname = value.trim();
  if (!hostname || hostname.length > 255 || /[\s\u0000-\u001f\u007f]/u.test(hostname)) {
    throw new Error("Hostname must be 1-255 characters and cannot contain whitespace or control characters.");
  }
  return hostname;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function createCollector(nameValue: string | undefined, hostnameValue: string | undefined) {
  const name = validatedName(nameValue);
  const hostname = validatedHostname(hostnameValue);
  const token = `labops_collector_${randomBytes(32).toString("base64url")}`;

  const [collector] = await db.insert(collectorsTable).values({
    name,
    hostname,
    tokenHash: hashToken(token),
    status: "active",
    capabilities: ["icmp"],
  }).returning({ id: collectorsTable.id, name: collectorsTable.name });

  console.log(`Collector ${collector.name} created with ID ${collector.id}.`);
  console.log("Enrollment token (shown once; store it securely):");
  console.log(token);
}

async function listCollectors() {
  const collectors = await db.select({
    id: collectorsTable.id,
    name: collectorsTable.name,
    hostname: collectorsTable.hostname,
    status: collectorsTable.status,
    capabilities: collectorsTable.capabilities,
    lastSeenAt: collectorsTable.lastSeenAt,
    createdAt: collectorsTable.createdAt,
  }).from(collectorsTable).orderBy(asc(collectorsTable.name));

  if (collectors.length === 0) {
    console.log("No collectors enrolled.");
    return;
  }

  console.table(collectors.map((collector) => ({
    ...collector,
    capabilities: collector.capabilities.join(","),
    lastSeenAt: collector.lastSeenAt?.toISOString() ?? "never",
    createdAt: collector.createdAt.toISOString(),
  })));
}

async function revokeCollector(nameValue: string | undefined) {
  const name = validatedName(nameValue);
  const [collector] = await db.update(collectorsTable).set({
    status: "revoked",
    revokedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(collectorsTable.name, name)).returning({
    id: collectorsTable.id,
    name: collectorsTable.name,
  });

  if (!collector) throw new Error(`Collector '${name}' was not found.`);
  console.log(`Collector ${collector.name} (ID ${collector.id}) revoked.`);
}

async function main() {
  const [command, first, second, ...extra] = process.argv.slice(2);
  if (extra.length > 0) usage();
  if (command === "create") return createCollector(first, second);
  if (command === "list" && first === undefined) return listCollectors();
  if (command === "revoke" && second === undefined) return revokeCollector(first);
  return usage();
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Collector command failed.");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
