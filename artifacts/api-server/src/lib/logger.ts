import pino, { type LoggerOptions } from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const sensitiveRedactionPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
  "clientSecret",
  "authorizationCode",
  "accessToken",
  "refreshToken",
  "idToken",
  "state",
  "stateHash",
  "nonce",
  "pkceVerifier",
  "pkceChallenge",
  "session.token",
  "session.tokenHash",
  "oidc.clientSecret",
  "oidc.authorizationCode",
  "oidc.state",
  "oidc.nonce",
  "oidc.pkceVerifier",
] as const;

const sensitiveKey =
  /(?:authorization|cookie|password|secret|token|state|nonce|pkce)/i;

function sanitizeLogValue(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (value instanceof Error) {
    return { type: value.name, message: "[Redacted]" };
  }
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value))
    return value.map((item) => sanitizeLogValue(item, seen));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKey.test(key) ? "[Redacted]" : sanitizeLogValue(item, seen),
    ]),
  );
}

export const loggerOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  redact: [...sensitiveRedactionPaths],
  formatters: {
    log(object) {
      return sanitizeLogValue(object) as Record<string, unknown>;
    },
  },
};

export const logger = pino({
  ...loggerOptions,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
