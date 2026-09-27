import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { triageIncident } from "./jev-triage";

const input = { deviceType: "Switch", vendor: "Cisco", consecutiveFailures: 3 };

describe("Jev incident advisory", () => {
  it("sends nothing in disabled or simulation mode", async () => {
    const fetcher = (async () => { throw new Error("must not call network"); }) as typeof fetch;
    assert.equal(await triageIncident(input, { mode: "disabled" }, fetcher), null);
    const simulated = await triageIncident(input, { mode: "simulation" }, fetcher);
    assert.equal(simulated?.mode, "simulation");
    assert.equal(simulated?.needsReview, true);
    assert.equal(simulated?.confidence, 0);
  });

  it("uses a bounded inventory-only request and validates the choice", async () => {
    let sent: Record<string, unknown> | undefined;
    const fetcher = (async (_url: string | URL | Request, options?: RequestInit) => {
      sent = JSON.parse(String(options?.body));
      return Response.json({ model: "jev-1.13.0", answers: { category: { type: "choice", choice: "network", confidence: 0.91 } } });
    }) as typeof fetch;
    const result = await triageIncident(input, { mode: "live", apiKey: "test" }, fetcher);
    assert.equal(result?.category, "network");
    assert.equal(result?.needsReview, false);
    assert.deepEqual(sent?.state, { deviceType: "Switch", vendor: "Cisco", checkOutcome: "unreachable", consecutiveFailures: 3 });
    assert.equal(JSON.stringify(sent).includes("managementIp"), false);
  });

  it("asks for review when uncertain and ignores failed or malformed responses", async () => {
    const config = { mode: "live" as const, apiKey: "test" };
    const uncertain = (async () => Response.json({ model: "jev", answers: { category: { type: "choice", choice: "storage", confidence: 0.5 } } })) as typeof fetch;
    assert.equal((await triageIncident(input, config, uncertain))?.needsReview, true);
    const invalid = (async () => Response.json({ model: "jev", answers: { category: { type: "choice", choice: "invalid", confidence: 1 } } })) as typeof fetch;
    assert.equal(await triageIncident(input, config, invalid), null);
    const failed = (async () => { throw new Error("offline"); }) as typeof fetch;
    assert.equal(await triageIncident(input, config, failed), null);
  });
});
