# PostgreSQL Reserved Keywords in Migrations

## The Problem

PostgreSQL has reserved keywords that **cannot be used as unquoted column names**. Using them without quotes causes syntax errors.

**Example:**
```sql
-- WRONG - 'role' is a reserved keyword
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    role user_roles NOT NULL  -- SyntaxError: "syntax error at or near 'NOT'"
);

-- CORRECT - Quote the reserved word
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    "role" user_roles NOT NULL
);
```

## Common Reserved Keywords

| Keyword | Example Fix |
|---------|-------------|
| `role` | `"role" user_roles NOT NULL` |
| `user` | `"user" TEXT` |
| `order` | `"order" TEXT` |
| `group` | `"group" TEXT` |
| `check`, `session`, `transaction` | Quote them |

## Key Lesson from This Session

**Always quote PostgreSQL reserved keywords in migration files.** The `role` column in the `roles` table caused "syntax error at or near NOT" when unquoted.

## Related Resources

- database-migrations skill
- CI must use DATABASE_URL with password matching POSTGRES_PASSWORD (not ***)
