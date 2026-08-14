import { z } from "zod";

const bodyLimitSchema = z
  .string()
  .regex(/^\d+(?:\.\d+)?(?:b|kb|mb)$/i, "must be a byte size such as 100kb");

const originSchema = z.string().superRefine((value, context) => {
  try {
    const url = new URL(value);
    if (!(["http:", "https:"] as string[]).includes(url.protocol) || url.origin !== value) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be an exact HTTP(S) origin without a path",
      });
    }
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "must be a valid origin" });
  }
});

const environmentSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65_535).default(5000),
    HOST: z.string().trim().min(1).default("127.0.0.1"),
    DATABASE_URL: z
      .string()
      .url()
      .refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol), {
        message: "must be a PostgreSQL URL",
      }),
    CORS_ALLOWED_ORIGINS: z.string().optional(),
    TRUST_PROXY: z.string().optional(),
    JSON_BODY_LIMIT: bodyLimitSchema.default("100kb"),
    URLENCODED_BODY_LIMIT: bodyLimitSchema.default("100kb"),
    LABOPS_REACHABILITY_PROVIDER: z.enum(["local-icmp", "collector"]).default("local-icmp"),
    LABOPS_COLLECTOR_ID: z.coerce.number().int().min(1).max(2_147_483_647).optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    OIDC_ISSUER_URL: z.string().trim().min(1).max(2_048),
    OIDC_CLIENT_ID: z.string().trim().min(1),
    OIDC_CLIENT_SECRET: z.string().trim().min(1),
    OIDC_CLIENT_AUTH_METHOD: z.enum(["client_secret_basic", "client_secret_post"]).default("client_secret_basic"),
    PUBLIC_BASE_URL: z.string().trim().min(1),
    AUTH_BOOTSTRAP_ISSUER: z.string().trim().min(1).max(2_048).optional(),
    AUTH_BOOTSTRAP_SUBJECT: z.string().trim().min(1).max(255).optional(),
    AUTH_SESSION_IDLE_TTL_SECONDS: z.coerce.number().int().min(300).max(86_400).default(1_800),
    AUTH_SESSION_ABSOLUTE_TTL_SECONDS: z.coerce.number().int().min(1_800).max(604_800).default(43_200),
    AUTH_FLOW_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(600),
    OIDC_HTTP_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(15_000).default(5_000),
    AUTH_BYPASS: z.string().optional(),
  })
  .superRefine((environment, context) => {
    if (
      environment.LABOPS_REACHABILITY_PROVIDER === "collector" &&
      environment.LABOPS_COLLECTOR_ID === undefined
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["LABOPS_COLLECTOR_ID"], message: "is required when collector reachability is enabled" });
    }
    for (const [name, raw, originOnly] of [
      ["OIDC_ISSUER_URL", environment.OIDC_ISSUER_URL, false],
      ["PUBLIC_BASE_URL", environment.PUBLIC_BASE_URL, true],
    ] as const) {
      try {
        const url = new URL(raw);
        if (!(["http:", "https:"] as string[]).includes(url.protocol) || url.username || url.password || url.search || url.hash || (originOnly && url.origin !== raw)) {
          throw new Error("invalid");
        }
        if (environment.NODE_ENV === "production" && url.protocol !== "https:") {
          context.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: "must use HTTPS in production" });
        }
      } catch {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: originOnly ? "must be an exact HTTP(S) origin" : "must be an absolute HTTP(S) URL without query or fragment" });
      }
    }
    if ((environment.AUTH_BOOTSTRAP_ISSUER === undefined) !== (environment.AUTH_BOOTSTRAP_SUBJECT === undefined)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["AUTH_BOOTSTRAP_SUBJECT"], message: "bootstrap issuer and subject must be configured together" });
    }
    if (environment.AUTH_BOOTSTRAP_SUBJECT && (environment.AUTH_BOOTSTRAP_SUBJECT === "*" || !/^[\x21-\x7e]+$/.test(environment.AUTH_BOOTSTRAP_SUBJECT))) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["AUTH_BOOTSTRAP_SUBJECT"], message: "must be an exact non-wildcard ASCII subject" });
    }
    if (environment.AUTH_SESSION_IDLE_TTL_SECONDS > environment.AUTH_SESSION_ABSOLUTE_TTL_SECONDS) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["AUTH_SESSION_IDLE_TTL_SECONDS"], message: "must not exceed absolute TTL" });
    }
    if (environment.AUTH_BYPASS !== undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["AUTH_BYPASS"], message: "is forbidden" });
    }
  });

