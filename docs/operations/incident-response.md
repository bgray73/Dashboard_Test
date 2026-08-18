# LabOps Incident Response Guide

## Severity Levels

| Level | Example | Response Time |
|-------|---------|---------------|
| **P0 — Critical** | Production outage, data breach, auth bypass | 15 min |
| **P1 — High** | Webhook pipeline down, monitoring stalled | 60 min |
| **P2 — Medium** | Non-critical feature broken, false alerts | 4 hr |
| **P3 — Low** | Documentation issue, cosmetic bug | Next business day |

---

## Common Incident Playbooks

### P0: Authentication Bypass

**Symptoms:** Unauthorized access detected in logs, unknown users viewing protected data, session tokens being accepted without proper validation.

**Steps:**
1. **Immediate** — Revoke all active sessions:
   ```sql
   UPDATE auth_sessions SET revoked_at = now() WHERE revoked_at IS NULL;
   ```
2. **Investigate** — Check `security_audit` log events for `authorization_denied` and `authentication_failure` patterns:
   ```bash
   grep "authorization_denied\|authentication_failure" /var/log/labops.log | tail -100
   ```
3. **Identify** — Check for recently provisioned users:
   ```sql
   SELECT * FROM users ORDER BY created_at DESC LIMIT 10;
   SELECT * FROM user_role_memberships ORDER BY granted_at DESC LIMIT 10;
   ```
4. **Verify** — After mitigation, test that unauthenticated requests to `/api/devices` return 401.
5. **Document** — File a security incident report with details, timeline, and remediation.

**Runbook:** `scripts/src/backup.ts` for backup verification; ensure OIDC client secret is rotated if compromise is suspected.

---

### P1: Webhook Delivery Failure (SSRF / Pipeline Stalled)

**Symptoms:** Webhook deliveries stuck in "retrying" state, `webhook_queue_depth` metric rising, delivery failures in logs.

**Steps:**
1. **Check webhook settings** — Verify `webhook_enabled` is true and `webhook_url` is in `application_settings`.
2. **Validate URL** — Ensure the configured webhook URL passes `isAllowedWebhookUrl()` (HTTPS or localhost HTTP only).
3. **Check queue depth** — Monitor `/api/metrics` for `labops_webhook_queue_depth`.
4. **Review failures** — Check `notification_deliveries` table for error messages:
   ```sql
   SELECT event_type, status, error_message, attempt_count 
   FROM notification_deliveries 
   WHERE status = 'failed' 
   ORDER BY attempted_at DESC 
   LIMIT 50;
   ```
5. **Retry** — Use the retry API: `POST /api/notifications/deliveries/retry`.
6. **Escalate** — If webhook URL points to an internal service (SSRF attempt), flag for security review.

**Runbook:** `artifacts/api-server/src/lib/webhook-notifications.ts` — delivery retry backoff: 1m, 5m, 15m, 30m, 60m (max 5 attempts).

---

### P1: Monitoring Stalled (Scheduler Leader Lost)

**Symptoms:** Monitoring checks not running, incidents not opening, `labops_scheduler_leader` metric shows 0 with no takeover.

**Steps:**
1. **Check leader status** — Verify `labops_scheduler_leader` metric in `/api/metrics`.
2. **Check process health** — Verify API process is running and responsive (`/api/healthz`).
3. **Check database connectivity** — Run readiness check: `curl /api/readyz`.
4. **Review logs** — Look for scheduler errors or lock contention:
   ```bash
   grep "scheduler\|leadership\|advisory_lock" /var/log/labops.log
   ```
5. **Restart** — If leader is lost with no takeover after 30 seconds, restart the API process to trigger lease recovery.
6. **Verify** — Confirm `labops_scheduler_leader` returns to 1 and monitoring checks resume.

**Runbook:** `artifacts/api-server/src/lib/job-leadership.ts` — uses `pg_advisory_xact_lock` for single-leader election.

---

### P2: Migration Failure (Database Incompatible)

**Symptoms:** Server fails to start, `/api/readyz` reports migration failure, error logs show schema mismatch.

**Steps:**
1. **Check readiness** — `curl /api/readyz` should return 503 with migration failure details.
2. **Inspect migrations** — Check applied migrations:
   ```sql
   SELECT id, hash, created_at FROM drizzle_migrations ORDER BY created_at;
   ```
3. **Compare** — Verify the expected migration hash matches what's deployed.
4. **Do NOT** use `pnpm db:push` in production — this bypasses migration history.
5. **Roll forward or back** — Apply the missing migration or roll back to a compatible version.
6. **Restart** — Once migrations are consistent, restart the API.

**Runbook:** `lib/db/src/migrate.ts` — migrations are located in `lib/db/drizzle/`. Never use `push-force` in production.

---

### P0: Security Scan Finding (Vulnerability Detected)

**Symptoms:** Trivy, gitleaks, or CodeQL reports a critical/high severity finding in CI or production scan.

**Steps:**
1. **Triage** — Determine if the finding is exploitable in the current deployment mode:
   - Development vs. production mode
   - Exposed vs. internal-only endpoint
   - Local vs. remote reachability
2. **Assess** — Check `docs/security/final-review.md` for known findings and accepted exceptions.
3. **Patch** — Apply the minimal fix. Never commit secrets to the repository.
4. **Verify** — Re-run the specific scan: `trivy fs --severity CRITICAL,HIGH .`
5. **Rotate** — If a credential was exposed, rotate it immediately in the secret manager.
6. **Document** — Add the finding and remediation to the incident report.

**Runbook:** `.github/workflows/security.yml` — Trivy, gitleaks, and CodeQL run on every push to `main` and on PRs.

---

## Communication

- **Internal:** Update the incident status in the team channel every 30 minutes during active incidents.
- **External:** For P0/P1 incidents affecting customers, notify via the status page within 15 minutes.
- **Post-mortem:** All P0/P1 incidents require a post-mortem documenting root cause, timeline, and preventive measures.

## Tooling References

- **Logs:** `pino` JSON format, redacted via `sensitiveRedactionPaths` in `logger.ts`
- **Metrics:** Prometheus text format at `/api/metrics`
- **Health:** `/api/healthz` (liveness), `/api/readyz` (readiness: DB + migrations)
- **Backup/Restore:** `scripts/src/backup.ts` and `scripts/src/restore-test.ts`
- **Deploy:** See `docs/operations/release-checklist.md`
