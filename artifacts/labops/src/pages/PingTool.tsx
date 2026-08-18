import { useState } from "react";
import { Wifi } from "lucide-react";
import { api, type PingResult } from "@/lib/api";
import { Button, Card, Detail, Input, Label, Loading, PageTitle, Status, cls } from "@/components/ui";

export function PingTool() {
  const [target, setTarget] = useState("192.168.1.1");
  const [result, setResult] = useState<PingResult>();
  const [loading, setLoading] = useState(false);

  const run = () => {
    setLoading(true);
    setResult(undefined);
    api.ping({ target })
      .then(setResult)
      .catch(() =>
        setResult({ status: "unknown", latencyMs: null, message: "LabOps could not perform this check." }),
      )
      .finally(() => setLoading(false));
  };

  return (
    <>
      <PageTitle
        eyebrow="Tools / reachability"
        title="Manual ping"
        description="One explicit check, from this workspace to a host you name."
      />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="p-6">
          <Label>Hostname or IP address</Label>
          <Input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className="mono"
            placeholder="192.168.1.1"
            aria-label="Hostname or IP address"
          />
          <Button className="mt-6 w-full" onClick={run} disabled={loading || !target}>
            {loading ? <span>Checking…</span> : <><Wifi size={15} />Run ping</>}
          </Button>
        </Card>

        <Card className="p-6 min-h-[250px]">
          {!result && !loading ? (
            <div className="grid h-full min-h-[200px] place-items-center text-center text-sm text-muted-foreground">
              <div>
                <Wifi className="mx-auto mb-3 text-muted-foreground" size={23} />
                <p>Results will appear here</p>
                <p className="mt-1 text-xs">No request is sent until you run the check.</p>
              </div>
            </div>
          ) : loading ? (
            <Loading />
          ) : (
            <div>
              <div className="flex items-center gap-3">
                <Status status={result?.status} />
                <span className="mono text-xs text-muted-foreground">{target}</span>
              </div>
              <p className="mt-5 text-sm leading-6 text-muted-foreground">{result?.message}</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <Detail
                  label="Latency"
                  value={result?.latencyMs != null ? `${result.latencyMs} ms` : "—"}
                  mono
                />
                <Detail label="Checked at" value={new Date().toLocaleTimeString()} />
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
