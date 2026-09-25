# 아키텍처(Architecture) 코드 리뷰

## 발견사항

- **[WARNING]** Organization-scope "Admin 필요" 판정 로직이 두 서비스에 독립적으로 이중 구현됨
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `assertCanModify` (게이트 656, 헬퍼 정의 651~665 부근) / `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — `assertRequesterStillAllowed` (게이트 405~430, 특히 416~429)
  - 상세: `row.scope === 'organization'` 일 때 `ADMIN_ROLES` 로 role 을 검사하는 "조직 스코프 → Admin 요구" 결합 로직이 `IntegrationsService.assertCanModify`(내부적으로 `isAdmin()` 사용)와 `IntegrationOAuthService.assertRequesterStillAllowed`(role 을 직접 `ADMIN_ROLES.has()`로 검사)에 각각 독립적으로 작성되어 있다. `ADMIN_ROLES` 상수 자체는 `common/constants/workspace-roles.ts` 로 이미 단일화되어 있어 임계값 drift 위험은 낮지만(그 파일 자체의 Rationale 이 "동명이인 상수가 남으면 한쪽만 바뀌는 날 두 판정이 갈린다"를 명시적으로 경계하고 있음), 이 PR 은 그 판정을 감싸는 **조합 로직**(scope 체크 + role 체크 + 에러 throw)을 두 서비스에서 각자 새로 작성했다. `IntegrationsService` 는 `IntegrationOAuthService` 에 단방향으로 의존하고(`integrations.service.ts` 의 `oauthService: IntegrationOAuthService` 주입, 역방향 의존 없음) 있어 순환 의존을 피하려면 서비스 인스턴스를 직접 재사용할 수 없는 구조적 제약은 이해되나, 이 조합 로직 자체는 클래스 상태에 의존하지 않는 순수 함수라 `integration-visibility.ts`(이미 `isIntegrationVisibleTo`/`integrationVisibilityClause` 를 "한 규칙의 두 표현"으로 공존시키는 파일)에 세 번째 표현으로 추가해 두 서비스가 순환 의존 없이 공유할 수 있었다.
  - 제안: `integration-visibility.ts` 에 `assertOrgScopeModifiable(scope, role, action): void` 같은 순수 함수를 추가해 두 서비스가 재사용하도록 리팩터링. 지금 당장 급한 결함은 아니나(값은 동일 소스 `ADMIN_ROLES` 에서 오므로 실제 판정이 갈릴 가능성은 낮음), 다음 사람이 한쪽만 고치면 조용히 drift 하는 구조는 이 저장소가 `workspace-roles.ts` Rationale 에서 이미 한 번 겪고 명시적으로 경계한 실수 패턴과 같은 모양이다.

- **[INFO]** `NotFoundException({code:'RESOURCE_NOT_FOUND', message:'Integration not found'})` 리터럴이 서비스 경계를 넘어 세 번째 지점에 복제됨
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:412-413`(신규, `assertRequesterStillAllowed` 내부) — 같은 파일 811~817 부근(`handleCallback`, 기존 코드)에도 동일 리터럴이 이미 있었고, `codebase/backend/src/modules/integrations/integrations.service.ts` 는 `throwIntegrationNotFound()` 로 이미 이 리터럴을 단일화해 두었다(그 헬퍼의 주석이 "파일 전체 7곳으로 늘어 있었다"는 과거 WARNING 을 기록하고 있음)
  - 상세: `IntegrationsService` 는 같은 401/404 응답 셰이프를 위해 전용 helper(`throwIntegrationNotFound`)를 만들어 두었는데, `IntegrationOAuthService` 는 (private 헬퍼라 재사용할 수 없어) 같은 리터럴을 다시 인라인으로 썼다. 기능은 정확히 동일해 정합성 결함은 아니지만, 바로 위 WARNING 과 같은 원인(서비스 간 공유 지점 부재)에서 나온 반복 패턴이라 함께 적어둔다.
  - 제안: 위 `assertOrgScopeModifiable` 제안과 같은 자리에 `integrationNotFoundError()` factory 를 두면 두 서비스가 같은 표현을 공유할 수 있다.

