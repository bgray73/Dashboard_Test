import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ReachabilityResult = { status: "online" | "offline" | "unknown"; latencyMs: number | null; message: string };
export type ReachabilityProviderId = "local-icmp";
export type ReachabilityProviderMetadata = {
  id: ReachabilityProviderId;
  label: string;
  description: string;
  capabilities: {
    protocol: "icmp";
    executionLocation: "api-host";
    supportsLatency: true;
    requiresSystemBinary: "ping";
    availability: "runtime-detected";
  };
};
export interface ReachabilityProvider {
  readonly metadata: ReachabilityProviderMetadata;
  check(target: string, timeoutSeconds: number): Promise<ReachabilityResult>;
}

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

export function createLocalIcmpProvider(executor: PingExecutor = execFileAsync, now: () => number = Date.now): ReachabilityProvider {
  const capabilities = Object.freeze({ protocol: "icmp" as const, executionLocation: "api-host" as const, supportsLatency: true as const, requiresSystemBinary: "ping" as const, availability: "runtime-detected" as const });
  const metadata = Object.freeze({
    id: "local-icmp" as const,
    label: "Local ICMP",
    description: "Runs the system ping command from the LabOps API host.",
    capabilities,
  });
  return {
    metadata,
    async check(target, timeoutSeconds) {
      const started = now();
      try {
        await executor("ping", pingArguments(target, timeoutSeconds), {
          timeout: Math.max(1000, Math.min(30000, timeoutSeconds * 1000 + 500)), windowsHide: true,
        });
        return { status: "online", latencyMs: now() - started, message: "LabOps reached the device successfully." };
      } catch (error) {
        const details = error as { stderr?: string; message?: string; code?: string };
        const diagnostic = `${details.stderr ?? ""} ${details.message ?? ""}`;
        if (details.code === "ENOENT" || /operation not permitted|permission denied|address family not supported|missing cap_net_raw/i.test(diagnostic)) {
          return { status: "unknown", latencyMs: null, message: "ICMP checks are unavailable in this environment. Run LabOps where ping and the target network are accessible." };
        }
        return { status: "offline", latencyMs: null, message: "LabOps could not reach this device. It may be on a private network or the address may be incorrect." };
      }
    }
  };
}

export const localIcmpProvider = createLocalIcmpProvider();
export const activeReachabilityProvider = localIcmpProvider;
export const reachabilityProviders = Object.freeze([localIcmpProvider.metadata]);

export async function checkReachability(target: string, timeoutSeconds: number, provider: ReachabilityProvider = activeReachabilityProvider): Promise<ReachabilityResult> {
  if (!isIpv4OrHostname(target)) return { status: "unknown", latencyMs: null, message: "Enter a valid hostname or IP address." };
  return provider.check(target, timeoutSeconds);
}

export function performPing(target: string, timeoutSeconds: number): Promise<ReachabilityResult> {
  return checkReachability(target, timeoutSeconds);
}
