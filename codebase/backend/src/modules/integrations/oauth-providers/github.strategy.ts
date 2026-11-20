import {
  type IdentityRequestSpec,
  type OAuthProvider,
  readString,
} from './oauth-provider-strategy';
import { StandardOAuthStrategy } from './standard-oauth.strategy';

/** GitHub OAuth — RFC 6749 standard authorization-code flow. */
export class GitHubOAuthStrategy extends StandardOAuthStrategy {
  readonly provider: OAuthProvider = 'github';
  protected readonly authorizeUrl = 'https://github.com/login/oauth/authorize';
  protected readonly tokenUrl = 'https://github.com/login/oauth/access_token';

  extractProviderMeta(data: Record<string, unknown>): Record<string, unknown> {
    return { login: readString(data, 'login') };
  }

  /** 토큰 응답에 `login` 이 없어서 `/user` 로 채운다(CLE-T-81270P). 이 API 는 User-Agent 가 없으면 거절한다. */
  buildIdentityRequest(accessToken: string): IdentityRequestSpec {
    return {
      url: 'https://api.github.com/user',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Clemvion',
      },
    };
  }

  extractIdentity(
    data: Record<string, unknown>,
  ): Record<string, string> | null {
    const login = readString(data, 'login');
    return login ? { login } : null;
  }

  protected stubIdentity(): Record<string, string> {
    return { login: 'stub-user' };
  }
}

export const githubOAuthStrategy = new GitHubOAuthStrategy();
