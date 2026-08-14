# LabOps

LabOps is a dark-first console for home and network labs. It combines device inventory, automated and manual reachability checks, network configuration generation, saved configurations, and practical IPv4 tools in one React application.

![LabOps dashboard](screenshots/labops-dashboard-final.jpg)

## Features

- Dashboard with automated device-health counts and recent status
- Device inventory with add, edit, delete, search, filtering, and manual ping
- Per-device background monitoring intervals, failure streaks, latency, and retained history
- Monitoring view with current health, 24-hour/7-day/30-day availability, and incident lifecycle
- Manual and scheduled maintenance that pause automated checks without creating false outages
- Scheduler visibility, maintenance audit history, dashboard counts, and monitoring filters
- Per-device check history and open/resolved incident records
- Incident acknowledgment with operator notes and a durable activity trail
- Incident workspace with response forms, activity timelines, and action-state filters
- Safe CSV exports for inventory, incidents, and retained monitoring history
- Per-device 24-hour, 7-day, and 30-day availability reports and CSV export
- Optional incident-open and recovery webhooks with delivery history and test delivery
- Configuration generation for Cisco IOS/IOS-XE, Cisco NX-OS, Juniper Junos, and Arista EOS
- SNMPv3, Syslog, NTP, and NetFlow/IPFIX configuration output
- Saved configuration archive with SNMPv3 password redaction
- IPv4 subnet calculator and manual ping tool
- Dark-first responsive interface
- Durable webhook retries with delivery state and manual retry controls

## Technology

- Node.js 24, TypeScript 5.9, and pnpm workspaces
- React and Vite frontend
- Express 5 API
- PostgreSQL with Drizzle ORM
- Zod validation and Orval-generated API clients

## Project structure

```text
artifacts/labops/       React/Vite frontend
artifacts/api-server/   Express API server
lib/db/                 Drizzle schemas and database access
lib/api-spec/           OpenAPI specification and code generation
lib/api-client-react/   Generated React API client
screenshots/            Application screenshots
```

## Local development

### Prerequisites

- Node.js 24
- pnpm
- PostgreSQL

### Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Set the PostgreSQL connection string:

   ```bash
   export DATABASE_URL='postgresql://USER:***@HOST:5432/DATABASE'
   ```

   Copy `.env.example` when you need the full set of deployment options. The API
   defaults to `127.0.0.1:5000`, accepts no cross-origin browser origins, ignores
   forwarded headers, and limits main API request bodies to `100kb`. LAN exposure
   must be explicit through `HOST`, an exact `CORS_ALLOWED_ORIGINS` list, and—only
   behind a known reverse proxy—a narrowly scoped `TRUST_PROXY` list.

3. Apply the development database schema:

   ```bash
   pnpm --filter @workspace/db run push
   ```

4. Start the API server:

   ```bash
   pnpm --filter @workspace/api-server run dev
   ```

5. In a second terminal, start the frontend:

   ```bash
   pnpm --filter @workspace/labops run dev
   ```

The API server listens on port `5000`. Vite prints the frontend URL when it starts
and proxies `/api` to `http://localhost:5000` by default.

Set `HOST=0.0.0.0` only when intentional LAN/container exposure is required. The
secure default is `127.0.0.1`. LabOps still has no main-API authentication or RBAC,
so do not expose it to an untrusted network. See
[`docs/security/threat-model.md`](docs/security/threat-model.md) and
[`docs/security/route-inventory.md`](docs/security/route-inventory.md).

Automated monitoring runs inside the API process, without an external queue. Enabled devices are checked at their configured interval (30 seconds to 24 hours). Three consecutive failed checks are required before a device is marked offline; earlier failures remain unknown. Sustained outages open incidents and successful recovery resolves them. Manual maintenance mode and validated per-device maintenance windows pause automated polling, resolve active incidents, and suppress new incidents until monitoring automatically resumes at the scheduled end. Availability uses observed online/offline checks and excludes unknown results. Monitoring history is retained for 30 days by default; operators can configure 30–365 days in Settings, and cleanup runs daily.

