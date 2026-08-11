import { Router, type IRouter } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import {
  applicationSettingsTable,
  db,
  devicesTable,
  monitoringHistoryTable,
  monitoringIncidentsTable,
  notificationDeliveriesTable,
  savedConfigurationsTable,
} from "@workspace/db";
import { isIpv4OrHostname, performPing } from "../lib/reachability";
import { recordDeviceCheck, resolveIncidentsForMaintenance } from "../lib/monitoring";
import { availabilityForWindow } from "../lib/availability-policy";
import { isAllowedWebhookUrl } from "../lib/webhook-policy";
import { sendWebhook } from "../lib/webhook-notifications";

const router: IRouter = Router();

const DEVICE_TYPES = [
  "Physical Server",
  "Virtual Machine",
  "Container",
  "Router",
  "Switch",
  "Firewall",
  "Storage",
  "Wireless",
  "Other",
] as const;
const VENDORS = [
  "Cisco",
  "Juniper",
  "Arista",
  "Palo Alto",
  "Fortinet",
  "Dell",
  "Supermicro",
  "HPE",
  "VMware",
  "Proxmox",
  "Linux",
  "Other",
] as const;
const CONFIG_VENDORS = [
  "Cisco IOS / IOS-XE",
  "Cisco NX-OS",
  "Juniper Junos",
  "Arista EOS",
] as const;
const CONFIG_TYPES = ["SNMPv3", "Syslog", "NTP", "NetFlow / IPFIX"] as const;
const STATUSES = ["online", "offline", "unknown"] as const;

type DeviceInput = {
  hostname: string;
  managementIp: string;
  deviceType: string;
  vendor: string;
  model?: string;
  operatingSystem?: string;
  location?: string;
  serialNumber?: string;
  notes?: string;
  monitoringEnabled?: boolean;
  maintenanceMode?: boolean;
  monitoringIntervalSeconds?: number;
};

type SavedConfigurationInput = {
  name: string;
  vendor: string;
  configurationType: string;
  associatedDeviceId?: number | null;
  generatedConfiguration: string;
  notes?: string;
  authPassword?: string;
  privacyPassword?: string;
};

let setupPromise: Promise<void> | undefined;

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readId(value: unknown): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function validateDeviceInput(body: unknown): { data?: DeviceInput; error?: string } {
  if (!body || typeof body !== "object") return { error: "Device details are required." };
  const input = body as Record<string, unknown>;
  const hostname = readString(input.hostname)?.trim();
  const managementIp = readString(input.managementIp)?.trim();
  const deviceType = readString(input.deviceType);
  const vendor = readString(input.vendor);
  if (!hostname || !managementIp || !deviceType || !vendor) {
    return { error: "Hostname, management IP, device type, and vendor are required." };
  }
  if (!isIpv4OrHostname(managementIp)) {
    return { error: "Enter a valid hostname or management IP address." };
  }
  if (!DEVICE_TYPES.includes(deviceType as (typeof DEVICE_TYPES)[number])) {
    return { error: "Select a valid device type." };
  }
  if (!VENDORS.includes(vendor as (typeof VENDORS)[number])) {
    return { error: "Select a valid vendor." };
  }
  if (input.monitoringEnabled !== undefined && typeof input.monitoringEnabled !== "boolean") {
    return { error: "Monitoring Enabled must be true or false." };
  }
  if (input.maintenanceMode !== undefined && typeof input.maintenanceMode !== "boolean") {
    return { error: "Maintenance Mode must be true or false." };
  }
  const monitoringIntervalSeconds = Number(input.monitoringIntervalSeconds ?? 60);
  if (!Number.isInteger(monitoringIntervalSeconds) || monitoringIntervalSeconds < 30 || monitoringIntervalSeconds > 86400) {
    return { error: "Polling interval must be between 30 and 86400 seconds." };
  }
  return {
    data: {
      hostname,
      managementIp,
      deviceType,
      vendor,
      model: readString(input.model)?.trim() ?? "",
      operatingSystem: readString(input.operatingSystem)?.trim() ?? "",
      location: readString(input.location)?.trim() ?? "",
      serialNumber: readString(input.serialNumber)?.trim() ?? "",
      notes: readString(input.notes)?.trim() ?? "",
      monitoringEnabled: input.monitoringEnabled === true,
      maintenanceMode: input.maintenanceMode === true,
      monitoringIntervalSeconds,
    },
  };
}

