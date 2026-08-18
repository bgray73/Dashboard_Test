import { useState, useMemo } from "react";
import { Button, Card, Input, Label, PageTitle, cls } from "@/components/ui";

function calculateSubnet(input: string): Record<string, string> {
  const match = input.trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
  if (!match) return { error: "Enter a valid CIDR, for example 192.168.10.0/24." };
  const nums = match[1].split(".").map(Number);
  const prefix = Number(match[2]);
  if (nums.some((number) => number > 255) || prefix > 32)
    return { error: "That address or prefix is not valid." };
  const ip = nums.reduce((value, number) => (value << 8) + number, 0) >>> 0;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network + (~mask >>> 0)) >>> 0;
  const fmt = (value: number) =>
    [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join(".");
  const hosts = Math.max(0, 2 ** (32 - prefix) - (prefix >= 31 ? 0 : 2));
  return {
    network_address: fmt(network),
    broadcast_address: fmt(broadcast),
    first_host: fmt(prefix >= 31 ? network : network + 1),
    last_host: fmt(prefix >= 31 ? broadcast : broadcast - 1),
    usable_hosts: hosts.toLocaleString(),
    subnet_mask: fmt(mask),
  };
}

export function Subnet() {
  const [cidr, setCidr] = useState("192.168.10.0/24");
  const result = useMemo(() => calculateSubnet(cidr), [cidr]);

  return (
    <>
      <PageTitle
        eyebrow="Tools / ipv4"
        title="Subnet calculator"
        description="A quick read of the boundaries inside an IPv4 network."
      />
      <Card className="max-w-3xl p-6">
        <Label>IPv4 address / CIDR prefix</Label>
        <div className="flex gap-2">
          <Input value={cidr} onChange={(event) => setCidr(event.target.value)} className="mono" />
          <Button variant="secondary" onClick={() => setCidr("10.0.0.0/8")}>/8</Button>
          <Button variant="secondary" onClick={() => setCidr("172.16.0.0/16")}>/16</Button>
        </div>
        {result.error ? (
          <p className="mt-4 text-sm text-destructive">{result.error}</p>
        ) : (
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {Object.entries(result).map(([key, value]) => (
              <div key={key} className="rounded-md border border-border bg-secondary/30 p-4">
                <p className="text-[11px] capitalize text-muted-foreground">
                  {key.replaceAll("_", " ")}
                </p>
                <p className="mono mt-2 text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
