export type Device = {
  id: number; hostname: string; managementIp: string; deviceType: string; vendor: string; model?: string;
  operatingSystem?: string; location?: string; serialNumber?: string; notes?: string; monitoringEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceStartsAt?: string | null; maintenanceEndsAt?: string | null;
  lastStatus: string; lastCheckedAt?: string; isSample?: boolean; createdAt?: string; updatedAt?: string;
  monitoringIntervalSeconds: number; lastLatencyMs?: number | null; consecutiveFailures: number;
};
export type MonitoringHistory = { id: number; deviceId: number; checkedAt: string; status: string; latencyMs: number | null; errorMessage?: string | null; consecutiveFailures: number; source: string };
export type MonitoringIncident = { id: number; deviceId: number; startedAt: string; lastFailureAt: string; resolvedAt?: string | null; status: "open" | "resolved"; acknowledgedAt?: string | null; acknowledgedBy?: string | null; operatorNote?: string | null; peakFailures: number; durationSeconds?: number | null; errorMessage?: string | null; resolutionReason?: string | null };
export type IncidentActivity = { id: number; incidentId: number; eventType: string; actor?: string | null; note?: string | null; occurredAt: string };
export type MaintenanceHistory = { id: number; deviceId: number; eventType: string; occurredAt: string; maintenanceStartsAt?: string | null; maintenanceEndsAt?: string | null };
export type SchedulerSnapshot = { serverTime: string; enabledDevices: number; pausedForMaintenance: number; dueDevices: number; nextDueAt: string | null };
export type AvailabilityMetric = { percentage: number | null; onlineChecks: number; offlineChecks: number; observedChecks: number };
export type AvailabilityWindows = Record<"24h" | "7d" | "30d", AvailabilityMetric>;
export type SavedConfiguration = { id: number; name: string; vendor: string; configurationType: string; associatedDeviceId?: number; generatedConfiguration: string; notes?: string; createdAt?: string; updatedAt?: string; authPassword?: string; privacyPassword?: string };
export type Settings = { applicationName: string; defaultTheme: string; defaultConfigVendor: string; pingTimeoutSeconds: number; webhookEnabled: boolean; webhookUrl: string };
export type NotificationDelivery = { id: number; incidentId?: number | null; eventType: string; destination: string; status: string; responseStatus?: number | null; errorMessage?: string | null; attemptCount: number; nextAttemptAt?: string | null; attemptedAt: string; deliveredAt?: string | null };
export type PingResult = { status: string; latencyMs: number | null; message: string; target?: string; device?: Device };
const base = '/api';
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }, ...options });
  if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`);
  return response.status === 204 ? undefined as T : response.json();
}
export const api = {
  devices: () => request<Device[]>('/devices'),
  device: (id: number) => request<Device>(`/devices/${id}`),
  createDevice: (data: Partial<Device>) => request<Device>('/devices', { method: 'POST', body: JSON.stringify(data) }),
  updateDevice: (id: number, data: Partial<Device>) => request<Device>(`/devices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDevice: (id: number) => request<void>(`/devices/${id}`, { method: 'DELETE' }),
  pingDevice: (id: number) => request<PingResult>(`/devices/${id}/ping`, { method: 'POST' }),
  summary: () => request<any>('/dashboard/summary'),
  recent: () => request<any[]>('/dashboard/recent-status'),
  checkMonitored: () => request<any>('/dashboard/check-monitored', { method: 'POST' }),
  monitoring: () => request<{ devices: Device[]; history: MonitoringHistory[]; incidents: MonitoringIncident[]; maintenanceHistory: MaintenanceHistory[]; availability: AvailabilityWindows; deviceAvailability: Record<number, AvailabilityWindows>; scheduler: SchedulerSnapshot }>('/monitoring'),
  maintenanceHistory: (deviceId?: number) => request<MaintenanceHistory[]>(`/maintenance-history${deviceId ? `?deviceId=${deviceId}` : ''}`),
  deviceHistory: (id: number) => request<MonitoringHistory[]>(`/devices/${id}/monitoring-history?limit=25`),
  incidents: (deviceId?: number) => request<MonitoringIncident[]>(`/incidents${deviceId ? `?deviceId=${deviceId}` : ''}`),
  acknowledgeIncident: (id: number, data: { actor: string; note?: string }) => request<MonitoringIncident>(`/incidents/${id}/acknowledgment`, { method: 'PATCH', body: JSON.stringify(data) }),
  incidentActivity: (id: number) => request<IncidentActivity[]>(`/incidents/${id}/activity`),
  saved: () => request<SavedConfiguration[]>('/saved-configurations'),
  saveConfig: (data: Partial<SavedConfiguration>) => request<SavedConfiguration>('/saved-configurations', { method: 'POST', body: JSON.stringify(data) }),
  deleteConfig: (id: number) => request<void>(`/saved-configurations/${id}`, { method: 'DELETE' }),
  settings: () => request<Settings>('/settings'),
  updateSettings: (data: Partial<Settings>) => request<Settings>('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  notificationDeliveries: () => request<NotificationDelivery[]>('/notifications/deliveries'),
  testWebhook: () => request<NotificationDelivery>('/notifications/test', { method: 'POST' }),
  retryWebhook: (id: number) => request<NotificationDelivery>(`/notifications/deliveries/${id}/retry`, { method: 'POST' }),
  ping: (data: { target: string }) => request<PingResult>('/tools/ping', { method: 'POST', body: JSON.stringify(data) }),
};
