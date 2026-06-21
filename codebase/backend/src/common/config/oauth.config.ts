import { registerAs } from '@nestjs/config';

/**
 * OAuth provider 자격증명 + redirect base URL namespace (refactor M-6 — Option B).
 *
 * 기존 `IntegrationOAuthService` 의 `process.env.{CAFE24,GOOGLE,GITHUB}_CLIENT_ID/SECRET`,
 * `FRONTEND_URL`/`APP_URL`, `OAUTH_STUB_MODE` 직접 접근을 ConfigService 로 중앙화한다.
 *
 * 동작 보존 계약:
 * - 미설정 값은 빈 문자열(`''`) — 호출부의 `if (!clientId)` (falsy) `OAUTH_CONFIG_MISSING`
 *   throw 와 `frontendUrl || appUrl || '<fallback>'` 체인이 그대로 유지된다.
 * - `google`/`github` 는 `service.oauthProvider` 동적 키 접근(`<PROVIDER>_CLIENT_ID`)을
 *   대체한다. cafe24 public-app 자격증명은 `cafe24.*`. makeshop 은 요청 body 로 받으므로
 *   env namespace 대상이 아니다.
 * - `stubModeRaw`: `OAUTH_STUB_MODE` raw flag. honored 판정(NODE_ENV gate)은
 *   `common/utils/oauth-stub-mode.ts` (`isOAuthStubModeAllowed`) 가 단일 source.
 */
export interface OAuthEnvConfig {
  cafe24: { clientId: string; clientSecret: string };
  google: { clientId: string; clientSecret: string };
  github: { clientId: string; clientSecret: string };
  stubModeRaw: string;
  frontendUrl: string;
  appUrl: string;
}

/**
 * 미설정/테스트 폴백용 빈 OAuth env 의 단일 SoT (review W4·Maintainability#5).
 * **factory** 인 이유: 소비자(서비스 getter, 테스트 mock)가 nested 객체를 mutate 할 수 있어
 * 공유 frozen 싱글턴은 cross-test 누수를 유발한다 — 매 호출 fresh nested 객체를 반환한다.
 */
export function emptyOAuthEnvConfig(): OAuthEnvConfig {
  return {
    cafe24: { clientId: '', clientSecret: '' },
    google: { clientId: '', clientSecret: '' },
    github: { clientId: '', clientSecret: '' },
    stubModeRaw: '',
    frontendUrl: '',
    appUrl: '',
  };
}

export const oauthConfig = registerAs(
  'oauth',
  (): OAuthEnvConfig => ({
    cafe24: {
      clientId: process.env.CAFE24_CLIENT_ID ?? '',
      clientSecret: process.env.CAFE24_CLIENT_SECRET ?? '',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
    stubModeRaw: process.env.OAUTH_STUB_MODE ?? '',
    frontendUrl: process.env.FRONTEND_URL ?? '',
    appUrl: process.env.APP_URL ?? '',
  }),
);
