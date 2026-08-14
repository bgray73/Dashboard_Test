# LabOps threat model

## Scope

This document describes the Phase 17 security boundary for the LabOps API, frontend, PostgreSQL database, local collector, ICMP execution, and outbound incident webhooks. It records current controls and residual risks; it is not a claim that LabOps is safe for public exposure.

## Deployment assumption

LabOps is a trusted-LAN application. The API binds to `127.0.0.1` by default. LAN or internet exposure is an explicit operator decision requiring `HOST`, an exact `CORS_ALLOWED_ORIGINS` allowlist, TLS at a reverse proxy, and a narrowly scoped `TRUST_PROXY` value.

Phase 18 requires OIDC authentication and a revocable PostgreSQL-backed session for every main application route. Role-based authorization is not yet implemented: every authenticated user currently shares application permissions. Do not expose the API to an untrusted network until route-level authorization and later safeguards land.

## Assets

- Device identity, management IPs, location, model, serial number, notes, and health history
- Incidents, acknowledgments, maintenance history, reports, and availability data
- Application settings and webhook destinations
- Saved generated configurations and transient SNMPv3 credentials
- Collector enrollment tokens, token hashes, leases, and results
- PostgreSQL credentials and retained operational records
- API host network access, including ICMP and outbound HTTPS

## Trust boundaries and data flows

1. **Browser → frontend/API:** Untrusted request headers, query parameters, forms, and JSON enter Express. Phase 17 constrains CORS, body sizes, proxy trust, and response headers. Phase 18 adds a deny-by-default session guard; CORS is not authentication.
2. **API → OIDC provider:** Authorization Code Flow uses S256 PKCE, state, nonce, exact issuer validation, a registered callback, bounded discovery, and generic failures. Provider tokens are not persisted. Existing local sessions continue during a provider outage.
3. **API → PostgreSQL:** The API stores stable issuer/subject identities, only SHA-256 session-token digests, and short-lived one-time login flows. Database credentials remain environment-only. Later phases add versioned migrations, concurrency invariants, and backup drills.
4. **API → local ICMP:** Validated IPv4/hostname targets reach `execFile`, never a shell. The capability may be unavailable on hosted systems and must report `unknown` honestly.
5. **Collector → collector API:** Collector routes use scoped bearer tokens and a separate 16 KiB JSON limit. Collector authentication does not protect the main API.
6. **API → webhook destination:** Outbound HTTPS is currently destination-validated only at a basic URL-policy level. Redirect/DNS/private-address SSRF hardening is a later dedicated phase.
7. **Reverse proxy → API:** Forwarded headers are ignored by default. An operator may configure exact trusted proxy addresses/subnets; `TRUST_PROXY=true` is rejected.

## Threat actors

- Anonymous or malicious host on a reachable LAN
- Malicious website attempting cross-origin browser requests
- Compromised or replaying collector
- Malicious device hostname, notes, configuration, report field, or API payload
- Malicious webhook endpoint or DNS operator
- Misconfigured reverse proxy supplying spoofable forwarded headers
- Concurrent API process or overlapping scheduled/manual check
- Dependency or CI supply-chain compromise
- Operator error during retention, migration, or restore

## Phase 17 controls

- Loopback-only API binding by default
- Exact HTTP(S) CORS origin allowlist; wildcard and path-bearing values rejected
- Forwarded headers ignored unless exact proxy addresses/subnets are configured
- Helmet response headers and Express signature removal
- Explicit configurable 100 KiB main JSON/form limits
- Preserved 16 KiB collector JSON limit
- Centralized Zod validation for runtime configuration
- PostgreSQL-only `DATABASE_URL` validation
- Query strings and authorization/cookie headers redacted from request logs
- Frozen lockfile and minimum package release-age policy

## Known residual risks and planned treatment

| Risk                                                     | Current status                                                 | Planned phase               |
| -------------------------------------------------------- | -------------------------------------------------------------- | --------------------------- |
| Main API lacks route-level RBAC                          | Authentication complete; authenticated users share permissions | Authorization phase         |
| Webhook DNS/redirect SSRF                                | Basic URL policy only                                          | Webhook egress security     |
| SNMP secret non-persistence is not fully server-enforced | Known gap                                                      | Secret handling             |
| Concurrent checks can race or duplicate incidents        | Known gap                                                      | Monitoring concurrency      |
| In-process schedulers can duplicate across replicas      | Known gap                                                      | Scheduler ownership         |
| Production schema changes use `drizzle-kit push`         | Development-only mechanism                                     | Migrations/backups          |
| API contract and E2E coverage are incomplete             | Known gap                                                      | API/frontend quality phases |
| `/healthz` is liveness only                              | Does not prove database readiness                              | CI/operations phase         |

## Security invariants

- Secrets are supplied through environment/configured secret storage, never committed.
- Hosted ICMP inability produces `unknown`, not fabricated success or outage.
- Collector tokens are shown once and stored only as hashes.
- Untrusted proxy headers never influence client IP or protocol by default.
- No wildcard CORS origin is accepted.
- Oversized bodies fail with HTTP `413` before route logic.
- Security-sensitive changes require tests, independent review, and passing CI.

## Review triggers

Update this document when adding an endpoint, credential, role, collector capability, outbound integration, deployment topology, database, scheduler, or new sensitive data field.
