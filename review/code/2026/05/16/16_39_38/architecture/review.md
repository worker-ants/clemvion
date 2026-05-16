# Architecture Review

## 발견사항

- **[INFO]** `IntegrationsService.requestScopes` 내 Cafe24 Private 분기 — 비즈니스 레이어 서비스가 공급자별(provider-specific) 분기를 직접 보유
  - 위치: `integrations.service.ts` — `requestScopes()` 내 `entity.serviceType === 'cafe24' && creds.app_type === 'private'` 블록
  - 상세: `IntegrationsService` 는 도메인 공통 오케스트레이터여야 하지만, Cafe24 Private 흐름에만 해당되는 `appBaseUrl` URL 조합, `installToken` 유효성 검사, `credentials.scopes` 머지 등을 직접 처리한다. 새 공급자가 추가될 때마다 이 분기가 늘어날 위험이 있다. `IntegrationOAuthService` 가 이미 공급자별 흐름을 담당하는 역할을 갖고 있는 구조이므로, Private 분기 처리도 OAuthService 또는 공급자별 전략 객체로 위임하는 방향이 개방-폐쇄 원칙에 더 부합한다.
  - 제안: `requestScopes` 의 공급자 분기를 `IntegrationOAuthService.beginRequestScopes(entity, mergedScopes)` 형태의 메서드로 위임하거나, 공급자별 전략 인터페이스(`IntegrationProvider`)를 도입해 Cafe24 전용 로직을 캡슐화한다. 단기적으로는 현재 주석(`spec Rationale` 참조)이 의도를 충분히 설명하므로 치명적 위험은 없다.

- **[INFO]** `IntegrationsService` 의 `entityTesters` 등록 — 런타임 뮤테이션 방식의 의존성 역전
  - 위치: `integrations.service.ts` — `registerEntityTester()` + `private readonly entityTesters = new Map<string, EntityAwareTester>()`
  - 상세: 외부 모듈(`Cafe24Module.onModuleInit`)이 `registerEntityTester`를 호출해 런타임에 동작을 주입하는 방식은 의존성 역전 원칙을 달성하지만, 주입 타이밍이 NestJS DI 컨테이너 생명주기와 분리되어 있다. 테스트에서 등록 누락 시 폴백(`dispatchTest`)이 조용히 실행되어 구조적 검증만 통과하는 false-positive 위험이 존재한다. 또한 `registerEntityTester`가 중복 등록 시 warn 로그를 남기지만, 실제 프로덕션 이중 등록 원인 추적이 어렵다.
  - 제안: NestJS 커스텀 프로바이더(`InjectionToken` 또는 `ModuleRef`)를 통한 DI로 전환하면 컨테이너가 수명주기를 보장하므로 등록 누락 위험이 제거된다. 단기적으로는 테스트에서 `entityTesters`를 명시적으로 세팅하는 헬퍼를 두어 폴백 혼용을 방지할 수 있다.

- **[INFO]** 라우트 선언 순서 의존성 — 프레임워크 제약을 주석+Swagger description 이중으로 문서화
  - 위치: `integrations.controller.ts` — `@Get('cafe24/precheck')` 선언 블록(line 590–617)과 `ApiOperation.description` 내 "Route order note"
  - 상세: `GET /integrations/cafe24/precheck` 가 `GET /integrations/:id` 보다 앞에 선언되어야 하는 NestJS 라우터 제약이 코드 주석과 Swagger description 양쪽에 복제되어 있다. 이는 정보를 두 곳에 분산시키는 DRY 위반이다. Swagger description 에 넣으면 API 소비자에게 구현 세부사항이 노출되며, 장기적으로 두 문서가 drift 할 가능성이 있다.
  - 제안: Swagger `description` 에서 "Route order note" 단락을 제거하고, 코드 주석만 단일 진실로 유지한다. 회귀 방지는 라우트 순서를 검증하는 e2e 테스트(실제 400 여부 확인)로 대체한다.

- **[INFO]** `buildFakeCafe24Integration` factory — 테스트 전용 데이터 모델 경계
  - 위치: `integration-oauth.service.cafe24.spec.ts` — `buildFakeCafe24Integration()` 함수
  - 상세: 이번 변경으로 흩어진 인라인 mock 객체를 factory 함수로 통합한 것은 DRY 측면에서 긍정적이다. 반환 타입이 `Record<string, unknown>` 으로 느슨하게 정의되어 있어 타입 시스템이 실제 엔티티 형태와의 불일치를 잡아주지 못한다. 예를 들어 `workspaceId` 필드가 factory 에서 생략되어 있는데, 서비스 코드가 이 필드에 접근하는 상황이 생기면 테스트가 런타임 오류 없이 통과될 수 있다.
  - 제안: 반환 타입을 `Partial<Integration>` 또는 별도로 정의한 `FakeCafe24Integration` 인터페이스로 좁혀 타입 안전성을 높인다. `workspaceId` 처럼 서비스 코드가 의존하는 필드는 factory 기본값에 포함시킨다.

- **[INFO]** `IntegrationsService` 의 `resolveRole` 위임 — 컨트롤러가 권한 조회를 직접 호출
  - 위치: `integrations.controller.ts` — `create`, `rotate`, `requestScopes`, `updateScope` 핸들러 내 `this.integrationsService.resolveRole(...)` 호출
  - 상세: 권한 조회(`resolveRole`)가 서비스 레이어에 위임되어 있지만 컨트롤러가 직접 조회 결과를 service 메서드의 인자로 전달하는 패턴이다. 이는 권한 관련 로직이 컨트롤러-서비스 경계에 걸쳐 분산된 구조를 만든다. 권한 결정(authorization decision)은 가드(Guard) 또는 서비스 내부에서 완결되는 것이 레이어 책임 분리 관점에서 바람직하다.
  - 제안: NestJS `@Roles` 가드를 확장해 `workspaceId`·`userId` 기반 동적 역할을 컨텍스트에 주입하거나, 서비스 내부에서 `userId`를 받아 역할 조회 + 권한 판단까지 완결한다. 컨트롤러는 `userId`만 전달하도록 단순화한다.

## 요약

이번 변경은 테스트 fixture 중복을 `buildFakeCafe24Integration` factory로 통합하고, Swagger 문서에 라우트 순서 주의사항을 추가하며, 트랜잭션 미적용 의도를 주석으로 명문화한 리팩토링/문서화 작업이다. 전체적으로 레이어 분리(컨트롤러-서비스-데이터)는 잘 유지되어 있고, `IntegrationOAuthService`와 `IntegrationsService`의 역할 구분도 명확하다. 다만 `IntegrationsService.requestScopes` 내 공급자별 분기 내재화, 런타임 tester 등록 방식, 컨트롤러의 역할 조회 위임 패턴은 서비스 확장 시 단일 책임 원칙 위반 압력이 높아질 수 있는 잠재 구조 취약점이다. 현 규모에서는 허용 가능한 트레이드오프이며 즉각적인 조치가 필요한 Critical/Warning 수준의 문제는 발견되지 않았다.

## 위험도

LOW
