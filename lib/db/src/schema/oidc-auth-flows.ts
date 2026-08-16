import { index, text, timestamp } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";

export const oidcAuthFlowsTable = pgTable(
  "oidc_auth_flows",
  {
    id: text("id").primaryKey(),
    stateHash: text("state_hash").notNull(),
    state: text("state").notNull(),
    nonce: text("nonce").notNull(),
    pkceVerifier: text("pkce_verifier").notNull(),
    issuer: text("issuer").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("oidc_auth_flows_issuer_idx").on(table.issuer),
    index("oidc_auth_flows_expires_idx").on(table.expiresAt),
  ],
);

export type OidcAuthFlow = typeof oidcAuthFlowsTable.$inferSelect;