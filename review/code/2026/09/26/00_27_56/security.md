# 보안(Security) 코드 리뷰

## 개요

이번 변경은 Integration(통합) 리소스에 대한 **Personal/Organization 가시성·인가 판정을 신설**하는 IDOR/인가 우회 수정이다. 핵심 산출물은 `integration-visibility.ts` (신규, `isIntegrationVisibleTo` · `integrationVisibilityClause` · `integrationNotFoundError` · `assertOrgScopeModifiable`)이며, `IntegrationsController` / `IntegrationsService` / `IntegrationOAuthService` / `WorkspacesService` / workflow-assistant 도구 체인(`ExploreToolsService`, `CandidateLookupService`, `AssistantFinishGuard`, `AssistantToolRouter`)이 모두 이 판정을 일관되게 소비하도록 리팩터링됐다. e2e 스펙 주석(`test/integration-personal-owner.e2e-spec.ts`)에 따르면 이 변경 **이전에는 `created_by` 를 전혀 검사하지 않아 Viewer 가 Organization 통합을 자신의 외부 계정으로 재인증(자격 증명 바꿔치기)할 수 있었다** — 이번 diff는 그 결함의 수정이다.

## 발견사항

- **[INFO]** Cafe24/MakeShop precheck 엔드포인트가 남의 personal 통합의 `status` 는 계속 노출한다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — `pickPrecheckConflict()` (신설, 예전 `precheckCafe24Mall`/`precheckMakeshopShop` 인라인 로직을 대체)
  - 상세: `pickPrecheckConflict`는 충돌 대상이 다른 멤버의 personal 통합이면 `existingIntegrationId`/`existingName`은 생략하지만(`identity()` 헬퍼, `isIntegrationVisibleTo` 기반), `status`(`connected`/`pending_install`/`error`/`expired`)와 `conflict: true` 자체는 scope와 무관하게 그대로 반환한다. 즉 공격자는 임의의 `mallId`/`shopUid`를 넣어 "그 워크스페이스에 그 매장을 연결한 개인 통합이 존재하는지, 그리고 그 연결 상태가 무엇인지"를 열거할 수 있다. 다만 이는 diff 가 새로 만든 문제가 아니라 기존 동작(diff 이전 코드도 항상 id/name/status 모두 반환)을 완화한 것이며, 코드 주석과 `spec/2-navigation/4-integration.md` §8·§9.2 가 "충돌·status는 그대로 알린다"를 명시적 설계로 규정한다(매장 식별자 유일성이 워크스페이스 단위라 새 통합 생성 가능 여부를 사전에 알려줘야 하는 UX 요구 때문).
  - 제안: 의도된 트레이드오프로 보이므로 코드 변경은 불필요. 다만 "status까지 마스킹해야 하는가"는 위협 모델에 따라 재검토할 수 있는 지점이라 재참조용으로 남긴다(신규 결함 아님, 등급 INFO).

- **[INFO]** `integrationVisibilityClause(alias)`가 SQL 조각을 문자열 보간으로 조립한다
  - 위치: `codebase/backend/src/modules/integrations/integration-visibility.ts:37` (`export function integrationVisibilityClause`)
  - 상세: `` `(${alias}.scope <> 'personal' OR ${alias}.created_by = :${INTEGRATION_USER_PARAM})` `` — `alias` 인자가 그대로 SQL 문자열에 삽입된다. 현재 모든 호출부(`integrations.service.ts:511`, `explore-tools.service.ts:172`)는 하드코딩 리터럴 `'i'`만 넘기므로 실제 주입 경로는 없다. 그러나 이 함수는 모듈 밖으로 export된 재사용 헬퍼라, 향후 호출부가 동적 문자열(예: 사용자 입력에서 파생된 alias)을 넘기면 SQL 인젝션으로 이어질 수 있는 구조다.
  - 제안: 필수 조치는 아니나, 방어적으로 `alias`를 화이트리스트 정규식(`/^[a-zA-Z_][a-zA-Z0-9_]*$/`)으로 검증하거나 타입을 리터럴 유니온으로 좁혀 향후 오용을 원천 차단할 수 있다.

