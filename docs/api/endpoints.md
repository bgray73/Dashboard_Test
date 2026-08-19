# API Endpoint Inventory

> Complete inventory of all API endpoints for OpenAPI specification development.

## Health Endpoints

| Method | Path | Auth | Tags | Description |
|---|---|---|---|---|
| GET | /healthz | No | health | Health check - returns `{status: "ok"}` |

## Readiness Endpoints

| Method | Path | Auth | Tags | Description |
|---|---|---|---|---|
| GET | /readyz | No | health | Readiness probe - verifies DB connectivity, migrations, configuration |

## Authentication Endpoints

| Method | Path | Auth | Tags | Description |
|---|---|---|---|---|
| GET | /auth/login | No | auth | Initiate OIDC login flow - redirects to provider |
| GET | /auth/callback | No | auth | OIDC callback - exchanges code for tokens, establishes session |
| GET | /auth/me | Yes | auth | Get current authenticated user info |
| POST | /auth/logout | Yes | auth | Revoke session, clear cookie, 204 response |

## Dashboard Endpoints

| Method | Path | Auth | Tags | Description |
|---|---|---|---|---|
| GET | /dashboard/summary | Yes | dashboard | Summary stats - devices, incidents, availability |
| GET | /dashboard/recent-status | Yes | dashboard | Recent device status (last 12) |
| POST | /dashboard/check-monitored | Yes | dashboard | Manually trigger monitoring check for all devices |

## Device Management Endpoints

| Method | Path | Auth | Tags | Description |
|---|---|---|---|---|
| GET | /devices | Yes | devices | List all devices, search, filter by status |
| GET | /devices/:id | Yes | devices | Get device details |
| POST | /devices | Yes | devices | Create new device |
| PATCH | /devices/:id | Yes | devices | Update device |
| DELETE | /devices/:id | Yes | devices | Delete device |
| GET | /devices/:id/monitoring-history | Yes | devices | Get monitoring history for device |

## Monitoring Endpoints

| Method | Path | Auth | Tags | Description |
|---|---|---|---|---|
| GET | /monitoring | Yes | monitoring | Full monitoring dashboard - devices, history, incidents |
| POST | /monitoring | Yes | monitoring | (reserved for programmatic check submission) |

## Incident Endpoints

| Method | Path | Auth | Tags | Description |
|---|---|---|---|---|
| GET | /incidents | Yes | incidents | List incidents, filter by status |
| GET | /incidents/:id | Yes | incidents | Get incident details |
| PATCH | /incidents/:id/acknowledgment | Yes | incidents | Acknowledge incident |

## Reports Endpoints

| Method | Path | Auth | Tags | Description |
|---|---|---|---|---|
| GET | /reports/summary | Yes | reports | Summary stats as JSON |
| GET | /reports/devices.csv | Yes | reports | Export devices as CSV |
| GET | /reports/incidents.csv | Yes | reports | Export incidents as CSV |
| GET | /reports/monitoring-history.csv | Yes | reports | Export monitoring history as CSV |
| GET | /reports/availability | Yes | reports | Availability report by device |
| GET | /reports/availability.csv | Yes | reports | Export availability as CSV |

## Maintenance Endpoints

| Method | Path | Auth | Tags | Description |
|---|---|---|---|---|
| GET | /maintenance-history | Yes | maintenance | List maintenance events, filter by device |

## Settings Endpoints

| Method | Path | Auth | Tags | Description |
|---|---|---|---|---|
| GET | /settings | Yes | settings | Get application settings |
| PATCH | /settings | Yes | settings | Update application settings |
| GET | /settings/snmp-secrets | Yes | settings | Get SNMP secret counts (non-sensitive) |
| POST | /settings/snmp-secrets | Yes | settings | Store SNMP secrets (server-managed only) |

## Webhook Endpoints

| Method | Path | Auth | Tags | Description |
|---|---|---|---|---|
| POST | /webhook/test | Yes | webhooks | Test webhook delivery |

---

## Notes

1. All endpoints under `/api/*/*` (other than `/auth` and `/healthz`/`/readyz`) require authentication via the auth-guard middleware.
2. Role-based access control is applied at the route level - specific endpoints require Authorization (Admin) role.
3. The labops router (`/api/*`) is the primary application router.

## Files to Update

- `lib/api-spec/openapi.yaml` — Add all endpoints and schemas
- `lib/api-zod/` — Add request/response types
- `lib/api-client-react/` — Will be regenerated from OpenAPI
- `.github/workflows/ci.yml` — Add drift detection step

## Next Steps

1. Add OpenAPI paths/operations for each endpoint
2. Define request/response schemas
3. Add security schemes (Bearer token, Role requirements)
4. Run `orval generate` to create TypeScript types and client
5. Add CI check: `orval generate && git diff --exit`