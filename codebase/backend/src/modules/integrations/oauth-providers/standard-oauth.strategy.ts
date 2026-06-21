import { InternalServerErrorException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  type AuthorizeUrlInput,
  type OAuthProvider,
  type OAuthProviderStrategy,
  type TokenExchangeResult,
  type TokenRequestInput,
  type TokenRequestSpec,
  readNumber,
} from './oauth-provider-strategy';

/**
 * RFC 6749 standard authorization-code flow shared by providers with a single
 * global authorize/token endpoint (google, github). Differences between those
 * providers are limited to the endpoint URLs and the metadata extracted from
 * the token response, expressed by the abstract members below.
 *
 * Standard-flow conventions (vs cafe24/makeshop deviations):
 *  - space-delimited scopes (RFC 6749 §3.3),
 *  - client credentials sent in the request **body** (RFC 6749 §2.3.1) — no
 *    Basic auth header,
 *  - `expires_in` is the sole expiry signal.
 */
export abstract class StandardOAuthStrategy implements OAuthProviderStrategy {
  abstract readonly provider: OAuthProvider;
  protected abstract readonly authorizeUrl: string;
  protected abstract readonly tokenUrl: string;

  buildAuthorizeUrl(input: AuthorizeUrlInput): string {
    const params = new URLSearchParams({
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      scope: input.scopes.join(' '),
      state: input.state,
      response_type: 'code',
    });
    return `${this.authorizeUrl}?${params.toString()}`;
  }

  buildTokenRequest(input: TokenRequestInput): TokenRequestSpec {
    const { clientId, clientSecret } = input.envCredentials;
    if (!clientId || !clientSecret) {
      const clientIdKey = `${this.provider.toUpperCase()}_CLIENT_ID`;
      const clientSecretKey = `${this.provider.toUpperCase()}_CLIENT_SECRET`;
      throw new InternalServerErrorException({
        code: 'OAUTH_CONFIG_MISSING',
        message: `OAuth credentials (${clientIdKey}, ${clientSecretKey}) are not configured`,
      });
    }
    // RFC 6749 §2.3.1 — client creds in the body (cafe24/makeshop use Basic
    // auth instead; sending both is rejected by cafe24).
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
    });
    return {
      tokenUrl: this.tokenUrl,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    };
  }

  parseTokenExpiresAt(data: Record<string, unknown>): Date | null {
    const expiresIn = readNumber(data, 'expires_in');
    return expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
  }

  abstract extractProviderMeta(
    data: Record<string, unknown>,
  ): Record<string, unknown>;

  buildStubResult(
    requestedScopes: string[],
    _beginMeta: Record<string, unknown> | null,
  ): TokenExchangeResult {
    // Standard providers — access_token TTL ~30d in stub mode.
    return {
      accessToken: `stub-${this.provider}-${randomBytes(8).toString('hex')}`,
      refreshToken: `stub-refresh-${randomBytes(8).toString('hex')}`,
      scopes: requestedScopes,
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      providerMeta: { stub: true },
    };
  }
}
