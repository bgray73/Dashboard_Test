import { useEffect, useState, type FormEvent } from "react";
import { X, Loader2 } from "lucide-react";
import { api, type MonitoringIncident, type IncidentActivity } from "@/lib/api";
import { Button, Detail, Empty, Loading, Modal, Input, Label, Textarea, formatDuration } from "@/components/ui";

export function IncidentWorkspace({
  incident,
  deviceName,
  onClose,
  onSaved,
}: {
  incident: MonitoringIncident;
  deviceName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [actor, setActor] = useState(incident.acknowledgedBy || "");
  const [note, setNote] = useState(incident.operatorNote || "");
  const [activity, setActivity] = useState<IncidentActivity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.incidentActivity(incident.id)
      .then(setActivity)
      .catch(() => setMessage("Unable to load incident activity."))
      .finally(() => setLoadingActivity(false));
  }, [incident.id]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!actor.trim()) {
      setMessage("Operator name is required.");
      return;
    }
    setSaving(true);
    setMessage("");
    api.acknowledgeIncident(incident.id, { actor: actor.trim(), note: note.trim() || undefined })
      .then(onSaved)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to save incident response."))
      .finally(() => setSaving(false));
  };

  return (
    <Modal onClose={onClose}>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="mono text-[10px] uppercase tracking-[.18em] text-primary">
            Incident workspace
          </p>
          <h2 className="mt-1 text-xl font-extrabold">{deviceName}</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Started {new Date(incident.startedAt).toLocaleString()} · {formatDuration(incident.durationSeconds)}
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Detail label="Status" value={incident.status} />
        <Detail label="Peak failures" value={String(incident.peakFailures)} mono />
        <Detail label="Resolution" value={incident.resolutionReason || "Pending recovery"} />
      </div>

      <p className="mt-5 rounded-md border border-card-border bg-secondary/30 p-4 text-sm text-muted-foreground">
        {incident.errorMessage || "No error detail was recorded."}
      </p>

      {incident.status === "open" && (
        <form className="mt-6 space-y-4 border-t border-card-border pt-5" onSubmit={submit}>
          <div>
            <Label>Operator name *</Label>
            <Input
              required
              maxLength={100}
              value={actor}
              onChange={(event) => setActor(event.target.value)}
              placeholder="Who is handling this incident?"
              aria-label="Operator name"
            />
          </div>
          <div>
            <Label>Response note</Label>
            <Textarea
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What was checked, observed, or escalated?"
              aria-label="Response note"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-destructive">{message}</span>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {incident.acknowledgedAt ? "Update response" : "Acknowledge incident"}
            </Button>
          </div>
        </form>
      )}

      <div className="mt-6 border-t border-card-border pt-5">
        <h3 className="font-bold">Activity timeline</h3>
        <p className="mt-1 text-xs text-muted-foreground">Durable operator actions for this incident.</p>
        {loadingActivity ? (
          <div className="mt-4"><Loading /></div>
        ) : activity.length ? (
          <div className="mt-4 divide-y divide-card-border rounded-md border border-card-border">
            {activity.map((event) => (
              <div key={event.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="mono text-[10px] uppercase text-primary">
                    {event.eventType.replaceAll("_", " ")}
                  </span>
                  <span className="mono text-[10px] text-muted-foreground">
                    {new Date(event.occurredAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-xs font-bold">{event.actor || "System"}</p>
                {event.note && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{event.note}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty text="No operator activity has been recorded." />
        )}
      </div>
    </Modal>
  );
}
