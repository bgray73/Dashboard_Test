import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
export type ReachabilityResult = { status: "online" | "offline" | "unknown"; latencyMs: number | null; errorMessage: string | null };
type PingExecutor = (file: string, args: string[], options: { timeout: number; windowsHide: boolean }) => Promise<unknown>;

export function isIpv4OrHostname(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,252}$/.test(value);
}

export function pingArguments(target: string, timeoutSeconds: number, platform = process.platform): string[] {
  const timeout = Math.max(1, Math.min(30, timeoutSeconds));
  if (platform === "win32") return ["-n", "1", "-w", String(timeout * 1000), target];
  if (platform === "darwin") return ["-c", "1", "-W", String(timeout * 1000), target];
  return ["-4", "-c", "1", "-W", String(timeout), target];
}

export async function checkIcmp(target: string, timeoutSeconds: number, executor: PingExecutor = execFileAsync, now: () => number = Date.now): Promise<ReachabilityResult> {
  if (!isIpv4OrHostname(target)) return { status: "unknown", latencyMs: null, errorMessage: "Invalid hostname or IP address." };
  const boundedTimeout = Math.max(1, Math.min(30, timeoutSeconds));
  const started = now();
  try {
    await executor("ping", pingArguments(target, boundedTimeout), { timeout: boundedTimeout * 1000 + 500, windowsHide: true });
    return { status: "online", latencyMs: now() - started, errorMessage: null };
  } catch (error) {
    const details = error as { stderr?: string; message?: string; code?: string };
    const diagnostic = `${details.stderr ?? ""} ${details.message ?? ""}`;
    if (details.code === "ENOENT" || /operation not permitted|permission denied|address family not supported|missing cap_net_raw/i.test(diagnostic)) {
      return { status: "unknown", latencyMs: null, errorMessage: "ICMP is unavailable in the collector environment." };
    }
    return { status: "offline", latencyMs: null, errorMessage: "The collector could not reach the target." };
  }
}