function sanitizeConfiguration(input: SavedConfigurationInput): string {
  let configuration = input.generatedConfiguration;
  if (input.authPassword) configuration = configuration.split(input.authPassword).join("<AUTH_PASSWORD>");
  if (input.privacyPassword) configuration = configuration.split(input.privacyPassword).join("<PRIV_PASSWORD>");
  configuration = configuration
    .replace(/(<AUTH_PASSWORD>|<AUTH[_ -]?PASSWORD>|AUTH_PASSWORD|\[AUTH_PASSWORD\])/gi, "<AUTH_PASSWORD>")
    .replace(/(<PRIV_PASSWORD>|<PRIV[_ -]?PASSWORD>|PRIV_PASSWORD|\[PRIV_PASSWORD\])/gi, "<PRIV_PASSWORD>");

  if (input.configurationType === "SNMPv3") {
    configuration = configuration
      .replace(/(authentication(?:-password| password)?\s+)(?!<AUTH_PASSWORD>|\[AUTH_PASSWORD\])\S+/gi, "$1<AUTH_PASSWORD>")
      .replace(/(privacy(?:-password| password)?\s+)(?!<PRIV_PASSWORD>|\[PRIV_PASSWORD\])\S+/gi, "$1<PRIV_PASSWORD>");
  }
  return configuration;
}

async function ensureSetup(): Promise<void> {
  if (!setupPromise) {
    setupPromise = (async () => {
      const [existingSettings] = await db.select({ id: applicationSettingsTable.id }).from(applicationSettingsTable).limit(1);
      if (!existingSettings) {
        await db.insert(applicationSettingsTable).values({}).execute();
      }

      const existingSamples = await db
        .select({ id: devicesTable.id })
        .from(devicesTable)
        .where(eq(devicesTable.isSample, true))
        .limit(1);
      if (existingSamples.length > 0) return;

      await db.insert(devicesTable).values([
        {
          hostname: "core-sw-01",
          managementIp: "192.168.1.2",
          deviceType: "Switch",
          vendor: "Cisco",
          model: "Catalyst 9300",
          operatingSystem: "IOS-XE",
          location: "Rack A · U24",
          notes: "Sample device — safe to delete.",
          monitoringEnabled: true,
          lastStatus: "unknown",
          isSample: true,
        },
        {
          hostname: "edge-rtr-01",
          managementIp: "192.168.1.1",
          deviceType: "Router",
          vendor: "Cisco",
          model: "ISR 4331",
          operatingSystem: "IOS-XE",
          location: "Rack A · U01",
          notes: "Sample device — safe to delete.",
          monitoringEnabled: true,
          lastStatus: "unknown",
          isSample: true,
        },
        {
          hostname: "compute-dell-01",
          managementIp: "192.168.1.20",
          deviceType: "Physical Server",
          vendor: "Dell",
          model: "PowerEdge R640",
          operatingSystem: "Ubuntu Server 24.04",
          location: "Rack B · U10",
          notes: "Sample device — safe to delete.",
          monitoringEnabled: false,
          lastStatus: "unknown",
          isSample: true,
        },
        {
          hostname: "compute-sm-01",
          managementIp: "192.168.1.21",
          deviceType: "Physical Server",
          vendor: "Supermicro",
          model: "SYS-5019D",
          operatingSystem: "Debian 12",
          location: "Rack B · U12",
          notes: "Sample device — safe to delete.",
          monitoringEnabled: false,
          lastStatus: "unknown",
          isSample: true,
        },
        {
          hostname: "pve-01",
          managementIp: "192.168.1.30",
          deviceType: "Physical Server",
          vendor: "Proxmox",
          model: "ProLiant DL360",
          operatingSystem: "Proxmox VE 8",
          location: "Rack B · U20",
          notes: "Sample device — safe to delete.",
          monitoringEnabled: true,
          lastStatus: "unknown",
          isSample: true,
        },
      ]);
    })().catch((error) => {
      setupPromise = undefined;
      throw error;
    });
  }
  await setupPromise;
}

