import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Copy, Plus, Trash2 } from "lucide-react";
import { api, type SavedConfiguration } from "@/lib/api";
import { Button, Card, Empty, ErrorState, Loading, PageTitle, cls } from "@/components/ui";

export function SavedConfigs() {
  const [items, setItems] = useState<SavedConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [, setLocation] = useLocation();

  const load = () =>
    api.saved().then(setItems).catch(() => setError(true)).finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

  const remove = (item: SavedConfiguration) => {
    if (confirm(`Delete ${item.name}?`)) {
      api.deleteConfig(item.id).then(load).catch(() => undefined);
    }
  };

  const copyConfig = (item: SavedConfiguration) => {
    void navigator.clipboard?.writeText(item.generatedConfiguration);
  };

  return (
    <>
      <PageTitle
        eyebrow="Utilities / archive"
        title="Saved configurations"
        description="Reusable output kept close to the hardware it was made for."
        action={
          <a
            href="/config-generator"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground"
          >
            <Plus size={14} />New configuration
          </a>
        }
      />
      <Card>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : items.length === 0 ? (
          <Empty
            text="No saved configurations yet."
            action={
              <Button className="mt-4" onClick={() => setLocation("/config-generator")}>
                <Plus size={14} />Generate one
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-card-border">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold">{item.name}</h3>
                    <span className="rounded bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">
                      {item.vendor}
                    </span>
                  </div>
                  <p className="mono mt-2 text-[11px] text-muted-foreground">
                    {item.configurationType} ·{" "}
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}
                  </p>
                  {item.notes && (
                    <p className="mt-2 text-xs text-muted-foreground">{item.notes}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => copyConfig(item)}>
                    <Copy size={14} />Copy
                  </Button>
                  <Button variant="danger" onClick={() => remove(item)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
