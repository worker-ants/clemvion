import { type OAuthProvider, readString } from './oauth-provider-strategy';
import { StandardOAuthStrategy } from './standard-oauth.strategy';

/** Google OAuth — RFC 6749 standard authorization-code flow. */
export class GoogleOAuthStrategy extends StandardOAuthStrategy {
  readonly provider: OAuthProvider = 'google';
  protected readonly authorizeUrl =
    'https://accounts.google.com/o/oauth2/v2/auth';
  protected readonly tokenUrl = 'https://oauth2.googleapis.com/token';

  extractProviderMeta(data: Record<string, unknown>): Record<string, unknown> {
    return {
      account_email:
        readString(data, 'account_email') ?? readString(data, 'email'),
    };
  }
}

export const googleOAuthStrategy = new GoogleOAuthStrategy();
