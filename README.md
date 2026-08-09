# LabOps

LabOps is a dark-first console for home and network labs. It combines device inventory, manual reachability checks, network configuration generation, saved configurations, and practical IPv4 tools in one React application.

![LabOps dashboard](screenshots/labops-dashboard-final.jpg)

## Features

- Dashboard with device counts and recent status
- Device inventory with add, edit, delete, search, filtering, and manual ping
- Configuration generation for Cisco IOS/IOS-XE, Cisco NX-OS, Juniper Junos, and Arista EOS
- SNMPv3, Syslog, NTP, and NetFlow/IPFIX configuration output
- Saved configuration archive with SNMPv3 password redaction
- IPv4 subnet calculator and manual ping tool
- Dark-first responsive interface

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
   export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE'
   ```

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

The API server listens on port `5000`. Vite prints the frontend URL when it starts.

## Validation

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
- SNMPv3 authentication and privacy passwords are accepted transiently for configuration generation.
- Saved SNMPv3 configurations replace entered passwords with `<AUTH_PASSWORD>` and `<PRIV_PASSWORD>` placeholders.
- Review generated configuration before applying it to production network equipment.

## Current scope

LabOps Phase 1 uses manual reachability checks. It does not include a scheduler, polling engine, queue, collector, or application authentication. Hosted containers may not permit ICMP; in that case, manual ping results are reported as offline instead of being mocked.