async function getSettings() {
  const [settings] = await db.select().from(applicationSettingsTable).limit(1);
  return settings ?? {
    id: 0,
    applicationName: "LabOps",
    defaultTheme: "dark",
    defaultConfigVendor: CONFIG_VENDORS[0],
    pingTimeoutSeconds: 3,
    webhookEnabled: false,
    webhookUrl: "",
    updatedAt: new Date(),
  };
}

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  await ensureSetup();
  const devices = await db.select().from(devicesTable);
  const dayAgo = new Date(Date.now() - 86_400_000);
  const [recentHistory, openIncidents] = await Promise.all([
    db.select({ status: monitoringHistoryTable.status, checkedAt: monitoringHistoryTable.checkedAt })
      .from(monitoringHistoryTable).where(gte(monitoringHistoryTable.checkedAt, dayAgo)),
    db.select({ id: monitoringIncidentsTable.id }).from(monitoringIncidentsTable)
      .where(eq(monitoringIncidentsTable.status, "open")),
  ]);
  const availability24h = availabilityForWindow(recentHistory, dayAgo);
  res.json({
    totalDevices: devices.length,
    onlineDevices: devices.filter((device) => device.lastStatus === "online").length,
    offlineDevices: devices.filter((device) => device.lastStatus === "offline").length,
    unknownDevices: devices.filter((device) => !STATUSES.includes(device.lastStatus as (typeof STATUSES)[number]) || device.lastStatus === "unknown").length,
    servers: devices.filter((device) => ["Physical Server", "Virtual Machine", "Container"].includes(device.deviceType)).length,
    networkDevices: devices.filter((device) => ["Router", "Switch", "Firewall", "Wireless"].includes(device.deviceType)).length,
    openIncidents: openIncidents.length,
    availability24h: availability24h.percentage,
  });
});

router.get("/dashboard/recent-status", async (_req, res): Promise<void> => {
  await ensureSetup();
  const devices = await db.select().from(devicesTable).orderBy(desc(devicesTable.updatedAt));
  res.json(devices.slice(0, 12));
});

router.post("/dashboard/check-monitored", async (req, res): Promise<void> => {
  await ensureSetup();
  const settings = await getSettings();
  const devices = await db.select().from(devicesTable).where(eq(devicesTable.monitoringEnabled, true));
  const results = [];
  for (const device of devices) {
    results.push(await recordDeviceCheck(device, settings.pingTimeoutSeconds, "manual"));
  }
  res.json({ checked: results.length, results });
});

router.get("/monitoring", async (_req, res): Promise<void> => {
  await ensureSetup();
  const devices = await db.select().from(devicesTable).orderBy(desc(devicesTable.lastCheckedAt));
  const history = await db.select().from(monitoringHistoryTable).orderBy(desc(monitoringHistoryTable.checkedAt)).limit(100);
  const incidents = await db.select().from(monitoringIncidentsTable).orderBy(desc(monitoringIncidentsTable.startedAt)).limit(100);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const availabilityHistory = await db.select({ deviceId: monitoringHistoryTable.deviceId, status: monitoringHistoryTable.status, checkedAt: monitoringHistoryTable.checkedAt })
    .from(monitoringHistoryTable).where(gte(monitoringHistoryTable.checkedAt, thirtyDaysAgo));
  const windows = [
    ["24h", new Date(Date.now() - 86_400_000)],
    ["7d", new Date(Date.now() - 7 * 86_400_000)],
    ["30d", thirtyDaysAgo],
  ] as const;
  const availability = Object.fromEntries(windows.map(([key, start]) => [key, availabilityForWindow(availabilityHistory, start)]));
  const deviceAvailability = Object.fromEntries(devices.map((device) => [device.id, Object.fromEntries(windows.map(([key, start]) => [key, availabilityForWindow(availabilityHistory.filter((sample) => sample.deviceId === device.id), start)]))]));
  res.json({ devices, history, incidents, availability, deviceAvailability });
});

router.get("/incidents", async (req, res): Promise<void> => {
  const status = readString(req.query.status);
  if (status && status !== "open" && status !== "resolved") { res.status(400).json({ error: "Status must be open or resolved." }); return; }
  const deviceId = req.query.deviceId === undefined ? undefined : readId(req.query.deviceId);
  if (req.query.deviceId !== undefined && !deviceId) { res.status(400).json({ error: "Device ID must be a positive number." }); return; }
  const conditions = [status ? eq(monitoringIncidentsTable.status, status) : undefined, deviceId ? eq(monitoringIncidentsTable.deviceId, deviceId) : undefined].filter(Boolean);
  const query = db.select().from(monitoringIncidentsTable);
  const rows = conditions.length ? await query.where(and(...conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])).orderBy(desc(monitoringIncidentsTable.startedAt)).limit(200) : await query.orderBy(desc(monitoringIncidentsTable.startedAt)).limit(200);
  res.json(rows);
});

