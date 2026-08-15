# Phase 19: Authorization RBAC Middleware Implementation

## Overview

Phase 19 adds role-based access control (RBAC) with the following components:
1. **Authorization roles middleware** - Role-based access control for routes
2. **CSRF-token middleware** - Protection against cross-site request forgery
3. **Security audit events** - Structured logging for security events
4. **Rate limiting** - API rate limiting to prevent abuse

## Implementation Status

### ✅ Completed
- [x] Roles database schema (`lib/db/src/schema/roles.ts`)
- [x] SQL migration (`lib/db/migrations/...`)
- [x] Auth store extensions with role management
- [x] Authorization route-to-role mapping
- [x] Authorization middleware
- [x] CSRF protection middleware
- [x] Security audit logging
- [x] Enhanced security headers (CSP, etc.)

### ⚠️ In Progress
- [ ] Update auth guard to include roles in request
- [ ] Wire up role loading from database

## Required Changes

### 1. Database Migration

Run the migration to create roles tables:
```sql
-- Run: lib/db/migrations/20240115000000_add_roles_and_user_role_memberships.sql
```

Then run Drizzle push:
```bash
pnpm --filter @workspace/db run push
```

### 2. Extend Auth Guard

The `createMainAuthGuard` in `routes/auth.ts` needs to be updated to:
1. Load the user's roles from the database
2. Add roles to `res.locals.auth` or set on `req.auth`

### 3. Initialize Default Admin Role

On first user login (bootstrap), automatically grant the administrator role:
- This happens in `AuthStore.bootstrapAdminRole()` method
- Requires updating the auth callback flow

### 4. Route Authorization

The `routeRoles` map in `authorization.ts` defines role requirements:
- **viewer**: Dashboard, reports, devices (read), monitoring, incidents (read), maintenance history
- **operator**: Check-run, devices (write), incidents (acknowledge), settings cleanup, notifications test
- **administrator**: Devices (delete), saved configurations, notifications, settings (write)

## Role Hierarchy

```
viewer (level 1)
  └── operator (level 2)
        └── administrator (level 3)
```

## Security Events Logged

- `auth_success` - Successful authentication
- `auth_failure` - Failed authentication attempt
- `auth_session_created` - New session created
- `auth_session_revoked` - Session revoked
- `role_changed` - Role granted/revoked
- `csrf_validation_failure` - CSRF token validation failed
- `authorization_failure` - Access denied due to role

## Rate Limiting

- Global: 100 requests/minute per IP
- Per-endpoint: Configurable (default 100/minute)

## Testing

1. Verify schema migration works
2. Test role-based access to protected routes
3. Test CSRF token validation
4. Test rate limiting

## Rollback

If needed, remove the roles tables:
```sql
DROP TABLE IF EXISTS user_role_memberships;
DROP TABLE IF EXISTS roles;
DROP TYPE IF EXISTS user_roles;
```