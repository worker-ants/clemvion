import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { parseJwtExp } from '../jwt-exp';
import { normalizeCafe24IsoTimezone } from '../cafe24-token-utils';
import {
  type AuthorizeUrlInput,
  type Cafe24AppType,
  type Cafe24BeginMeta,
  type ExchangeDiagnostics,
  type OAuthProvider,
  type OAuthProviderStrategy,
  type TokenExchangeResult,
  type TokenRequestInput,
  type TokenRequestSpec,
  readNumber,
  readString,
} from './oauth-provider-strategy';

/** Cafe24 is mall_id-dependent — both authorize and token hosts embed it. */
export function cafe24AuthorizeUrl(mallId: string): string {
  return `https://${mallId}.cafe24api.com/api/v2/oauth/authorize`;
}

export function cafe24TokenUrl(mallId: string): string {
  return `https://${mallId}.cafe24api.com/api/v2/oauth/token`;
}

/**
 * Shared Cafe24 OAuth protocol. Public and private apps differ **only** in
 * where the client credentials come from (env vs the request body persisted on
 * the state row) — every other protocol detail (mall_id-dependent host,
 * comma-delimited scopes, Basic-auth token exchange, JWT-`exp` expiry
 * precedence, operator/mall metadata) is identical and lives here.
 *
 * The install-token security flow (HMAC / nonce / recovery) stays in the
 * facade; this strategy only supplies the authorize URL + token request the
 * facade wraps with that machinery.
 */
export abstract class Cafe24OAuthStrategyBase implements OAuthProviderStrategy {
  readonly provider: OAuthProvider = 'cafe24';
  abstract readonly appType: Cafe24AppType;

  /** Resolve client credentials (env for public, state body for private). */
  protected abstract resolveCredentials(input: TokenRequestInput): {
    clientId: string;
    clientSecret: string;
  };

  buildAuthorizeUrl(input: AuthorizeUrlInput): string {
    const mallId = input.mallId;
    if (!mallId) {
      throw new BadRequestException({
        code: 'CAFE24_INVALID_MALL_ID',
        message: 'mall_id is required to build the Cafe24 authorize URL',
      });
    }
    // Cafe24 deviates from RFC 6749 §3.3 (space-delimited) and requires
    // comma-delimited scopes on /oauth/authorize. Sending space-delimited
    // scopes is rejected with `invalid_scope` even for a single valid scope.
    const params = new URLSearchParams({
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      scope: input.scopes.join(','),
      state: input.state,
      response_type: 'code',
    });
    return `${cafe24AuthorizeUrl(mallId)}?${params.toString()}`;
  }

  buildTokenRequest(input: TokenRequestInput): TokenRequestSpec {
    const pm = (input.providerMeta ?? {}) as Partial<Cafe24BeginMeta>;
    if (!pm.mall_id) {
      throw new BadRequestException({
        code: 'CAFE24_INVALID_MALL_ID',
        message: 'mall_id missing on OAuth state — cannot build token URL',
      });
    }
    const { clientId, clientSecret } = this.resolveCredentials(input);
    // Cafe24 의 token endpoint 는 **Basic auth only** 요구. body 에
    // client_id/client_secret 을 같이 넣으면 `invalid_request` 로 거부된다
    // (2026-05-15 운영 보고). spec/2-navigation/4-integration.md §3.2.
    const body = new URLSearchParams({
      code: input.code,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
    });
    return {
      tokenUrl: cafe24TokenUrl(pm.mall_id),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body,
    };
  }

  /**
   * Cafe24 access_token / refresh_token are JWTs, so the `exp` claim is the
   * single source of truth. Precedence: JWT exp > standard `expires_in` >
   * `expires_at` ISO (TZ-less normalized to +09:00 KST) > 2h documented TTL.
   * spec/2-navigation/4-integration.md Rationale "Cafe24 token 만료 SoT — JWT
   * exp 격상 (2026-05-18)".
   */
  parseTokenExpiresAt(data: Record<string, unknown>): Date | null {
    const accessToken = readString(data, 'access_token');
    const jwtExpMs = parseJwtExp(accessToken);
    if (jwtExpMs !== null) return new Date(jwtExpMs);

    const expiresIn = readNumber(data, 'expires_in');
    if (expiresIn) return new Date(Date.now() + expiresIn * 1000);

    const expiresAtStr = readString(data, 'expires_at');
    if (expiresAtStr) {
      const normalized = normalizeCafe24IsoTimezone(expiresAtStr);
      const parsed = Date.parse(normalized);
      if (Number.isFinite(parsed)) return new Date(parsed);
    }

    return new Date(Date.now() + 2 * 60 * 60 * 1000);
  }

  extractProviderMeta(data: Record<string, unknown>): Record<string, unknown> {
    const providerMeta: Record<string, unknown> = {};
    // Cafe24 token response carries `user_id` (operator account). Renamed to
    // `cafe24_operator_id` to avoid confusion with internal `User.id`.
    const operator = readString(data, 'user_id');
    if (operator) providerMeta.cafe24_operator_id = operator;
    // Cafe24 echoes mall_id — capture as a sanity check.
    const mallId = readString(data, 'mall_id');
    if (mallId) providerMeta.cafe24_response_mall_id = mallId;
    return providerMeta;
  }

  buildStubResult(
    requestedScopes: string[],
    beginMeta: Record<string, unknown> | null,
  ): TokenExchangeResult {
    const providerMeta: Record<string, unknown> = { stub: true };
    providerMeta.cafe24_operator_id = `stub-operator-${randomBytes(4).toString('hex')}`;
    const pmMall =
      beginMeta && typeof beginMeta.mall_id === 'string'
        ? beginMeta.mall_id
        : null;
    if (pmMall) providerMeta.cafe24_response_mall_id = pmMall;
    return {
      accessToken: `stub-${this.provider}-${randomBytes(8).toString('hex')}`,
      refreshToken: `stub-refresh-${randomBytes(8).toString('hex')}`,
      scopes: requestedScopes,
      tokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      providerMeta,
    };
  }

  describeExchange(
    result: TokenExchangeResult,
    requestedScopes: string[],
    providerMeta: Record<string, unknown> | null,
  ): ExchangeDiagnostics {
    const pm = (providerMeta ?? {}) as Partial<Cafe24BeginMeta>;
    const warnings: string[] = [];
    const info: string[] = [];
    const echoMallId =
      typeof result.providerMeta?.cafe24_response_mall_id === 'string'
        ? result.providerMeta.cafe24_response_mall_id
        : null;
    if (echoMallId && pm.mall_id && echoMallId !== pm.mall_id) {
      warnings.push(
        `Cafe24 token mall_id mismatch: requested=${pm.mall_id} echoed=${echoMallId} — subsequent API calls against ${pm.mall_id} will 403`,
      );
    }
    const missingScopes = requestedScopes.filter(
      (s) => !result.scopes.includes(s),
    );
    if (missingScopes.length > 0) {
      warnings.push(
        `Cafe24 granted fewer scopes than requested for mall=${pm.mall_id ?? echoMallId ?? 'unknown'}: requested=${requestedScopes.join(',')} granted=${result.scopes.join(',')} missing=${missingScopes.join(',')}`,
      );
    }
    info.push(
      `Cafe24 token exchange succeeded: mall_id=${echoMallId ?? pm.mall_id ?? 'unknown'} granted_scopes=${result.scopes.join(',')} expires_at=${result.tokenExpiresAt?.toISOString() ?? 'none'}`,
    );
    return { warnings, info };
  }
}
