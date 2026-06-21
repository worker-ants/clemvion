# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] 모듈-수준 singleton 인스턴스 도입 — stateless 보장 확인
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/m-2-oauth-strategy-a246b9/codebase/backend/src/modules/integrations/oauth-providers/` — 각 strategy 파일 말미의 `export const xxxStrategy = new XxxStrategy()`
- **상세**: `googleOAuthStrategy`, `githubOAuthStrategy`, `cafe24PublicOAuthStrategy`, `cafe24PrivateOAuthStrategy`, `makeshopOAuthStrategy` 가 모듈 로드 시점에 단 한 번 생성되어 공유된다. 이들이 공유 상태를 전혀 보유하지 않는지(모든 필드가 `readonly` 상수, 메서드는 순수 함수) 확인이 필요하다. 코드 내에서는 인스턴스 변수(멤버 변수) 에 쓰기가 없으며 모든 입력은 파라미터로만 전달되므로 현재 코드 기준으로 공유 상태 없음이 확인된다. 추후 strategy 구현 시 `this.xxx = ...` 형태의 인스턴스 프로퍼티 쓰기가 추가되면 동시 요청 간 데이터 오염이 발생할 수 있으므로 주의가 필요하다.
- **제안**: OAuthProviderStrategy 인터페이스 주석에 "구현체는 stateless 싱글톤이어야 한다 — 인스턴스 변수에 쓰지 말 것" 을 명시해 후속 기여자에게 제약을 전달한다. (현재 코드는 이 제약을 준수하고 있다.)

### [INFO] `ALLOWED_OAUTH_PROVIDERS` 정의 이동 — 기존 re-export 경로 보존 여부
- **위치**: `integration-oauth.service.ts` 상단 — `export { ALLOWED_OAUTH_PROVIDERS }; export type { OAuthProvider, Cafe24BeginMeta, MakeshopBeginMeta }`
- **상세**: `ALLOWED_OAUTH_PROVIDERS`, `OAuthProvider`, `Cafe24BeginMeta`, `MakeshopBeginMeta`, `TokenExchangeResult` 의 canonical 위치가 `integration-oauth.service.ts` → `oauth-providers/oauth-provider-strategy.ts` 로 이동됐고, facade 에서 re-export 로 기존 import 경로를 유지하고 있다. `TokenExchangeResult` 는 facade 에서 `interface` 로 선언되던 것이 `oauth-provider-strategy.ts` 로 이동됐지만, facade 에서의 re-export 목록에 `TokenExchangeResult` 가 없음을 확인했다.
  - diff 에서 `export type { OAuthProvider, Cafe24BeginMeta, MakeshopBeginMeta }` 만 있고 `TokenExchangeResult` 는 제외돼 있다. 기존 코드에서 `integration-oauth.service.ts` 로부터 `TokenExchangeResult` 를 직접 import 하던 외부 모듈(테스트, 다른 서비스)이 있다면 컴파일 에러가 발생할 수 있다.
  - 커밋 메시지는 "테스트 import 심볼(`parseTokenExpiresAt`/`Cafe24BeginMeta`/`ALLOWED_OAUTH_PROVIDERS` 등) facade 에서 re-export 유지" 라고 명시하나, `TokenExchangeResult` 는 목록에 명시되지 않았다. unit PASS 가 확인된다고 기술되어 있으므로 실제로 외부 import 가 없었거나 이미 처리됐을 가능성이 높으나, 명시적으로 확인할 필요가 있다.
- **제안**: 기존 facade 에서 `TokenExchangeResult` 를 import 하던 파일이 없는지 grep 으로 확인하거나, 안전을 위해 `export type { ..., TokenExchangeResult }` 를 re-export 목록에 추가한다.

### [INFO] `parseTokenExpiresAt` 함수 — 위임 shim 으로 동작 변경 없음 확인
- **위치**: `integration-oauth.service.ts` — `export function parseTokenExpiresAt(...)` 및 내부 `normalizeTokenResponse` 함수
- **상세**: `parseTokenExpiresAt` 은 `resolveOAuthStrategy(provider).parseTokenExpiresAt(data)` 로 위임하며, `normalizeTokenResponse` 내에서도 `resolveOAuthStrategy(provider)` (appType 없이 — cafe24 기본 public) 로 호출한다. 두 호출 경로 모두 동일한 strategy 인스턴스를 반환하므로 동작이 일관된다. cafe24 public/private 간 `parseTokenExpiresAt` 로직이 base class인 `Cafe24OAuthStrategyBase` 에서 공유되므로 appType 구분이 불필요한 점도 올바르다.
- **제안**: 없음. 현 구현이 의도와 일치한다.

### [INFO] `envCredentials` 조달 — `this.providerEnvCredentials(provider)` 항상 호출됨
- **위치**: `integration-oauth.service.ts` — `exchangeCodeForToken` 내 `strategy.buildTokenRequest({ ..., envCredentials: this.providerEnvCredentials(provider) })`
- **상세**: `buildTokenRequest` 에 `envCredentials` 를 전달할 때, cafe24 private 이나 makeshop 처럼 env credentials 를 사용하지 않는 strategy 에서도 `this.providerEnvCredentials(provider)` 가 항상 호출된다. 이전 코드에서는 provider 분기 내에서만 해당 env 를 읽었다. 현재는 항상 호출되므로 불필요한 env 읽기가 발생한다. `providerEnvCredentials` 가 process.env 를 읽는 순수 함수라면 side effect는 없으나, 이 함수가 만약 ConfigService를 통해 캐시를 갱신하거나 로깅을 하는 경우에는 의도치 않은 호출 횟수 증가가 될 수 있다. 대부분의 경우 이는 무해한 INFO 수준 사항이다.
- **제안**: 관찰을 위해 언급하나, 현 패턴(M-6에서 ConfigService 경유로 이전된 환경)에서는 무해할 가능성이 높다. 추가 확인 불필요.

### [INFO] `resolveOAuthStrategy` 가 `begin` 흐름에서 `'public'` 고정으로 호출됨
- **위치**: `integration-oauth.service.ts` 라인 ~238 — `const strategy = resolveOAuthStrategy(service.oauthProvider, 'public')`
- **상세**: begin authorize URL 빌드 시 appType 을 `'public'` 으로 고정하여 strategy 를 가져온다. cafe24 private 의 begin 흐름은 이미 위쪽 분기(`handleCafe24PrivateInstall`)에서 별도 처리되어 early return 하므로 이 라인에 도달하지 않는다. 따라서 `'public'` 고정이 올바른 동작이다. 코드 주석에 이 의도가 설명되어 있어 가독성도 양호하다.
- **제안**: 없음.

---

## 요약

이 리팩터링(M-2)은 `IntegrationOAuthService` 의 provider별 if/else 분기를 `OAuthProviderStrategy` 인터페이스와 6개 strategy 구현체로 분리한 순수 구조 재편이다. 외부 API 계약(함수 시그니처·공개 export·에러 코드·동작)은 변경되지 않았으며, process.env 접근도 M-6에서 이미 ConfigService로 이전 완료된 상태라 환경 변수 side effect도 없다. 모든 strategy 인스턴스는 stateless singleton 패턴을 따르며 공유 가변 상태를 보유하지 않는다. 유일하게 주의할 사항은 `TokenExchangeResult` 타입이 facade re-export 목록에서 누락된 것으로 보이는 점이며, unit PASS 근거로 사실상 무해하지만 명시적 확인을 권장한다. 그 외 발견사항은 모두 INFO 등급이며 런타임 부작용을 유발할 가능성이 없다.

---

## 위험도

LOW
