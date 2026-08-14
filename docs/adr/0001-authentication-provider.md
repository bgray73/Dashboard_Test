# ADR 0001: Provider-neutral OIDC authentication and server sessions

- **Status:** Accepted
- **Date:** 2026-08-14
- **Decision owners:** LabOps maintainers
- **Decision scope:** Phase 18 authentication only (GitHub issue #19)

## Context

LabOps currently has no authentication on its main `/api` router. The collector boundary is different: `/api/collector/v1/*` already accepts a collector ID and a scoped bearer token. Phase 18 must authenticate browser users without making an identity provider a runtime dependency for every API request and without weakening collector isolation.

The identity protocol must remain portable. Replit Auth is a supported deployment, not a provider-specific application model. Replit's current documentation describes Replit Auth as Agent-managed and says manual implementation is not supported.[1] Its live OIDC metadata nevertheless identifies `https://replit.com/oidc` as the issuer and advertises authorization-code, S256 PKCE, UserInfo, RP-initiated logout, and confidential-client authentication methods.[2] Consequently, the application will consume standards-based OIDC configuration and will not depend on Replit-only headers, database tables, claims, or SDKs.

Authorization roles, CSRF-token middleware, security audit events, and rate limits are Phase 19 decisions. Phase 18 still uses POST logout, same-site cookies, exact callback construction, one-time authorization flows, and a deny-by-default main API guard.

## Decision

### 1. Protocol and library

Use OpenID Connect Authorization Code Flow with all three of:

- S256 PKCE (`code_verifier` and `code_challenge`);
- a cryptographically random `state`; and
- a cryptographically random OIDC `nonce`.

Generate a new independent value for each item on every login attempt. Never accept `plain` PKCE, implicit/hybrid flow, password grants, bearer access tokens as LabOps sessions, or credentials implemented by LabOps. OAuth Security BCP requires CSRF protection for redirect flows, exact registered redirect handling, and PKCE guidance; RFC 7636 defines S256.[7][10] OIDC Core defines nonce validation and the stable issuer/subject identity tuple.[8]

Add `openid-client` as the sole OIDC protocol library during implementation. The researched current release is **6.8.5**; use `openid-client@^6.8.5` and let the frozen pnpm lockfile pin the installed artifact. Version 6 is the maintained ESM line, supports Node 20+ (therefore this repository's Node 24), WebCrypto, discovery, PKCE helpers, authorization URL construction, callback validation, token exchange, claims validation, UserInfo, and RP-initiated logout.[3]

Use these v6 APIs rather than v5 `Issuer`/`Client` examples:

```ts
import * as oidc from "openid-client";

const config = await oidc.discovery(
  new URL(issuerUrl),
  clientId,
  { client_secret: clientSecret },
  clientAuthMethod === "client_secret_basic"
    ? oidc.ClientSecretBasic(clientSecret)
    : oidc.ClientSecretPost(clientSecret),
);

const verifier = oidc.randomPKCECodeVerifier();
const challenge = await oidc.calculatePKCECodeChallenge(verifier);
const state = oidc.randomState();
const nonce = oidc.randomNonce();
const authorizationUrl = oidc.buildAuthorizationUrl(config, {
  redirect_uri: callbackUrl,
  scope: "openid profile email",
  response_type: "code",
  code_challenge: challenge,
  code_challenge_method: "S256",
  state,
  nonce,
});

const tokens = await oidc.authorizationCodeGrant(config, callbackRequestUrl, {
  pkceCodeVerifier: verifier,
  expectedState: state,
  expectedNonce: nonce,
  idTokenExpected: true,
});
const claims = tokens.claims();
```

`discovery()` from an issuer URL is the library's recommended configuration path and validates the metadata issuer; passing a discovery-document URL directly is forbidden because that disables issuer validation.[4] `authorizationCodeGrant()` validates the authorization response and accepts the expected PKCE/state/nonce checks.[5] Do not implement JWT, JWK, token, or claim signature validation manually.

Use existing Node `crypto` for opaque values and SHA-256, existing Zod for environment/claim shape validation, and existing Drizzle/PostgreSQL for persistence. Do not add Passport, `express-session`, a JWT session package, a Replit-specific auth package, or an in-memory session store.

### 2. Exact runtime configuration

Add the following fields to the centralized runtime configuration. Values are trimmed; secrets are never printed. Unknown or invalid authentication configuration fails startup.

| Environment variable                | Required/default              | Validation and meaning                                                                                                                                                                                                                                        |
| ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OIDC_ISSUER_URL`                   | Required                      | Absolute issuer URL with no query or fragment. HTTPS is required in production. Preserve its path and compare the discovered `issuer` exactly; do not silently rewrite a trailing slash.                                                                      |
| `OIDC_CLIENT_ID`                    | Required                      | Non-empty registered confidential-client ID.                                                                                                                                                                                                                  |
| `OIDC_CLIENT_SECRET`                | Required                      | Non-empty secret supplied only by the deployment secret manager. Never place a real value in `.env.example`.                                                                                                                                                  |
| `OIDC_CLIENT_AUTH_METHOD`           | Default `client_secret_basic` | Exactly `client_secret_basic` or `client_secret_post`; map explicitly to `oidc.ClientSecretBasic()` or `oidc.ClientSecretPost()`. Startup/login fails if discovery does not advertise the selected method. Public-client `none` is not supported in Phase 18. |
| `PUBLIC_BASE_URL`                   | Required                      | Exact browser-visible HTTP(S) origin only: no path, credentials, query, or fragment. HTTPS is required in production. Never derive it from `Host`, `Forwarded`, or `X-Forwarded-*`.                                                                           |
| `AUTH_BOOTSTRAP_ISSUER`             | Optional only as a pair       | Exact expected issuer for the one-time first-user transaction. Must equal discovered issuer and be set with `AUTH_BOOTSTRAP_SUBJECT`.                                                                                                                         |
| `AUTH_BOOTSTRAP_SUBJECT`            | Optional only as a pair       | Exact, case-sensitive OIDC `sub` allowed to create the first user. Empty/wildcard values are rejected. Remove both bootstrap variables after first login.                                                                                                     |
| `AUTH_SESSION_IDLE_TTL_SECONDS`     | Default `1800`                | Integer 300–86,400. Idle timeout; must not exceed the absolute timeout.                                                                                                                                                                                       |
| `AUTH_SESSION_ABSOLUTE_TTL_SECONDS` | Default `43200`               | Integer 1,800–604,800. Hard lifetime from session creation.                                                                                                                                                                                                   |
| `AUTH_FLOW_TTL_SECONDS`             | Default `600`                 | Integer 60–900. Lifetime of one-time state/nonce/PKCE rows.                                                                                                                                                                                                   |
| `OIDC_HTTP_TIMEOUT_MS`              | Default `5000`                | Integer 1,000–15,000. Deadline for discovery, token, JWKS, and UserInfo requests.                                                                                                                                                                             |

The OIDC scope is deliberately fixed to `openid profile email`; it is not an environment variable. LabOps requests no `offline_access`, stores no refresh token, and does not require profile/email claims to authorize a user. `NODE_ENV=production` additionally requires HTTPS issuer/base URLs, a client secret, and Secure cookies. There is no `AUTH_BYPASS`, development-user, trusted-header, or anonymous-production mode; adding one would require a new ADR. Tests inject an authentication adapter directly and never activate a runtime bypass.

Apply `OIDC_HTTP_TIMEOUT_MS` with an `AbortSignal` through `config[oidc.customFetch]`; the library documents `customFetch` as the supported fetch override.[3] Do not log its request URL/body because token endpoints carry codes and credentials.

### 3. Callback URLs and provider registration

Construct, never infer, these values:

- redirect URI: `${PUBLIC_BASE_URL}/api/auth/callback`
- local post-login destination: `${PUBLIC_BASE_URL}/`
- local post-logout destination: `${PUBLIC_BASE_URL}/`

Register the redirect URI exactly at the provider. If provider-initiated logout is added later, register the post-logout URI exactly as well. Do not accept a callback URL, issuer, or arbitrary `returnTo` from request parameters. Phase 18 always returns to `/`; a future safe-return feature must store a validated relative path in the one-time flow row, never round-trip an arbitrary URL.

The callback accepts only `GET /api/auth/callback` with authorization response parameters. Build the `URL` passed to `authorizationCodeGrant()` from `PUBLIC_BASE_URL` plus the original path/query, not request host/protocol headers. Reject duplicate parameters, malformed URLs, missing/error callbacks without matching one-time state, and callbacks whose state is missing, expired, already consumed, or mismatched. Never render provider error descriptions, codes, or callback parameters into the frontend.

### 4. Replit mapping

For a Replit Auth OIDC client that provides confidential-client credentials, configure:

```dotenv
OIDC_ISSUER_URL=https://replit.com/oidc
OIDC_CLIENT_ID=<value-provisioned-for-this-Replit-Auth-client>
OIDC_CLIENT_SECRET=<store-in-Replit-Secrets-never-in-source>
OIDC_CLIENT_AUTH_METHOD=client_secret_basic
PUBLIC_BASE_URL=https://<published-app-or-custom-domain>
AUTH_BOOTSTRAP_ISSUER=https://replit.com/oidc
AUTH_BOOTSTRAP_SUBJECT=<exact-sub-from-the-approved-initial-account>
```

Replit's live metadata currently advertises both `client_secret_basic` and `client_secret_post`; use `client_secret_basic` unless the provisioned client registration explicitly requires post.[2] Map Replit claims exactly like any other provider:

- identity key: metadata `issuer` + ID-token `sub`;
- optional display snapshot: `name`, otherwise `preferred_username`, otherwise Replit's non-standard `username`, otherwise `sub`;
- optional email snapshot: `email` only when it is a string; record `email_verified` as profile metadata if needed, never as the identity key;
- ignore Replit's `sid`, image, and all unneeded claims.

Do not assume `REPL_ID` is an OIDC client ID, do not read `REPLIT_DOMAINS` to construct callbacks, and do not trust Replit proxy identity headers. Current Replit documentation intentionally delegates setup to Agent and does not document a manual client-ID/client-secret export.[1] Therefore, before implementation rollout, the operator must confirm that the specific Replit Auth registration exposes a confidential client ID/secret and accepts the exact callback. If it exposes only a public client (`token_endpoint_auth_method=none`), stop: Phase 18's required `OIDC_CLIENT_SECRET` contract is not met. Do not weaken the ADR silently.

### 5. One-time authorization flow

`GET /api/auth/login` performs bounded discovery/configuration, verifies metadata includes authorization and token endpoints, `response_types_supported` includes `code`, `code_challenge_methods_supported` includes `S256`, and the selected token auth method is supported. It then:

1. generates independent state, nonce, and PKCE verifier values with `openid-client` helpers;
2. stores one flow row with the original state for the library's constant-time expected-state check and a SHA-256 state hash used only as the indexed callback lookup key;
3. sends `Cache-Control: no-store` and a `302` to the provider authorization URL containing S256 challenge, state, nonce, exact redirect URI, response type `code`, and fixed scopes.

The database stores the nonce and verifier because their original values are required for validation/token exchange. They are short-lived secrets: restrict DB access, never log/select them outside the callback path, and delete them on consumption. Do not put state, nonce, or verifier in browser cookies/local storage.

At callback, SHA-256 hash the returned state and atomically consume the row with one `DELETE ... WHERE state_hash = ? AND expires_at > now() RETURNING ...` before contacting the provider. Exactly one concurrent/replayed callback can proceed. A provider/network failure after consumption requires a new login; never restore the row. Pass the **stored original** state (not the untrusted callback value) as `expectedState`, together with stored `pkceCodeVerifier`, stored `expectedNonce`, and `idTokenExpected: true`, to `authorizationCodeGrant()`. Require non-empty string `iss`/`sub`, exact discovered issuer, expected client audience (validated by the library), and validated ID-token nonce. Do not create a user/session on any validation or exchange failure.

### 6. Stable account mapping and explicit bootstrap

The sole identity key is the exact, case-sensitive pair `(issuer, subject)` from validated OIDC data. Email, username, display name, provider, tenant label, and Replit account name are mutable profile attributes and must never merge or locate accounts. A unique database constraint enforces the pair.

Phase 18 has no open enrollment and no user-management UI:

- If a matching user exists, update only optional profile snapshots and `last_login_at`, then issue a session.
- If no matching user exists and at least one LabOps user exists, return `403` without creating anything.
- If the users table is empty, acquire a transaction-scoped bootstrap lock, re-check emptiness, and create the first user only when both configured bootstrap values exactly match the validated issuer/subject.
- If bootstrap configuration is absent/mismatched, return `403`. Never reveal which component mismatched.
- After success, the operator removes both bootstrap variables. Their later presence has no effect while any user exists. Deleting all users does not implicitly reopen enrollment; without the explicit pair, bootstrap remains closed.

Use one PostgreSQL transaction and a fixed `pg_advisory_xact_lock` key (document the chosen numeric constant in implementation) around the empty-table check and insert, plus the unique identity constraint. This makes two simultaneous first callbacks deterministic. No email-based invitation, wildcard, first-request-wins, localhost exception, or production development bypass is permitted.

### 7. PostgreSQL model

Implement three Drizzle schema files under `lib/db/src/schema/` in the later implementation PR (not in this ADR commit):

**`users`**

- `id`: `serial`, primary key
- `identity_issuer`: `text`, not null
- `identity_subject`: `text`, not null
- `email`: `text`, nullable profile snapshot
- `display_name`: `text`, nullable profile snapshot
- `email_verified`: `boolean`, nullable profile snapshot
- `created_at`: timestamptz, not null, default now
- `updated_at`: timestamptz, not null, default now
- `last_login_at`: timestamptz, nullable
- unique constraint on (`identity_issuer`, `identity_subject`)

**`auth_sessions`**

- `id`: `serial`, primary key; internal only
- `user_id`: integer FK to users, not null, cascade on delete
- `token_hash`: `text`, not null, unique; lowercase hex SHA-256 of the cookie token
- `created_at`: timestamptz, not null, default now
- `last_seen_at`: timestamptz, not null, default now
- `idle_expires_at`: timestamptz, not null
- `absolute_expires_at`: timestamptz, not null
- `revoked_at`: timestamptz, nullable
- indexes on (`token_hash`) through the unique constraint, (`user_id`), and (`idle_expires_at`, `absolute_expires_at`)

**`oidc_auth_flows`**

- `id`: `serial`, primary key
- `state_hash`: `text`, not null, unique; lowercase hex SHA-256
- `state`: `text`, not null; original expected state used only after hash lookup
- `nonce`: `text`, not null
- `pkce_verifier`: `text`, not null
- `issuer`: `text`, not null; discovered issuer for this attempt
- `created_at`: timestamptz, not null, default now
- `expires_at`: timestamptz, not null
- index on `expires_at`

Application validation caps issuer at 2,048 characters, subject at the OIDC Core limit of 255 ASCII characters, profile snapshots at 320/255 characters, and verifies stored hash lengths/hex format. Add CHECK constraints for `idle_expires_at <= absolute_expires_at` and `expires_at > created_at`. Use database time for expiry comparisons. A periodic best-effort cleanup deletes expired/consumed flows and expired/revoked sessions; correctness never depends on cleanup.

The current repository intentionally uses `drizzle-kit push` and has not adopted versioned migrations. For Phase 18, define/export the schemas, review generated SQL, back up PostgreSQL, and run `DATABASE_URL=... pnpm --filter @workspace/db run push` once in a maintenance window before deploying auth code. The application must not create/alter tables at startup; startup performs a harmless schema-readiness check and fails closed with a clear operator error when tables/columns are absent. Do not use `push-force`, automatic destructive reconciliation, or drop auth tables on rollback. Conversion to versioned migrations remains a later architecture phase.

### 8. Opaque server session

After a successful callback and identity transaction:

1. generate 32 random bytes (256 bits) with `crypto.randomBytes(32)` and base64url-encode without padding;
2. SHA-256 hash that exact ASCII token and persist only the lowercase hex digest;
3. revoke any valid session identified by a pre-existing LabOps session cookie, create a fresh row, and set the newly generated token once in the response;
4. discard all provider authorization codes, access tokens, refresh tokens, and ID tokens after validated claims are extracted.

The cookie is never a JWT and contains no user/session ID. Authentication hashes the presented token, looks up one non-revoked row, and requires both `idle_expires_at > now()` and `absolute_expires_at > now()`. Use a constant-time hash comparison if any hash is compared in application memory; normally equality is performed by PostgreSQL on the indexed digest. OWASP recommends meaningless, unpredictable session IDs, cookie protections, server-side invalidation, and both idle and absolute expiration.[9]

Refresh idle expiry to `min(now + idle TTL, absolute_expires_at)` and update `last_seen_at` at most once every five minutes to avoid a write on every request. The absolute deadline never moves. An expired/revoked/missing session returns the same `401 {"error":"Authentication required."}`, clears the cookie, and does not execute downstream route/database logic.

Cookie policy:

| Attribute  | Production              | Local HTTP development |
| ---------- | ----------------------- | ---------------------- |
| Name       | `__Host-labops_session` | `labops_session`       |
| `HttpOnly` | yes                     | yes                    |
| `Secure`   | yes                     | no                     |
| `SameSite` | `Lax`                   | `Lax`                  |
| `Path`     | `/`                     | `/`                    |
| `Domain`   | omitted (host-only)     | omitted (host-only)    |
| `Max-Age`  | absolute TTL            | absolute TTL           |

The production `__Host-` name is valid only with Secure, host-only, `Path=/`. Never make the cookie name configurable. When clearing, repeat the same name/path/SameSite/Secure attributes with `Max-Age=0`. Do not set a state/nonce/verifier cookie.

### 9. Routes, login, logout, and invalidation

Mount middleware in this order:

1. request logging, Helmet, and CORS;
2. `/api/collector/v1/*` with its existing 16 KiB parser and collector bearer authentication;
3. main parsers;
4. public `GET /api/healthz` and `/api/auth/*` route mechanics;
5. one default main-session guard;
6. all existing LabOps routes.

Public route behavior:

- `GET /api/auth/login`: create a flow and redirect, or bounded `503` when the provider cannot be reached/configured.
- `GET /api/auth/callback`: consume/validate the flow and provider response; on success rotate the local session and `303` to `/`; use generic `400` for invalid/replayed/expired callbacks, `403` for unprovisioned identity, and bounded `503` for provider failure.
- `GET /api/auth/me`: `200` with the minimum local user projection (`id`, display name, optional email) for a valid local session; otherwise the standard `401`. It performs no provider call.
- `POST /api/auth/logout`: idempotently revoke the current local row when present, clear the cookie, set `Cache-Control: no-store`, and return `204`. It performs no provider call.

POST logout plus `SameSite=Lax` is the Phase 18 baseline; Phase 19 adds general CSRF-token middleware. Local logout is authoritative and available during provider outage. It does not sign the browser out of the user's global provider/Replit account. This avoids making local revocation dependent on an optional end-session endpoint or retaining an ID token. If explicit provider logout is later required, use `buildEndSessionUrl()` only when metadata advertises it and keep local revocation first; the library supports this API.[6][11]

Successful login always rotates the local token. Logout revokes the current row immediately. Expiry invalidates without waiting for cleanup. Database/session compromise response can invalidate all sessions with one transactional `UPDATE auth_sessions SET revoked_at = now() WHERE revoked_at IS NULL`; rotating the OIDC secret affects future login but is not a substitute for local invalidation.

### 10. Provider outage and network behavior

OIDC is on the login/callback path only. Existing local-session checks use PostgreSQL and cached local user data and never call discovery, JWKS, UserInfo, introspection, or the provider. Therefore a provider outage:

- does not revoke or shorten valid local sessions;
- makes new login/callback fail within `OIDC_HTTP_TIMEOUT_MS` with a generic `503` and `Retry-After: 30`;
- never falls back to anonymous, cached provider claims, trusted headers, or a development identity;
- never retries a callback token exchange automatically, because the code/flow are one-time;
- leaves logout functional.

Discovery is lazy and cached in memory with a bounded refresh policy; provider unavailability must not prevent the process from starting and serving valid sessions. Syntactically invalid/missing production configuration still fails startup. Cache only provider metadata/JWKS through library-supported behavior, never tokens. A fresh process with an outage can still validate existing local sessions; only login is unavailable. Return correlation IDs to operators, not upstream URLs, response bodies, codes, claims, or stack traces to users.

### 11. Local development

Preferred local development uses a separate provider client/tenant and the browser-visible Vite origin, for example:

```dotenv
NODE_ENV=development
PUBLIC_BASE_URL=http://localhost:5173
OIDC_ISSUER_URL=https://<development-issuer>
OIDC_CLIENT_ID=<development-client-id>
OIDC_CLIENT_SECRET=<local-secret-not-committed>
OIDC_CLIENT_AUTH_METHOD=client_secret_basic
AUTH_BOOTSTRAP_ISSUER=https://<development-issuer>
AUTH_BOOTSTRAP_SUBJECT=<developer-test-account-sub>
```

Register `http://localhost:5173/api/auth/callback` and keep Vite's `/api` proxy. Use exactly one hostname (`localhost` or `127.0.0.1`) throughout because cookies are host-scoped. `.env.example` contains placeholders only.

A local OIDC server such as a test Keycloak/Dex instance may use HTTP only when `NODE_ENV=development` **and** both issuer and endpoints are loopback hosts. In that narrow case pass `allowInsecureRequests` through `discovery(..., { execute: [oidc.allowInsecureRequests] })`; `openid-client` otherwise enforces HTTPS and marks this escape hatch as development/testing-only.[3] Production rejects every HTTP issuer/base URL regardless of other flags. Developers still complete a real OIDC flow. Unit/integration tests may use an in-process fake issuer and dependency injection, but shipped runtime code has no bypass route/header/user.

### 12. Collector isolation and default route guard

The browser session authenticator must never inspect or accept `Authorization: Bearer` as a main user credential. The collector authenticator must never inspect or accept the browser cookie. Keep the collector router mounted before and outside the main auth guard, preserve its separate 16 KiB body limit, collector ID requirement, token hash, status checks, and response semantics.

The main guard protects all `/api` routes by default except the explicit public list: `/api/healthz`, `/api/auth/login`, `/api/auth/callback`, `/api/auth/me`, and `/api/auth/logout`. `/api/auth/me` and logout are public only in routing terms; they act on a cookie if one exists. Add an inventory test that enumerates every route and proves anonymous requests cannot reach route handlers. A collector bearer token must receive `401` on a main route, and a browser session cookie must receive `401` on collector routes.

### 13. Logging and data minimization

Retain current request logging that strips query strings and redacts `Authorization`, `Cookie`, and `Set-Cookie`. Extend redaction/tests so none of these can appear in structured fields, child loggers, thrown errors, or debug output:

- session cookie/token or hash;
- OIDC client secret;
- authorization code, access token, refresh token, or ID token;
- callback query/form parameters;
- state or state hash, nonce, PKCE verifier/challenge;
- raw discovery/JWKS/token/UserInfo bodies;
- full provider claims or unnecessary email/profile values.

Never log complete request/response objects on auth routes. Log only event name, outcome category (`invalid_callback`, `provider_unavailable`, `identity_not_provisioned`, `session_expired`), HTTP status, safe provider issuer hostname (not query), and request correlation ID. Do not include whether issuer vs. subject failed bootstrap. Pino redaction is defense in depth; code must avoid attaching secrets before serialization. Authentication responses use `Cache-Control: no-store` where they expose session state or redirects.

### 14. Test strategy

Implementation is not complete until these tests pass:

**Configuration/unit**

- required fields, exact origin/issuer parsing, HTTPS production rules, timeout/TTL bounds, paired bootstrap fields, auth-method enum/support, and rejection of any bypass configuration;
- 32-byte token generation, base64url shape, deterministic SHA-256 hashing, no plaintext persistence;
- cookie names/flags and exact-attribute clearing in production and local HTTP;
- idle refresh throttle, idle expiry, absolute expiry, revoked rows, and generic `401`;
- claim validation and exact case-sensitive `(issuer, sub)` mapping; changing email does not change identity;
- secret-redaction tests over normal, provider-error, callback-error, and thrown-error logs.

**OIDC protocol with a controllable fake issuer (no live Replit dependency in CI)**

- authorization URL contains exact redirect URI, fixed scope, `response_type=code`, S256 challenge, state, and nonce;
- valid code flow calls the v6 API with verifier/expected state/expected nonce/`idTokenExpected`, consumes the flow, rotates any old session, and stores no provider token;
- missing, duplicate, random, mismatched, expired, and replayed state; nonce mismatch; PKCE mismatch; wrong issuer/audience/signature; provider `error`; missing `sub`; and token/JWKS timeout all create no session;
- callback race proves only one `DELETE ... RETURNING` wins;
- discovery lacking S256/code/selected client auth method fails closed;
- provider timeout is bounded and returns generic `503`; existing local `/me` and protected API requests still succeed during outage; logout still revokes.

**PostgreSQL integration**

- real pushed schema, unique identity and token/state hash constraints, expiry CHECK constraints, user cascade, and relevant indexes;
- simultaneous first-login transactions create exactly one configured user; wrong/unset bootstrap creates none; unknown identities remain denied after bootstrap;
- session issue, lookup, throttled touch, absolute cap, logout revocation, all-session incident revocation, and cleanup;
- assertions query tables directly to prove plaintext session tokens and provider tokens are absent.

**Express/router/frontend**

- every route inventory entry: public exceptions have intentional behavior; all other main routes return `401` before handler/database spies run;
- collector bearer works only under `/api/collector/v1`; browser cookie cannot cross-authenticate; collector body limit remains 16 KiB;
- login/loading/authenticated/expired/logout/provider-unavailable frontend states expose no callback detail;
- `pnpm install --frozen-lockfile`, targeted auth tests, full `pnpm run test`, `pnpm run typecheck`, `pnpm run build`, and production dependency audit.

Use a fake standards-conforming issuer or intercepted `openid-client` fetch for deterministic tests, including signed ID tokens and key rotation. Run one manual smoke test against the configured development provider and one against the target Replit deployment before rollout; CI must not require external provider availability.

### 15. Rollout

1. Provision a development OIDC client and verify discovery, S256, selected confidential-client auth, exact callback, and stable `sub`. For Replit, complete the confidential-client credential gate described above.
2. Add schemas/tests/auth code in the Phase 18 implementation PR; update `.env.example`, threat model, route inventory, operating docs, and OpenAPI/frontend contracts in that PR.
3. Back up PostgreSQL. Review `drizzle-kit push` SQL, apply it in a maintenance window, and verify schema readiness before application deployment.
4. Register the production callback exactly. Put issuer/client/base/bootstrap values in the deployment secret manager; verify no secret is in git, build output, logs, or CI artifacts.
5. Deploy with external exposure still restricted. Complete the one approved first-user login, verify `(issuer, sub)`, secure cookie, session hash, idle/absolute times, protected-route `401`, logout revocation, and collector operation.
6. Remove `AUTH_BOOTSTRAP_ISSUER` and `AUTH_BOOTSTRAP_SUBJECT`, restart, and prove an unknown identity receives `403` while the provisioned identity works.
7. Run the provider-outage drill and session-revocation drill. Only then allow the intended TLS-protected network exposure.

### 16. Rollback

Application rollback to Phase 17 would reintroduce an unauthenticated main API. Before rolling back auth code, bind to loopback or remove untrusted ingress/firewall exposure and confirm collector connectivity is still scoped. Never present the Phase 17 app publicly as an auth rollback.

Then:

1. revoke all local sessions in PostgreSQL and clear browser cookies where possible;
2. roll back the application artifact/config while retaining `users`, `auth_sessions`, and `oidc_auth_flows` tables for forensic review and safe forward recovery;
3. do not run `push-force` or drop columns/tables during emergency rollback;
4. remove/disable the provider callback and rotate the OIDC client secret if compromise is suspected;
5. fix forward, reapply schema readiness checks, restore the auth deployment, and re-run bootstrap only if the database truly has no users and the explicit pair is restored intentionally.

A provider outage alone is not a reason to roll back: existing sessions and logout remain local. A bad auth release should normally be fixed forward behind restricted ingress. Destructive schema rollback requires a separately reviewed migration/backup plan.

## Consequences

### Positive

- Identity is portable across conforming issuers and Replit is configuration, not a code fork.
- Provider tokens are not browser sessions and are not retained.
- Local, revocable, hashed sessions continue through provider outages.
- Explicit bootstrap avoids first-request-wins and email/username account takeover.
- Default guarding and collector isolation make route exposure testable.

### Costs and limitations

- PostgreSQL is required for login flows and every authenticated API request.
- A user whose local session expires cannot log in during a provider outage.
- Phase 18 is effectively a provisioned-user/single-initial-user system until Phase 19 adds administration and roles.
- Local HTTP requires a different non-`__Host-` cookie name.
- Current Replit documentation does not expose manual confidential-client setup; deployment credentials must be confirmed before Replit rollout.
- Current pre-migration `drizzle-kit push` increases operational care and makes backup/review mandatory.

## Alternatives rejected

- **Replit-only auth middleware/headers:** not portable, couples trust to hosting headers, and conflicts with explicit OIDC configuration.
- **Passwords:** creates credential storage/recovery scope and violates Phase 18.
- **JWT browser sessions:** harder immediate revocation and unnecessary token/claim exposure; LabOps already depends on PostgreSQL.
- **`express-session` default stores or in-memory flow state:** unsuitable across restarts/replicas and does not meet PostgreSQL/hash requirements.
- **Email/username identity mapping:** mutable and collision-prone; only issuer + subject is stable.
- **First successful login wins:** allows race/account takeover and is not explicit bootstrap.
- **Provider introspection on every request:** makes provider availability part of the main API data path.
- **Development bypass enabled by environment/header:** too easy to expose; real OIDC or test-only dependency injection is required.
- **Changing collector auth to browser sessions:** mixes machine and human trust boundaries and is outside scope.

## Sources

[1] https://docs.replit.com/features/auth-and-identity/authentication — Replit Auth documentation
[2] https://replit.com/oidc/.well-known/openid-configuration — Replit OIDC discovery metadata
[3] https://github.com/panva/openid-client/tree/v6.8.5 — openid-client v6.8.5 documentation
[4] https://github.com/panva/openid-client/blob/v6.8.5/docs/functions/discovery.md — openid-client discovery API
[5] https://github.com/panva/openid-client/blob/v6.8.5/docs/functions/authorizationCodeGrant.md — openid-client authorizationCodeGrant API
[6] https://github.com/panva/openid-client/blob/v6.8.5/docs/functions/buildEndSessionUrl.md — openid-client buildEndSessionUrl API
[7] https://www.rfc-editor.org/rfc/rfc9700.html — RFC 9700: OAuth 2.0 Security Best Current Practice
[8] https://openid.net/specs/openid-connect-core-1_0-final.html — OpenID Connect Core 1.0
[9] https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html — OWASP Session Management Cheat Sheet
[10] https://www.rfc-editor.org/rfc/rfc7636.html — RFC 7636: PKCE
[11] https://openid.net/specs/openid-connect-rpinitiated-1_0-final.html — OpenID Connect RP-Initiated Logout 1.0
