# Database Layer (@workspace/db)

This package provides database access and migration infrastructure for LabOps.

## Dependencies

- **Drizzle ORM** - Type-safe PostgreSQL query builder
- **Drizzle Kit** - Schema management (dev only)
- **pg** - PostgreSQL client

## Database Commands

### Development Schema Management

```bash
# Push schema to database (dev only - destroys existing data)
pnpm --filter @workspace/db run push
```

**Warning:** `push` will drop and recreate tables. Use only in development.

### Migration Commands (Production)

```bash
# Apply pending migrations
pnpm --filter @workspace/db db:migrate

# Check migration status
pnpm --filter @workspace/db db:migrate:status

# Show only pending migrations
pnpm --filter @workspace/db db:migrate:status --pending

# Show only applied migrations  
pnpm --filter @workspace/db db:migrate:status --applied

# Dry-run to preview pending migrations
pnpm --filter @workspace/db db:migrate --dry-run
```

### Collector Management

```bash
# Create a new collector
pnpm --filter @workspace/db collectors create <name> [hostname]

# List enrolled collectors
pnpm --filter @workspace/db collectors list

# Revoke a collector
pnpm --filter @workspace/db collectors revoke <name>
```

## Schema Organization

Schemas are organized in `src/schema/`:

| File | Table(s) |
|------|----------|
| `users.ts` | User identities from OIDC |
| `devices.ts` | Device inventory |
| `collectors.ts` | Remote collector registration |
| `monitoring-history.ts` | Check history records |
| `monitoring-incidents.ts` | Open/resolved incidents |
| `reachability-jobs.ts` | ICMP job queue |
| `roles.ts` | RBAC role definitions |
| `saved-configurations.ts` | Archived configs |
| ... | ... |

## Migration Files

SQL migration files live in `migrations/`:

```
migrations/
  20240115000000_add_roles_and_user_role_memberships.sql
```

Each migration:
1. Starts with timestamp prefix for ordering
2. Contains only forward changes (no rollback)
3. Is idempotent with `IF NOT EXISTS` where appropriate
4. Updates `drizzle_migrations` tracking table

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |

## Backup/Restore

### Production Backup

```bash
# Logical backup
pg_dump -d $DATABASE_URL -f backups/labops-$(date +%Y%m%d).sql

# Compressed backup
pg_dump -Fc -d $DATABASE_URL -f backups/labops-$(date +%Y%m%d).dump
```

### Restore

```bash
# Create database
createdb labops_restore

# Restore from SQL dump
psql -d labops_restore -f backups/labops-20260816.sql

# Or from custom format
pg_restore -d labops_restore backups/labops-20260816.dump

# Verify migrations
DATABASE_URL=postgresql://... pnpm --filter @workspace/db db:migrate:status
```

## Security Notes

- Never commit migration files with real data
- Store `DATABASE_URL` in secret manager, not environment files
- Review migration SQL before applying to production
- Test restores in staging before production backup rotation