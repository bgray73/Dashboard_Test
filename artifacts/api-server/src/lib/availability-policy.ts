export type AvailabilitySample = { status: string; checkedAt: Date };
export type AvailabilityDevice = { id: number; hostname: string; lastStatus: string; monitoringEnabled: boolean };

export function availabilityForWindow(samples: AvailabilitySample[], windowStart: Date) {
  const observed = samples.filter((sample) => sample.checkedAt >= windowStart && (sample.status === "online" || sample.status === "offline"));
  const online = observed.filter((sample) => sample.status === "online").length;
  const offline = observed.length - online;
  return {
    percentage: observed.length ? Math.round((online / observed.length) * 10000) / 100 : null,
    onlineChecks: online,
    offlineChecks: offline,
    observedChecks: observed.length,
  };
}

export function incidentDurationSeconds(startedAt: Date, resolvedAt: Date) {
  return Math.max(0, Math.round((resolvedAt.getTime() - startedAt.getTime()) / 1000));
}

export function availabilityReport(devices: AvailabilityDevice[], samples: (AvailabilitySample & { deviceId: number })[], now = new Date()) {
  return devices.map((device) => {
    const deviceSamples = samples.filter((sample) => sample.deviceId === device.id);
    return {
      deviceId: device.id,
      hostname: device.hostname,
      currentStatus: device.lastStatus,
      monitoringEnabled: device.monitoringEnabled,
      availability24h: availabilityForWindow(deviceSamples, new Date(now.getTime() - 86_400_000)),
      availability7d: availabilityForWindow(deviceSamples, new Date(now.getTime() - 7 * 86_400_000)),
      availability30d: availabilityForWindow(deviceSamples, new Date(now.getTime() - 30 * 86_400_000)),
    };
  });
}
