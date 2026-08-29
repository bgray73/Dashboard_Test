# Dashboard_Test AI Development Workflow

This document defines the shared operating rules for AI-assisted development in `Dashboard_Test`.

## Goal

Use multiple AI workers safely and efficiently while keeping GitHub as the source of truth. Workers may include Hermes Agent, Cursor, OpenAI Codex, Replit, OpenRouter-backed models, and local models.

## Core Safety Rules

1. Never make AI-generated development changes directly on `main`.
2. Every independent task uses its own branch and, when working locally in parallel, its own Git worktree.
3. Fetch/synchronize the latest appropriate base before starting a task.
4. Do not allow two agents to edit the same working directory simultaneously.
5. Avoid parallel tasks that substantially overlap the same files or subsystem. Run overlapping work sequentially.
6. Prefer small, reversible changes over broad rewrites.
7. Never expose secrets, tokens, passwords, API keys, private keys, or production credentials in prompts, commits, logs, issues, or pull requests.
8. Do not bypass tests or security checks simply to make CI pass.
9. GitHub pull requests and CI are the validation path into `main`.
10. A worker must report uncertainty rather than invent repository state, test results, or successful execution.

## Source of Truth

GitHub repository state is authoritative. Local clones, Cursor workspaces, Hermes sessions, Codex sessions, and Replit environments are workers/copies and must synchronize through Git.

## Worker Roles

### Hermes Agent — Coordinator / Infrastructure

Primary responsibilities:

- task classification and routing
- orchestration and handoffs
- Git operations and worktree coordination
- infrastructure and system-level tasks
- Proxmox, Docker, deployment automation, and related operational work
- dependency/documentation/simple maintenance tasks when appropriate
- provider fallback and inexpensive-model routing

Hermes should avoid consuming expensive frontier-model capacity for simple repetitive tasks when a cheaper model can perform them reliably.

### Cursor — Primary Implementation Worker

Primary responsibilities:

- normal feature implementation
- frontend/UI work
- routine bug fixes
- tests
- normal refactoring
- API/application changes

Escalate difficult root-cause or architecture problems rather than repeatedly guessing.

### Codex — Senior Engineering Worker

Reserve Codex for work where stronger reasoning provides value:

- difficult debugging/root-cause analysis
- architecture decisions
- complex multi-file problems
- complicated refactoring
- performance/security-sensitive implementation
- problems other workers failed to solve
- deep repository analysis

Codex capacity should not be wasted on formatting, documentation, simple renames, or other routine work.

### Replit — Runtime / Prototype / Deployment Worker

Use Replit when its managed environment provides an advantage:

- rapid prototypes
- clean-environment reproduction
- application runtime validation
- frontend/backend prototypes
- databases and integrations
- previews and deployment testing

The Replit copy is not authoritative; changes must return through GitHub branches/PRs. Avoid unnecessary Agent iterations that consume credits.

### OpenRouter / Alternative Cloud Models — Overflow

Use as fallback or cost-optimized capacity when the preferred worker/model is unavailable, rate-limited, quota-limited, or unnecessarily expensive for the task.

### Local Models — Low-Cost Worker

Prefer local models for low-risk work such as:

- documentation drafts
- summaries
- repository searches
- formatting
- repetitive/simple transformations

Escalate when correctness requires stronger reasoning.

## Routing Guidelines

Suggested default routing:

| Task | Preferred worker |
| --- | --- |
| Documentation / formatting / simple repetitive work | Local model or inexpensive Hermes provider |
| Git / orchestration / infrastructure | Hermes |
| Normal feature / UI / application work | Cursor |
| Routine tests / refactoring | Cursor or Hermes |
| Difficult bug / root-cause analysis | Codex |
| Architecture / complex multi-file problem | Codex |
| Prototype / clean runtime reproduction | Replit |
| Database / managed deployment validation | Replit |
| Preferred provider quota/rate limit | Hermes fallback provider |

Routing is guidance, not a substitute for judgment.

