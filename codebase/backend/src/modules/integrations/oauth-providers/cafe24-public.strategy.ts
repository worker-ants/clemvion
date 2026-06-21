import { InternalServerErrorException } from '@nestjs/common';
import {
  type Cafe24AppType,
  type TokenRequestInput,
} from './oauth-provider-strategy';
import { Cafe24OAuthStrategyBase } from './cafe24-oauth.strategy';

/**
 * Cafe24 Public app — credentials come from env (`CAFE24_CLIENT_ID` /
 * `CAFE24_CLIENT_SECRET`, resolved by the facade into `envCredentials`). The
 * flow is initiated by us (standard begin → authorize URL).
 */
export class Cafe24PublicOAuthStrategy extends Cafe24OAuthStrategyBase {
  readonly appType: Cafe24AppType = 'public';

  protected resolveCredentials(input: TokenRequestInput): {
    clientId: string;
    clientSecret: string;
  } {
    const { clientId, clientSecret } = input.envCredentials;
    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException({
        code: 'OAUTH_CONFIG_MISSING',
        message: 'CAFE24_CLIENT_ID / CAFE24_CLIENT_SECRET env not configured',
      });
    }
    return { clientId, clientSecret };
  }
}

export const cafe24PublicOAuthStrategy = new Cafe24PublicOAuthStrategy();