- **[INFO]** 좋은 설계 — 언급할 가치가 있는 패턴들 (조치 불필요)
  - `integration-visibility.ts` 가 "보이는가" 규칙을 TS predicate(`isIntegrationVisibleTo`)와 SQL 조각(`integrationVisibilityClause`)의 두 표현으로 한 파일에 공존시키고, `IntegrationsService.findAll`·`ExploreToolsService.listIntegrations` 양쪽에서 재사용됨 — 단일 진실 원천이 레이어(메모리 필터 vs SQL 필터) 경계를 넘어 잘 유지됨.
  - `pickPrecheckConflict()` 를 자유 함수로 추출해 `precheckCafe24Mall`/`precheckMakeshopShop` 의 중복 로직(상태 우선순위 매칭 + 가시성 판정)을 하나로 합침 — 이전엔 두 메서드에 거의 동일한 코드가 복제돼 있었다.
  - `judgedRow()` + compare-and-set(`update(judgedRow, patch)`, affected===0 → 404) 패턴이 `update`/`remove`/`updateScope`/`reauthorize` 네 곳에 일관 적용됨 — 엔티티 전체 `save()`(lost-update 위험)를 피하고 "판정 시점 조건이 커밋 시점에도 유지되는가"를 SQL 원자성에 위임하는 설계가 반복 없이 통일됨.
  - `integrations.controller.owner.spec.ts` 의 리플렉션 기반 완결성 캐너리(`:id` 라우트 전수 나열 → 판정 표와 비교) — 새 `:id` 라우트가 인가 판정 없이 추가되는 것을 컴파일이 아니라 테스트 레벨에서 막는 구조적 가드. 이 저장소가 과거 "라우트별 수동 부착 누락" 회귀를 두 번 겪었다는 주석과 정확히 대응하는 방어.
  - `userId` 가 컨트롤러 → `IntegrationsService`/`IntegrationOAuthService` → `ExploreToolsService`/`CandidateLookupService`/`AssistantToolRouter`/`AssistantFinishGuard` 까지 일관되게 관통 전달되어, workflow-assistant 의 통합 후보 조회도 같은 가시성 규칙(§8)을 공유 — 기능이 여러 진입점(REST API, AI 어시스턴트 도구 호출)에 걸쳐 있음에도 같은 규칙을 재구현하지 않고 관통시킨 점이 모듈 경계 설계로서 견고함.
  - `IntegrationOAuthService` 에 `@Optional() workspacesService?: WorkspacesService` 를 주입하되 `IntegrationsModule` 이 이미 `WorkspacesModule`(전역 모듈)을 `imports` 하고 있어 프로덕션 경로에서는 항상 해석되고, 미해석 시 fail-closed(`ADMIN_REQUIRED` 로 거부)로 안전하게 저하 — 순환 의존 없이 두 서비스가 같은 워크스페이스 역할 조회 소스를 공유.

## 요약

이번 변경은 "Personal 통합은 생성자에게만 보인다·Organization 통합 변경은 Admin 이상"이라는 하나의 규칙(spec §8)을 REST 컨트롤러, 두 서비스(`IntegrationsService`/`IntegrationOAuthService`), AI 어시스턴트 도구 체인(`ExploreToolsService`/`CandidateLookupService`/`AssistantToolRouter`)까지 일관되게 관통시키면서, `integration-visibility.ts`(가시성 규칙의 TS/SQL 두 표현), `pickPrecheckConflict`(cafe24/makeshop 공통화), `judgedRow`+조건부 UPDATE(compare-and-set) 같은 재사용 가능한 추상화를 새로 뽑아낸 잘 정리된 리팩터링이다. 레이어 책임(컨트롤러가 역할을 해석해 서비스에 넘기고, 서비스가 가시성·인가를 판정)도 명확하고 순환 의존도 없다. 유일하게 남는 아키텍처 부채는 `IntegrationsService`→`IntegrationOAuthService` 의 단방향 의존 제약 때문에 "조직 스코프는 Admin 이상" 이라는 같은 조합 판정이 두 서비스에 독립적으로 재구현된 점인데, 근본 상수(`ADMIN_ROLES`)는 이미 단일화되어 있어 즉각적인 정합성 위험은 낮다. 이는 당장 차단할 결함이 아니라 다음 변경 시 두 곳을 함께 고치지 않으면 drift 할 수 있는 유지보수성 관찰(WARNING)이다.

## 위험도
LOW
