import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Database, Wifi, AlertCircle, Activity, Settings2, ShieldCheck, RefreshCw } from "lucide-react";
import { api, type Device, type AvailabilityReport, type AvailabilityWindows, type MonitoringIncident } from "@/lib/api";
import { cls } from "@/lib/utils";
import { Card, Loading, Button, ErrorState, Empty, Status, PageTitle, Metric } from "@/components/ui";

export function Dashboard() {
  const [summary, setSummary] = useState<Record<string, number | null>>({});
  const [recent, setRecent] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    Promise.all([api.summary(), api.recent()])
      .then(([nextSummary, nextRecent]) => {
        setSummary(nextSummary);
        setRecent(nextRecent);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const check = () => {
    setChecking(true);
    api.checkMonitored().then(load).catch(() => undefined).finally(() => setChecking(false));
  };

  return (
    <>
      <PageTitle
        eyebrow="Operations overview"
        title="Dashboard"
        description="A clear read on your home lab, without the noise of an enterprise NOC."
        action={<Button onClick={check} disabled={checking}><RefreshCw size={14} className={checking ? "animate-spin" : ""} />Check monitored</Button>}
      />
      {error ? (
        <ErrorState onRetry={load} />
      ) : loading ? (
        <Loading />
      ) : (
        <div className="space-y-6 animate-rise">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Total devices" value={summary.totalDevices ?? 0} icon={Database} />
            <Metric label="Online" value={summary.onlineDevices ?? 0} icon={Wifi} tone="good" />
            <Metric label="Offline" value={summary.offlineDevices ?? 0} icon={AlertCircle} tone="bad" />
            <Metric label="Unknown" value={summary.unknownDevices ?? 0} icon={Activity} />
            <Metric label="Open incidents" value={summary.openIncidents ?? 0} icon={AlertCircle} tone={summary.openIncidents ? "bad" : "good"} />
            <Metric label="Active maintenance" value={summary.activeMaintenance ?? 0} icon={Settings2} />
            <Metric label="Upcoming maintenance" value={summary.upcomingMaintenance ?? 0} icon={Activity} />
            <Metric label="24h availability" value={summary.availability24h == null ? "—" : `${summary.availability24h}%`} icon={ShieldCheck} tone="good" />
          </div>

          <Card>
            <div className="flex items-center justify-between border-b border-card-border px-5 py-4">
              <div>
                <h2 className="font-bold">Recent device status</h2>
                <p className="mt-1 text-xs text-muted-foreground">Current reachability, not historical metrics.</p>
              </div>
              <Link href="/devices" className="text-xs font-bold text-primary hover:underline">View inventory</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left">
                <thead className="bg-secondary/40">
                  <tr className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 font-normal">Status</th>
                    <th className="px-4 py-3 font-normal">Hostname</th>
                    <th className="px-4 py-3 font-normal">IP address</th>
                    <th className="px-4 py-3 font-normal">Device type</th>
                    <th className="px-4 py-3 font-normal">Vendor</th>
                    <th className="px-4 py-3 font-normal">Model</th>
                    <th className="px-5 py-3 font-normal">Last checked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {recent.length ? (
                    recent.map((device) => (
                      <tr key={device.id} className="hover:bg-secondary/25">
                        <td className="px-5 py-4"><Status status={device.lastStatus} /></td>
                        <td className="px-4 py-4"><Link href={`/devices/${device.id}`} className="font-bold hover:text-primary">{device.hostname}</Link></td>
                        <td className="mono px-4 py-4 text-xs text-muted-foreground">{device.managementIp}</td>
                        <td className="px-4 py-4 text-xs">{device.deviceType}</td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">{device.vendor}</td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">{device.model || "—"}</td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">{device.lastCheckedAt ? new Date(device.lastCheckedAt).toLocaleString() : "Not checked"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={7}><Empty text="No devices yet." /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-5">
            <div className="flex gap-4">
              <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={20} />
              <div>
                <p className="text-sm font-bold">Automated health, manual control</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Enabled devices are polled in the background. Manual Ping Now remains available for immediate checks.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
