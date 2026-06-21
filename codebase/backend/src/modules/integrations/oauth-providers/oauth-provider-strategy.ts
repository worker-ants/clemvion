/**
 * OAuth provider strategy contract (refactor M-2).
 *
 * `IntegrationOAuthService` (facade) historically interleaved five OAuth
 * protocols (google / github / cafe24-public / cafe24-private / makeshop) in a
 * single 2,600-line class — `begin`, `exchangeCodeForToken`,
 * `normalizeTokenResponse`, `parseTokenExpiresAt`, `stubTokenResult` each
 * carried a provider `if/else` chain. This module factors the **pure,
 * stateless protocol decisions** of each provider behind a single interface so
 * a provider change touches exactly one strategy file (plan
 * `plan/in-progress/refactor/02-architecture.md` §M-2, recommended Option A).
 *
 * What stays in the facade (NOT here): OAuth state / preview-token lifecycle,
 * the install-token security guards (HMAC / nonce / rate-limit), pending-install
 * row creation, duplicate prechecks, the token-exchange HTTP execution, and the
 * credential assembly. Strategies are pure (no DI, no DB) — instantiated as
 * module-level singletons and resolved via `./index#resolveOAuthStrategy`.
 *
 * spec discretion: `spec/2-navigation/4-integration.md` Rationale records that
 * "provider 별 분리인지 파라메트릭인지는 구현 세부 사항" — the data-flow
 * participant `IntegrationOauthService` (facade name) is unchanged, so the
 * sequence diagrams are unaffected.
 */

export const ALLOWED_OAUTH_PROVIDERS = [
  'google',
  'github',
  'cafe24',
  'makeshop',
] as const;
export type OAuthProvider = (typeof ALLOWED_OAUTH_PROVIDERS)[number];

/** Cafe24 has two app variants that differ only in credential source. */
export type Cafe24AppType = 'public' | 'private';

/**
 * Begin-time metadata for cafe24 OAuth (also persisted on the state row's
 * `provider_meta` JSONB column until callback consumption). Public apps may
 * omit `client_id`/`client_secret` (env-provided); private apps must supply
 * both — the values exist on the wire only for the state TTL (10 min).
 */
export interface Cafe24BeginMeta {
  mall_id: string;
  app_type: Cafe24AppType;
  client_id?: string;
  client_secret?: string;
}

/**
 * Begin-time metadata for makeshop OAuth. MakeShop is a confidential-client-only
 * app (no public/private split like cafe24) — the user always supplies
 * `client_id`/`client_secret`. `shop_uid` is NOT known at begin time: it is
 * learned from the ShopStore install redirect's `?shop_uid=...` parameter and
 * projected onto the `mall_id` column at callback. spec/2-navigation/4-
 * integration.md §5.9, spec/4-nodes/4-integration/5-makeshop.md §9.1.
 */
export interface MakeshopBeginMeta {
  client_id: string;
  client_secret: string;
}

/** Normalized token-exchange result shared across facade and strategies. */
export interface TokenExchangeResult {
  accessToken: string;
  refreshToken: string | null;
  scopes: string[];
  tokenExpiresAt: Date | null;
  providerMeta: Record<string, unknown>;
}

/** Inputs for `buildAuthorizeUrl` — superset across providers. */
export interface AuthorizeUrlInput {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  /** cafe24: mall_id (mall_id-dependent authorize host). */
  mallId?: string;
  /** makeshop: PKCE S256 `code_challenge` (OAuth 2.1). */
  codeChallenge?: string;
}

/** Inputs for `buildTokenRequest`. */
export interface TokenRequestInput {
  code: string;
  redirectUri: string;
  /**
   * Decrypted OAuth state `provider_meta` — cafe24 carries mall_id/app_type
   * (+ private-app creds); makeshop carries client creds + `code_verifier`.
   */
  providerMeta: Record<string, unknown> | null;
  /** Env-resolved client credentials (google/github/cafe24-public). */
  envCredentials: { clientId: string; clientSecret: string };
}

/** Resolved HTTP request the facade executes for the token exchange. */
export interface TokenRequestSpec {
  tokenUrl: string;
  headers: Record<string, string>;
  body: URLSearchParams;
}

/** Provider-specific post-exchange diagnostics (logged by the facade). */
export interface ExchangeDiagnostics {
  warnings: string[];
  info: string[];
}

/**
 * The pure, per-provider OAuth protocol surface. Implementations are stateless
 * singletons — all state (env config, repositories, nonce cache) lives in the
 * facade and is passed in via the input objects.
 */
export interface OAuthProviderStrategy {
  readonly provider: OAuthProvider;
  /** cafe24 public/private discriminator; `undefined` for other providers. */
  readonly appType?: Cafe24AppType;

  /**
   * Build the authorize URL. Encapsulates the base authorize endpoint (static
   * vs mall_id-dependent), the scope separator (cafe24 `,` vs RFC `' '`), and
   * any extra params (makeshop PKCE S256 challenge).
   */
  buildAuthorizeUrl(input: AuthorizeUrlInput): string;

  /**
   * Resolve the token-exchange HTTP request: token URL, headers (Basic auth
   * for cafe24/makeshop vs none for RFC providers) and form body (PKCE
   * `code_verifier` for makeshop; client creds in body for google/github;
   * bare for cafe24). Throws the same provider-specific config / credential
   * errors as the legacy inline branches.
   */
  buildTokenRequest(input: TokenRequestInput): TokenRequestSpec;

  /** Resolve the access_token expiry instant from the token response. */
  parseTokenExpiresAt(data: Record<string, unknown>): Date | null;

  /** Extract provider-specific metadata from the token response. */
  extractProviderMeta(data: Record<string, unknown>): Record<string, unknown>;

  /** Stub-mode token result (NODE_ENV=test/development OAUTH_STUB_MODE). */
  buildStubResult(
    requestedScopes: string[],
    beginMeta: Record<string, unknown> | null,
  ): TokenExchangeResult;

  /**
   * Optional post-exchange diagnostics (e.g. cafe24 mall_id / scope mismatch).
   * Returns log lines for the facade to emit; `null`/absent = nothing to log.
   */
  describeExchange?(
    result: TokenExchangeResult,
    requestedScopes: string[],
    providerMeta: Record<string, unknown> | null,
  ): ExchangeDiagnostics | null;
}

/** Read a non-empty string field off a parsed JSON object, else null. */
export function readString(
  obj: Record<string, unknown>,
  key: string,
): string | null {
  const v = obj[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** Read a finite number field off a parsed JSON object, else null. */
export function readNumber(
  obj: Record<string, unknown>,
  key: string,
): number | null {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
