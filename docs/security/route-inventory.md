# API route inventory

All routes are mounted beneath `/api`. Phase 18 protects every main application route with a revocable browser session by default. Only the public mechanics listed below bypass that guard. Collector routes retain their independent bearer-token boundary.

## Public liveness

| Method | Path       | Purpose                   | Data/mutation risk                        |
| ------ | ---------- | ------------------------- | ----------------------------------------- |
| GET    | `/healthz` | Process liveness response | Low; does not verify PostgreSQL readiness |

## Public authentication mechanics

| Method | Path             | Purpose/control                                                        |
| ------ | ---------------- | ---------------------------------------------------------------------- |
| GET    | `/auth/login`    | Starts a one-time state/nonce/S256 PKCE flow                           |
| GET    | `/auth/callback` | Consumes the flow once, validates OIDC claims, rotates the session     |
| GET    | `/auth/me`       | Returns the local session identity or 401; never contacts the provider |
| POST   | `/auth/logout`   | Revokes local server state and clears the browser cookie               |

## Dashboard, monitoring, and incidents

All routes in this and the following main-application sections require an authenticated browser session. Phase 19 will add route-level roles.

| Method | Path                            | Risk                                             |
| ------ | ------------------------------- | ------------------------------------------------ |
| GET    | `/dashboard/summary`            | Reads aggregate operational state                |
| GET    | `/dashboard/recent-status`      | Reads device identity and status                 |
| POST   | `/dashboard/check-monitored`    | Initiates network checks and state changes       |
| GET    | `/monitoring`                   | Reads scheduler, devices, history, and incidents |
| GET    | `/maintenance-history`          | Reads maintenance audit data                     |
| GET    | `/incidents`                    | Reads incident records                           |
| GET    | `/incidents/:id/activity`       | Reads operator activity                          |
| PATCH  | `/incidents/:id/acknowledgment` | Mutates incident response/audit state            |

## Devices

| Method | Path                              | Risk                                                  |
| ------ | --------------------------------- | ----------------------------------------------------- |
| GET    | `/devices`                        | Reads inventory and management addresses              |
| POST   | `/devices`                        | Creates inventory records                             |
| GET    | `/devices/:id`                    | Reads a device record                                 |
| PATCH  | `/devices/:id`                    | Changes monitoring, maintenance, and identity data    |
| DELETE | `/devices/:id`                    | Destructive cascading deletion                        |
| POST   | `/devices/:id/ping`               | Initiates network access and mutates monitoring state |
| GET    | `/devices/:id/monitoring-history` | Reads retained health history                         |

## Reports and exports

| Method | Path                              | Risk                                       |
| ------ | --------------------------------- | ------------------------------------------ |
| GET    | `/reports/summary`                | Reads aggregate report counts              |
| GET    | `/reports/devices.csv`            | Exports inventory and management addresses |
| GET    | `/reports/incidents.csv`          | Exports incident/operator data             |
| GET    | `/reports/monitoring-history.csv` | Exports retained monitoring history        |
| GET    | `/reports/availability`           | Reads availability data                    |
| GET    | `/reports/availability.csv`       | Exports availability data                  |

## Saved configurations and settings

| Method | Path                                  | Risk                                                      |
| ------ | ------------------------------------- | --------------------------------------------------------- |
| GET    | `/saved-configurations`               | Reads archived generated configurations                   |
| POST   | `/saved-configurations`               | Persists generated configuration; secret-sensitive        |
| DELETE | `/saved-configurations/:id`           | Destructive deletion                                      |
| GET    | `/settings`                           | Reads application and webhook settings                    |
| PATCH  | `/settings`                           | Changes retention, ping, appearance, and webhook behavior |
| GET    | `/settings/retention-status`          | Reads cleanup eligibility                                 |
| POST   | `/settings/retention-cleanup`         | Destructively deletes expired monitoring rows             |
| GET    | `/notifications/deliveries`           | Reads webhook delivery metadata                           |
| POST   | `/notifications/test`                 | Causes outbound network access                            |
| POST   | `/notifications/deliveries/:id/retry` | Repeats outbound network access                           |

## Network tools

| Method | Path                               | Risk                                           |
| ------ | ---------------------------------- | ---------------------------------------------- |
| POST   | `/tools/ping`                      | Initiates ICMP from the API host               |
| GET    | `/tools/reachability-capabilities` | Discloses provider/runtime capability metadata |

## Collector API

Mounted beneath `/api/collector/v1`; bearer-token authenticated and restricted to a 16 KiB JSON body.

| Method | Path                  | Risk/control                                             |
| ------ | --------------------- | -------------------------------------------------------- |
| POST   | `/heartbeat`          | Authenticated collector liveness update                  |
| POST   | `/jobs/claim`         | Authenticated, collector-scoped lease claim              |
| POST   | `/jobs/:jobId/result` | Authenticated leased result submission and replay checks |

## Required follow-up permission model

The authorization phase must assign every route explicitly to one of these minimum roles:

- **Public:** liveness and OIDC callback/login mechanics only
- **Viewer:** read dashboards, inventory, monitoring, incidents, and reports
- **Operator:** Viewer plus checks, maintenance, and incident acknowledgment
- **Administrator:** Operator plus inventory/configuration mutations, settings, retention, notifications, roles, and collector lifecycle

Deny by default. Any new route must update this inventory and add anonymous/Viewer/Operator/Administrator integration tests.
