import {
  emptyOAuthEnvConfig,
  type OAuthEnvConfig,
} from '../../../common/config';

/**
 * refactor M-6 — `IntegrationOAuthService` 테스트용 ConfigService 최소 mock.
 *
 * provider 자격증명·redirect URL·OAUTH_STUB_MODE 가 `process.env` 직접 접근에서
 * `oauth` namespace 로 이전됨에 따라, 옛 `process.env.{CAFE24,GOOGLE,...}_CLIENT_ID`
 * 런타임 set 패턴을 본 가변 `env` 객체 mutation 으로 대체한다. 서비스가 메서드 호출
 * 시점에 `configService.get('oauth')` 를 읽으므로, 테스트는 호출 직전 `mock.env.*` 를
 * 수정하면 된다 (생성자 5번째 인자로 `mock.configService` 전달).
 *
 * jest 타입 비의존 (build tsc 가 `__test-utils__` 를 컴파일하므로 의도적으로 plain 함수).
 */
export interface OAuthConfigMock {
  /** 가변 oauth env — 테스트가 직접 필드를 수정한다. */
  env: OAuthEnvConfig;
  /** `IntegrationOAuthService` 생성자의 configService(5번째) 인자. */
  configService: { get: (key: string) => unknown };
}

export function makeOAuthConfigMock(
  overrides: Partial<OAuthEnvConfig> = {},
): OAuthConfigMock {
  const env: OAuthEnvConfig = { ...emptyOAuthEnvConfig(), ...overrides };
  return {
    env,
    configService: {
      // review W3: 'oauth' 외 키 접근은 silent undefined 대신 명시 throw — 미래에
      // IntegrationOAuthService 가 새 namespace 를 읽기 시작하면 본 mock 확장을 강제한다.
      get: (key: string) => {
        if (key !== 'oauth') {
          throw new Error(
            `makeOAuthConfigMock: 예상치 못한 config 키 '${key}' (현재 'oauth' 만 지원). ` +
              `소비자가 새 namespace 를 읽으면 본 mock 을 확장하라.`,
          );
        }
        return env;
      },
    },
  };
}
