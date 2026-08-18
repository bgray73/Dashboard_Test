import { useEffect, useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, Filter, Plus, Search, Trash2 } from "lucide-react";
import { api, type Device } from "@/lib/api";
import { Button, Card, Empty, ErrorState, Input, Label, Loading, PageTitle, Select, Status, cls } from "@/components/ui";
import { DeviceForm } from "./DeviceForm";

export function Devices() {
  const [items, setItems] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"hostname" | "status">("hostname");
  const [editing, setEditing] = useState<Device>();
  const [adding, setAdding] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    api.devices()
      .then(setItems)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(
    () =>
      items
        .filter(
          (device) =>
            (filter === "all" || device.lastStatus === filter) &&
            [device.hostname, device.managementIp, device.vendor, device.model, device.location]
              .join(" ")
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "hostname"
            ? a.hostname.localeCompare(b.hostname)
            : a.lastStatus.localeCompare(b.lastStatus),
        ),
    [items, search, filter, sort],
  );

  const remove = (device: Device) => {
    if (confirm(`Delete ${device.hostname}? This cannot be undone.`)) {
      api.deleteDevice(device.id).then(load).catch(() => undefined);
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="Inventory / devices"
        title="Device inventory"
        description="The hardware and hosts you care about, recorded with just enough context."
        action={<Button onClick={() => setAdding(true)}><Plus size={15} />Add device</Button>}
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-card-border p-4 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-muted-foreground" size={15} />
            <Input
              className="pl-9"
              placeholder="Search hostname, address, vendor..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select
              className="w-auto min-w-[130px]"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="unknown">Unknown</option>
            </Select>
            <Button variant="secondary" onClick={() => setSort(sort === "hostname" ? "status" : "hostname")}>
              <Filter size={14} />
              {sort === "hostname" ? <ArrowDownAZ size={14} /> : <ArrowUpAZ size={14} />}
            </Button>
          </div>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : filtered.length === 0 ? (
          <Empty
            text={items.length ? "No devices match your filter." : "Your inventory is empty."}
            action={<Button className="mt-4" onClick={() => setAdding(true)}><Plus size={14} />Add first device</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-secondary/40">
                <tr className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-normal">Device</th>
                  <th className="px-4 py-3 font-normal">Type / vendor</th>
                  <th className="px-4 py-3 font-normal">Location</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                  <th className="px-5 py-3 text-right font-normal">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {filtered.map((device) => (
                  <tr key={device.id} className="group hover:bg-secondary/25">
                    <td className="px-5 py-4">
                      <a href={`/devices/${device.id}`} className="font-bold hover:text-primary">{device.hostname}</a>
                      <p className="mono text-[11px] text-muted-foreground">{device.managementIp}</p>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {device.deviceType}
                      <span className="text-muted-foreground">, {device.vendor}</span>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{device.location || "—"}</td>
                    <td className="px-4 py-4"><Status status={device.lastStatus} /></td>
                    <td className="px-5 py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(device)}>
                        <span className="sr-only">Edit {device.hostname}</span>
                        ✏️
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => remove(device)}>
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {adding && (
          <DeviceForm
            onClose={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              load();
            }}
          />
        )}
        {editing && (
          <DeviceForm
            initial={editing}
            onClose={() => setEditing(undefined)}
            onSaved={() => {
              setEditing(undefined);
              load();
            }}
          />
        )}
      </Card>
    </>
  );
}
