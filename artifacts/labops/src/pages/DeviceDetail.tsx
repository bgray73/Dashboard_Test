import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { ChevronLeft, Edit3, Wifi } from "lucide-react";
import { api, type Device, type MonitoringHistory, type MonitoringIncident, type AvailabilityWindows } from "@/lib/api";
import { Button, Card, Detail, ErrorState, Loading, PageTitle, Status, isDeviceInMaintenance, maintenanceWindow } from "@/components/ui";

export function DeviceDetail() {
  // @ts-ignore - useParams is from wouter
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [device, setDevice] = useState<Device>();
  const [history, setHistory] = useState<MonitoringHistory[]>([]);
  const [incidents, setIncidents] = useState<MonitoringIncident[]>([]);
  const [availability, setAvailability] = useState<AvailabilityWindows>();
  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = () => {
    if (id) {
      Promise.all([
        api.device(Number(id)),
        api.deviceHistory(Number(id)),
        api.incidents(Number(id)),
        api.monitoring(),
      ])
        .then(([nextDevice, nextHistory, nextIncidents, monitoring]) => {
          setDevice(nextDevice);
          setHistory(nextHistory);
          setIncidents(nextIncidents);
          setAvailability(monitoring.deviceAvailability[Number(id)]);
        })
        .catch(() => setDevice(undefined))
        .finally(() => setLoading(false));
    }
  };

  useEffect(load, [id]);

  if (loading) return <Loading />;
  if (!device) return <ErrorState onRetry={load} />;

  const ping = () => {
    setPinging(true);
    api.pingDevice(device.id).then(load).finally(() => setPinging(false));
  };

  const remove = () => {
    if (confirm(`Delete ${device.hostname}?`)) {
      api.deleteDevice(device.id).then(() => setLocation("/devices"));
    }
  };

  return (
    <>
      <a href="/devices" className="mb-6 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
        <ChevronLeft size={15} />Back to inventory
      </a>
      <PageTitle
        eyebrow={`Device / ${device.deviceType}`}
        title={device.hostname}
        description={`${device.vendor} ${device.model || ""} · ${device.location || "Unassigned location"}`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Edit3 size={14} />Edit
            </Button>
            <Button onClick={ping} disabled={pinging}>
              <Wifi size={14} />{pinging ? "Checking…" : "Ping device"}
            </Button>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-6">
          <div className="flex items-start justify-between border-b border-card-border pb-5">
            <div>
              <p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Reachability</p>
              <div className="mt-3 flex items-center gap-3">
                <Status status={device.lastStatus} />
                {isDeviceInMaintenance(device) && (
                  <span className="rounded bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">
                    {device.maintenanceMode ? "Manual maintenance" : "Scheduled maintenance"}
                  </span>
                )}
                <span className="mono text-xs text-muted-foreground">
                  {device.lastCheckedAt ? new Date(device.lastCheckedAt).toLocaleString() : "Not checked yet"}
                </span>
              </div>
            </div>
            <div className="grid size-12 place-items-center rounded-full bg-accent text-primary">
              <Wifi size={21} />
            </div>
          </div>
          <div className="grid gap-5 pt-6 sm:grid-cols-2">
            <Detail label="Management IP" value={device.managementIp} mono />
            <Detail label="Device type" value={device.deviceType} />
            <Detail label="Operating system" value={device.operatingSystem} />
            <Detail label="Serial number" value={device.serialNumber} />
            <Detail label="Monitoring" value={
              isDeviceInMaintenance(device) ? "Paused for maintenance" : device.monitoringEnabled ? "Enabled" : "Disabled"
            } />
            <Detail label="Maintenance window" value={maintenanceWindow(device)} />
            <Detail label="Record created" value={device.createdAt ? new Date(device.createdAt).toLocaleString() : "—"} />
          </div>
        </Card>
      </div>
    </>
  );
}