router.get("/devices/:id/monitoring-history", async (req, res): Promise<void> => {
  const id = readId(req.params.id);
  if (!id) { res.status(400).json({ error: "Device ID must be a positive number." }); return; }
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  res.json(await db.select().from(monitoringHistoryTable).where(eq(monitoringHistoryTable.deviceId, id)).orderBy(desc(monitoringHistoryTable.checkedAt)).limit(limit));
});

router.get("/devices", async (req, res): Promise<void> => {
  await ensureSetup();
  const search = readString(req.query.search)?.trim().toLowerCase() ?? "";
  const status = readString(req.query.status);
  const deviceType = readString(req.query.deviceType);
  const vendor = readString(req.query.vendor);
  const sort = readString(req.query.sort) ?? "hostname";
  const direction = readString(req.query.direction) === "desc" ? -1 : 1;
  const devices = await db.select().from(devicesTable);
  const filtered = devices.filter((device) => {
    const searchable = [device.hostname, device.managementIp, device.vendor, device.model, device.location, device.notes].join(" ").toLowerCase();
    return (!search || searchable.includes(search))
      && (!status || device.lastStatus === status)
      && (!deviceType || device.deviceType === deviceType)
      && (!vendor || device.vendor === vendor);
  });
  filtered.sort((a, b) => {
    const left = String((a as Record<string, unknown>)[sort] ?? a.hostname);
    const right = String((b as Record<string, unknown>)[sort] ?? b.hostname);
    return left.localeCompare(right) * direction;
  });
  res.json(filtered);
});

router.post("/devices", async (req, res): Promise<void> => {
  await ensureSetup();
  const parsed = validateDeviceInput(req.body);
  if (!parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const [device] = await db.insert(devicesTable).values(parsed.data).returning();
  res.status(201).json(device);
});

router.get("/devices/:id", async (req, res): Promise<void> => {
  await ensureSetup();
  const id = readId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Device ID must be a positive number." });
    return;
  }
  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, id));
  if (!device) {
    res.status(404).json({ error: "Device not found." });
    return;
  }
  res.json(device);
});

router.patch("/devices/:id", async (req, res): Promise<void> => {
  await ensureSetup();
  const id = readId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Device ID must be a positive number." });
    return;
  }
  const parsed = validateDeviceInput(req.body);
  if (!parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const [device] = await db.update(devicesTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(devicesTable.id, id)).returning();
  if (!device) {
    res.status(404).json({ error: "Device not found." });
    return;
  }
  if (device.maintenanceMode) await resolveIncidentsForMaintenance(device.id);
  res.json(device);
});

router.delete("/devices/:id", async (req, res): Promise<void> => {
  await ensureSetup();
  const id = readId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Device ID must be a positive number." });
    return;
  }
  await db.update(savedConfigurationsTable).set({ associatedDeviceId: null, updatedAt: new Date() }).where(eq(savedConfigurationsTable.associatedDeviceId, id));
  const [device] = await db.delete(devicesTable).where(eq(devicesTable.id, id)).returning();
  if (!device) {
    res.status(404).json({ error: "Device not found." });
    return;
  }
  res.status(204).send();
});

router.post("/devices/:id/ping", async (req, res): Promise<void> => {
  await ensureSetup();
  const id = readId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Device ID must be a positive number." });
    return;
  }
  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, id));
  if (!device) {
    res.status(404).json({ error: "Device not found." });
    return;
  }
  const settings = await getSettings();
  res.json(await recordDeviceCheck(device, settings.pingTimeoutSeconds, "manual"));
});

router.get("/saved-configurations", async (_req, res): Promise<void> => {
  await ensureSetup();
  res.json(await db.select().from(savedConfigurationsTable).orderBy(desc(savedConfigurationsTable.createdAt)));
});

