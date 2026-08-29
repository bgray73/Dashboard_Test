# Codex Setup for Hermes

This document covers the local-machine portion of Stage 3 for `Dashboard_Test`.

The repository does not store Codex credentials. Authentication remains in the user's local Hermes/Codex configuration.

## Two Codex Paths

Hermes can interact with Codex in two distinct ways:

1. **Hermes model provider** — Hermes itself uses the `openai-codex` provider with Hermes-managed OAuth.
2. **Standalone Codex CLI skill** — Hermes can invoke the Codex CLI as a specialized coding worker inside a Git repository.

These are related but separate authentication/runtime paths. Do not assume that a missing `OPENAI_API_KEY` means Codex OAuth is unavailable.

## Hermes-Managed Codex OAuth

On the machine running Hermes, authenticate the `openai-codex` provider using Hermes' authentication flow:

```bash
hermes auth add openai-codex
```

Hermes stores its managed OAuth state outside this repository. Never commit the resulting auth files or tokens.

If an OAuth refresh later fails because authorization was revoked or became invalid, authenticate again rather than copying tokens into repository files.

## Standalone Codex CLI

Hermes also includes a Codex skill for delegating coding work to the standalone Codex CLI.

Important operational requirements:

- run Codex inside a Git repository
- use an isolated `agent/codex-*` branch/worktree
- preserve the Dashboard_Test handoff context
- never work directly on `main`
- run validation before PR handoff

The standalone CLI can maintain its own OAuth session outside the repository.

## Dashboard_Test Project Skill

This repository provides:

`.agents/skills/dashboard-codex/SKILL.md`

Hermes supports project-local skills under `.agents/skills/`. Project skills are not trusted automatically for arbitrary cloned repositories. From inside a trusted Dashboard_Test checkout, enable project-skill discovery with:

```bash
hermes skills trust
```

After trust is established, the `dashboard-codex` skill becomes available for sessions launched from this repository.

## Initial Operating Mode

Codex is reserved for HARD tasks. Hermes should recommend Codex and obtain human approval before a substantial usage-sensitive Codex dispatch unless the user has explicitly authorized autonomous Codex use for that class of task.

Routine work should continue to use the least expensive capable worker.

## Verification

After local authentication and project trust are configured:

1. Start Hermes from the Dashboard_Test checkout.
2. Confirm the project-local `dashboard-codex` skill is visible.
3. Give Hermes a small read-only HARD-task analysis request.
4. Confirm Hermes recommends/uses Codex only after the configured approval gate.
5. Confirm no repository credentials or OAuth tokens are created or committed.

Do not use a production deployment or destructive task as the first integration test.
