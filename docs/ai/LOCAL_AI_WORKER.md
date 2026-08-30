# Local AI Worker — Dashboard_Test

This guide supplements `/AI_WORKFLOW.md` and the Hermes coordinator policy. If they conflict, `/AI_WORKFLOW.md` wins.

Stage 7 adds a local-model lane for inexpensive, low-risk work. The local model is a worker selected by Hermes, not the repository's source of truth and not a replacement for Cursor, Codex, or Replit.

## Purpose

Use local inference first when the task is cheap, bounded, reversible, and does not require the strongest reasoning model. The goal is to reduce cloud usage while keeping difficult engineering on the workers best suited to it.

Good local-model tasks include:

- summarizing repository files, logs, issues, and completed work
- drafting or cleaning documentation
- formatting and mechanical text transformations
- simple repository searches and classification
- repetitive low-risk edits with explicit acceptance criteria
- extracting structured information from supplied text
- preparing handoff summaries for another worker
- simple test-data or boilerplate generation that will still be reviewed and validated

Do not route a task locally merely because local inference is available.

## Tasks that should normally stay elsewhere

Route NORMAL implementation to Cursor, including ordinary features, UI, APIs, tests, bug fixes, and application refactors.

Route HARD engineering to Codex, including difficult root-cause analysis, architecture, security-sensitive reasoning, performance investigations, complex repository-wide changes, and work that has already resisted sound approaches.

Route RUNTIME work to Replit when it needs a clean hosted environment, database/runtime reproduction, integration validation, preview, or deployment-specific troubleshooting.

Keep infrastructure, Git coordination, worktree management, automation, provider selection, and handoffs with Hermes.

## Safety boundary

Local models are not trusted to bypass the existing repository controls.

For any repository mutation:

1. Start from the current GitHub state.
2. Use an isolated `agent/local-<short-description>` branch/worktree.
3. Never commit directly to `main`.
4. Do not share a writable working directory with another worker.
5. Check for overlapping active work before editing shared files.
6. Keep the change small and reversible.
7. Never expose secrets, tokens, credentials, private keys, or production data to prompts or committed files.
8. Run applicable validation.
9. Return changes through a GitHub pull request.
10. Let GitHub Actions remain the final automated gate before human merge approval.

A local model must not be used as a reason to weaken review, testing, security, or deployment controls.

## Hermes connection

Current Hermes Agent supports local/self-hosted models through OpenAI-compatible endpoints. Configure the machine running Hermes, not this repository.

Recommended interactive path:

```bash
hermes model
```

Select the custom/self-hosted endpoint option and supply the local server's OpenAI-compatible `/v1` URL, model name, and the model's real context length. A key can normally be omitted for a keyless loopback-only local server.

Hermes stores model/provider configuration in `~/.hermes/config.yaml`. Do not commit that machine-specific file or credentials to Dashboard_Test.

### Ollama example

Ollama exposes an OpenAI-compatible endpoint that Hermes can use directly. A typical loopback endpoint is:

```text
http://localhost:11434/v1
```

The exact model is intentionally not hard-coded in repository policy. Choose a model that actually fits the local machine and verify its tool-calling quality and context window before making it part of routine dispatch.

### LM Studio

Hermes also supports LM Studio/local OpenAI-compatible serving. Treat it the same way: configure the endpoint on the Hermes host, verify the loaded model, and keep machine configuration outside GitHub.

## Recommended routing mode

Initially use local AI as an explicit low-cost worker rather than making it the global primary model.

Hermes should classify the task first:

- EASY / mechanical / summarization -> local model when capable
- NORMAL application work -> Cursor
- HARD engineering -> Codex
- RUNTIME / preview / deployment -> Replit
- INFRASTRUCTURE / coordination -> Hermes

This preserves quality while creating a cheap lane for tasks that do not justify cloud-model usage.

## Validation before routine use

Before Hermes begins assigning local tasks automatically, verify all of the following on the Hermes host:

1. The local inference server is running and reachable only on the intended interface.
2. Hermes can query the endpoint and select the intended model.
3. The configured context length does not exceed what the server actually provides.
4. The model can follow a bounded repository task without inventing command/test results.
5. Tool calling works if the assigned task requires tools.
6. A read-only repository summary task completes correctly.
7. A small isolated branch task can produce a valid handoff without touching `main`.

Do not claim the local worker is operational until those checks have actually been performed.

## Escalation

Escalate from local AI when:

- the task becomes architecture- or security-sensitive
- the model cannot reliably follow repository constraints
- required tool calls fail or are unavailable
- context limits prevent adequate repository understanding
- output repeatedly needs substantial correction
- roughly two sound attempts fail

Preserve the prompt, findings, relevant logs, attempted approaches, and remaining question in the standard Hermes handoff. Do not burn local compute indefinitely just because it has no per-token cloud charge.

## Completion report

A local worker should return:

- Status
- Objective completed or not completed
- Files inspected
- Files changed, if any
- Commands actually executed
- Tests/checks actually executed and their results
- Important findings
- Uncertainty or context limitations
- Remaining issues
- Recommended next worker/action

Normal code path remains:

`local worker branch -> commit -> push -> PR -> GitHub Actions -> human review/approval -> merge`

## Privacy and network exposure

Local inference can keep model processing on the local machine, but repository tooling may still communicate with GitHub or other configured services. Do not describe the entire workflow as offline unless every required component has been verified to operate offline.

Prefer loopback binding for a model server used only by Hermes on the same Mac. If the endpoint is intentionally exposed to the LAN or through a remote-access network, add appropriate authentication and network controls rather than assuming a local-model API is safe to expose unauthenticated.
