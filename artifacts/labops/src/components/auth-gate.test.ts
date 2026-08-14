import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AuthScreen, SessionShell, type AuthState } from "./auth-gate";

it("renders an accessible loading status while the session resolves", () => {
  const markup = renderToStaticMarkup(
    createElement(AuthScreen, {
      state: { status: "loading" },
      onRetry: () => undefined,
    }),
  );

  assert.match(markup, /role="status"/);
  assert.match(markup, /Checking your session/);
  assert.doesNotMatch(markup, /Sign in/);
});

for (const testCase of [
  {
    state: { status: "anonymous" },
    heading: "Sign in to LabOps",
    action: "Sign in",
    href: "/api/auth/login",
  },
  {
    state: { status: "expired" },
    heading: "Your session expired",
    action: "Sign in again",
    href: "/api/auth/login",
  },
  {
    state: { status: "unavailable" },
    heading: "LabOps is temporarily unavailable",
    action: "Retry",
    href: undefined,
  },
] satisfies Array<{
  state: AuthState;
  heading: string;
  action: string;
  href?: string;
}>) {
  it(`renders the ${testCase.state.status} session state without provider details`, () => {
    const markup = renderToStaticMarkup(
      createElement(AuthScreen, {
        state: testCase.state,
        onRetry: () => undefined,
      }),
    );

    assert.match(markup, new RegExp(testCase.heading));
    assert.match(markup, new RegExp(`>${testCase.action}<`));
    if (testCase.href)
      assert.match(markup, new RegExp(`href="${testCase.href}"`));
    assert.doesNotMatch(markup, /callback|OIDC|provider|state=|code=/i);
  });
}

it("renders the authenticated user and a logout control with app content", () => {
  const markup = renderToStaticMarkup(
    createElement(SessionShell, {
      user: {
        id: 7,
        displayName: "Lab Operator",
        email: "operator@example.test",
      },
      loggingOut: false,
      onLogout: () => undefined,
      children: createElement("div", null, "Dashboard content"),
    }),
  );

  assert.match(markup, /Lab Operator/);
  assert.match(markup, /operator@example\.test/);
  assert.match(markup, /Dashboard content/);
  assert.match(markup, /<button[^>]*>Sign out<\/button>/);
});
