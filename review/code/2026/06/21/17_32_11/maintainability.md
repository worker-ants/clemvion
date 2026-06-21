# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `resolveOAuthStrategy` 가 `normalizeTokenResponse` 내부에서 이중 호출됨
- 위치: `integration-oauth.service.ts` — `normalizeTokenResponse` 함수 내부 (~line 2598 in diff context)
- 상세: `exchangeCodeForToken` 에서 이미 `strategy = resolveOAuthStrategy(provider, appType)` 를 해소한 뒤 `normalizeTokenResponse(provider, data, requestedScopes)` 를 호출하는데, `normalizeTokenResponse` 내부에서 `resolveOAuthStrategy(provider)` 를 다시 호출한다 (appType 없이 — 코멘트로 "cafe24 public/private parse는 동일하므로 default fine" 이라고 설명). registry 조회 자체는 O(1) 단순 switch 라 성능 문제는 아니지만, 호출자(exchangeCodeForToken)가 이미 해소한 strategy 를 내부 헬퍼가 재해소하는 패턴은 의존 흐름을 숨긴다. `normalizeTokenResponse` 가 `OAuthProviderStrategy` 를 매개변수로 받도록 서명을 바꾸면 이중 해소 없이 의도가 명확해진다.
- 제안: `normalizeTokenResponse(provider, data, requestedScopes, strategy: OAuthProviderStrategy)` 로 변경하고 호출자에서 strategy 를 전달.

---

### [INFO] `parseTokenExpiresAt` 공개 함수가 내부적으로 `resolveOAuthStrategy` 를 호출하는 thin shim 으로 남아 있음
- 위치: `integration-oauth.service.ts` (export 함수 `parseTokenExpiresAt`)
- 상세: `normalizeTokenResponse` 내부의 `strategy.parseTokenExpiresAt(data)` 와 사실상 동일한 코드 경로를 한 줄 shim 으로 감싸 export 한다. 테스트 후방 호환을 위해 유지한다는 점을 주석으로 설명하고 있어 의도는 이해되지만, "thin delegating shim — the per-provider precedence lives in each strategy" 라는 JSDoc 주석이 함수 목적을 잘 설명한다. 단, 이 함수가 앞으로도 테스트용 export 만 남길 것이라면 `@internal` 또는 `/** @deprecated use strategy.parseTokenExpiresAt directly */` 같은 힌트를 추가하면 다음 개발자가 새 코드에서 이 함수를 직접 쓰는 실수를 방지할 수 있다.
- 제안: JSDoc 에 `@deprecated — test-compat shim; new code should call strategy.parseTokenExpiresAt directly` 추가.

---

### [INFO] `AuthorizeUrlInput` 의 `mallId`·`codeChallenge` 가 superset 설계로 인해 잘못된 provider 에 전달돼도 타입 오류 없음
- 위치: `oauth-provider-strategy.ts` — `AuthorizeUrlInput` 인터페이스
- 상세: 인터페이스가 모든 provider 의 optional 필드를 한 객체에 모았다(superset union-bag 패턴). `buildAuthorizeUrl` 호출 시 google strategy 에 `mallId` 를 넘겨도 타입 레벨에서 오류가 발생하지 않는다. 런타임에서는 각 strategy 가 무시하므로 실제 버그는 없지만, 향후 필드가 추가될 때 오용 가능성이 생긴다. 현재 파일 수(8개)와 복잡도를 고려하면 per-provider typed input 으로 완전히 나누는 것은 과도한 변경이고, superset bag 은 단일 인터페이스 유지라는 전략 패턴의 실용적 선택임을 주석에 이미 문서화(`/** cafe24: mall_id ... */`, `/** makeshop: PKCE ... */`)하고 있어 의도가 명확하다.
- 제안: 현재 설계 유지 가능. 다만 `AuthorizeUrlInput` 주석에 "superset: unused fields are ignored by each strategy" 를 한 줄 추가하면 설계 의도가 더 명확해진다.

---

