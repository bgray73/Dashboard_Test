import { ApiError, type AuthUser } from "../lib/api";

export type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: AuthUser }
  | { status: "expired" }
  | { status: "unavailable" };

export type AuthEvent =
  | { type: "expired" }
  | { type: "logged-out" }
  | { type: "retry" }
  | { type: "loaded"; state: AuthState };

export function transitionSession(
  state: AuthState,
  event: AuthEvent,
): AuthState {
  if (event.type === "expired")
    return state.status === "anonymous" ? state : { status: "expired" };
  if (event.type === "logged-out") return { status: "anonymous" };
  if (event.type === "retry") return { status: "loading" };
  return event.state;
}

export async function loadSession(
  me: () => Promise<AuthUser>,
): Promise<AuthState> {
  try {
    return { status: "authenticated", user: await me() };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401)
      return { status: "anonymous" };
    return { status: "unavailable" };
  }
}
