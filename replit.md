# LabOps

LabOps is a dark-first home and network lab console for device inventory, manual reachability checks, network configuration generation, saved configurations, and practical IPv4 tools.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/labops run dev` — run the LabOps frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

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

- LabOps uses a straightforward internal Express router mounted at `/api`; it intentionally does not expand the existing OpenAPI contract for this focused product.
- Phase 1 performs reachability checks only when explicitly requested. There is no scheduler, polling engine, queue, or collector.
- Subnet calculation and configuration generation remain client-side; saved configurations and device records use PostgreSQL through Drizzle.
- SNMPv3 credentials are accepted transiently for generation but are redacted server-side before a saved configuration is persisted.
- Authentication is not part of the initial release. If it becomes necessary, use Replit Auth rather than custom authentication.

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
- Restart both `artifacts/api-server: API Server` and `artifacts/labops: web` after server or artifact configuration changes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