### [INFO] `MakeshopOAuthStrategy.buildStubResult` 에서 `randomBytes` import 를 사용하지만 `makeshop.strategy.ts` 가 `cafe24-oauth.strategy.ts` 와 동일한 stub 결과 구조(stub: true, provider token) 생성
- 위치: `makeshop.strategy.ts` — `buildStubResult` / `cafe24-oauth.strategy.ts` — `buildStubResult`
- 상세: 두 파일 모두 `{ stub: true }` + `stub-${this.provider}-${randomBytes(8)}` + `stub-refresh-${randomBytes(8)}` + `tokenExpiresAt` 패턴을 독립적으로 구현한다. TTL 값과 providerMeta 조합이 달라 완전 중복은 아니지만, `accessToken`/`refreshToken` 접두어 패턴과 `{ stub: true }` 기본 meta 초기화는 동일하다. `StandardOAuthStrategy.buildStubResult` 에서 이 공통 부분을 protected helper 로 추출해 두 하위 클래스가 재사용했다면 더 좋았겠지만, `Cafe24OAuthStrategyBase` 와 `MakeshopOAuthStrategy` 가 상속 계층을 공유하지 않아 단순 추출이 어렵다. `OAuthProviderStrategy` 인터페이스 레벨에 static factory helper 를 두거나, 별도 `buildBaseStubResult` 유틸을 `oauth-provider-strategy.ts` 에 export 해 재사용하면 미래 stub 형식 변경 시 한 곳만 수정하면 된다.
- 제안: `oauth-provider-strategy.ts` 에 `buildBaseStubTokens(provider: OAuthProvider, ttlMs: number): Pick<TokenExchangeResult, 'accessToken' | 'refreshToken' | 'tokenExpiresAt'>` 같은 exported helper 추가.

---

### [INFO] `cafe24-oauth.strategy.ts` 의 `cafe24AuthorizeUrl` / `cafe24TokenUrl` 이 public export 됨
- 위치: `cafe24-oauth.strategy.ts` — lines `export function cafe24AuthorizeUrl` / `export function cafe24TokenUrl`
- 상세: 두 함수가 `export` 이지만 같은 파일의 `Cafe24OAuthStrategyBase` 만 사용한다. 외부에서 직접 이 URL 헬퍼를 호출할 이유가 없다면(facade 는 이제 strategy 를 통해 접근) `export` 제거 또는 private static 메서드로 내부화하는 것이 캡슐화에 맞다. 현재 상태에서는 이 함수들을 다른 파일에서 직접 import 해 사용할 여지를 열어두어 추후 URL 구조 변경 시 영향 범위를 넓힌다.
- 제안: `export` 제거 후 파일 로컬 함수로 내부화. 또는 `Cafe24OAuthStrategyBase` 의 private static 메서드로 이동.

---

### [INFO] `TokenRequestInput.envCredentials` 가 모든 provider 에 항상 전달되나 cafe24-private / makeshop 에서는 무시됨
- 위치: `oauth-provider-strategy.ts` — `TokenRequestInput` 인터페이스; `integration-oauth.service.ts` — `buildTokenRequest` 호출부
- 상세: facade 는 항상 `this.providerEnvCredentials(provider)` 를 `envCredentials` 로 전달하지만, `Cafe24PrivateOAuthStrategy` 와 `MakeshopOAuthStrategy` 는 이 값을 사용하지 않는다. 불필요한 데이터가 매 호출마다 전달되는 것이 작은 비효율이지만, 보다 중요한 것은 코드를 읽는 사람이 "이 field 가 필수인가?" 를 헷갈릴 수 있다는 점이다. 주석(`/** Env-resolved client credentials (google/github/cafe24-public). */`)이 어느 provider 에 적용되는지 명시해 두어 현재도 이해 가능하다.
- 제안: 현재 수준 유지 가능. 주석에 `(ignored by cafe24-private and makeshop)` 보완 시 의도가 더 명확해진다.

---

## 요약

이번 M-2 리팩터링은 2,600줄 단일 클래스에서 5개 프로토콜이 혼재하던 구조를 strategy 패턴으로 분리한 대규모 개선으로, 가독성·코드 복잡도·함수 길이·중첩 깊이 모두 현저히 개선되었다. 인터페이스(`OAuthProviderStrategy`)와 추상 기반 클래스(`StandardOAuthStrategy`, `Cafe24OAuthStrategyBase`), 레지스트리(`resolveOAuthStrategy`) 의 역할 구분이 명확하고, 각 파일의 책임이 단일하며, 네이밍(`buildAuthorizeUrl`, `buildTokenRequest`, `parseTokenExpiresAt`, `extractProviderMeta`, `buildStubResult`)이 의도를 직관적으로 전달한다. 발견된 사항은 모두 INFO 수준(strict double-resolution 패턴, export 범위 과다, superset 인터페이스 문서화 보완, stub helper 소규모 중복)으로, 현재 코드의 동작 정확성이나 유지보수성을 저해하지는 않는다. 전체적으로 이 변경은 유지보수성을 크게 향상시키는 모범적인 리팩터링이다.

## 위험도

LOW
