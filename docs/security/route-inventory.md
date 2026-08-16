# API route inventory

All routes are mounted beneath `/api`. Phase 18 protects every main application route with a revocable browser session by default. Only the public mechanics listed below bypass that guard. Collector routes retain their independent bearer-token boundary.

Phase 19-20 added route-level roles: every route requires an authenticated session, and the authorization middleware enforces a minimum role (Viewer, Operator, or Administrator) based on database-loaded user roles.

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

All routes in this and the following main-application sections require an authenticated browser session. Phase 19-20 authorization middleware enforces role-based access control per route.

| Method | Path                            | Role         | Risk                                             |
| ------ | ------------------------------- | ------------ | ------------------------------------------------ |
| GET    | `/dashboard/summary`            | Viewer       | Reads aggregate operational state                |
| GET    | `/dashboard/recent-status`      | Viewer       | Reads device identity and status                 |
| POST   | `/dashboard/check-monitored`    | Operator     | Initiates network checks and state changes       |
| GET    | `/monitoring`                   | Reads scheduler, devices, history, and incidents |
| GET    | `/maintenance-history`          | Reads maintenance audit data                     |
| GET    | `/incidents`                    | Reads incident records                           |
| GET    | `/incidents/:id/activity`       | Reads operator activity                          |
| PATCH  | `/incidents/:id/acknowledgment` | Mutates incident response/audit state            |

## Devices

| Method | Path                               | Role         | Risk                                                  |
| ------ | ---------------------------------- | ------------ | ----------------------------------------------------- |
| GET    | `/devices`                        | Viewer       | Reads inventory and management addresses              |
| POST   | `/devices`                        | Administrator | Creates inventory records                             |
| GET    | `/devices/:id`                    | Viewer       | Reads a device record                                 |
| PATCH  | `/devices/:id`                    | Administrator | Changes monitoring, maintenance, and identity data    |
| DELETE | `/devices/:id`                    | Administrator | Destructive cascading deletion                        |
| POST   | `/devices/:id/ping`               | Operator     | Initiates network access and mutates monitoring state |
| GET    | `/devices/:id/monitoring-history` | Viewer       | Reads retained health history                         |

## Reports and exports

| Method | Path                              | Role         | Risk                                       |
| ------ | --------------------------------- | ------------ | ------------------------------------------ |
| GET    | `/reports/summary`                | Viewer       | Reads aggregate report counts              |
| GET    | `/reports/devices.csv`            | Viewer       | Exports inventory and management addresses |
| GET    | `/reports/incidents.csv`          | Viewer       | Exports incident/operator data             |
| GET    | `/reports/monitoring-history.csv` | Viewer       | Exports retained monitoring history        |
| GET    | `/reports/availability`           | Viewer       | Reads availability data                    |
| GET    | `/reports/availability.csv`       | Viewer       | Exports availability data                  |

## Saved configurations and settings

| Method | Path                                  | Role         | Risk                                                      |
| ------ | ------------------------------------- | ------------ | --------------------------------------------------------- |
| GET    | `/saved-configurations`               | Viewer       | Reads archived generated configurations                   |
| POST   | `/saved-configurations`               | Administrator | Persists generated configuration; secret-sensitive        |
| DELETE | `/saved-configurations/:id`           | Administrator | Destructive deletion                                      |
| GET    | `/settings`                           | Viewer       | Reads application and webhook settings                    |
| PATCH  | `/settings`                           | Administrator | Changes retention, ping, appearance, and webhook behavior |
| GET    | `/settings/retention-status`          | Viewer       | Reads cleanup eligibility                                 |
| POST   | `/settings/retention-cleanup`         | Operator     | Destructively deletes expired monitoring rows             |
| GET    | `/notifications/deliveries`           | Viewer       | Reads webhook delivery metadata                           |
| POST   | `/notifications/test`                 | Operator     | Causes outbound network access                            |
| POST   | `/notifications/deliveries/:id/retry` | Operator     | Repeats outbound network access                           |

## Network tools

| Method | Path                               | Role         | Risk                                           |
| ------ | ---------------------------------- | ------------ | ---------------------------------------------- |
| POST   | `/tools/ping`                      | Operator     | Initiates ICMP from the API host               |
| GET    | `/tools/reachability-capabilities` | Viewer       | Discloses provider/runtime capability metadata |

## Collector API

Mounted beneath `/api/collector/v1`; bearer-token authenticated and restricted to a 16 KiB JSON body.

| Method | Path                  | Risk/control                                             |
| ------ | --------------------- | -------------------------------------------------------- |
| POST   | `/heartbeat`          | Authenticated collector liveness update                  |
| POST   | `/jobs/claim`         | Authenticated, collector-scoped lease claim              |
| POST   | `/jobs/:jobId/result` | Authenticated leased result submission and replay checks |

## Role management
| Method | Path                    | Role         | Risk                                             |
| ------ | ----------------------- | ------------ | ------------------------------------------------ |
| GET    | `/roles`                | Viewer       | Reads role definitions and assignments           |
| GET    | `/roles/users/:userId`  | Viewer       | Reads a user's role assignments                  |
| POST   | `/roles/assign`         | Administrator | Grants a role to a user                          |
| DELETE | `/roles/revoke`         | Administrator | Removes role membership from a user              |
| GET    | `/roles/summary`        | Administrator | Reads role assignment statistics                 |

## Collector lifecycle
| Method | Path              | Role         | Risk                                             |
| ------ | ----------------- | ------------ | ------------------------------------------------ |
| GET    | `/collectors`     | Administrator | Lists all collectors with status and statistics |
| GET    | `/collectors/:id` | Administrator | Reads a collector's detail                       |
| POST   | `/collectors`     | Administrator | Creates a new collector                          |
| PATCH  | `/collectors/:id` | Administrator | Updates collector settings                       |
| DELETE | `/collectors/:id` | Administrator | Revokes a collector and rotates its token       |

## Required follow-up permission model

The authorization phase must assign every route explicitly to one of these minimum roles:

- **Public:** liveness and OIDC callback/login mechanics only
- **Viewer:** read dashboards, inventory, monitoring, incidents, and reports
- **Operator:** Viewer plus checks, maintenance, and incident acknowledgment
- **Administrator:** Operator plus inventory/configuration mutations, settings, retention, notifications, roles, and collector lifecycle

Deny by default. Any new route must update this inventory and add anonymous/Viewer/Operator/Administrator integration tests.
