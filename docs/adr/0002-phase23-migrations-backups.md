# ADR 0002: Migration Infrastructure and Backup/Restore Procedures

- **Status:** Proposed
- **Date:** 2026-08-16
- **Decision owners:** LabOps maintainers
- **Decision scope:** Phase 23 migrations/backups (GitHub issue #23)

## Context

LabOps currently uses `drizzle-kit push` for schema management, which is appropriate for development but not suitable for production. This approach:

- Does not track schema history
- Cannot reproduce database state from scratch
- Provides no upgrade/downgrade path
- Makes backup/restore validation impossible

## Decision

### 1. Migration Infrastructure

**Implement SQL-based migrations with the following structure:**

```
lib/db/migrations/
  YYYYMMDDHHMMSS_migration_name.sql
```

**Migration runner:** Custom TypeScript script in `lib/db/src/migrate.ts`

**Migration commands:**
```bash
# Apply pending migrations
pnpm --filter @workspace/db db:migrate

# Check migration status
pnpm --workspace/db db:migrate:status

# Dry-run to preview pending migrations
pnpm --filter @workspace/db db:migrate --dry-run
```

**Migration table:** `drizzle_migrations` (PostgreSQL)

### 2. Baseline Migration Strategy

For existing deployments, the baseline migration represents the current schema state. On first run:

1. Mark the baseline hash as already applied in `drizzle_migrations` table
2. Do not re-execute the baseline (it would fail with "table already exists" errors)

This allows production databases to adopt the migration system without downtime.

### 3. Future Migration Workflow

**For each schema change:**
1. Generate a unique migration file with timestamp prefix
2. Write SQL `ALTER TABLE` statements (not `CREATE TABLE`)
3. Include `IF NOT EXISTS` for idempotency
4. Add corresponding indexes/constraints as needed
5. Run `db:migrate` to apply
6. Update ORM schema files to match

**Migration file naming:**
```
20260816000000_add_idempotency_columns.sql
```
(Timestamp + descriptive name)

### 4. Backup/Restore Procedures

**Backup:**
```bash
# Logical backup using pg_dump
pg_dump -Fc -d $DATABASE_URL -f backup.dump

# Or SQL dump for portability
pg_dump -d $DATABASE_URL -f backup.sql
```

**Restore test:**
```bash
# Create test database
createdb labops_restore_test

# Restore
pg_restore -d labops_restore_test backup.dump

# Run migrations to verify
DATABASE_URL=postgresql://... pnpm --filter @workspace/db db:migrate
```

**Point-in-time recovery:**
- Use `created_at` from `drizzle_migrations` to identify safe restore points
- Combine with WAL archiving for production

### 5. Migration Best Practices

1. **Never modify existing migrations** - they are the historical record
2. **Keep transactions** - wrap multiple statements in `BEGIN`/`COMMIT`
3. **Handle failures gracefully** - use `IF NOT EXISTS` where appropriate
4. **Test restores regularly** - part of CI/CD pipeline
5. **Document breaking changes** - in migration file comments

## Consequences

### Positive
- Reproducible database schema across environments
- Safe production deployments with rollback capability
- Clear audit trail of schema changes
- Ability to spin up fresh databases from scratch
- Integration with CI/CD for automated testing

### Negative
- Additional tooling complexity
- Need to convert existing `drizzle-kit push` usage
- Manual baseline migration handling for existing deployments

## Implementation Plan

1. Add `db:migrate` and `db:migrate:status` scripts to package.json
2. Create `lib/db/src/migrate.ts` and `lib/db/src/migrate-status.ts`
3. Create baseline migration (Phase 23)
4. Update documentation with backup/restore procedures
5. CI: Add migration verification step

## Alternatives Considered

- **Flyway/Liquibase:** Overkill for this scale; adds Java dependency
- **Prisma Migrate:** Would require ORM migration; Drizzle doesn't support migrations yet
- **Goose/golang-migrate:** Language barrier for TypeScript project
- **Sequential numbered files:** Timestamp-based clearer for audit trail