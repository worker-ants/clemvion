import { BadRequestException } from '@nestjs/common';
import {
  type Cafe24AppType,
  type Cafe24BeginMeta,
  type TokenRequestInput,
} from './oauth-provider-strategy';
import { Cafe24OAuthStrategyBase } from './cafe24-oauth.strategy';

/**
 * Cafe24 Private app — Cafe24 OAuth cannot be initiated by us; the flow starts
 * from Cafe24 Developers' "테스트 실행" hitting our install App URL. Credentials
 * are supplied by the user at begin, persisted (encrypted) on the integration
 * row + the OAuth state `provider_meta`, and read back here for the exchange.
 */
export class Cafe24PrivateOAuthStrategy extends Cafe24OAuthStrategyBase {
  readonly appType: Cafe24AppType = 'private';

  protected resolveCredentials(input: TokenRequestInput): {
    clientId: string;
    clientSecret: string;
  } {
    const pm = (input.providerMeta ?? {}) as Partial<Cafe24BeginMeta>;
    if (!pm.client_id || !pm.client_secret) {
      throw new BadRequestException({
        code: 'CAFE24_PRIVATE_APP_CREDENTIALS_REQUIRED',
        message:
          'private app credentials missing on OAuth state — cannot exchange code',
      });
    }
    return { clientId: pm.client_id, clientSecret: pm.client_secret };
  }
}

export const cafe24PrivateOAuthStrategy = new Cafe24PrivateOAuthStrategy();
