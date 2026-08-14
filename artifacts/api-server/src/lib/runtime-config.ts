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
  })
  .superRefine((environment, context) => {
    if (
      environment.LABOPS_REACHABILITY_PROVIDER === "collector" &&
      environment.LABOPS_COLLECTOR_ID === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["LABOPS_COLLECTOR_ID"],
        message: "is required when collector reachability is enabled",
      });
    }
  });

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
    };
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid runtime configuration: ${details}`, { cause: error });
  }
}
