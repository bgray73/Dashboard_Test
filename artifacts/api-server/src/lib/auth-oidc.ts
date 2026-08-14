import { createHash } from "node:crypto";
import type { Pool } from "pg";
import * as oidc from "openid-client";
import type { ValidatedIdentity } from "./auth-store";
import type { AuthRuntimeConfig } from "./runtime-config";

export class InvalidCallbackError extends Error {
  constructor() {
    super("Invalid authentication callback.");
    this.name = "InvalidCallbackError";
  }
}
export class ProviderUnavailableError extends Error {
  constructor() {
    super("Authentication provider unavailable.");
    this.name = "ProviderUnavailableError";
  }
}

export function classifyOidcExchangeError(
  error: unknown,
): InvalidCallbackError | ProviderUnavailableError {
  if (
    error instanceof InvalidCallbackError ||
    error instanceof ProviderUnavailableError
  )
    return error;
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (
      current instanceof TypeError ||
      (current instanceof DOMException &&
        ["AbortError", "TimeoutError"].includes(current.name)) ||
      current instanceof oidc.WWWAuthenticateChallengeError ||
      (current instanceof oidc.ResponseBodyError && current.status >= 500) ||
      (current instanceof Error &&
        (["AbortError", "TimeoutError"].includes(current.name) ||
          (current as Error & { code?: string }).code === "OAUTH_TIMEOUT"))
    ) {
      return new ProviderUnavailableError();
    }
    current =
      current instanceof Error
        ? (current as Error & { cause?: unknown }).cause
        : undefined;
  }
  return new InvalidCallbackError();
}

export type OidcMetadata = {
  issuer: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  responseTypesSupported: string[];
  pkceMethodsSupported: string[];
  tokenAuthMethodsSupported: string[];
};

const loopbackHostnames = new Set(["127.0.0.1", "localhost", "::1"]);

function validateDiscoveredEndpointUrls(
  metadata: oidc.ServerMetadata,
  allowLoopbackHttp: boolean,
) {
  for (const [name, value] of Object.entries(metadata)) {
    if (
      typeof value !== "string" ||
      (name !== "jwks_uri" && !name.endsWith("_endpoint"))
    )
      continue;
    let endpoint: URL;
    try {
      endpoint = new URL(value);
    } catch {
      throw new InvalidCallbackError();
    }
    if (
      endpoint.protocol !== "https:" &&
      !(
        allowLoopbackHttp &&
        endpoint.protocol === "http:" &&
        loopbackHostnames.has(endpoint.hostname)
      )
    ) {
      throw new InvalidCallbackError();
    }
  }
}

export interface OidcProtocol {
  discover(): Promise<OidcMetadata>;
  createAuthorization(): Promise<{
    url: URL;
    state: string;
    nonce: string;
    verifier: string;
  }>;
  exchange(
    callbackUrl: URL,
    expected: { state: string; nonce: string; verifier: string },
  ): Promise<ValidatedIdentity & { providerTokensDisposed?: boolean }>;
}

export class OpenidClientV6Protocol implements OidcProtocol {
  private cached?: {
    config: oidc.Configuration;
    metadata: OidcMetadata;
    refreshAt: number;
  };
  private pending?: Promise<{
    config: oidc.Configuration;
    metadata: OidcMetadata;
    refreshAt: number;
  }>;

  constructor(private readonly settings: AuthRuntimeConfig) {}

  private async configuration() {
    if (this.cached && this.cached.refreshAt > Date.now()) return this.cached;
    if (this.pending) return this.pending;
    this.pending = (async () => {
      const clientAuth =
        this.settings.clientAuthMethod === "client_secret_basic"
          ? oidc.ClientSecretBasic(this.settings.clientSecret)
          : oidc.ClientSecretPost(this.settings.clientSecret);
      const customFetch: typeof fetch = (input, init) => {
        const timeout = AbortSignal.timeout(this.settings.httpTimeoutMs);
        const signal = init?.signal
          ? AbortSignal.any([init.signal, timeout])
          : timeout;
        return fetch(input, { ...init, signal });
      };
      const issuer = new URL(this.settings.issuerUrl);
      const isLoopbackHttp =
        issuer.protocol === "http:" && loopbackHostnames.has(issuer.hostname);
      const config = await oidc.discovery(
        issuer,
        this.settings.clientId,
        { client_secret: this.settings.clientSecret },
        clientAuth,
        {
          [oidc.customFetch]: customFetch,
          timeout: Math.ceil(this.settings.httpTimeoutMs / 1_000),
          execute: [
            oidc.enableNonRepudiationChecks,
            ...(isLoopbackHttp ? [oidc.allowInsecureRequests] : []),
          ],
        },
      );
      const source = config.serverMetadata();
      validateDiscoveredEndpointUrls(source, isLoopbackHttp);
      const metadata: OidcMetadata = {
        issuer: source.issuer,
        authorizationEndpoint: source.authorization_endpoint,
        tokenEndpoint: source.token_endpoint,
        responseTypesSupported: source.response_types_supported ?? [],
        pkceMethodsSupported: source.code_challenge_methods_supported ?? [],
        tokenAuthMethodsSupported:
          source.token_endpoint_auth_methods_supported ?? [],
      };
      const value = { config, metadata, refreshAt: Date.now() + 300_000 };
      this.cached = value;
      return value;
    })();
    try {
      return await this.pending;
    } finally {
      this.pending = undefined;
    }
  }

