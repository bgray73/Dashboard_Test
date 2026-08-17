import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { execSync } from "node:child_process";

function runCommand(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: "utf8", stdio: "pipe" });
}

describe("Pre-commit verification", () => {
  it("typecheck passes", () => {
    const result = runCommand("pnpm run typecheck", "/Users/bgray/Dashboard_Test");
    assert.doesNotMatch(result, "error");
  });

  it("schema tests pass", () => {
    const result = runCommand("pnpm run test --filter @workspace/db -- --test-threads=1", "/Users/bgray/Dashboard_Test");
    // Check for no failures
    assert.ok(!result.includes("fail"));
  });
});