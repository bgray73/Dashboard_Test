import { sql } from "drizzle-orm";
import { check, index, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const oidcAuthFlowsTable = pgTable(
  "oidc_auth_flows",
  {
    id: serial("id").primaryKey(),
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