## Branch Naming

Use descriptive task branches:

- `agent/hermes-<description>`
- `agent/cursor-<description>`
- `agent/codex-<description>`
- `agent/replit-<description>`

Do not reuse an unrelated old agent branch for new work.

## Task Start Procedure

Before modifying code:

1. Identify the task and acceptance criteria.
2. Fetch/synchronize repository state.
3. Verify the base branch/ref.
4. Verify the working directory is clean when operating locally.
5. Create/use the assigned task branch and isolated worktree when needed.
6. Inspect relevant architecture, existing code, tests, and conventions.
7. Check whether another active task overlaps the same files/subsystem.
8. Only then begin implementation.

## Implementation Rules

- Find the root cause before making broad debugging changes.
- Prefer the smallest reliable fix.
- Preserve existing behavior unless the task explicitly requires a behavior change.
- Follow existing project conventions and dependency choices.
- Avoid adding dependencies when existing project capabilities are sufficient.
- Add/update tests when appropriate.
- Never claim a command/test passed unless it actually ran successfully.

## Validation for Dashboard_Test

The repository uses pnpm. At minimum, use the relevant subset of the repository's standard checks and, before a significant PR is considered complete, expect CI to validate:

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run test
pnpm run build
```

Database-related validation may require the repository's PostgreSQL test environment and migrations.

GitHub Actions is the final automated validation path. Do not merge around failing CI without understanding and explicitly resolving the failure.

## Failure / Escalation Policy

Do not repeatedly retry essentially the same failed approach.

After approximately two reasonable failed approaches:

1. stop making speculative changes;
2. preserve useful errors/logs;
3. summarize what was tried;
4. reassess the suspected root cause;
5. hand the task to the appropriate stronger/specialized worker.

Typical escalation:

`Local/cheap model -> Hermes/Cursor -> Codex`

If Codex is unavailable because of quota/rate limits, use the configured strong fallback model rather than abandoning the task.

Use Replit when evidence points to environment, dependency installation, database, deployment, or runtime reproduction issues.

## Standard Agent Handoff

Every cross-agent handoff should contain:

```text
Repository: bgray73/Dashboard_Test
Branch:
Worker handing off:
Recommended next worker:

Original objective:

Problem/current status:

Root cause suspected or confirmed:

Relevant files:

Changes already made:

Commands already executed:

Tests executed and results:

Errors/logs:

Approaches that failed:

Acceptance criteria:

Do not modify / restrictions:

Recommended next action:
```

The receiving worker must verify important findings against the actual branch/repository state, but should avoid unnecessarily repeating completed investigation.

## Completion Report

A worker completing a task should report:

- result/status
- root cause, when applicable
- files/components changed
- important implementation decisions
- tests/checks actually performed
- test/build/CI results
- remaining risks or known issues
- recommended next action

Keep explanations understandable to a technical professional; provide line-by-line source-code explanations only when useful or requested.

## Pull Request Flow

Expected flow:

`Task -> isolated branch/worktree -> implementation -> local validation -> commit -> push -> PR -> GitHub Actions -> review -> merge`

A PR with failing required validation is not considered complete.

## Parallel Agent Policy

Parallelism is allowed when tasks are independent.

Good example:

- Cursor works on a UI component.
- Codex investigates an unrelated authentication defect.
- Replit validates a deployment/runtime issue.

Bad example:

- Cursor and Codex simultaneously rewrite the same authentication files in the same working directory.

When overlap is likely, coordinate ownership or run the work sequentially.

## Cost / Quota Awareness

Use the least expensive worker/model that can reliably complete the task.

Reserve premium reasoning capacity for problems that need it. If a provider hits a quota/rate limit, preserve task context in the standard handoff and route to an appropriate fallback rather than restarting from zero.

## Human Control

Until the orchestration workflow has been proven reliable, expensive jobs, merges, production deployments, destructive operations, security-sensitive changes, and major architectural changes require explicit human approval.

Automation should increase throughput without removing review and rollback points.