- **[INFO]** `getForExecution`(실행 엔진 경로)은 workspace 범위만 검사하고 personal 소유권은 보지 않는다 — 코드에 명시된 기존 갭
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `getForExecution()` / `requireEntity()` (`Authorisation contract` 주석 참고)
  - 상세: JSDoc이 스스로 "does not verify … whether the integration is organisation-shared vs. personal … Use exclusively from trusted execution-engine code paths"라고 밝힌다. `requireVisible`(신규 personal 판정)을 거치지 않으므로, 워크플로 실행 경로에서 personal 통합이 실행 시점에 재검증 없이 사용될 수 있다. 이번 diff가 만든 회귀는 아니고 diff 자체도 이 메서드를 건드리지 않았지만, 이번 PR의 주제(personal 소유권 강제)와 정면으로 관련된 잔여 표면이라 언급한다. `requireVisible`의 JSDoc도 "실행 엔진 전용 `getForExecution`만 예외(노드 실행 시점 판정은 후속 plan)"이라고 스스로 인정한다.
  - 제안: 코드 주석대로 후속 plan에서 다뤄야 할 항목 — 이번 리뷰에서는 회귀가 아니므로 차단 사유로 삼지 않는다.

## 확인한 방어 설계 (양호)

- **404 통일(존재 은닉)**: `integrationNotFoundError()`가 "없는 통합"과 "남의 personal"에 동일한 `RESOURCE_NOT_FOUND` 리터럴을 반환해 존재 여부 열거를 차단한다(`integrations.controller.owner.spec.ts`의 리플렉션 전수 테스트로 `:id` 라우트 전체를 커버).
- **TOCTOU 차단**: `IntegrationOAuthService.handleCallback`이 `pessimistic_write` 락 안에서 `assertRequesterStillAllowed`를 재실행하고(begin↔callback 사이 state TTL 동안의 scope/역할 변경 대응), `IntegrationsService.rotate`도 동일 패턴(외부 연결 테스트 이후 트랜잭션 안에서 재판정)을 쓴다. 역할 조회(`WorkspacesService.getMemberRole`)도 락을 쥔 같은 트랜잭션 커넥션(`manager`)으로 수행해 별도 커넥션을 빌리지 않는다.
- **Fail-closed**: `workspacesService`가 주입되지 않으면(`@Optional()`) Organization 통합의 재판정은 무조건 거부(`ADMIN_REQUIRED`)한다(`integration-oauth.service.spec.ts` "역할을 조회할 수 없으면 … fail-closed" 케이스).
- **Compare-and-set 쓰기**: `judgedRow()`로 판정 근거(`scope`)를 조건절에 실어, 판정과 쓰기 사이 다른 요청이 scope를 바꾸면 0-row로 끝나 404 처리된다(lost-update 방지).
- **userId 전파 경로 검증**: 모든 신규 `userId` 파라미터는 컨트롤러의 `@CurrentUser() user: JwtPayload`(`user.sub`, JWT에서 유래) 또는 그 상위 호출부(`workflow-assistant.controller.ts`의 `sendMessage`)에서만 주입되며, 클라이언트가 body로 임의 userId를 지정할 수 있는 경로는 확인되지 않았다.
- **SQL 인젝션 없음**: 목록·precheck 쿼리는 TypeORM QueryBuilder의 파라미터 바인딩(`:workspaceId` 등)을 사용하고, `mallId`/`shopUid`는 컨트롤러 DTO 단에서 정규식(`^[a-z0-9-]{3,50}$`, `^[A-Za-z0-9_-]{2,64}$`)으로 사전 검증된다.
- **하드코딩된 시크릿 없음**: 테스트 픽스처의 `'old-secret'`/`'new-secret'` 등은 목(mock) 자격 증명이며 실제 시크릿이 아니다.
- **e2e 커버리지**: `integration-personal-owner.e2e-spec.ts`가 목록 필터링, `:id` 전 라우트 404 동등성, `oauth/begin` 우회 시도, Organization 변경의 Admin 강제, 본인 personal의 정상 동작을 실제 HTTP 계층에서 검증한다.

## 요약

이번 변경은 새로운 취약점을 도입하기보다, 기존의 심각한 IDOR/인가 우회(personal 통합의 `created_by` 미검증으로 인해 Viewer가 Organization 통합의 자격 증명을 바꿔치기할 수 있었던 결함, 그리고 남의 personal 통합의 존재·이름이 여러 `:id` 경로와 precheck 엔드포인트로 노출되던 정보 유출)를 체계적으로 닫는다. 가시성 판정(`isIntegrationVisibleTo`)과 변경 판정(`assertOrgScopeModifiable`)을 단일 순수 함수로 모으고, 이를 요청 경로·OAuth 콜백 재판정·워크플로 어시스턴트 도구 체인까지 일관되게 적용했으며, TOCTOU·lost-update·존재 열거 방지까지 신경 쓴 견고한 설계다. 남은 항목은 모두 INFO 등급으로, 신규 결함이 아니라 (1) precheck의 의도된 상태값 노출, (2) 재사용 가능한 SQL 헬퍼의 방어적 강화 여지, (3) 실행 엔진 경로의 이미 문서화된 후속 과제다.

## 위험도

NONE
