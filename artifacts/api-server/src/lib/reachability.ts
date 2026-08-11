import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ReachabilityResult = { status: "online" | "offline" | "unknown"; latencyMs: number | null; message: string };

export function isIpv4OrHostname(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,252}$/.test(value);
}

export async function performPing(target: string, timeoutSeconds: number): Promise<ReachabilityResult> {
  if (!isIpv4OrHostname(target)) return { status: "unknown", latencyMs: null, message: "Enter a valid hostname or IP address." };
  const started = Date.now();
  try {
    await execFileAsync("ping", ["-4", "-c", "1", "-W", String(Math.max(1, Math.min(30, timeoutSeconds))), target], {
      timeout: Math.max(1000, Math.min(30000, timeoutSeconds * 1000 + 500)), windowsHide: true,
    });
    return { status: "online", latencyMs: Date.now() - started, message: "LabOps reached the device successfully." };
  } catch (error) {
    const details = error as { stderr?: string; message?: string; code?: string };
    const diagnostic = `${details.stderr ?? ""} ${details.message ?? ""}`;
    if (details.code === "ENOENT" || /operation not permitted|permission denied|address family not supported|missing cap_net_raw/i.test(diagnostic)) {
      return { status: "unknown", latencyMs: null, message: "ICMP checks are unavailable in this environment. Run LabOps where ping and the target network are accessible." };
    }
    return { status: "offline", latencyMs: null, message: "LabOps could not reach this device. It may be on a private network or the address may be incorrect." };
  }
}
