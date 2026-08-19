/**
 * Zod validation schemas generated from OpenAPI spec
 * Phase 29.3 - Devices endpoints
 */
import * as zod from "zod";

// Health schemas
export const healthStatusSchema = zod.object({
  status: zod.enum(["ok"]),
});

export const readinessResponseSchema = zod.object({
  status: zod.enum(["pass", "warn", "fail"]),
  timestamp: zod.string(),
  checks: zod.array(zod.lazy(() => checkResultSchema)),
});

export const checkResultSchema = zod.object({
  name: zod.string(),
  status: zod.enum(["pass", "fail", "warn"]),
  detail: zod.string().nullable(),
});

// Device schemas
export const deviceSchema = zod.object({
  id: zod.number().int().positive(),
  hostname: zod.string(),
  managementIp: zod.string(),
  deviceType: zod.enum([
    "Physical Server",
    "Virtual Machine",
    "Container",
    "Router",
    "Switch",
    "Firewall",
    "Storage",
    "Wireless",
    "Other",
  ]),
  vendor: zod.enum([
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
  ]),
  model: zod.string(),
  operatingSystem: zod.string(),
  location: zod.string(),
  notes: zod.string(),
  serialNumber: zod.string().nullable(),
  status: zod.enum(["online", "offline", "unknown"]),
  lastCheckedAt: zod.string().nullable(),
  latencyMs: zod.number().nullable(),
  monitoringEnabled: zod.boolean(),
  monitoringIntervalSeconds: zod.number().int().min(30).max(86400),
});

export const deviceInputSchema = zod.object({
  hostname: zod.string(),
  managementIp: zod.string(),
  deviceType: zod.enum([
    "Physical Server",
    "Virtual Machine",
    "Container",
    "Router",
    "Switch",
    "Firewall",
    "Storage",
    "Wireless",
    "Other",
  ]),
  vendor: zod.enum([
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
  ]),
  model: zod.string().optional(),
  operatingSystem: zod.string().optional(),
  location: zod.string().optional(),
  serialNumber: zod.string().optional(),
  notes: zod.string().optional(),
  monitoringEnabled: zod.boolean().optional(),
  maintenanceMode: zod.boolean().optional(),
  maintenanceStartsAt: zod.string().nullable().optional(),
  maintenanceEndsAt: zod.string().nullable().optional(),
  monitoringIntervalSeconds: zod.number().int().min(30).max(86400).optional(),
});

export const monitoringHistorySchema = zod.object({
  id: zod.number().int().positive(),
  deviceId: zod.number().int().positive(),
  checkedAt: zod.string(),
  status: zod.enum(["online", "offline", "warning", "error"]),
  latencyMs: zod.number().nullable(),
  consecutiveFailures: zod.number().nullable(),
  source: zod.string(),
  errorMessage: zod.string().nullable(),
});

export const errorSchema = zod.object({
  error: zod.string(),
});

// Legacy aliases for backward compatibility
export const HealthCheckResponse = healthStatusSchema;
export const ReadinessCheckResponse = readinessResponseSchema;

// Export zod as namespace for direct access
export { zod };