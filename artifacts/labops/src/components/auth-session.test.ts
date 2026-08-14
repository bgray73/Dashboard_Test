import assert from "node:assert/strict";
import { it } from "node:test";

import { ApiError, type AuthUser } from "../lib/api";
import { loadSession, transitionSession, type AuthState } from "./auth-session";

const user: AuthUser = {
  id: 7,
  displayName: "Lab Operator",
  email: "operator@example.test",
};

it("loads the session exactly once and maps authentication outcomes", async () => {
  let calls = 0;
  const authenticated = await loadSession(async () => {
    calls += 1;
    return user;
  });
  assert.deepEqual(authenticated, { status: "authenticated", user });
  assert.equal(calls, 1);

  assert.deepEqual(
    await loadSession(async () => {
      throw new ApiError("Authentication required.", 401);
    }),
    { status: "anonymous" },
  );
  assert.deepEqual(
    await loadSession(async () => {
      throw new ApiError("Unavailable", 503);
    }),
    { status: "unavailable" },
  );
});

it("transitions an active session to expired or anonymous without fetching", () => {
  const active: AuthState = { status: "authenticated", user };
  assert.deepEqual(transitionSession(active, { type: "expired" }), {
    status: "expired",
  });
  assert.deepEqual(transitionSession(active, { type: "logged-out" }), {
    status: "anonymous",
  });
  assert.deepEqual(
    transitionSession({ status: "unavailable" }, { type: "retry" }),
    { status: "loading" },
  );
});
