import assert from "node:assert/strict";
import { it } from "node:test";

import {
  ApiError,
  SESSION_EXPIRED_EVENT,
  api,
  request,
  sessionEvents,
} from "./api";

it("uses cookie credentials and emits one safe session-expired event for a 401", async () => {
  const originalFetch = globalThis.fetch;
  const originalEventTarget = globalThis.EventTarget;
  const events = new EventTarget();
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  let expired = 0;
  events.addEventListener(SESSION_EXPIRED_EVENT, () => {
    expired += 1;
  });
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return new Response('{"error":"Authentication required."}', {
      status: 401,
    });
  };

  try {
    await assert.rejects(
      request("/devices", undefined, { events }),
      (error: unknown) => error instanceof ApiError && error.status === 401,
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init?.credentials, "include");
    assert.equal(expired, 1);
    assert.equal(originalEventTarget, globalThis.EventTarget);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("loads the minimum local user and logs out with POST", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    if (String(input).endsWith("/auth/me")) {
      return Response.json({
        id: 7,
        displayName: "Lab Operator",
        email: "operator@example.test",
      });
    }
    return new Response(null, { status: 204 });
  };

  try {
    assert.deepEqual(await api.me(), {
      id: 7,
      displayName: "Lab Operator",
      email: "operator@example.test",
    });
    await api.logout();
    assert.deepEqual(
      calls.map(({ input, init }) => [
        String(input),
        init?.method ?? "GET",
        init?.credentials,
      ]),
      [
        ["/api/auth/me", "GET", "include"],
        ["/api/auth/logout", "POST", "include"],
      ],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("does not report the initial anonymous session as an expired active session", async () => {
  const originalFetch = globalThis.fetch;
  let expired = 0;
  const listener = () => {
    expired += 1;
  };
  sessionEvents.addEventListener(SESSION_EXPIRED_EVENT, listener);
  globalThis.fetch = async () => new Response(null, { status: 401 });

  try {
    await assert.rejects(
      api.me(),
      (error: unknown) => error instanceof ApiError && error.status === 401,
    );
    assert.equal(expired, 0);
  } finally {
    sessionEvents.removeEventListener(SESSION_EXPIRED_EVENT, listener);
    globalThis.fetch = originalFetch;
  }
});