  async discover(): Promise<OidcMetadata> {
    return (await this.configuration()).metadata;
  }

  async createAuthorization() {
    const { config } = await this.configuration();
    const verifier = oidc.randomPKCECodeVerifier();
    const challenge = await oidc.calculatePKCECodeChallenge(verifier);
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: `${this.settings.publicBaseUrl}/api/auth/callback`,
      scope: "openid profile email",
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      nonce,
    });
    return { url, state, nonce, verifier };
  }

  async exchange(
    callbackUrl: URL,
    expected: { state: string; nonce: string; verifier: string },
  ): Promise<ValidatedIdentity> {
    try {
      const { config, metadata } = await this.configuration();
      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: expected.verifier,
        expectedState: expected.state,
        expectedNonce: expected.nonce,
        idTokenExpected: true,
      });
      const claims = tokens.claims() as Record<string, unknown> | undefined;
      const issuer = claims?.iss;
      const subject = claims?.sub;
      if (
        typeof issuer !== "string" ||
        issuer !== metadata.issuer ||
        typeof subject !== "string" ||
        !subject
      )
        throw new InvalidCallbackError();
      const displayName = [
        claims?.name,
        claims?.preferred_username,
        claims?.username,
        subject,
      ].find((value) => typeof value === "string") as string;
      return {
        issuer,
        subject,
        displayName,
        email: typeof claims?.email === "string" ? claims.email : undefined,
        emailVerified:
          typeof claims?.email_verified === "boolean"
            ? claims.email_verified
            : undefined,
      };
    } catch (error) {
      throw classifyOidcExchangeError(error);
    }
  }
}

export class OidcService {
  constructor(
    private readonly pool: Pool,
    private readonly protocol: OidcProtocol,
    private readonly settings: {
      issuer: string;
      clientAuthMethod: "client_secret_basic" | "client_secret_post";
      flowTtlSeconds: number;
    },
  ) {}

  private async checkedMetadata(): Promise<OidcMetadata> {
    try {
      const metadata = await this.protocol.discover();
      if (
        metadata.issuer !== this.settings.issuer ||
        !metadata.authorizationEndpoint ||
        !metadata.tokenEndpoint ||
        !metadata.responseTypesSupported.includes("code") ||
        !metadata.pkceMethodsSupported.includes("S256") ||
        !metadata.tokenAuthMethodsSupported.includes(
          this.settings.clientAuthMethod,
        )
      ) {
        throw new Error("unsupported metadata");
      }
      return metadata;
    } catch {
      throw new ProviderUnavailableError();
    }
  }

  async beginLogin(): Promise<URL> {
    await this.checkedMetadata();
    try {
      const flow = await this.protocol.createAuthorization();
      await this.pool.query(
        `INSERT INTO oidc_auth_flows (state_hash,state,nonce,pkce_verifier,issuer,expires_at)
         VALUES ($1,$2,$3,$4,$5,now()+($6*interval '1 second'))`,
        [
          createHash("sha256").update(flow.state, "ascii").digest("hex"),
          flow.state,
          flow.nonce,
          flow.verifier,
          this.settings.issuer,
          this.settings.flowTtlSeconds,
        ],
      );
      return flow.url;
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw error;
      throw new ProviderUnavailableError();
    }
  }

  async completeCallback(
    callbackUrl: URL,
    returnedState: string,
  ): Promise<ValidatedIdentity> {
    const hash = createHash("sha256")
      .update(returnedState, "ascii")
      .digest("hex");
    const result = await this.pool.query<{
      state: string;
      nonce: string;
      pkce_verifier: string;
      issuer: string;
    }>(
      `DELETE FROM oidc_auth_flows WHERE state_hash=$1 AND expires_at>now() RETURNING state,nonce,pkce_verifier,issuer`,
      [hash],
    );
    const flow = result.rows[0];
    if (!flow || flow.issuer !== this.settings.issuer)
      throw new InvalidCallbackError();
    await this.checkedMetadata();
    try {
      const identity = await this.protocol.exchange(callbackUrl, {
        state: flow.state,
        nonce: flow.nonce,
        verifier: flow.pkce_verifier,
      });
      if (identity.issuer !== flow.issuer || !identity.subject)
        throw new InvalidCallbackError();
      return {
        issuer: identity.issuer,
        subject: identity.subject,
        email: identity.email,
        displayName: identity.displayName,
        emailVerified: identity.emailVerified,
      };
    } catch (error) {
      throw classifyOidcExchangeError(error);
    }
  }
}
