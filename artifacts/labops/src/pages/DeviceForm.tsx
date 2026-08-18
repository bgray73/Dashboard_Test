import { useState, type ChangeEvent, type FormEvent } from "react";
import { api, type Device } from "@/lib/api";
import { Button, Input, Label, Select, Textarea, Modal, cls, toLocalDateTime } from "@/components/ui";

const DEVICE_TYPES = ["Physical Server", "Virtual Machine", "Container", "Router", "Switch", "Firewall", "Storage", "Wireless", "Other"];
const DEVICE_VENDORS = ["Cisco", "Juniper", "Arista", "Palo Alto", "Fortinet", "Dell", "Supermicro", "HPE", "VMware", "Proxmox", "Linux", "Other"];

type DeviceFormProps = {
  initial?: Device;
  onClose: () => void;
  onSaved: () => void;
};

export function DeviceForm({ initial, onClose, onSaved }: DeviceFormProps) {
  const [form, setForm] = useState<Partial<Device>>(() =>
    initial
      ? { ...initial, maintenanceStartsAt: toLocalDateTime(initial.maintenanceStartsAt), maintenanceEndsAt: toLocalDateTime(initial.maintenanceEndsAt) }
      : {
          hostname: "",
          managementIp: "",
          deviceType: "Other",
          vendor: "Other",
          model: "",
          operatingSystem: "",
          location: "",
          serialNumber: "",
          notes: "",
          monitoringEnabled: true,
          maintenanceMode: false,
          maintenanceStartsAt: "",
          maintenanceEndsAt: "",
          monitoringIntervalSeconds: 60,
        },
  );
  const [saving, setSaving] = useState(false);

  const update = (key: keyof Device) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: event.target.value });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      maintenanceStartsAt: form.maintenanceStartsAt
        ? new Date(form.maintenanceStartsAt).toISOString()
        : null,
      maintenanceEndsAt: form.maintenanceEndsAt
        ? new Date(form.maintenanceEndsAt).toISOString()
        : null,
    };
    const task = initial
      ? api.updateDevice(initial.id, payload)
      : api.createDevice({ ...payload, lastStatus: "unknown" });
    task.then(onSaved).catch(() => undefined).finally(() => setSaving(false));
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit}>
        <div className="mb-6 flex justify-between">
          <div>
            <p className="mono text-[10px] uppercase tracking-[.18em] text-primary">
              {initial ? "Edit record" : "New record"}
            </p>
            <h2 className="mt-1 text-xl font-extrabold">
              {initial ? initial.hostname : "Add device"}
            </h2>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>✕</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Hostname *</Label><Input required value={form.hostname ?? ""} onChange={update("hostname")} /></div>
          <div><Label>Management IP *</Label><Input required value={form.managementIp ?? ""} onChange={update("managementIp")} /></div>
          <div><Label>Device type</Label><Select value={form.deviceType} onChange={update("deviceType")}>{DEVICE_TYPES.map((item) => <option key={item}>{item}</option>)}</Select></div>
          <div><Label>Vendor</Label><Select value={form.vendor} onChange={update("vendor")}>{DEVICE_VENDORS.map((item) => <option key={item}>{item}</option>)}</Select></div>
          <div><Label>Model</Label><Input value={form.model ?? ""} onChange={update("model")} /></div>
          <div><Label>Operating system</Label><Input value={form.operatingSystem ?? ""} onChange={update("operatingSystem")} /></div>
          <div><Label>Location</Label><Input value={form.location ?? ""} onChange={update("location")} /></div>
          <div><Label>Serial number</Label><Input value={form.serialNumber ?? ""} onChange={update("serialNumber")} /></div>
          <div className="sm:col-span-2"><Label>Description / notes</Label><Textarea value={form.notes ?? ""} onChange={update("notes")} /></div>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.monitoringEnabled === true}
              onChange={(event) => setForm({ ...form, monitoringEnabled: event.target.checked })}
              className="size-4 accent-[hsl(var(--primary))]"
            />
            Enable automated monitoring
          </label>
          <div><Label>Polling interval (seconds)</Label><Input type="number" min={30} max={86400} value={form.monitoringIntervalSeconds ?? 60} onChange={update("monitoringIntervalSeconds")} /></div>
          <div><Label>Maintenance mode</Label><Select value={form.maintenanceMode ? "on" : "off"} onChange={(event) => setForm({ ...form, maintenanceMode: event.target.value === "on" })}><option value="off">Off</option><option value="on">On</option></Select></div>
          <div><Label>Maintenance starts</Label><Input type="datetime-local" value={form.maintenanceStartsAt ?? ""} onChange={update("maintenanceStartsAt")} /></div>
          <div><Label>Maintenance ends</Label><Input type="datetime-local" value={form.maintenanceEndsAt ?? ""} onChange={update("maintenanceEndsAt")} /></div>
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-card-border pt-5">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : initial ? "Save changes" : "Add device"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