Settings previews the exact number of monitoring-history rows outside the configured retention window and allows a confirmed cleanup to run immediately. Cleanup refuses stale previews when retention changes, deletes only expired monitoring history, and preserves devices, incidents, acknowledgments, and settings.

Phase 14 introduces a provider boundary around reachability checks and read-only capability discovery. Native ICMP from the API host remains the only active provider, and its availability is detected honestly at runtime. This foundation does not add remote execution, collector networking, credentials, provider selection, or fallback success results.

Phase 15 adds an optional outbound-polling local collector for ICMP checks. Enroll collectors with the database CLI, configure the collector with its one-time token, and set `LABOPS_REACHABILITY_PROVIDER=collector` on the API to opt in. `LABOPS_COLLECTOR_ID` is required in collector mode and must identify the active enrolled collector that receives the jobs. Tokens are stored only as SHA-256 hashes. Jobs are leased and replay-safe, and missing or late collectors produce `Unknown`, never a fabricated success or outage. Use HTTPS except for loopback-only local development.

```bash
DATABASE_URL='postgresql://...' pnpm --filter @workspace/db collectors create lab-collector
LABOPS_URL='https://labops.example' LABOPS_COLLECTOR_ID='1' LABOPS_COLLECTOR_TOKEN='shown-once-token' pnpm --filter @workspace/labops-collector dev
LABOPS_REACHABILITY_PROVIDER=collector LABOPS_COLLECTOR_ID=1 pnpm --filter @workspace/api-server dev
```

Collector lifecycle remains CLI-only until LabOps has authentication and RBAC. Revoke a collector with `pnpm --filter @workspace/db collectors revoke <name>`. The API accepts only server-generated ICMP jobs for inventory devices, limits one active job per device and 1,000 pending jobs globally, expires jobs after one lease, and removes terminal job records after seven days. It does not support arbitrary commands, network discovery, SNMP, SSH, or inbound connections to the collector.

Phase 5 webhooks are optional and disabled by default. Configure them in Settings. Remote destinations must use HTTPS; localhost HTTP is allowed for local testing. LabOps sends JSON for incident opening and recovery, waits up to five seconds, and records the result without storing URL paths or query-string tokens in delivery history. Failed deliveries are retained in PostgreSQL and retried after one minute and five minutes, for a maximum of three automatic attempts. Due retries resume when the API restarts, and operators can retry an unsuccessful delivery immediately from Settings.

## Validation

Run the automated tests:

```bash
pnpm run test
```

Run the full typecheck:

```bash
pnpm run typecheck
```

Build all packages:

```bash
pnpm run build
```

Regenerate the API hooks and Zod schemas after changing the OpenAPI specification:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Security notes

- Keep `DATABASE_URL` and future credentials in environment variables or Replit Secrets; never commit them.
- The main API is currently intended for a trusted network and binds to loopback by default; authentication and RBAC are planned hardening work.
- Configure CORS with exact origins only. Wildcards and origins containing paths are rejected.
- Do not enable `TRUST_PROXY` broadly; list only known reverse-proxy addresses or subnets.
- SNMPv3 authentication and privacy passwords are accepted transiently for configuration generation.
- Saved SNMPv3 configurations replace entered passwords with `<AUTH_PASSWORD>` and `<PRIV_PASSWORD>` placeholders.
- Review generated configuration before applying it to production network equipment.

## Current scope

LabOps Phase 15 uses small in-process schedulers plus PostgreSQL monitoring history, configurable retention with previewed manual cleanup, an incident response workspace, per-device availability reports, bounded operational CSV exports, scheduled maintenance, maintenance audit events, durable webhook delivery state, and provider-neutral reachability. Native ICMP on the API host remains the default; an optional authenticated local collector can poll outbound for inventory-bound ICMP jobs. Collector enrollment and revocation are CLI-only because LabOps still has no authentication or RBAC. Availability is check-based rather than SLA-grade and excludes unknown checks. Retention cleanup is serialized with settings changes in PostgreSQL. Webhook retries remain bounded and single-process; there is no external queue, arbitrary remote execution, SNMP collection, email/SMS, network discovery, or device credentials. Hosted environments that block ICMP report failures honestly and never mock success.
