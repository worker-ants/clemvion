import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { parseJwtExp } from '../jwt-exp';
import {
  type AuthorizeUrlInput,
  type MakeshopBeginMeta,
  type OAuthProvider,
  type OAuthProviderStrategy,
  type TokenExchangeResult,
  type TokenRequestInput,
  type TokenRequestSpec,
  readNumber,
  readString,
} from './oauth-provider-strategy';

/**
 * MakeShop OAuth (OAuth 2.1 + PKCE, confidential client) fixed hosts.
 * `auth.makeshop.com` is the authorize/token host (data-call host
 * `connect.makeshop.co.kr` is separate). spec/2-navigation/4-integration.md
 * §5.9 + spec/4-nodes/4-integration/5-makeshop.md §9.1.
 *
 * ⚠ VERIFY against makeshop docs before production — keep in sync with the
 * token refresh path (`makeshop-api.client.ts`).
 */
const MAKESHOP_AUTHORIZE_URL = 'https://auth.makeshop.com/oauth/authorize';
const MAKESHOP_TOKEN_URL = 'https://auth.makeshop.com/oauth/token';

/**
 * MakeShop OAuth strategy. Confidential-client-only (no public/private split):
 * the user supplies client_id/client_secret, persisted on the state row and
 * read back here. OAuth 2.1 mandates PKCE S256 (verifier stashed on the state
 * `provider_meta` in the facade's install flow, presented as `code_verifier`
 * during the exchange) and space-delimited scopes.
 */
export class MakeshopOAuthStrategy implements OAuthProviderStrategy {
  readonly provider: OAuthProvider = 'makeshop';

  buildAuthorizeUrl(input: AuthorizeUrlInput): string {
    if (!input.codeChallenge) {
      throw new BadRequestException({
        code: 'MAKESHOP_PKCE_REQUIRED',
        message:
          'PKCE code_challenge is required to build the MakeShop authorize URL',
      });
    }
    // MakeShop follows OAuth 2.1 — SPACE-separated scopes (NOT cafe24's comma).
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      scope: input.scopes.join(' '),
      state: input.state,
      code_challenge: input.codeChallenge,
      code_challenge_method: 'S256',
    });
    return `${MAKESHOP_AUTHORIZE_URL}?${params.toString()}`;
  }

  buildTokenRequest(input: TokenRequestInput): TokenRequestSpec {
    const pm = (input.providerMeta ?? {}) as Partial<MakeshopBeginMeta> & {
      code_verifier?: string;
    };
    if (!pm.client_id || !pm.client_secret) {
      throw new BadRequestException({
        code: 'MAKESHOP_CREDENTIALS_REQUIRED',
        message:
          'makeshop client credentials missing on OAuth state — cannot exchange code',
      });
    }
    // MakeShop: confidential client → Basic auth (client creds in header, NOT
    // body) + PKCE code_verifier. spec/2-navigation/4-integration.md §5.9.
    const params: Record<string, string> = {
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
    };
    if (pm.code_verifier) params.code_verifier = pm.code_verifier;
    return {
      tokenUrl: MAKESHOP_TOKEN_URL,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${pm.client_id}:${pm.client_secret}`).toString('base64')}`,
      },
      body: new URLSearchParams(params),
    };
  }

  /**
   * MakeShop — access_token TTL ~1h. `expires_in` (seconds) first, then
   * `expires_at` ISO, then JWT `exp` if the token happens to be a JWT, finally
   * a 1h default. Same precedence as `makeshop-api.client.ts`. spec §5.9.
   */
  parseTokenExpiresAt(data: Record<string, unknown>): Date | null {
    const expiresIn = readNumber(data, 'expires_in');
    if (expiresIn) return new Date(Date.now() + expiresIn * 1000);
    const expiresAtStr = readString(data, 'expires_at');
    if (expiresAtStr) {
      const parsed = Date.parse(expiresAtStr);
      if (Number.isFinite(parsed)) return new Date(parsed);
    }
    const jwtExpMs = parseJwtExp(readString(data, 'access_token'));
    if (jwtExpMs !== null) return new Date(jwtExpMs);
    return new Date(Date.now() + 60 * 60 * 1000);
  }

  extractProviderMeta(_data: Record<string, unknown>): Record<string, unknown> {
    // MakeShop token response carries no extra metadata to persist (shop_uid is
    // mirrored from the state's provider_meta by the facade, not the response).
    return {};
  }

  buildStubResult(
    requestedScopes: string[],
    beginMeta: Record<string, unknown> | null,
  ): TokenExchangeResult {
    const providerMeta: Record<string, unknown> = { stub: true };
    const pmShop =
      beginMeta && typeof beginMeta.shop_uid === 'string'
        ? beginMeta.shop_uid
        : null;
    if (pmShop) providerMeta.makeshop_response_shop_uid = pmShop;
    return {
      accessToken: `stub-${this.provider}-${randomBytes(8).toString('hex')}`,
      refreshToken: `stub-refresh-${randomBytes(8).toString('hex')}`,
      scopes: requestedScopes,
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      providerMeta,
    };
  }
}

export const makeshopOAuthStrategy = new MakeshopOAuthStrategy();
