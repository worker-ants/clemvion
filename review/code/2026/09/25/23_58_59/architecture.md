# 아키텍처(Architecture) Review

## 발견사항

- **[INFO]** 가시성 판정의 이중 표현(in-memory vs SQL) — drift 방지 장치가 테스트뿐
  - 위치: `codebase/backend/src/modules/integrations/integration-visibility.ts:24-39` (`isIntegrationVisibleTo` · `integrationVisibilityClause`)
  - 상세: 같은 판정 규칙("personal 이면서 생성자가 아니면 안 보인다")을 부울 함수(`isIntegrationVisibleTo`, 메모리 필터용)와 SQL 문자열(`integrationVisibilityClause`, QueryBuilder `andWhere` 용)로 각각 손으로 유지한다. 파일 상단 주석이 "같은 규칙의 두 표현이라 이 파일에 함께 둔다"고 명시해 의도는 드러나지만, 두 표현을 하나에서 파생시키는 컴파일 타임/런타임 장치는 없고 `integration-visibility.spec.ts`의 개별 단위 테스트만 둘을 붙잡아 둔다. 향후 규칙이 바뀔 때(예: personal 조건에 `deletedAt` 같은 필드가 추가) 한쪽만 고치고 다른 쪽을 놓치면 목록(SQL 필터)과 `:id` 단건 조회(메모리 판정)의 가시성이 갈라진다 — 페이지네이션 total 에는 안 잡히는데 상세 조회는 되는 식의 조용한 불일치.
  - 제안: 최소한 두 표현이 같은 판정을 내리는지 확인하는 property-style 테스트(예: 여러 `(scope, createdBy, userId)` 조합에 대해 SQL 문자열을 파싱하지 않고도, SQL 문자열이 참조하는 조건과 `isIntegrationVisibleTo` 의 진리표를 나란히 assert)를 추가해 두 표현의 의미적 동치를 명시적으로 고정해 두는 것을 고려.

- **[INFO]** 두 서비스가 서로를 주입할 수 없어 "판정 오케스트레이션 시퀀스" 자체가 중복
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:405-425` (`assertRequesterStillAllowed`) vs `codebase/backend/src/modules/integrations/integrations.service.ts:687-697` (`requireModifiable`)
  - 상세: 공유 판정 원자(`isIntegrationVisibleTo`, `assertOrgScopeModifiable`)는 `integration-visibility.ts` 로 잘 뽑혀 있어 "무엇을 판정하는가"는 중복이 없다. 다만 "어떤 순서로 조합하는가"(보이는가 → pending_install 이면 skip → organization 이면 role 조회 → assert)라는 오케스트레이션 형태 자체는 두 서비스에 나란히 손으로 다시 쓰여 있다. `IntegrationOAuthService` 쪽은 역할을 `this.workspacesService` 로 직접 조회하고, `IntegrationsService` 쪽은 컨트롤러가 미리 조회해 인자로 받는다 — "역할을 누가 조회하는가"의 책임 소재도 두 서비스가 다르다. 두 서비스가 서로를 주입 못 하는 제약(주석에 명시) 자체는 타당한 설계 근거이므로 지금 구조가 틀렸다는 뜻은 아니지만, 세 번째 호출부가 생기면 또 같은 시퀀스를 손으로 베낄 위험이 있다.
  - 제안: 급하지 않음. 세 번째 유사 호출부가 생기면 `integration-visibility.ts` 에 "역할 조회자를 인자로 받는" 고차 함수(예: `requireModifiableWithRoleResolver(row, userId, resolveRole, action)`)를 추가해 시퀀스까지 한 곳으로 모으는 것을 고려.

- **[INFO]** 모듈 경계 — `workflow-assistant` 가 `integrations` 모듈의 내부 파일을 상대 경로로 직접 import
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:8-11`
  - 상세: `ExploreToolsService` 가 `IntegrationsService`(공개 provider)를 거치지 않고 `../../integrations/integration-visibility` 를 직접 import해 SQL 절을 재사용한다. `integration-visibility.ts` 가 순수 함수·무상태 정책 모듈이라 NestJS DI 없이 재사용하는 것 자체는 합리적이고, 이 저장소는 이미 `Integration` 엔티티도 다른 모듈에서 상대 경로로 직접 import하는 관례를 갖고 있어(`explore-tools.service.ts` 자신도 그렇게 한다) 새로 생긴 문제는 아니다. 다만 두 모듈의 경계가 "공개 API(서비스 클래스)"가 아니라 "구현 파일 경로"로 그어져 있어, `integration-visibility.ts` 의 내부 구조가 바뀌면(예: 파일 분할) `integrations` 모듈 밖의 소비자가 함께 깨진다.
  - 제안: 지금 당장 리팩터링할 필요는 없음(기존 컨벤션과 일관). 다만 `integration-visibility.ts` 같은 "여러 모듈이 공유하는 순수 정책 함수"가 늘어나면, `common/` 또는 별도 `@shared` 패키지로 승격해 모듈 경계를 파일 경로가 아니라 명시적 공개 표면으로 그리는 것을 고려.

