import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkReachability, createLocalIcmpProvider, localIcmpProvider, performPing, type ReachabilityProvider } from "./reachability";

describe("reachability providers", () => {
  it("delegates a validated target and timeout to the selected provider", async () => {
    const calls: Array<[string, number]> = [];
    const expected = { status: "online" as const, latencyMs: 8, message: "collector result" };
    const provider: ReachabilityProvider = {
      metadata: localIcmpProvider.metadata,
      async check(target, timeoutSeconds) { calls.push([target, timeoutSeconds]); return expected; },
    };
    assert.deepEqual(await checkReachability("lab-switch.local", 7, provider), expected);
    assert.deepEqual(calls, [["lab-switch.local", 7]]);
  });

  it("rejects an invalid target without invoking the provider", async () => {
    let invoked = false;
    const provider: ReachabilityProvider = {
      metadata: localIcmpProvider.metadata,
      async check() { invoked = true; throw new Error("should not run"); },
    };
    const result = await checkReachability("invalid target!", 3, provider);
    assert.equal(result.status, "unknown");
    assert.equal(invoked, false);
  });

  it("describes the native provider without claiming runtime availability", () => {
    assert.deepEqual(localIcmpProvider.metadata.capabilities, {
      protocol: "icmp", executionLocation: "api-host", supportsLatency: true,
      requiresSystemBinary: "ping", availability: "runtime-detected",
    });
  });

  it("reports missing ping capability as unknown", async () => {
    const provider = createLocalIcmpProvider(async () => { throw Object.assign(new Error("spawn ping ENOENT"), { code: "ENOENT" }); });
    assert.equal((await provider.check("127.0.0.1", 3)).status, "unknown");
  });

  it("reports permission restrictions as unknown", async () => {
    const provider = createLocalIcmpProvider(async () => { throw new Error("operation not permitted"); });
    assert.equal((await provider.check("127.0.0.1", 3)).status, "unknown");
  });

  it("reports ordinary ping failures as offline", async () => {
    const provider = createLocalIcmpProvider(async () => { throw new Error("request timed out"); });
    assert.equal((await provider.check("192.0.2.1", 3)).status, "offline");
  });

  it("returns measured latency after a successful check", async () => {
    const times = [100, 112];
    const provider = createLocalIcmpProvider(async () => undefined, () => times.shift() ?? 112);
    assert.deepEqual(await provider.check("127.0.0.1", 3), {
      status: "online", latencyMs: 12, message: "LabOps reached the device successfully.",
    });
  });

  it("passes the native ping command, arguments, and bounded timeout to its executor", async () => {
    let invocation: unknown[] = [];
    const provider = createLocalIcmpProvider(async (...args) => { invocation = args; });
    await provider.check("127.0.0.1", 3);
    assert.deepEqual(invocation, ["ping", process.platform === "win32" ? ["-n", "1", "-w", "3000", "127.0.0.1"] : process.platform === "darwin" ? ["-c", "1", "-W", "3000", "127.0.0.1"] : ["-4", "-c", "1", "-W", "3", "127.0.0.1"], { timeout: 3500, windowsHide: true }]);
  });

  it("keeps performPing as the compatibility entry point", () => {
    assert.equal(typeof performPing, "function");
  });
});
