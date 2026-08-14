import React, { type ReactNode, useCallback, useEffect, useState } from "react";

import {
  api,
  SESSION_EXPIRED_EVENT,
  sessionEvents,
  type AuthUser,
} from "@/lib/api";
import { loadSession, transitionSession, type AuthState } from "./auth-session";

export type { AuthState } from "./auth-session";

export function AuthScreen({
  state,
  onRetry,
}: {
  state: AuthState;
  onRetry: () => void;
}) {
  if (state.status === "loading") {
    return (
      <main
        className="grid min-h-dvh place-items-center bg-background p-6"
        aria-busy="true"
      >
        <p role="status" className="text-sm text-muted-foreground">
          Checking your session…
        </p>
      </main>
    );
  }

  if (state.status === "authenticated") return null;

  const expired = state.status === "expired";
  const unavailable = state.status === "unavailable";
  const heading = unavailable
    ? "LabOps is temporarily unavailable"
    : expired
      ? "Your session expired"
      : "Sign in to LabOps";
  const description = unavailable
    ? "The authentication service could not be reached. Try again in a moment."
    : expired
      ? "Sign in again to continue working."
      : "Use your approved account to access this workspace.";

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <section
        className="w-full max-w-md rounded-xl border border-card-border bg-card p-8 shadow-2xl"
        aria-labelledby="auth-heading"
      >
        <p className="mono text-[10px] uppercase tracking-[.2em] text-primary">
          LabOps access
        </p>
        <h1 id="auth-heading" className="mt-3 text-2xl font-extrabold">
          {heading}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {unavailable ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Retry
          </button>
        ) : (
          <a
            href="/api/auth/login"
            className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            {expired ? "Sign in again" : "Sign in"}
          </a>
        )}
      </section>
    </main>
  );
}

export function SessionShell({
  user,
  loggingOut,
  onLogout,
  children,
}: {
  user: AuthUser;
  loggingOut: boolean;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <aside
        className="flex items-center justify-end gap-3 border-b border-card-border bg-card px-4 py-2 text-xs"
        aria-label="Current session"
      >
        <span>
          <strong>{user.displayName}</strong>
          {user.email ? (
            <span className="ml-2 text-muted-foreground">{user.email}</span>
          ) : null}
        </span>
        <button
          type="button"
          disabled={loggingOut}
          onClick={onLogout}
          className="rounded-md border border-card-border px-3 py-1.5 font-bold hover:bg-secondary disabled:opacity-50"
        >
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </aside>
      {children}
    </>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [loggingOut, setLoggingOut] = useState(false);

  const refresh = useCallback(() => {
    setState((current) => transitionSession(current, { type: "retry" }));
    void loadSession(api.me).then((loaded) =>
      setState((current) =>
        transitionSession(current, { type: "loaded", state: loaded }),
      ),
    );
  }, []);

  useEffect(() => {
    refresh();
    const expire = () =>
      setState((current) => transitionSession(current, { type: "expired" }));
    sessionEvents.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () =>
      sessionEvents.removeEventListener(SESSION_EXPIRED_EVENT, expire);
  }, [refresh]);

  const logout = useCallback(() => {
    setLoggingOut(true);
    void api
      .logout()
      .catch(() => undefined)
      .finally(() => {
        setLoggingOut(false);
        setState((current) =>
          transitionSession(current, { type: "logged-out" }),
        );
      });
  }, []);

  if (state.status !== "authenticated")
    return <AuthScreen state={state} onRetry={refresh} />;
  return (
    <SessionShell user={state.user} loggingOut={loggingOut} onLogout={logout}>
      {children}
    </SessionShell>
  );
}
