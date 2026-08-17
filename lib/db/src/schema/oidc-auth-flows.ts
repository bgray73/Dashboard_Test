import { index, text, timestamp, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { pgTable } from "drizzle-orm/pg-core";

export const oidcAuthFlowsTable = pgTable(
  "oidc_auth_flows",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    stateHash: text("state_hash").notNull(),
    state: text("state").notNull(),
    nonce: text("nonce").notNull(),
    pkceVerifier: text("pkce_verifier").notNull(),
    issuer: text("issuer").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("oidc_auth_flows_state_hash_unique").on(table.stateHash),
    index("oidc_auth_flows_expires_at_idx").on(table.expiresAt),
    check("oidc_auth_flows_expiry_check", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);

export type OidcAuthFlow = typeof oidcAuthFlowsTable.$inferSelect;