import { readFileSync } from "node:fs";

export type JevTriage = {
  category: "network" | "compute" | "storage" | "wireless" | "other";
  confidence: number;
  needsReview: boolean;
  model: string;
  evaluatedAt: string;
  mode: "simulation" | "live";
};

export type JevMode = "disabled" | "simulation" | "live";
const categories = ["network", "compute", "storage", "wireless", "other"] as const;

export function readJevKey(env: NodeJS.ProcessEnv): string | undefined {
  if (env.LABOPS_JEV_API_KEY) return env.LABOPS_JEV_API_KEY;
  if (!env.LABOPS_JEV_API_KEY_FILE) return undefined;
  const value = readFileSync(env.LABOPS_JEV_API_KEY_FILE);
  if (value.byteLength > 65_536) throw new Error("LABOPS_JEV_API_KEY_FILE exceeds 64 KiB");
  return value.toString("utf8").trim();
}

export async function triageIncident(
  input: { deviceType: string; vendor: string; consecutiveFailures: number },
  config: { mode: JevMode; apiKey?: string },
  fetcher: typeof fetch = fetch,
): Promise<JevTriage | null> {
  if (config.mode === "disabled") return null;
  if (config.mode === "simulation") return {
    category: "other", confidence: 0, needsReview: true, model: "simulation",
    evaluatedAt: new Date().toISOString(), mode: "simulation",
  };
  if (!config.apiKey) throw new Error("Jev live mode requires an API key");
  try {
    // Inventory classification only: do not transmit hostname, IP, notes, logs, or credentials.
    const response = await fetcher("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "jev-latest",
        state: { deviceType: input.deviceType.slice(0, 80), vendor: input.vendor.slice(0, 80),
          checkOutcome: "unreachable", consecutiveFailures: Math.min(input.consecutiveFailures, 100) },
        questions: { category: { type: "choice",
          instructions: "Which operational team should initially inspect this unreachable device? This is not a root-cause diagnosis.",
          criteria: {
            network: "Router, switch, firewall or network connectivity",
            compute: "Physical server, virtual machine, container or hypervisor",
            storage: "Storage appliance or backup storage",
            wireless: "Wireless access point or wireless controller",
            other: "Unclear or outside these areas",
          },
        } },
      }),
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) return null;
    const body = await response.json() as { model?: unknown; answers?: { category?: { type?: unknown; choice?: unknown; confidence?: unknown } } };
    const answer = body.answers?.category;
    if (answer?.type !== "choice" || !categories.some((item) => item === answer.choice) ||
        typeof answer.confidence !== "number" || !Number.isFinite(answer.confidence) ||
        answer.confidence < 0 || answer.confidence > 1 || typeof body.model !== "string") return null;
    return { category: answer.choice as JevTriage["category"], confidence: answer.confidence,
      needsReview: answer.choice === "other" || answer.confidence < 0.8,
      model: body.model, evaluatedAt: new Date().toISOString(), mode: "live" };
  } catch { return null; }
}
