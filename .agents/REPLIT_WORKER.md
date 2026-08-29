# Replit Worker Policy — Dashboard_Test

This policy supplements `/AI_WORKFLOW.md`. If the two conflict, `/AI_WORKFLOW.md` wins.

Replit is the specialized runtime, clean-environment, database, preview, integration, and deployment worker for Dashboard_Test. It is not the default day-to-day coding worker.

## When Hermes should route work to Replit

Use Replit for RUNTIME tasks such as:

- reproducing behavior in a clean hosted environment
- starting and exercising the full application stack
- database setup, migrations, seed data, and environment-specific database debugging
- runtime-only failures that do not reproduce through static analysis or normal tests
- integration testing across services
- hosted prototypes and previews
- deployment preparation and deployment-specific troubleshooting
- validating environment variables, ports, service startup, and external integration wiring without exposing secrets

Do not spend Replit Agent usage on routine documentation, formatting, simple repository queries, ordinary UI work, straightforward application features, or normal unit-test maintenance when Hermes, a local model, or Cursor can perform the work more economically.

Difficult root-cause engineering or architecture should normally be escalated to Codex rather than consuming Replit cycles in repeated speculative code changes.

## Human approval and cost control

Before a substantial usage-sensitive Replit Agent job, Hermes should present the proposed objective and why Replit is the appropriate worker unless the user has explicitly authorized autonomous Replit dispatch for that class of task.

A request to investigate or create a preview is not authorization to deploy to production, modify production data, rotate credentials, change billing, or perform destructive operations.

Avoid long blind debugging loops. After roughly two sound failed approaches, preserve evidence and return a handoff to Hermes so the task can be reclassified.

## GitHub is the source of truth

Replit work must start from the current GitHub state and return changes through GitHub.

Never use Replit's copy of the project as an independent source of truth.

For implementation work:

1. Synchronize from the intended GitHub base.
2. Work only on an isolated `agent/replit-<short-description>` branch.
3. Do not commit directly to `main`.
4. Do not overwrite unrelated work.
5. Check for overlap with active Cursor, Codex, or Hermes tasks before changing shared files.
6. Keep changes scoped and reversible.
7. Commit and push the branch when the task is ready for review.
8. Open or prepare a pull request and let GitHub Actions provide the final automated gate.

## Handoff into Replit

Use `.agents/HERMES_HANDOFF_TEMPLATE.md`. Include at minimum:

- objective and acceptance criteria
- branch and base
- exact runtime symptom or behavior to reproduce
- relevant files and components
- commands already executed
- test results
- logs and error messages
- database/environment assumptions
- failed approaches
- restrictions and safety concerns
- the exact question Replit must answer

Replit should verify inherited findings rather than blindly trusting them.

## Environment and secrets

Use environment-specific secret storage for credentials and tokens. Never write real credentials into repository files, prompts intended for commits, logs, issues, pull requests, screenshots, or documentation.

Treat `.env.example` as documentation only. Do not replace placeholders with real values.

Clearly distinguish development/test/preview resources from production resources. Do not assume a Replit database or deployment is production simply because the application runs successfully there.

Do not make production deployment, production database mutation, destructive migration, DNS change, credential rotation, or other high-impact change without explicit human approval.

## Runtime procedure

For runtime debugging:

1. Reproduce the reported behavior in the clean environment.
2. Capture the exact startup/runtime error and relevant logs.
3. Determine whether the problem is application code, dependency/build behavior, database/migration state, configuration, networking, or external integration.
4. Make the smallest appropriate fix only if Replit is the right worker for that fix.
5. If the root cause is primarily ordinary application code, return the evidence to Hermes for Cursor.
6. If the root cause requires difficult engineering or architecture, return the evidence to Hermes for Codex.
7. Re-run the reproduction and relevant validation after any change.

## Repository validation

When changes are made, run the applicable repository checks. The standard validation path is:

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run test
pnpm run build
```

Database-backed validation may also require the PostgreSQL and migration path used by CI.

Never claim a command, test, migration, preview, or deployment succeeded unless it was actually executed and observed.

## Preview and deployment behavior

A preview should be treated as disposable and non-production unless explicitly designated otherwise.

Before any production deployment, report:

- target environment
- exact branch/commit to deploy
- required environment variables and external services
- database migration impact
- rollback strategy
- expected user-visible impact
- validation performed

Then wait for explicit human approval.

## Completion report

Return to Hermes with:

- Status
- Runtime symptom reproduced or not reproduced
- Root cause/finding
- Solution or recommendation
- Files changed
- Environment/database changes made
- Commands executed
- Tests and runtime checks with results
- Preview information, if one was intentionally created
- Known risks
- Remaining issues
- Recommended next worker/action

Normal successful code path:

`Replit branch → commit → push → PR → GitHub Actions → human review/approval → merge`

Production deployment remains a separate explicitly approved action.