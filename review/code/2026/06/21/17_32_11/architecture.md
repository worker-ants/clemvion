# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] Strategy 패턴 적용 — 명확한 OCP/SRP 개선
- 위치: `/codebase/backend/src/modules/integrations/oauth-providers/` 전체
- 상세: 기존 2,600줄 단일 서비스에 흩어진 provider별 `if/else` 체인을 `OAuthProviderStrategy` 인터페이스 + 계층 구조(StandardOAuthStrategy → Google/GitHub, Cafe24OAuthStrategyBase → Public/Private, MakeshopOAuthStrategy)로 전환했다. 새 provider 추가 시 `resolveOAuthStrategy` registry에 단일 항목과 새 파일만 추가하면 되므로 OCP 요건을 충족한다.
- 제안: 유지.

### [INFO] 의존성 방향 — 전략 파일이 NestJS 예외를 직접 throw
- 위치: `oauth-providers/cafe24-oauth.strategy.ts`, `cafe24-private.strategy.ts`, `cafe24-public.strategy.ts`, `makeshop.strategy.ts`, `standard-oauth.strategy.ts`
- 상세: 순수 프로토콜 로직을 담당한다고 선언된 strategy 클래스들이 `@nestjs/common`의 `BadRequestException`, `InternalServerErrorException`을 직접 import하여 throw한다. 이는 전략 계층이 HTTP 프레임워크 레이어에 직접 결합됨을 의미한다. 현재 단일 애플리케이션 구조에서는 실질적 문제가 없으나, strategy가 "순수 stateless protocol 결정" 임을 강조한 설계 의도(oauth-provider-strategy.ts 파일 헤더)와 일관성이 다소 어긋난다. 프레임워크 독립성을 원한다면 도메인 에러 클래스를 별도 정의하고 facade에서 NestJS 예외로 변환하는 구조가 더 깔끔하다.
- 제안: 현 규모에서 강제 변경 불필요. 향후 strategy를 다른 컨텍스트(CLI, 테스트 더블)에서 재사용할 경우 도메인 예외 계층을 분리할 것.

### [INFO] `AuthorizeUrlInput`의 선택적 필드가 암묵적 provider 결합을 내포
- 위치: `oauth-providers/oauth-provider-strategy.ts` `AuthorizeUrlInput` 인터페이스, `makeshop.strategy.ts` `buildAuthorizeUrl`
- 상세: `AuthorizeUrlInput`에 `mallId?: string`(cafe24 전용)과 `codeChallenge?: string`(makeshop 전용)이 공통 인터페이스에 선택적 필드로 선언돼 있다. 각 strategy는 자신에게 필요한 필드가 없으면 runtime에 throw하는 방식이다. 이는 인터페이스 분리 원칙(ISP) 관점에서 "provider-agnostic 입력 DTO가 provider-specific 개념을 흡수한 형태"에 해당하며, 새 provider가 독자적인 authorize 파라미터를 요구할 때 공통 인터페이스가 계속 팽창할 수 있다. 동일 패턴이 `TokenRequestInput.providerMeta`(untyped `Record<string, unknown>`)로도 반복된다.
- 제안: 현재 provider 수(5개)와 변동 빈도를 고려하면 허용 범위 내다. 향후 provider가 늘어나면 generic `TInput extends object` 타입 파라미터를 인터페이스에 도입하거나, `buildAuthorizeUrl(input: BaseInput & ProviderExtras)` 패턴으로 전환을 검토할 것.

