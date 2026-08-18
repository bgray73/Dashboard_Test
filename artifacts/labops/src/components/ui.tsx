import React, { type ReactNode } from "react";
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertCircle, ChevronLeft, Edit3, FileDown, Loader2, Plus, RefreshCw, Trash2, Wifi } from "lucide-react";
import { cls } from "@/lib/utils";
import { type Device } from "@/lib/api";

export { cls };

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "secondary";
  size?: "sm" | "md";
};

export function Button({ children, variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={cls(
        "inline-flex items-center justify-center gap-2 rounded-md font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-2 py-1.5 text-xs" : "px-3.5 py-2 text-xs",
        variant === "primary" && "bg-primary text-primary-foreground hover:brightness-110",
        variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        variant === "ghost" && "text-muted-foreground hover:bg-secondary hover:text-foreground",
        variant === "danger" && "border border-destructive/30 text-destructive hover:bg-destructive/10",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cls(
        "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cls(
        "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cls(
        "min-h-[92px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15",
        className
      )}
      {...props}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground">{children}</label>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={cls("rounded-lg border border-card-border bg-card", className)}>{children}</section>;
}

export function PageTitle({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end animate-rise">
      <div>
        <p className="mono mb-2 text-[10px] uppercase tracking-[.2em] text-primary">{eyebrow}</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Status({ status }: { status?: string }) {
  const good = status === "online";
  const bad = status === "offline";
  return (
    <span className={cls(
      "inline-flex items-center gap-1.5 text-[11px] font-bold capitalize",
      good ? "text-primary" : bad ? "text-destructive" : "text-muted-foreground"
    )}>
      <span className={cls(
        "size-1.5 rounded-full",
        good ? "bg-primary shadow-[0_0_6px_hsl(var(--primary))]" : bad ? "bg-destructive" : "bg-muted-foreground"
      )} />
      {status || "unknown"}
    </span>
  );
}

export function Loading() {
  return <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-md bg-secondary/60" />)}</div>;
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
      <AlertCircle className="mx-auto text-destructive" size={24} />
      <p className="mt-3 font-bold">Unable to reach the LabOps API</p>
      <p className="mt-1 text-sm text-muted-foreground">Check the API server and try again.</p>
      <Button variant="danger" className="mt-4" onClick={onRetry}>
        <RefreshCw size={14} />Retry
      </Button>
    </div>
  );
}

export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return <div className="p-8 text-center text-sm text-muted-foreground"><p>{text}</p>{action}</div>;
}

export function Detail({ label, value, mono = false }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cls("mt-1 text-sm font-semibold", mono && "mono")}>{value || "—"}</p>
    </div>
  );
}

export function SectionHeader({ title, text }: { title: string; text: string }) {
  return (
    <div className="border-b border-card-border px-5 py-4">
      <h2 className="font-bold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

export function Metric({ label, value, icon: Icon, tone }: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone?: "good" | "bad";
}) {
  const magnitude = typeof value === "number" ? value : Number.parseFloat(value) || 0;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon size={17} className={tone === "good" ? "text-primary" : tone === "bad" ? "text-destructive" : "text-muted-foreground"} />
      </div>
      <p className="mono mt-5 text-3xl">{value}</p>
      <div className="mt-3 h-1 rounded-full bg-secondary">
        <div
          className={cls("h-1 rounded-full", tone === "bad" ? "bg-destructive" : "bg-primary")}
          style={{ width: `${Math.min(magnitude * 12 + 8, 100)}%` }}
        />
      </div>
    </Card>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4">
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-auto rounded-xl border border-card-border bg-card p-6 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

export function formatDuration(seconds?: number | null) {
  if (seconds == null) return "Ongoing";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

export function toLocalDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function isScheduledMaintenanceActive(device: Device, now = Date.now()) {
  const start = device.maintenanceStartsAt ? Date.parse(device.maintenanceStartsAt) : Number.NaN;
  const end = device.maintenanceEndsAt ? Date.parse(device.maintenanceEndsAt) : Number.NaN;
  return Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end;
}

export function isDeviceInMaintenance(device: Device, now = Date.now()) {
  return device.maintenanceMode || isScheduledMaintenanceActive(device, now);
}

export function maintenanceSummary(device: Device, now = Date.now()) {
  if (device.maintenanceMode) return "manual maintenance";
  if (isScheduledMaintenanceActive(device, now)) return "scheduled maintenance";
  if (device.maintenanceStartsAt && Date.parse(device.maintenanceStartsAt) > now)
    return `maintenance ${new Date(device.maintenanceStartsAt).toLocaleString()}`;
  return device.monitoringEnabled ? "enabled" : "disabled";
}

export function maintenanceWindow(device: Device) {
  return device.maintenanceStartsAt && device.maintenanceEndsAt
    ? `${new Date(device.maintenanceStartsAt).toLocaleString()} – ${new Date(device.maintenanceEndsAt).toLocaleString()}`
    : "Not scheduled";
}

export { AlertCircle, ChevronLeft, Edit3, FileDown, Loader2, Plus, RefreshCw, Trash2, Wifi };