export type AuthRuntimeConfig = {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  clientAuthMethod: "client_secret_basic" | "client_secret_post";
  publicBaseUrl: string;
  bootstrapIssuer?: string;
  bootstrapSubject?: string;
  sessionIdleTtlSeconds: number;
  sessionAbsoluteTtlSeconds: number;
  flowTtlSeconds: number;
  httpTimeoutMs: number;
  secureCookies: boolean;
};

export type RuntimeConfig = {
  port: number;
  host: string;
  databaseUrl: string;
  corsAllowedOrigins: string[];
  trustProxy: false | string[];
  jsonBodyLimit: string;
  urlencodedBodyLimit: string;
  reachabilityProvider: "local-icmp" | "collector";
  collectorId?: number;
  auth: AuthRuntimeConfig;
};

function parseOrigins(value: string | undefined): string[] {
  if (value === undefined || value.trim() === "") return [];
  return value.split(",").map((origin) => origin.trim());
}

function parseTrustProxy(value: string | undefined): false | string[] {
  if (value === undefined || value.trim() === "" || value.trim() === "false") return false;
  if (value.trim() === "true") {
    throw new Error("TRUST_PROXY must name trusted addresses or subnets; true is not allowed.");
  }
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

export function parseRuntimeConfig(environment: NodeJS.ProcessEnv): RuntimeConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid runtime configuration: ${details}`);
  }

  try {
    const corsAllowedOrigins = z.array(originSchema).parse(parseOrigins(result.data.CORS_ALLOWED_ORIGINS));
    return {
      port: result.data.PORT,
      host: result.data.HOST,
      databaseUrl: result.data.DATABASE_URL,
      corsAllowedOrigins,
      trustProxy: parseTrustProxy(result.data.TRUST_PROXY),
      jsonBodyLimit: result.data.JSON_BODY_LIMIT,
      urlencodedBodyLimit: result.data.URLENCODED_BODY_LIMIT,
      reachabilityProvider: result.data.LABOPS_REACHABILITY_PROVIDER,
      collectorId: result.data.LABOPS_COLLECTOR_ID,
      auth: {
        issuerUrl: result.data.OIDC_ISSUER_URL,
        clientId: result.data.OIDC_CLIENT_ID,
        clientSecret: result.data.OIDC_CLIENT_SECRET,
        clientAuthMethod: result.data.OIDC_CLIENT_AUTH_METHOD,
        publicBaseUrl: result.data.PUBLIC_BASE_URL,
        bootstrapIssuer: result.data.AUTH_BOOTSTRAP_ISSUER,
        bootstrapSubject: result.data.AUTH_BOOTSTRAP_SUBJECT,
        sessionIdleTtlSeconds: result.data.AUTH_SESSION_IDLE_TTL_SECONDS,
        sessionAbsoluteTtlSeconds: result.data.AUTH_SESSION_ABSOLUTE_TTL_SECONDS,
        flowTtlSeconds: result.data.AUTH_FLOW_TTL_SECONDS,
        httpTimeoutMs: result.data.OIDC_HTTP_TIMEOUT_MS,
        secureCookies: result.data.NODE_ENV === "production",
      },
    };
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid runtime configuration: ${details}`, { cause: error });
  }
}