router.post("/saved-configurations", async (req, res): Promise<void> => {
  await ensureSetup();
  const input = req.body as Partial<SavedConfigurationInput>;
  if (!input.name?.trim() || !CONFIG_VENDORS.includes(input.vendor as (typeof CONFIG_VENDORS)[number]) || !CONFIG_TYPES.includes(input.configurationType as (typeof CONFIG_TYPES)[number]) || !input.generatedConfiguration?.trim()) {
    res.status(400).json({ error: "Name, vendor, configuration type, and generated configuration are required." });
    return;
  }
  if (input.associatedDeviceId !== undefined && input.associatedDeviceId !== null && (!Number.isInteger(Number(input.associatedDeviceId)) || Number(input.associatedDeviceId) <= 0)) {
    res.status(400).json({ error: "Associated device must be valid." });
    return;
  }
  const name = input.name.trim();
  const vendor = input.vendor as string;
  const configurationType = input.configurationType as string;
  const generatedInput = input.generatedConfiguration;
  const generatedConfiguration = sanitizeConfiguration({
    name,
    vendor,
    configurationType,
    generatedConfiguration: generatedInput,
    notes: input.notes,
    authPassword: input.authPassword,
    privacyPassword: input.privacyPassword,
  });
  const [saved] = await db.insert(savedConfigurationsTable).values({
    name,
    vendor,
    configurationType,
    associatedDeviceId: input.associatedDeviceId == null ? null : Number(input.associatedDeviceId),
    generatedConfiguration,
    notes: input.notes?.trim() ?? "",
  }).returning();
  res.status(201).json(saved);
});

router.delete("/saved-configurations/:id", async (req, res): Promise<void> => {
  await ensureSetup();
  const id = readId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Saved configuration ID must be a positive number." });
    return;
  }
  const [saved] = await db.delete(savedConfigurationsTable).where(eq(savedConfigurationsTable.id, id)).returning();
  if (!saved) {
    res.status(404).json({ error: "Saved configuration not found." });
    return;
  }
  res.status(204).send();
});

router.get("/settings", async (_req, res): Promise<void> => {
  await ensureSetup();
  res.json(await getSettings());
});

router.patch("/settings", async (req, res): Promise<void> => {
  await ensureSetup();
  const current = await getSettings();
  const input = req.body as Record<string, unknown>;
  const applicationName = readString(input.applicationName)?.trim() || current.applicationName;
  const defaultTheme = readString(input.defaultTheme) ?? current.defaultTheme;
  const defaultConfigVendor = readString(input.defaultConfigVendor) ?? current.defaultConfigVendor;
  const pingTimeoutSeconds = Number(input.pingTimeoutSeconds ?? current.pingTimeoutSeconds);
  const webhookEnabled = input.webhookEnabled === undefined ? current.webhookEnabled : input.webhookEnabled === true;
  const webhookUrl = readString(input.webhookUrl)?.trim() ?? current.webhookUrl;
  if (!["dark", "light"].includes(defaultTheme) || !CONFIG_VENDORS.includes(defaultConfigVendor as (typeof CONFIG_VENDORS)[number]) || !Number.isInteger(pingTimeoutSeconds) || pingTimeoutSeconds < 1 || pingTimeoutSeconds > 30) {
    res.status(400).json({ error: "Check the theme, default vendor, and ping timeout values." });
    return;
  }
  if (webhookEnabled && !isAllowedWebhookUrl(webhookUrl)) {
    res.status(400).json({ error: "Webhook URL must use HTTPS. Localhost HTTP is allowed for development." });
    return;
  }
  const [settings] = await db.update(applicationSettingsTable).set({
    applicationName,
    defaultTheme,
    defaultConfigVendor,
    pingTimeoutSeconds,
    webhookEnabled,
    webhookUrl,
    updatedAt: new Date(),
  }).where(eq(applicationSettingsTable.id, current.id)).returning();
  res.json(settings);
});

router.get("/notifications/deliveries", async (_req, res): Promise<void> => {
  await ensureSetup();
  res.json(await db.select().from(notificationDeliveriesTable).orderBy(desc(notificationDeliveriesTable.attemptedAt)).limit(100));
});

router.post("/notifications/test", async (_req, res): Promise<void> => {
  await ensureSetup();
  const settings = await getSettings();
  if (!settings.webhookEnabled || !settings.webhookUrl) {
    res.status(400).json({ error: "Enable and save a webhook before sending a test." });
    return;
  }
  const delivery = await sendWebhook({
    event: "webhook.test", occurredAt: new Date().toISOString(),
    device: { id: 0, hostname: "labops-test", managementIp: "127.0.0.1" },
  });
  res.status(delivery?.status === "delivered" ? 200 : 502).json(delivery);
});

router.post("/tools/ping", async (req, res): Promise<void> => {
  await ensureSetup();
  const target = readString((req.body as Record<string, unknown> | undefined)?.target)?.trim();
  if (!target) {
    res.status(400).json({ error: "Enter a hostname or IP address." });
    return;
  }
  const settings = await getSettings();
  res.json({ target, ...(await performPing(target, settings.pingTimeoutSeconds)) });
});

export default router;
