import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api, type Device, type MonitoringHistory, type MonitoringIncident, type MaintenanceHistory, type AvailabilityWindows, type SchedulerSnapshot, type AvailabilityReportRow } from "@/lib/api";
import { Button, Card, Detail, Empty, ErrorState, Loading, PageTitle, Select, Status, cls } from "@/components/ui";
import { IncidentWorkspace } from "../components/incident-workspace";

export function Monitoring() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [incidents, setIncidents] = useState<MonitoringIncident[]>([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistory[]>([]);
  const [scheduler, setScheduler] = useState<SchedulerSnapshot>();
  const [availability, setAvailability] = useState<AvailabilityWindows>();
  const [incidentFilter, setIncidentFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [maintenanceFilter, setMaintenanceFilter] = useState("all");
  const [selectedIncident, setSelectedIncident] = useState<MonitoringIncident>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    api.monitoring()
      .then((data) => {
        setDevices(data.devices);
        setIncidents(data.incidents);
        setMaintenanceHistory(data.maintenanceHistory);
        setScheduler(data.scheduler);
        setAvailability(data.availability);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const names = new Map(devices.map((device) => [device.id, device.hostname]));

  const filteredIncidents = incidents.filter(
    (incident) =>
      incidentFilter === "all" ||
      incident.status === incidentFilter ||
      (incidentFilter === "acknowledged" && Boolean(incident.acknowledgedAt)) ||
      (incidentFilter === "unacknowledged" && incident.status === "open" && !incident.acknowledgedAt),
  );

  const openIncidents = incidents.filter((incident) => incident.status === "open");
  const acknowledgedIncidents = openIncidents.filter((incident) => incident.acknowledgedAt);
  const unacknowledgedIncidents = openIncidents.length - acknowledgedIncidents.length;

  const isDeviceInMaintenance = (device: Device) => {
    const start = device.maintenanceStartsAt ? Date.parse(device.maintenanceStartsAt) : NaN;
    const end = device.maintenanceEndsAt ? Date.parse(device.maintenanceEndsAt) : NaN;
    const active = Number.isFinite(start) && Number.isFinite(end) && start <= Date.now() && Date.now() < end;
    const upcoming = device.maintenanceStartsAt && Date.parse(device.maintenanceStartsAt) > Date.now();
    return { active, upcoming };
  };

  const visibleDevices = devices.filter((device) => {
    const maint = isDeviceInMaintenance(device);
    return (
      (healthFilter === "all" || device.lastStatus === healthFilter) &&
      (maintenanceFilter === "all" ||
        (maintenanceFilter === "active" && (device.maintenanceMode || maint.active)) ||
        (maintenanceFilter === "upcoming" && !device.maintenanceMode && !maint.active && maint.upcoming) ||
        (maintenanceFilter === "none" && !device.maintenanceMode && !maint.active && !maint.upcoming))
    );
  });

  return (
    <>
      <PageTitle
        eyebrow="Operations / monitoring"
        title="Monitoring"
        description="Scheduler state, maintenance activity, availability, and sustained outage incidents."
        action={<Button variant="secondary" onClick={load}><RefreshCw size={14} />Refresh</Button>}
      />
      {error ? (
        <ErrorState onRetry={load} />
      ) : loading ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="Monitoring enabled" value={String(scheduler?.enabledDevices ?? 0)} mono />
              <Detail label="Due now" value={String(scheduler?.dueDevices ?? 0)} mono />
              <Detail label="Paused for maintenance" value={String(scheduler?.pausedForMaintenance ?? 0)} mono />
              <Detail label="Next scheduler due" value={scheduler?.nextDueAt ? new Date(scheduler.nextDueAt).toLocaleString() : "No enabled devices"} />
            </div>
            <p className="mono mt-4 text-[10px] text-muted-foreground">
              Server time {scheduler ? new Date(scheduler.serverTime).toLocaleString() : "—"}
            </p>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            {(["24h", "7d", "30d"] as const).map((window) => (
              <Card key={window} className="p-5">
                <p className="text-xs text-muted-foreground">{window} fleet availability</p>
                <p className="mono mt-3 text-2xl">
                  {availability?.[window]?.percentage == null ? "—" : `${availability[window].percentage}%`}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {availability?.[window]?.observedChecks ?? 0} observed checks
                </p>
              </Card>
            ))}
          </div>

          <Card>
            <div className="flex flex-col gap-3 border-b border-card-border p-4 sm:flex-row">
              <Select value={healthFilter} onChange={(event) => setHealthFilter(event.target.value)}>
                <option value="all">All health states</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="unknown">Unknown</option>
              </Select>
              <Select value={maintenanceFilter} onChange={(event) => setMaintenanceFilter(event.target.value)}>
                <option value="all">All maintenance states</option>
                <option value="active">Active maintenance</option>
                <option value="upcoming">Upcoming maintenance</option>
                <option value="none">No maintenance</option>
              </Select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-secondary/40">
                  <tr className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 font-normal">Device</th>
                    <th className="px-4 py-3 font-normal">Status</th>
                    <th className="px-4 py-3 font-normal">Latency</th>
                    <th className="px-5 py-3 font-normal">Last checked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {visibleDevices.length ? (
                    visibleDevices.map((device) => (
                      <tr key={device.id} className="hover:bg-secondary/25">
                        <td className="px-5 py-4">
                          <a href={`/devices/${device.id}`} className="font-bold hover:text-primary">{device.hostname}</a>
                        </td>
                        <td className="px-4 py-4"><Status status={device.lastStatus} /></td>
                        <td className="px-4 py-4 mono text-xs text-muted-foreground">{device.lastLatencyMs != null ? `${device.lastLatencyMs} ms` : "—"}</td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">{device.lastCheckedAt ? new Date(device.lastCheckedAt).toLocaleString() : "Not checked"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={4}><Empty text="No devices match your filters." /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-card-border px-5 py-4">
              <h2 className="font-bold">Open incidents</h2>
              <div className="flex gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {unacknowledgedIncidents} unacknowledged, {acknowledgedIncidents.length} acknowledged
                </span>
              </div>
            </div>
            {openIncidents.length ? (
              <div className="divide-y divide-card-border">
                {openIncidents.map((incident) => (
                  <div key={incident.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      {names.get(incident.deviceId) && (
                        <span className="mr-3 font-bold">{names.get(incident.deviceId)}</span>
                      )}
                      <span className={cls(
                        "rounded px-2 py-1 text-[10px] font-bold uppercase",
                        incident.status === "open" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                      )}>{incident.status}</span>
                      {incident.acknowledgedAt && (
                        <span className="mono ml-2 text-[10px] text-amber-400">
                          ACK · {incident.acknowledgedBy}
                        </span>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {incident.operatorNote || incident.errorMessage || "Sustained outage in progress."}
                      </p>
                    </div>
                    <button
                      className="rounded-md border border-card-border px-3 py-1.5 text-xs font-bold hover:bg-secondary"
                      onClick={() => setSelectedIncident(incident)}
                    >
                      Respond
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="No open incidents." />
            )}
          </Card>
        </div>
      )}

      {selectedIncident && (
        <IncidentWorkspace
          incident={selectedIncident}
          deviceName={names.get(selectedIncident.deviceId) || ""}
          onClose={() => setSelectedIncident(undefined)}
          onSaved={() => {
            setSelectedIncident(undefined);
            load();
          }}
        />
      )}
    </>
  );
}
