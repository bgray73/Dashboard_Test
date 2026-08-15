import type { Pool, PoolClient } from "pg";
import { generateSessionToken, hashOpaqueToken } from "./auth-token";

// Fixed transaction-scoped lock serializing the explicit first-user bootstrap.
const AUTH_BOOTSTRAP_LOCK_KEY = 18_180_001;

export class IdentityNotProvisionedError extends Error {
  constructor() { super("Identity is not provisioned."); this.name = "IdentityNotProvisionedError"; }
}

export type ValidatedIdentity = {
  issuer: string;
  subject: string;
  email?: string;
  displayName?: string;
  emailVerified?: boolean;
};

export type BootstrapIdentity = { issuer?: string; subject?: string };

function validateIdentity(identity: ValidatedIdentity): void {
  if (!identity.issuer || identity.issuer.length > 2_048) throw new Error("Invalid OIDC identity.");
  if (!identity.subject || identity.subject.length > 255 || !/^[\x20-\x7e]+$/.test(identity.subject)) throw new Error("Invalid OIDC identity.");
  if (identity.email && identity.email.length > 320) throw new Error("Invalid OIDC identity.");
  if (identity.displayName && identity.displayName.length > 255) throw new Error("Invalid OIDC identity.");
}

export async function checkAuthSchemaReady(pool: Pool): Promise<void> {
  const required: Record<string, string[]> = {
    users: ["id", "identity_issuer", "identity_subject"],
    auth_sessions: ["user_id", "token_hash", "idle_expires_at", "absolute_expires_at", "revoked_at"],
    oidc_auth_flows: ["state_hash", "state", "nonce", "pkce_verifier", "issuer", "expires_at"],
    // Phase 20: Role management tables
    roles: ["id", "role"],
    user_role_memberships: ["user_id", "role_id"],
  };
  const result = await pool.query<{ table_name: string; column_name: string }>(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name = ANY($1::text[])",
    [Object.keys(required)],
  );
  const present = new Set(result.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missing = Object.entries(required).flatMap(([table, columns]) => columns.filter((column) => !present.has(`${table}.${column}`)).map((column) => `${table}.${column}`));
  if (missing.length) throw new Error(`Authentication schema is not ready; run the reviewed Drizzle push. Missing: ${missing.join(", ")}`);
}

export class AuthStore {
  constructor(
    private readonly pool: Pool,
    private readonly ttl: { idleTtlSeconds: number; absoluteTtlSeconds: number },
  ) {}

  async mapIdentity(identity: ValidatedIdentity, bootstrap: BootstrapIdentity): Promise<{ id: number }> {
    validateIdentity(identity);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1)", [AUTH_BOOTSTRAP_LOCK_KEY]);
      const existing = await client.query<{ id: number }>(
        `SELECT id FROM users WHERE identity_issuer=$1 AND identity_subject=$2`,
        [identity.issuer, identity.subject],
      );
      if (existing.rows[0]) {
        await client.query(
          `UPDATE users SET email=$2, display_name=$3, email_verified=$4, updated_at=now(), last_login_at=now() WHERE id=$1`,
          [existing.rows[0].id, identity.email ?? null, identity.displayName ?? null, identity.emailVerified ?? null],
        );
        await client.query("COMMIT");
        return existing.rows[0];
      }
      const count = await client.query<{ count: number }>("SELECT count(*)::int AS count FROM users");
      if (count.rows[0].count !== 0 || bootstrap.issuer !== identity.issuer || bootstrap.subject !== identity.subject) {
        throw new IdentityNotProvisionedError();
      }
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO users (identity_issuer, identity_subject, email, display_name, email_verified, last_login_at)
         VALUES ($1,$2,$3,$4,$5,now()) RETURNING id`,
        [identity.issuer, identity.subject, identity.email ?? null, identity.displayName ?? null, identity.emailVerified ?? null],
      );
      await client.query("COMMIT");
      return inserted.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  async issueSession(userId: number, priorToken?: string): Promise<{ token: string; absoluteExpiresAt: Date }> {
    const token = generateSessionToken();
    const tokenHash = hashOpaqueToken(token);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (priorToken) await client.query("UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at, now()) WHERE token_hash=$1", [hashOpaqueToken(priorToken)]);
      const result = await client.query<{ absolute_expires_at: Date }>(
        `INSERT INTO auth_sessions (user_id, token_hash, idle_expires_at, absolute_expires_at)
         VALUES ($1,$2,now()+($3*interval '1 second'),now()+($4*interval '1 second')) RETURNING absolute_expires_at`,
        [userId, tokenHash, this.ttl.idleTtlSeconds, this.ttl.absoluteTtlSeconds],
      );
      await client.query("COMMIT");
      return { token, absoluteExpiresAt: result.rows[0].absolute_expires_at };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async lookupSession(token: string): Promise<{ sessionId: number; user: { id: number; displayName: string | null; email: string | null; roles: string[] } } | undefined> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return undefined;
    const result = await this.pool.query<{ session_id: number; id: number; display_name: string | null; email: string | null }>(
      `SELECT s.id AS session_id,u.id,u.display_name,u.email FROM auth_sessions s JOIN users u ON u.id=s.user_id
       WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.idle_expires_at>now() AND s.absolute_expires_at>now() LIMIT 1`,
      [hashOpaqueToken(token)],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    
    // Phase 20: Load user roles from database
    const rolesResult = await this.pool.query<{ role: string }>(
      `SELECT r.role FROM user_role_memberships r
       JOIN roles ro ON ro.id = r.role_id
       WHERE r.user_id = $1`,
      [row.id],
    );
    const roles = rolesResult.rows.map(r => r.role);
    
    await this.pool.query(
      `UPDATE auth_sessions SET last_seen_at=now(), idle_expires_at=LEAST(now()+($2*interval '1 second'),absolute_expires_at)
       WHERE id=$1 AND last_seen_at<=now()-interval '5 minutes'`,
      [row.session_id, this.ttl.idleTtlSeconds],
    );
    return { sessionId: row.session_id, user: { id: row.id, displayName: row.display_name, email: row.email, roles } };
  }

  async revokeSession(token: string): Promise<void> {
    if (/^[A-Za-z0-9_-]{43}$/.test(token)) await this.pool.query("UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE token_hash=$1", [hashOpaqueToken(token)]);
  }

  async revokeAllSessions(): Promise<number> {
    const result = await this.pool.query("UPDATE auth_sessions SET revoked_at=now() WHERE revoked_at IS NULL");
    return result.rowCount ?? 0;
  }

  async cleanup(): Promise<{ sessions: number; flows: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const sessions = await client.query("DELETE FROM auth_sessions WHERE revoked_at IS NOT NULL OR idle_expires_at<=now() OR absolute_expires_at<=now()");
      const flows = await client.query("DELETE FROM oidc_auth_flows WHERE expires_at<=now()");
      await client.query("COMMIT");
      return { sessions: sessions.rowCount ?? 0, flows: flows.rowCount ?? 0 };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
}
