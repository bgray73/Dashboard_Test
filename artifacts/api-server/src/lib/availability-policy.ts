export type AvailabilitySample = { status: string; checkedAt: Date };

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
