import { type OAuthProvider, readString } from './oauth-provider-strategy';
import { StandardOAuthStrategy } from './standard-oauth.strategy';

/** GitHub OAuth — RFC 6749 standard authorization-code flow. */
export class GitHubOAuthStrategy extends StandardOAuthStrategy {
  readonly provider: OAuthProvider = 'github';
  protected readonly authorizeUrl = 'https://github.com/login/oauth/authorize';
  protected readonly tokenUrl = 'https://github.com/login/oauth/access_token';

  extractProviderMeta(data: Record<string, unknown>): Record<string, unknown> {
    return { login: readString(data, 'login') };
  }
}

export const githubOAuthStrategy = new GitHubOAuthStrategy();
