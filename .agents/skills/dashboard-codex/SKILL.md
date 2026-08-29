---
name: dashboard-codex
description: Delegate difficult Dashboard_Test engineering tasks to OpenAI Codex while preserving repository isolation, evidence, tests, and human control.
version: 1.0.0
metadata:
  hermes:
    tags: [codex, delegation, debugging, architecture, dashboard-test]
---

# Dashboard_Test Codex Worker

Use this project-local skill when a Dashboard_Test task has been classified as HARD under `/AI_WORKFLOW.md` and `.agents/HERMES_COORDINATOR.md`.

## Codex Role

Codex is the senior engineering specialist, not the default worker.

Use Codex for:

- difficult root-cause debugging
- architecture decisions
- complex multi-package or repo-wide changes
- performance-sensitive engineering
- security-sensitive engineering
- complicated refactors
- tasks that have already resisted reasonable attempts by Hermes or Cursor

Do not consume Codex capacity for documentation, formatting, simple repository queries, routine UI work, ordinary tests, or straightforward maintenance when a less expensive worker is capable.

## Human Approval Gate

Before starting a substantial Codex job, Hermes must explain why Codex is appropriate and obtain explicit human approval unless the user has already authorized autonomous Codex use for that class of work.

Approval to investigate is not automatically approval to merge, deploy, perform destructive operations, or make major architecture changes.

## Repository Safety

1. Read `/AI_WORKFLOW.md` and `.agents/HERMES_COORDINATOR.md`.
2. Synchronize repository state before starting.
3. Never perform development work directly on `main`.
4. Use an isolated branch/worktree named `agent/codex-<description>`.
5. Never share the same working directory with another active agent.
6. Check likely file/component overlap before parallel work.
7. Never expose secrets, tokens, passwords, keys, or production credentials.
8. Keep changes as small and reversible as practical.

## Handoff Into Codex

Codex must receive enough context to avoid restarting blindly. Use `.agents/HERMES_HANDOFF_TEMPLATE.md` and include at minimum:

- objective
- acceptance criteria
- relevant files/components
- observed behavior and evidence
- suspected or confirmed root cause
- commands already run
- tests already run and their actual results
- errors/logs
- failed approaches
- restrictions / do-not-modify areas
- exact Codex assignment

Codex should verify important prior findings before relying on them.

## Engineering Procedure

For difficult bugs:

1. Reproduce or otherwise establish the failure with evidence.
2. Trace the relevant execution/data path.
3. Form a small set of plausible hypotheses.
4. Test hypotheses using repository evidence, logs, tests, or focused instrumentation.
5. Identify the root cause before broad modification whenever practical.
6. Implement the smallest correct fix.
7. Add or update regression coverage when appropriate.
8. Run focused validation first, then the repository validation path as applicable.
9. Review the final diff for unrelated changes.

For architecture/refactor work:

1. Inspect current architecture and conventions first.
2. State the reason the current design is insufficient.
3. Prefer compatibility-preserving changes.
4. Avoid new frameworks/dependencies unless justified.
5. Identify migration or rollback concerns.
6. Validate integration boundaries, not just isolated units.

## Validation

Use the repository's established commands as applicable:

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run test
pnpm run build
```

Database work may require the PostgreSQL/migration path used by CI.

Never report a test or command as successful unless it was actually executed.

GitHub Actions remains the final automated gate before merge.

## Failure Handling

If Codex cannot resolve the task after reasonable investigation:

- stop speculative broad edits
- preserve logs and evidence
- state what was ruled out
- identify remaining hypotheses
- leave the branch in a reviewable state
- return a structured handoff rather than claiming success

If Codex access is unavailable because of authentication, quota, or provider failure, return control to Hermes so configured provider fallback or another approved worker can be selected. Do not silently switch to an unapproved expensive service.

## Completion Report

Return:

```text
Status:
Root cause / finding:
Solution / decision:
Files changed:
Commands executed:
Tests executed:
Test results:
Regression coverage added:
Known risks:
Remaining issues:
Recommended next action:
```

After successful implementation, the normal path is commit -> push branch -> pull request -> GitHub Actions -> human review/approval -> merge.
