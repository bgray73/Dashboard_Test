# LabOps

LabOps is a dark-first home and network lab console for device inventory, manual reachability checks, network configuration generation, saved configurations, and practical IPv4 tools.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/labops run dev` — run the LabOps frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, and `PUBLIC_BASE_URL`
- Register `${PUBLIC_BASE_URL}/api/auth/callback` exactly. Replit Auth rollout additionally requires confirmed confidential-client credentials and token auth method; never infer or downgrade this contract.
- Optional first-user bootstrap requires exact paired `AUTH_BOOTSTRAP_ISSUER` and `AUTH_BOOTSTRAP_SUBJECT`; remove them after the first successful login.
- Secure defaults: `HOST=127.0.0.1`, `PORT=5000`, no cross-origin browser origins, no trusted proxy
- Optional deployment env: `CORS_ALLOWED_ORIGINS`, `TRUST_PROXY`, `JSON_BODY_LIMIT`, `URLENCODED_BODY_LIMIT`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/labops/` — deployable React/Vite frontend artifact and visual theme
- `artifacts/labops/src/App.tsx` — LabOps routes and Phase 1 page components
- `artifacts/labops/src/lib/api.ts` — direct frontend API client and response types
- `artifacts/api-server/src/routes/labops.ts` — internal Express API routes, validation, ping isolation, and SNMP redaction
- `lib/db/src/schema/` — Drizzle schemas for devices, saved configurations, and application settings
- `artifacts/labops/.replit-artifact/artifact.toml` — LabOps artifact registration and preview service

## Architecture decisions

- LabOps uses a straightforward internal Express router mounted at `/api`; later hardening phases will make OpenAPI authoritative.
- Phase 1 performs reachability checks only when explicitly requested. There is no scheduler, polling engine, queue, or collector.
- Subnet calculation and configuration generation remain client-side; saved configurations and device records use PostgreSQL through Drizzle.
- SNMPv3 credentials are accepted transiently for generation but are redacted server-side before a saved configuration is persisted.
- Phase 18 requires provider-neutral OIDC and revocable PostgreSQL-backed browser sessions for the main API. RBAC remains a later phase, so keep the API on loopback or a tightly controlled trusted LAN.
- Phase 17 centralizes runtime configuration, defaults API binding to loopback, restricts CORS to exact configured origins, rejects broad proxy trust, adds Helmet, and bounds request bodies.

## Product

- Dashboard with device counts and recent status
- Device inventory with add, edit, delete, search, filtering, and manual ping
- Configuration generator for Cisco IOS / IOS-XE, Cisco NX-OS, Juniper Junos, and Arista EOS
- Supported output types: SNMPv3, Syslog, NTP, and NetFlow / IPFIX
- Saved configuration archive with SNMPv3 password placeholders
- IPv4 subnet calculator and manual ping tool
- Minimal application, theme, vendor, and ping timeout settings

## User preferences

- Keep the product simple and modular; do not expand Phase 1 into an enterprise monitoring platform.
- Keep the default experience dark-first and operationally dense but readable.

## Gotchas

- The API server's ping execution is intentionally isolated in one function so a future local collector can replace it. Some hosted containers may not have permission to execute ICMP, in which case the result is explicitly offline rather than silently mocked.
- The frontend development proxy and API both default to port `5000`; override the proxy only with `API_PROXY_TARGET`.
- `HOST=0.0.0.0` is an explicit exposure decision. Configure TLS, exact allowed browser origins, and only known proxy addresses before using it.
- Apply `pnpm --filter @workspace/db run push` before startup; the API fails readiness when authentication tables are absent. Logout revokes local server state even if the identity provider is unavailable.
- Collector bearer tokens remain a separate authentication domain; browser cookies cannot authenticate collector routes.
- Restart both `artifacts/api-server: API Server` and `artifacts/labops: web` after server or artifact configuration changes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
