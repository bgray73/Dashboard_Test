import { useEffect, useState } from "react";
import { Cog, RefreshCw } from "lucide-react";
import { api, type Settings, type NotificationDelivery, type RetentionStatus } from "@/lib/api";
import { Button, Card, ErrorState, Input, Label, Loading, PageTitle, Select, cls } from "@/components/ui";

const CONFIG_VENDORS = ["Cisco IOS / IOS-XE", "Cisco NX-OS", "Cisco IOS-XR", "Juniper Junos", "Arista EOS", "Palo Alto", "Fortinet", "Other"];

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    applicationName: "LabOps",
    defaultTheme: "dark",
    defaultConfigVendor: CONFIG_VENDORS[0],
    pingTimeoutSeconds: 3,
    monitoringRetentionDays: 30,
    webhookEnabled: false,
    webhookUrl: "",
  });
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [retentionStatus, setRetentionStatus] = useState<RetentionStatus>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [message, setMessage] = useState("");
  const [retryingDeliveryId, setRetryingDeliveryId] = useState<number>();

  const loadDeliveries = () =>
    api.notificationDeliveries().then(setDeliveries).catch(() => undefined);

  useEffect(() => {
    Promise.all([
      api.settings().then(setSettings),
      api.retentionStatus().then(setRetentionStatus),
      loadDeliveries(),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.defaultTheme !== "light");
  }, [settings.defaultTheme]);

  const update = (key: keyof Settings) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setSettings({
        ...settings,
        [key]:
          key === "pingTimeoutSeconds" || key === "monitoringRetentionDays"
            ? Number(event.target.value)
            : event.target.value,
      });

  const save = () => {
    setSaving(true);
    api
      .updateSettings(settings)
      .then((updated) => {
        setSettings(updated);
        return api.retentionStatus().then(setRetentionStatus);
      })
      .then(() => setMessage("Settings saved"))
      .catch((error) =>
        setMessage(error instanceof Error ? error.message : "Unable to save settings"),
      )
      .finally(() => setSaving(false));
  };

  const cleanupRetention = () => {
    if (!retentionStatus || !window.confirm(
      `Delete ${retentionStatus.eligibleRows.toLocaleString()} monitoring history rows older than ${retentionStatus.retentionDays} days? This cannot be undone.`,
    )) return;
    setCleaning(true);
    api
      .cleanupRetention(retentionStatus.retentionDays)
      .then((result) => {
        setRetentionStatus(result.status);
        setMessage(`Cleanup complete: ${result.deletedRows.toLocaleString()} rows deleted`);
      })
      .catch((error) =>
        setMessage(error instanceof Error ? error.message : "Unable to clean monitoring history"),
      )
      .finally(() => {
        setCleaning(false);
        void api.retentionStatus().then(setRetentionStatus);
      });
  };

  const testWebhook = () => {
    setTesting(true);
    api
      .updateSettings(settings)
      .then(setSettings)
      .then(() => api.testWebhook())
      .then((delivery) =>
        setMessage(
          delivery.status === "delivered"
            ? "Test webhook delivered"
            : "Test webhook; automatic retry scheduled",
        ),
      )
      .catch(() => setMessage("Unable to test webhook; review delivery history"))
      .finally(() => {
        setTesting(false);
        void loadDeliveries();
      });
  };

  const retryWebhook = (id: number) => {
    setRetryingDeliveryId(id);
    api
      .retryWebhook(id)
      .then((delivery) =>
        setMessage(
          delivery.status === "delivered" ? "Webhook delivered" : "Retry scheduled",
        ),
      )
      .catch((error) =>
        setMessage(error instanceof Error ? error.message : "Unable to retry webhook"),
      )
      .finally(() => {
        setRetryingDeliveryId(undefined);
        void loadDeliveries();
      });
  };

  if (loading) return <Loading />;

  return (
    <>
      <PageTitle
        eyebrow="Workspace / preferences"
        title="Settings"
        description="Application defaults and reliable incident notifications."
      />
      <div className="max-w-3xl space-y-6">
        <Card className="p-6">
          <div className="mb-6 border-b border-card-border pb-5">
            <p className="font-bold">Application</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Name and appearance for this workspace.
            </p>
          </div>
          <div className="space-y-5">
            <div>
              <Label>Application name</Label>
              <Input value={settings.applicationName} onChange={update("applicationName")} />
            </div>
            <div>
              <Label>Default theme</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSettings({ ...settings, defaultTheme: "dark" })}
                  className={cls(
                    "rounded-md border p-3 text-left text-xs font-bold",
                    settings.defaultTheme !== "light"
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  Dark / console
                </button>
                <button
                  onClick={() => setSettings({ ...settings, defaultTheme: "light" })}
                  className={cls(
                    "rounded-md border p-3 text-left text-xs font-bold",
                    settings.defaultTheme === "light"
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  Light / daylight
                </button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-6 border-b border-card-border pb-5">
            <p className="font-bold">Operational defaults</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Used in the generator and manual reachability checks.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Default generator vendor</Label>
              <Select value={settings.defaultConfigVendor} onChange={update("defaultConfigVendor")}>
                {CONFIG_VENDORS.map((item) => <option key={item}>{item}</option>)}
              </Select>
            </div>
            <div>
              <Label>Ping timeout (seconds)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={settings.pingTimeoutSeconds}
                onChange={update("pingTimeoutSeconds")}
              />
            </div>
            <div>
              <Label>History retention (days)</Label>
              <Input
                type="number"
                min={30}
                max={365}
                value={settings.monitoringRetentionDays}
                onChange={update("monitoringRetentionDays")}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Retention summary</Label>
              {retentionStatus ? (
                <p className="text-xs text-muted-foreground">
                  Retaining {retentionStatus.retentionDays} days; {retentionStatus.eligibleRows.toLocaleString()} rows eligible for cleanup.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Checking retention…</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-6 border-b border-card-border pb-5">
            <p className="font-bold">Notifications</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Webhook delivery for incident acknowledgments and resolution events.
            </p>
          </div>
          <div className="space-y-5">
            <div>
              <Label>Webhook URL</Label>
              <Input
                type="url"
                value={settings.webhookUrl}
                onChange={update("webhookUrl")}
                placeholder="https://hooks.example.com/services/…"
                aria-label="Webhook URL"
              />
            </div>
            <div className="flex gap-4">
              <Button onClick={testWebhook} disabled={testing || !settings.webhookUrl}>
                {testing ? "Testing…" : "Test webhook"}
              </Button>
            </div>
            {retentionStatus?.lastCleanup && (
              <p className="text-xs text-muted-foreground">
                Last cleanup: {new Date(retentionStatus.lastCleanup.completedAt).toLocaleString()}
              </p>
            )}
          </div>
        </Card>

        {message && (
          <p className="text-xs text-muted-foreground">{message}</p>
        )}

        <div className="flex justify-end gap-3 border-t border-card-border pt-5">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RefreshCw size={14} /> Revert unsaved changes
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </div>
    </>
  );
}
