import pino from "pino";

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

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [...sensitiveRedactionPaths],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
