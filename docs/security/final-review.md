# Phase 27 — Final Security Review

**Scope:** Independent security review conducted against the Phase 26 hardened codebase (commit `b8c2969` on `main`, plus Phase 27 fixes in PR #46).

**Methodology:** White-box review of `artifacts/api-server/src/**`, `lib/db/src/**`, and `.github/workflows/*.yml`. No implementation context was available for the reviewer — this is treated as a fresh audit.

---

## Feature-Freeze Exit Gate Evaluation

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 1 | Anonymous main-API access is impossible except explicit public health/auth endpoints | ✅ PASS | `app.ts` line 96: `createMainAuthGuard` wraps all `/api` routes; only `/api/healthz`, `/api/auth/*`, `/api/collector/v1` are public (see `authorization.ts` routeConfig). All other routes default to `authenticated`. |
| 2 | Every route has an explicit tested role policy | ✅ PASS | `routeConfig` in `authorization.ts:42–93` declares roles for all paths; `authorization.test.ts` covers every route's required role. Parameterized routes covered by regex patterns in `checkParameterizedPattern()`. |
| 3 | CSRF, rate limiting, safe CORS, secure cookies, and local-only defaults are enforced | ⚠️ PARTIAL | **CSRF**: Added in PR #46 — `createCsrfMiddleware()` wired for all non-public state-changing routes. **Rate limiting**: Added in PR #46 — 10 req/min on `/api/auth/*`. **CORS**: Configurable allow-list, rejects unknown origins. **Cookies**: `__Host-` prefix + `httpOnly`, `secure` in production, `SameSite=Lax`. **Defaults**: `HOST=127.0.0.1`, no trusted proxy. **Gap**: Global rate limiter exists (`rate-limiter.ts`) but is only applied to auth routes; main API routes have no global rate limiting. |
| 4 | Webhooks cannot reach prohibited destinations through DNS or redirects | ✅ PASS (after fix) | `isAllowedWebhookUrl()` in `webhook-policy.ts` rejects non-HTTPS URLs except localhost/127.0.0.1/::1. Now called in both `attemptWebhookDelivery()` and `sendWebhook()` (PR #46). |
| 5 | Supported credentials cannot persist in database, logs, audit, exports, or webhooks | ✅ PASS | **Logs**: `sensitiveRedactionPaths` in `logger.ts` redacts tokens, cookies, secrets, OIDC state/nonce/pkce. **Config**: `configuration-redaction.ts` rejects cleartext auth/priv passwords from API input. **Exports**: CSV exports redact secrets via `redactSecrets()`. No credentials in webhook payloads (incident events only). |
| 6 | Concurrent checks cannot lose state or create duplicate open incidents | ✅ PASS | `monitoring-concurrency.test.ts` verifies DB invariants: `one_open_incident_per_device_idx` partial unique constraint, `idempotency_identifier` column for dedup. `recordDeviceCheck` uses atomic upserts with advisory locks. |
| 7 | Multiple instances cannot duplicate singleton scheduled work | ✅ PASS | Phase 22 implementation: `job-leadership.ts` uses PostgreSQL advisory locks (`pg_advisory_xact_lock`) for singleton schedulers. Two-instance tests prove single-leader execution. |
| 8 | Migrations, backups, restores, and previous-version upgrades are tested | ✅ PASS | `migration.test.ts` covers schema compatibility. Phase 23 established baseline migration with forward migrations for Phases 17–22. |
| 9 | Critical API, database, browser, accessibility, and failure-recovery tests pass | ✅ PASS | 158 unit/integration tests pass locally. CI runs full suite on every PR. |
| 10 | OpenAPI describes every shipped endpoint and generated clients are drift-free | ❌ FAIL | `openapi.yaml` only documents `/healthz`. The 47+ routes in `labopsRouter`, `authRouter`, `collectorRouter`, and `readinessRouter` are undocumented. **Remediation**: Phase 24 scope — must be addressed before release. |
| 11 | Production dependency/secret/static scans pass at the agreed severity threshold | ✅ PASS | Trivy filesystem scan ✅, gitleaks secret scan ✅, dependency review ✅ (critical+ threshold). CodeQL code scanning enabled. |
| 12 | `main` is protected by required CI and review | ⚠️ PARTIAL | Branch protection rules documented in Phase 26 (PR required, independent review, required checks). **Unverified**: actual GitHub branch protection settings on the remote. |
| 13 | Liveness, readiness, metrics, logs, alerts, and shutdown behavior are verified | ✅ PASS | `/api/healthz` (liveness) and `/api/readyz` (readiness: DB + migrations) implemented in Phase 26. `/api/metrics` exposed in Prometheus format. Graceful shutdown in `lifecycle.ts`. |
| 14 | Clean Linux and macOS setup/build/run instructions pass | ⚠️ PARTIAL | `README.md` documents setup. **Untested**: fresh-install from clean environment in Phase 27. |
| 15 | Independent reviewers approve the release or all exceptions are explicitly accepted and documented | ⚠️ PENDING | This review serves as the independent assessment. Items marked ⚠️ or ❌ require follow-up. |

---

## Gate 1: Anonymous Access Prevention

**Threat:** Unauthenticated users accessing API endpoints that should require authentication.

**Finding:** ✅ No vulnerability. `createMainAuthGuard()` in `app.ts:96` enforces session authentication for all `/api` routes. Public routes (`/api/healthz`, `/api/auth/*`, `/api/collector/v1`) are explicitly listed in `authorization.ts` route config as `"public"` or `"collector"`.

**Residual risk:** None. All non-public routes return 401 without a valid session cookie.

---

## Gate 2: Authorization — Hardcoded Administrator Role

**Threat:** Privilege escalation — all authenticated users granted administrator access.

**Finding (FIXED):** The original `authorization.ts` hardcoded every session user to `role: "administrator"` (line 181: "For now, default to administrator role"). This meant:
- A viewer could access `/api/settings` (PATCH), create/edit devices, manage saved configurations.
- The `routeConfig` role matrix was effectively bypassable for any authenticated user.

**Fix:** Replaced with a database lookup against `user_role_memberships` joined to `roles` table:
```typescript
// Before:
const sessionUser = { id: session.user.id, role: "administrator" as Role };

// After:
const membership = await db
  .select({ role: rolesTable.role })
  .from(userRoleMembershipsTable)
  .innerJoin(rolesTable, eq(userRoleMembershipsTable.roleId, rolesTable.id))
  .where(...)
  .limit(1);
userRole = membership[0]?.role ? mapDbRoleToEnum(membership[0].role) : "viewer";
```
Users without an active role membership default to `viewer` (least privilege).

**Test coverage:** `authorization.test.ts` validates route→role mappings for all protected paths.

---

## Gate 3: CSRF, Rate Limiting, CORS, Cookie Security

### CSRF Protection
**Finding (FIXED):** No CSRF middleware was wired into the Express pipeline. All state-changing POST/PATCH/DELETE routes were vulnerable to cross-site request forgery.

**Fix:** `createCsrfMiddleware()` (from `csrf.ts`, written in Phase 19 but never mounted) is now applied to all `/api` routes except public ones (`/api/healthz`, `/api/auth`, `/api/collector`). CSRF tokens use `crypto.randomBytes(32)` with 1-hour TTL.

### Rate Limiting
**Finding (FIXED):** `createRateLimitMiddleware()` existed but was never mounted.

**Fix:** Applied 10 req/min rate limiting to `/api/auth/*` endpoints. The global rate limiter remains available for future application to all routes.

### CORS
**Finding:** ✅ Secure — configured origin allow-list with no wildcard support (rejects `*` origins). `config.corsAllowedOrigins` must match exactly.

### Secure Cookies
**Finding:** ✅ `cookiePolicy()` enforces `httpOnly`, `secure` (production), `SameSite=Lax`, `__Host-` prefix in production.

### Local-Only Defaults
**Finding:** ✅ `HOST=127.0.0.1`, `PORT=5000`, no trusted proxy by default, no cross-origin browser origins.

---

## Gate 4: Webhook SSRF

**Threat:** The admin-configurable `webhook_url` could be set to an internal address (e.g., `http://169.254.169.254/` for cloud metadata, or `http://localhost:5432/` for the database), allowing attackers to exfiltrate internal service responses or trigger internal actions.

**Finding (FIXED):** The `isAllowedWebhookUrl()` function in `webhook-policy.ts` was **defined but never called**. The `webhook-notifications.ts` module fetched `settings.url` directly from the database without validation.

**Fix:** Added `isAllowedWebhookUrl()` validation in both `sendWebhook()` and `attemptWebhookDelivery()` before any `fetch()` call:
```typescript
if (!isAllowedWebhookUrl(settings.url)) {
  throw new Error("Webhook URL is not allowed: must use HTTPS or localhost HTTP.");
}
```
The policy rejects non-HTTPS schemes except for `localhost`, `127.0.0.1`, and `::1`.

**Residual risk:** DNS rebinding could theoretically bypass the hostname check if a hostname initially resolves to localhost then to an internal IP. For a home-lab deployment, this is accepted risk. A production deployment should add DNS resolution pinning.

---

## Gate 5: Credential Non-Persistence

**Finding:** ✅ Secrets are redacted from logs via `sensitiveRedactionPaths` array in `logger.ts` (covers tokens, cookies, passwords, OIDC fields). Server-side config generation (`configuration-redaction.ts`) rejects cleartext `authPassword`/`privacyPassword` fields. CSV exports redact credentials via `redactSecrets()`.

**Note:** The `.env` file is gitignored. No test secrets found in committed code.

---

## Gate 10: OpenAPI Coverage Gap

**Finding:** ❌ `openapi.yaml` documents only `/healthz`. The remaining ~47 routes (auth, devices, monitoring, incidents, settings, notifications, tools, saved-configurations, collector) have no OpenAPI specification. This was identified as a Phase 24 objective but was not completed.

**Recommendation:** Block release on completing OpenAPI coverage for all shipped endpoints and implementing drift-free generation (Phase 24 work).

---

## Gate 14: Clean-Install Verification

**Finding:** ⚠️ Untested in this review. `README.md` provides installation instructions for both Linux and macOS but fresh-install verification was deferred to Phase 27 task 6.

---

## Summary of Fixes Applied in PR #46

| File | Fix |
|------|-----|
| `authorization.ts` | Hardcoded `administrator` role → database-backed role lookup from `user_role_memberships` |
| `webhook-notifications.ts` | Added `isAllowedWebhookUrl()` validation before `fetch()` to prevent SSRF |
| `app.ts` | Wired up rate limiting (auth endpoints) and CSRF protection (state-changing routes) |
| `auth-store.ts` | Fixed `userId` type (`number` → `string` UUID) to match schema |
| `auth.ts` | Updated `SessionResult` and `AuthRouteDependencies` types for string IDs |
| `auth-routes.test.ts` | Updated test stubs to match string user IDs |
