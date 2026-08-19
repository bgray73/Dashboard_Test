/**
 * TypeScript type definitions generated from OpenAPI spec
 * Phase 29.3 - Devices endpoints
 */

// Re-export healthStatus from existing file if it exists
// Otherwise define inline

export interface Device {
  id: number;
  hostname: string;
  managementIp: string;
  deviceType: "Physical Server" | "Virtual Machine" | "Container" | "Router" | "Switch" | "Firewall" | "Storage" | "Wireless" | "Other";
  vendor: "Cisco" | "Juniper" | "Arista" | "Palo Alto" | "Fortinet" | "Dell" | "Supermicro" | "HPE" | "VMware" | "Proxmox" | "Linux" | "Other";
  model: string;
  operatingSystem: string;
  location: string;
  notes: string;
  serialNumber: string | null;
  status: "online" | "offline" | "unknown";
  lastCheckedAt: string | null;
  latencyMs: number | null;
  monitoringEnabled: boolean;
  monitoringIntervalSeconds: number;
}

export interface DeviceInput {
  hostname: string;
  managementIp: string;
  deviceType: "Physical Server" | "Virtual Machine" | "Container" | "Router" | "Switch" | "Firewall" | "Storage" | "Wireless" | "Other";
  vendor: "Cisco" | "Juniper" | "Arista" | "Palo Alto" | "Fortinet" | "Dell" | "Supermicro" | "HPE" | "VMware" | "Proxmox" | "Linux" | "Other";
  model?: string;
  operatingSystem?: string;
  location?: string;
  serialNumber?: string;
  notes?: string;
  monitoringEnabled?: boolean;
  maintenanceMode?: boolean;
  maintenanceStartsAt?: string | null;
  maintenanceEndsAt?: string | null;
  monitoringIntervalSeconds?: number;
}

export interface MonitoringHistory {
  id: number;
  deviceId: number;
  checkedAt: string;
  status: "online" | "offline" | "warning" | "error";
  latencyMs: number | null;
  consecutiveFailures: number | null;
  source: string;
  errorMessage: string | null;
}