- **[INFO]** 컨트롤러가 두 서비스 간 오케스트레이션(교차-서비스 인가 판정)을 직접 수행
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:258-268` (`oauthBegin` 의 `modifyActionOfBeginMode` 분기 + `requireModifiable` 호출)
  - 상세: `oauth/begin` 이 `integrationId` 를 지정한 재인증/scope 추가 모드일 때, 컨트롤러가 `roleOf()` 로 역할을 조회하고 `IntegrationsService.requireModifiable` 을 호출해 인가를 통과시킨 뒤에야 `IntegrationOAuthService.begin` 을 호출한다. 두 서비스가 서로를 주입할 수 없다는 명시된 제약(§ integration-visibility.ts 상단 주석) 때문에 컨트롤러가 사실상 파사드 역할을 겸하게 된 것으로, 이 결정 자체는 납득 가능하다. 다만 "새 mode 가 생기면 판정을 우회할 수 있다"는 위험을 `modifyActionOfBeginMode` 의 `never` 완전성 검사로 컴파일 타임에 막아 둔 점은 좋은 설계다. 컨트롤러(프레젠테이션 계층)가 두 서비스의 호출 순서·조건부 인가를 직접 조립한다는 점만 기록해 둔다 — 향후 같은 조합 로직이 다른 진입점(예: 배치 API, 내부 워크플로 실행)에도 필요해지면 컨트롤러 밖의 응용 서비스로 승격할 후보.
  - 제안: 지금 구조를 바꿀 필요는 없음. 동일한 "판정 후 begin" 조합이 두 번째 호출부에서 필요해지는 시점에 별도 파사드로 추출을 고려.

## 요약

이번 변경의 핵심은 `IntegrationsService` 와 `IntegrationOAuthService` 가 서로 주입할 수 없는 구조적 제약 아래에서, 통합 가시성·변경 인가 판정을 순수 함수 모듈(`integration-visibility.ts`)로 뽑아 두 서비스와 `workflow-assistant` 어시스턴트 도구 체인까지 단일 진실로 공유한 것이다. `isIntegrationVisibleTo`/`assertOrgScopeModifiable`/`adminRequiredError` 는 `Pick<Integration, …>` 구조적 타입으로 필요한 필드만 요구해 ISP 를 잘 지켰고, `pickPrecheckConflict` 로 cafe24/makeshop precheck 중복을 제거했으며, `modifyActionOfBeginMode` 의 `never` 완전성 검사와 `judgedRow`(compare-and-set) 패턴은 각각 "새 모드가 판정을 우회"·"판정과 쓰기 사이 TOCTOU" 같은 미래 회귀를 컴파일 타임/원자적 쓰기로 막아 두는 견고한 설계다. `IntegrationsController.owner.spec.ts` 의 리플렉션 기반 `:id` 라우트 전수 캐너리도 "새 라우트가 판정 없이 추가되는" 회귀를 구조적으로 봉쇄한다. userId 전파가 컨트롤러→서비스→워크플로 어시스턴트 도구 체인 전체에 일관되게 이뤄져 레이어 간 계약이 끊기지 않았다. 순환 의존성은 발견되지 않았고(WorkspacesModule 은 기존에 이미 IntegrationsModule 에 주입돼 있었음), 새로 도입된 결합은 모두 기존 관례와 일치한다. 지적한 항목은 전부 INFO 수준의 "다음에 커질 수 있는 씨앗"이며 지금 병합을 막을 사유는 없다.

## 위험도

LOW
