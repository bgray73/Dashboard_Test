import { createHash, randomBytes } from "node:crypto";
import type { CookieOptions } from "express";

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token, "ascii").digest("hex");
}

export function cookiePolicy(secure: boolean, absoluteTtlSeconds: number): {
  name: "__Host-labops_session" | "labops_session";
  set: CookieOptions;
  clear: CookieOptions;
} {
  const common: CookieOptions = { httpOnly: true, secure, sameSite: "lax", path: "/" };
  return {
    name: secure ? "__Host-labops_session" : "labops_session",
    set: { ...common, maxAge: absoluteTtlSeconds * 1_000 },
    clear: { ...common, maxAge: 0 },
  };
}
