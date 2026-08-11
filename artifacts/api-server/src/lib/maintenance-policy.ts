export type MaintenanceSchedule = {
  maintenanceMode: boolean;
  maintenanceStartsAt?: Date | string | null;
  maintenanceEndsAt?: Date | string | null;
};

export function isScheduledMaintenanceActive(
  device: MaintenanceSchedule,
  now = new Date(),
): boolean {
  const { maintenanceStartsAt: startsAt, maintenanceEndsAt: endsAt } = device;
  const startTime = startsAt ? new Date(startsAt).getTime() : Number.NaN;
  const endTime = endsAt ? new Date(endsAt).getTime() : Number.NaN;
  return Number.isFinite(startTime) && Number.isFinite(endTime) && startTime <= now.getTime() && now.getTime() < endTime;
}

export function isDeviceInMaintenance(
  device: MaintenanceSchedule,
  now = new Date(),
): boolean {
  return device.maintenanceMode || isScheduledMaintenanceActive(device, now);
}