### [INFO] `resolveOAuthStrategy`의 `appType` 파라미터가 `cafe24`에만 의미를 가지는 암묵적 coupling
- 위치: `oauth-providers/index.ts` `resolveOAuthStrategy(provider, appType?)`
- 상세: `appType` 파라미터는 `cafe24`에만 실질적 의미가 있고 다른 provider에서는 무시된다. facade 호출 측(`integration-oauth.service.ts`)에서 `resolveOAuthStrategy(provider, 'public')` 형태로 비-cafe24 provider에 `appType`을 전달하기도 한다. 이는 호출자가 "appType이 무엇인지 알아야 한다"는 암묵적 지식을 요구한다. 타입 시스템이 이를 제약하지 않아 향후 오용 가능성이 있다.
- 제안: `resolveOAuthStrategy` 오버로드를 `cafe24` provider에만 `appType` 필수 시그니처로 제한하거나, cafe24 분기만 별도 함수 `resolveCafe24Strategy(appType: Cafe24AppType)`으로 분리하는 것을 고려할 것.

### [INFO] `parseTokenExpiresAt` 함수의 이중 경로 — facade 함수와 strategy 메서드 중복 호출 가능성
- 위치: `integration-oauth.service.ts` `parseTokenExpiresAt()` exported function (line ~541) 및 `normalizeTokenResponse()` 내 `strategy.parseTokenExpiresAt(data)` 직접 호출
- 상세: `parseTokenExpiresAt` exported 함수는 "thin delegating shim"으로 strategy에 위임하는 하위 호환 레이어이고, `normalizeTokenResponse` 내부에서는 strategy를 직접 resolve하여 호출한다. 두 경로는 결국 동일 strategy 메서드를 호출하므로 동작은 동일하나, "facade에서 re-export 유지"라는 레거시 호환 목적과 "내부 리팩터링"이 혼재한 상태를 코드에서 명확히 구분하기 어렵다.
- 제안: 주석 수준의 문서화는 충분하다. 다만 re-exported `parseTokenExpiresAt`가 외부 테스트 외에 내부에서도 참조된다면 중복 strategy resolve가 발생하므로, 내부 `normalizeTokenResponse`가 항상 strategy 직접 호출을 쓰는 현재 패턴을 유지하고 exported shim은 테스트 전용임을 주석으로 강조할 것.

### [INFO] `buildStubResult`가 `OAuthProviderStrategy` 인터페이스에 포함된 점 — 환경별 관심사 혼합
- 위치: `oauth-providers/oauth-provider-strategy.ts` interface `OAuthProviderStrategy`, 각 strategy 구현체
- 상세: `buildStubResult`는 테스트/개발 환경 전용 동작이 프로덕션 strategy 인터페이스에 직접 포함된 구조다. 이는 strategy의 응집도를 낮추며, 새로운 provider 구현자가 stub 동작까지 의무적으로 구현해야 한다. 인터페이스가 두 가지 책임(실제 OAuth 프로토콜 + 테스트 더블 생성)을 갖는다.
- 제안: 현재 규모에서 실용적으로 허용 가능하다. 장기적으로는 `OAuthProviderStrategy`와 별도의 `OAuthProviderStubFactory` 인터페이스로 분리하거나, 전략 클래스 외부의 팩토리 맵으로 stub을 관리하는 방향을 검토할 것.

## 요약

이번 리팩터링(M-2)은 2,600줄 단일 facade에 혼재하던 5개 OAuth 프로토콜 분기를 Strategy 패턴으로 분리하여 SRP와 OCP를 실질적으로 개선한 올바른 방향의 변경이다. 레이어 경계도 명확하다 — 순수 프로토콜 로직(authorize URL·token request·expiry parsing·metadata 추출·stub)은 strategy로, 상태 관리·보안·DB·HTTP 실행은 facade에 잔류한다. 순환 의존성은 없으며 모듈 경계도 `oauth-providers/index.ts` 단일 진입점으로 깔끔하게 닫혀 있다. 주요 아키텍처 관점의 잔여 약점은 strategy가 NestJS 예외를 직접 throw하는 프레임워크 결합, `AuthorizeUrlInput`/`TokenRequestInput`의 provider-specific 선택적 필드 팽창 가능성, `buildStubResult`가 프로덕션 인터페이스에 포함된 관심사 혼합 세 가지이나, 모두 현재 규모에서는 실용적으로 허용 가능한 수준이며 즉각 차단을 요구하지 않는다.

## 위험도

LOW
