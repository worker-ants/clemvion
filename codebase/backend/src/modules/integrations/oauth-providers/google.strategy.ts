import {
  type AuthorizeUrlInput,
  type IdentityRequestSpec,
  type OAuthProvider,
  readString,
} from './oauth-provider-strategy';
import { StandardOAuthStrategy } from './standard-oauth.strategy';

/**
 * userinfo 조회에 필요한 권한 범위. 사용자가 고른 묶음과 상관없이 늘 요청한다(CLE-T-81270P).
 * Google 토큰 응답에는 계정 이메일이 없어서 userinfo 로 `account_email` 을 채운다.
 */
const GOOGLE_IDENTITY_SCOPES = ['openid', 'email'] as const;

/** Google OAuth — RFC 6749 standard authorization-code flow. */
export class GoogleOAuthStrategy extends StandardOAuthStrategy {
  readonly provider: OAuthProvider = 'google';
  protected readonly authorizeUrl =
    'https://accounts.google.com/o/oauth2/v2/auth';
  protected readonly tokenUrl = 'https://oauth2.googleapis.com/token';

  /**
   * 계정 조회용 권한 범위를 앞에 더하고 `access_type=offline` · `prompt=consent` 를 붙인다. Google 은 이 둘이
   * 없으면 refresh_token 을 주지 않고, 이미 동의한 계정에는 다시 주지 않는다. 저장 필드 `refresh_token` 이 필수라
   * 연결할 때마다 받아야 한다.
   */
  buildAuthorizeUrl(input: AuthorizeUrlInput): string {
    const scopes = [...new Set([...GOOGLE_IDENTITY_SCOPES, ...input.scopes])];
    const url = new URL(super.buildAuthorizeUrl({ ...input, scopes }));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    return url.toString();
  }

  extractProviderMeta(data: Record<string, unknown>): Record<string, unknown> {
    return {
      account_email:
        readString(data, 'account_email') ?? readString(data, 'email'),
    };
  }

  buildIdentityRequest(accessToken: string): IdentityRequestSpec {
    return {
      url: 'https://openidconnect.googleapis.com/v1/userinfo',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    };
  }

  extractIdentity(
    data: Record<string, unknown>,
  ): Record<string, string> | null {
    const email = readString(data, 'email');
    return email ? { account_email: email } : null;
  }

  protected stubIdentity(): Record<string, string> {
    return { account_email: 'stub-user@example.com' };
  }
}

export const googleOAuthStrategy = new GoogleOAuthStrategy();
