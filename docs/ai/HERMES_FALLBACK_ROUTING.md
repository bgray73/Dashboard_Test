# Hermes Fallback Routing — Dashboard_Test

This document defines the Stage 6 fallback policy for Dashboard_Test. It supplements `/AI_WORKFLOW.md` and `.agents/HERMES_COORDINATOR.md`; those files remain authoritative for repository safety and worker assignment.

## Goal

Keep Hermes sessions productive when the selected inference provider is unavailable, rate-limited, or out of usable quota, without silently escalating cost or weakening repository safeguards.

Hermes supports a configured cross-provider fallback chain. Current Hermes configuration uses the top-level `fallback_providers:` list in `~/.hermes/config.yaml`; the older singular `fallback_model:` form remains backward-compatible but should not be used for new setup.

## Dashboard_Test policy

Provider fallback is resilience for Hermes inference. It does **not** change worker responsibility.

- Cursor remains the primary worker for NORMAL application development.
- Codex remains the specialist for HARD engineering.
- Replit remains the specialist for RUNTIME, clean-environment, database, preview, and deployment work.
- Hermes remains coordinator and handles infrastructure, Git orchestration, routing, and low-cost work.
- OpenRouter is the preferred cloud fallback path when the active Hermes provider cannot continue.
- A local OpenAI-compatible endpoint may later be added after OpenRouter for cheap/non-critical work if it is validated for the task class.

Do not reinterpret a provider fallback as permission to give a weaker model a security-sensitive, destructive, production, or major architecture task.

## Recommended configuration procedure

Configure the fallback on the machine running Hermes, not in this repository:

```bash
hermes fallback
```

Use the interactive manager to add/list/remove fallback providers and models. Hermes persists the chain in `~/.hermes/config.yaml`.

A representative shape is:

```yaml
fallback_providers:
  - provider: openrouter
    model: <approved-openrouter-model>
```

The exact OpenRouter model should be selected at setup time based on current availability, capability, and cost. Do not hard-code an assumed model ID from this repository policy.

OpenRouter authentication is supplied outside the repository, normally through `OPENROUTER_API_KEY` in the Hermes environment. Never commit the key or copy it into project documentation.

## What triggers automatic fallback

Hermes currently supports fallback when the primary provider encounters supported failure classes such as exhausted rate-limit retries, supported server failures, authentication/authorization failures, not-found responses, or repeatedly malformed/empty responses.

Fallback is intended to continue the same Hermes session while preserving context. Subagent delegation inherits the configured primary fallback chain.

## Cost controls

Fallback should use the least expensive model that can safely complete the active task.

For EASY work, prefer a low-cost OpenRouter model or a validated local model.

For NORMAL coding, Cursor should normally remain the assigned coding worker; Hermes fallback should primarily preserve coordination rather than turn Hermes into an expensive replacement for Cursor.

For HARD work assigned to Codex, a Codex quota/rate-limit failure should return control to Hermes. Hermes may use OpenRouter for analysis only when the selected fallback model is judged capable. If the task is architecture-, security-, or production-sensitive, ask for human approval before materially changing the worker/model strategy.

Do not enter repeated fallback loops. If the fallback provider also fails, preserve the error and return a structured status instead of repeatedly switching providers or spending credits blindly.

## Optional OpenRouter provider routing

When OpenRouter itself is the active inference provider, Hermes supports provider-routing preferences in `~/.hermes/config.yaml`. This is separate from the cross-provider `fallback_providers` chain.

A cost-oriented example is:

```yaml
provider_routing:
  sort: "price"
  require_parameters: true
  data_collection: "deny"
```

Use provider routing only when the active provider supports it. It should not be treated as a generic setting for every direct provider.

## Optional local fallback

A validated OpenAI-compatible local endpoint can be appended to the fallback chain later:

```yaml
fallback_providers:
  - provider: openrouter
    model: <approved-openrouter-model>
  - provider: custom
    model: <validated-local-model>
    base_url: http://localhost:8000/v1
    key_env: LOCAL_API_KEY
```

The endpoint, model, and credential requirements must match the actual local inference server. Do not add this entry until the local model has been tested for the intended workload.

## Verification checklist

After configuring Hermes locally:

1. Run `hermes fallback list` and verify the intended ordered chain.
2. Confirm OpenRouter authentication exists without exposing the key.
3. Start a harmless Hermes session in the Dashboard_Test repository.
4. Confirm normal primary-provider operation first.
5. Exercise fallback only with a safe/non-destructive test or a controlled provider failure.
6. Confirm the session continues and reports the fallback provider/model correctly.
7. Confirm project safety rules still apply: isolated branch/worktree, no direct `main`, no secret leakage, validation before PR.

Do not deliberately disrupt production credentials or production workloads merely to test fallback.

## Failure handoff

If both primary and fallback paths fail, Hermes should return:

- primary provider/model attempted
- fallback provider/model attempted
- failure class and useful error text
- task state and branch/worktree
- commands/tests already completed
- uncommitted or committed changes
- whether a cheaper/local path is viable
- recommended next action

No provider failure authorizes bypassing CI, merging incomplete work, deploying to production, or making destructive changes.

## Repository scope

This file documents policy and local setup. `~/.hermes/config.yaml`, provider credentials, OAuth tokens, and API keys are machine-local configuration and must not be committed to Dashboard_Test.