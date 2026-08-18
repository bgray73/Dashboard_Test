import { useEffect, useState } from "react";
import { FileDown } from "lucide-react";
import { api, type ReportsSummary, type AvailabilityReport } from "@/lib/api";
import { Button, Card, Empty, ErrorState, Loading, PageTitle, Status } from "@/components/ui";

export function Reports() {
  const [summary, setSummary] = useState<ReportsSummary>();
  const [availabilityReport, setAvailabilityReport] = useState<AvailabilityReport>();
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([api.reportsSummary(), api.availabilityReport()])
      .then(([nextSummary, nextAvailability]) => {
        setSummary(nextSummary);
        setAvailabilityReport(nextAvailability);
      })
      .catch(() => setError(true));
  }, []);

  const exports = [
    {
      title: "Device inventory",
      description: "Current device identity, location, reachability, and monitoring configuration.",
      rows: summary?.devices,
      href: "/api/reports/devices.csv",
      filename: "labops-devices.csv",
    },
    {
      title: "Incident register",
      description: "Outage lifecycle, acknowledgment, operator notes, and resolution details.",
      rows: summary?.incidents,
      href: "/api/reports/incidents.csv",
      filename: "labops-incidents.csv",
    },
    {
      title: "Monitoring history",
      description: `The retained ${summary?.retentionDays ?? 30}-day reachability sample window with latency and failure context.`,
      rows: summary?.monitoringChecksRetained,
      href: "/api/reports/monitoring-history.csv",
      filename: `labops-monitoring-history-${summary?.retentionDays ?? 30}d.csv`,
    },
  ];

  const availability = (value: number | null) =>
    value == null ? "—" : `${value.toFixed(2)}%`;

  return (
    <>
      <PageTitle
        eyebrow="Operations / reports"
        title="Operational reports"
        description="Review availability and download bounded CSV snapshots for analysis or handoff."
      />
      {error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !summary || !availabilityReport ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col gap-3 border-b border-card-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold">Device availability</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Observed online checks divided by online and offline checks; unknown results are excluded.
                </p>
              </div>
              <a
                href="/api/reports/availability.csv"
                download="labops-device-availability.csv"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:brightness-110"
              >
                <FileDown size={14} />Download availability
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left">
                <thead className="bg-secondary/40">
                  <tr className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 font-normal">Device</th>
                    <th className="px-4 py-3 font-normal">Current</th>
                    <th className="px-4 py-3 font-normal">24 hours</th>
                    <th className="px-4 py-3 font-normal">7 days</th>
                    <th className="px-5 py-3 font-normal">30 days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {availabilityReport.devices.map((device) => (
                    <tr key={device.deviceId}>
                      <td className="px-5 py-4">
                        <a href={`/devices/${device.deviceId}`} className="font-bold hover:text-primary">
                          {device.hostname}
                        </a>
                        <p className="mono mt-1 text-[11px] text-muted-foreground">
                          {device.monitoringEnabled ? "monitoring enabled" : "monitoring disabled"}
                        </p>
                      </td>
                      <td className="px-4 py-4"><Status status={device.currentStatus} /></td>
                      <td className="px-4 py-4 mono text-xs text-muted-foreground">
                        {availability(device.availability24h.percentage)}
                      </td>
                      <td className="px-4 py-4 mono text-xs text-muted-foreground">
                        {availability(device.availability7d.percentage)}
                      </td>
                      <td className="px-5 py-4 mono text-xs text-muted-foreground">
                        {availability(device.availability30d.percentage)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div className="border-b border-card-border px-5 py-4">
              <h2 className="font-bold">CSV exports</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                    Download a bounded snapshot of the operational data for offline analysis.
                  </p>
            </div>
            {exports.map((exp) => (
              <div key={exp.title} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between border-b last:border-0">
                <div>
                  <h3 className="font-bold">{exp.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{exp.description}</p>
                  <p className="mt-1 mono text-[10px] text-muted-foreground">
                    {exp.rows ?? 0} rows
                  </p>
                </div>
                <a
                  href={exp.href}
                  download={exp.filename}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary"
                >
                  <FileDown size={14} />Download
                </a>
              </div>
            ))}
            {exports.every((exp) => !exp.rows) && <Empty text="No reports available yet." />}
          </Card>
        </div>
      )}
    </>
  );
}
