# LabOps Hardening Release Checklist

**Release:** Phase 27 — Final Release Hardening
**Base commit:** `b8c2969` (Phase 26 merge) + `1ac849f` (Phase 27 security fixes)
**Status:** ⚠️ PENDING — not all gates are green

---

## Pre-Release Gates

- [ ] **Anonymous access blocked** — All non-public API routes return 401 without a valid session. Verified: `createMainAuthGuard()` + `routeConfig` in `authorization.ts`.
- [ ] **Role-based access enforced** — Every route has an explicit role policy. Verified: `routeConfig` + `authorization.test.ts`. No hardcoded roles (fixed in PR #46).
- [ ] **CSRF protection** — State-changing requests require valid CSRF token. Applied to all non-public routes (PR #46). Auth/collector routes bypassed (public or token-based).
- [ ] **Rate limiting** — Auth endpoints rate-limited at 10 req/min. Global limiter available but applied only to auth endpoints currently.
- [ ] **SSRF protection** — Webhook URLs validated against allow-list before fetch. Applied in PR #46.
- [ ] **Secrets redacted** — No credentials in logs, exports, or webhook payloads. Verified: `logger.ts` redaction paths, `configuration-redaction.ts`.
- [ ] **Secure defaults** — `HOST=127.0.0.1`, `PORT=5000`, `TRUST_PROXY` off, no CORS wildcards, `__Host-` cookie prefix in production.
- [ ] **OpenAPI coverage** — Every shipped endpoint documented. ❌ BLOCKED: only `/healthz` is documented. Phase 24 work required.
- [ ] **Migrations tested** — Clean-install migration + previous-version upgrade. Phase 23 work.
- [ ] **CI green** — All checks pass on the release PR.
- [ ] **Security scans green** — Trivy, gitleaks, CodeQL, dependency review all passing.
- [ ] **Branch protection** — `main` requires PR + review + CI before merge.
- [ ] **Fresh install** — Clean Linux and macOS setup/build/run instructions pass from scratch.
- [ ] **Independent review** — This document completed by a reviewer with no implementation context.

---

## Verification Commands

```bash
# Type safety
pnpm run typecheck

# Unit + integration tests (158 tests)
pnpm run test

# Production build
pnpm run build

# Database migration status
pnpm --filter @workspace/db run migrate:status

# Security scans (CI handles these, but can run locally)
trivy fs --exit-code 1 --severity HIGH,CRITICAL .
gitleaks detect --config .gitleaks.toml
```

---

## Release Process

1. **Freeze** — No feature changes after this point. Only bug fixes with security impact.
2. **Verify** — Run all verification commands above from a clean checkout.
3. **Scan** — Confirm Trivy, gitleaks, and CodeQL pass on the release commit.
4. **Tag** — Create a signed git tag: `git tag -s v0.27.0 -m "Phase 27 hardening release"`
5. **Deploy** — Deploy to staging first, verify `/api/readyz` and `/api/healthz`.
6. **Monitor** — Watch for alert triggers in the first 24 hours post-deploy.

---

## Rollback Plan

If a critical issue is found post-release:
1. Revert the git tag.
2. Revert to the previous stable commit on `main`.
3. Investigate via logs: `kubectl logs -l app=labops-api --tail=1000` (or equivalent).
4. Restore from the most recent backup if data corruption is suspected (`scripts/src/backup.ts`).
