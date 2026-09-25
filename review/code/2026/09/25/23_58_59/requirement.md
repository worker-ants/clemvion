# 요구사항(Requirement) Review — integration-personal-owner (round 3)

## 스코프

`codebase/**` 22개 파일(백엔드 통합 인가 로직 12개 + workflow-assistant 6개 + DTO 1개 + e2e 1개, 프런트 문서 mdx 4개).
목적: Personal 통합은 생성자(`created_by`)에게만 보이게 하고(남의 personal = 없는 통합과 같은 404),
Organization 통합의 변경은 Admin 이상으로 제한하며, `oauth/begin` 의 `reauthorize`/`request_scopes` 우회 입구와
콜백 커밋 직전 재판정을 추가한다. 1·2라운드에서 이미 Critical 1 · Warning 17 을 조치했고(`5999aedfe`, `2f3562ce7`),
본 라운드는 잔여 회귀·spec 정합만 본다.

대조한 SoT: `spec/2-navigation/4-integration.md` §8 «판정 규칙» · Rationale «Personal 통합 소유자 강제»,
`spec/3-workflow-editor/4-ai-assistant.md` §4.1 · §4.3.1, `spec/5-system/1-auth.md` §3.2,
`codebase/backend/src/common/constants/workspace-roles.ts`, `plan/in-progress/integration-personal-owner-followup.md`.

## 검증 방법

- `integration-visibility.ts`(신규 순수 함수 모듈)와 `integrations.service.ts`/`integration-oauth.service.ts`/
  `integrations.controller.ts` 실제 소스 전문을 Read 로 열어 diff 문맥과 대조.
- `:id` 경로 10개 핸들러 전수(`integrations.controller.owner.spec.ts` 의 리플렉션 캐너리 `BY_ID` 표)가 컨트롤러의
  실제 `PATH_METADATA` 라우트 목록과 일치하는지 확인.
- `IntegrationOAuthService`/`IntegrationsService` 생성자 시그니처와 스펙 spy 테스트의 인자 개수·순서 대조.
- `WorkspacesModule`(`@Global`, `WorkspacesService` export)과 `IntegrationsModule` 의 import 로 순환 의존 여부 확인.
- `spec/2-navigation/4-integration.md` §8 표(액션 × Personal/Organization)의 9개 행을 코드 경로 1:1 대조.
- `spec/3-workflow-editor/4-ai-assistant.md` §4.1/§4.3.1 이 이미 "요청자에게 보이는 것만" 문구로 갱신돼 있음을 확인(별도
  diff 없이 기존 상태로 정합).
- CHANGELOG 최상단 항목·`plan/in-progress/integration-personal-owner-followup.md` 로 "아직 강제되지 않는 것"(§8) 4개
  항목이 이번 PR 스코프 밖으로 명시적으로 추적되는지 확인.

## 발견사항

- **[INFO]** `update`/`remove`/`reauthorize`/`requestScopes` 컨트롤러 핸들러가 대상 통합의 scope 를 알기 전에
  `roleOf()`(→ `WorkspacesService.getMemberRole` DB 조회)를 항상 먼저 호출한다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` — `update`(라인 483행 부근, diff 게이트
    `489`), `remove`(게이트 `662`), `reauthorize`(게이트 `573`), `requestScopes`(게이트 `604`).
  - 상세: §8 판정 규칙상 Personal 통합(«본인 것만»)은 역할을 보지 않으므로(`assertCanModify` 가 `scope !== 'organization'`
    이면 즉시 return), 다수를 차지할 Personal 대상 요청에서도 매번 불필요한 멤버십 조회 쿼리가 하나씩 더 나간다. 기능
    정확성에는 영향 없음 — `create`/`rotate`/`updateScope` 등 기존 코드도 이미 같은 패턴이라 이번 PR 이 새로 만든 문제는
    아니고 규모만 두 자리에서 몇 곳 더 늘었다.
  - 제안: 필요하면 후속으로 `requireVisible` 로 먼저 엔티티를 읽어 scope 를 확인한 뒤 organization 일 때만 role 을 조회하도록
    순서를 바꿀 수 있다. 다만 컨트롤러가 서비스 내부 엔티티에 접근하지 않는 현재 계층 분리를 깨야 해서, 리팩터링 비용 대비
    이득이 크지 않다면 현행 유지도 무방(요구사항 충족에는 지장 없음).

- **[INFO]** OAuth 콜백의 `assertRequesterStillAllowed` 가 `pessimistic_write` 행 락을 잡은 트랜잭션 내부에서
  `this.workspacesService.getMemberRole(...)` (다른 리포지토리·다른 커넥션의 추가 왕복)을 호출한다.
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` 의 `assertRequesterStillAllowed`
    (diff 게이트 `414`-`419`), 호출부 `handleCallback` 트랜잭션 안(게이트 `816`).
  - 상세: Organization 통합 재인증/콜백은 트래픽이 낮고(사용자 1회성 리다이렉트), 이 추가 쿼리가 잡는 락 보유 시간
    연장은 실질적 경합 위험이 낮다. 다만 설계상 "가능한 한 락 구간을 짧게" 라는 인접 원칙(예: rotate 의
    `mergeAndValidateCredentials` 를 "순수 함수라 임계 구간을 늘리지 않는다"고 명시한 주석)과 대비되는 지점이라 참고
    삼아 기록한다. 기능 결함은 아니다.
  - 제안: 낮은 우선순위. 필요시 락 안에서 role 을 조회하는 대신 락 전에 한 번 더 재조회하는 방식으로 바꿀 수 있으나,
    role 이 락과 credentials 교체 사이에 다시 바뀔 가능성(TOCTOU)을 남기므로 현재 설계(락 안에서 재조회)가 정확성
    측면에서는 더 보수적이다 — 트레이드오프이지 결함은 아니다.

이상 두 건 모두 INFO 수준이며 기능·spec 정합에는 영향이 없다. 그 외에는 다음을 전수 확인했고 전부 일치했다:

- §8 표의 9개 액션(생성·조회·수정·Reauthorize·Rotate·Scope 추가·전환·삭제·노드 사용) 중 노드 사용을 제외한 8개가
  코드 경로(`assertCanModify`/`requireVisible`/`requireModifiable`/`isAdmin` 직접 체크)와 1:1 대응. 노드 사용 미적용은
  spec §8 "아직 강제되지 않는 것" 에 명시된 의도적 유예이며 `integration-personal-owner-followup.md` 에 추적 중 —
  이번 PR 의 결함이 아니다.
- `:id` 경로 10개 핸들러(`findOne`/`listUsages`/`activity`/`testConnection`/`update`/`rotate`/`reauthorize`/
  `requestScopes`/`updateScope`/`remove`) 전부 `requireVisible` 또는 `requireModifiable` 를 거치며, 리플렉션 완결성
  캐너리(`integrations.controller.owner.spec.ts`)가 향후 라우트 추가 누락을 잡는다.
- `oauth/begin` 의 `reauthorize`/`request_scopes` + `integrationId` 조합만 `requireModifiable` 를 거치고 `mode:'new'`
  는 건드리지 않는다 — `modifyActionOfBeginMode` 의 `never` exhaustiveness 체크로 향후 mode 추가 시 컴파일 타임에
  강제된다.
- 콜백 커밋 직전 재판정(`assertRequesterStillAllowed`)이 `pending_install` 행을 의도적으로 건너뛰는 것은 spec §8
  "아직 강제되지 않는 것" 의 명시된 잔여 갭과 정확히 일치(begin 이 그 입구를 막는다는 전제도 코드와 동일).
  `@Optional() workspacesService` 가 없을 때 fail-closed(거부)로 떨어지는 것도 테스트로 확인.
  `WorkspacesModule` 이 `@Global`+export 이고 `IntegrationsModule` 이 이를 import 하므로 실제 DI 에서 순환 의존
  없이 주입된다(`@Optional()` 은 수동 생성 테스트 호환용이라는 주석과 실제 배선이 일치).
  `judgedRow`(id+workspaceId+scope) 를 조건으로 쓰는 조건부 `update`/`delete` (compare-and-set)가 `update`/`remove`/
  `updateScope`/`reauthorize` 4곳에 일관되게 적용되어 판정-쓰기 사이 scope 변경의 lost-update/권한 상승을 막는다.
  `precheckCafe24Mall`/`precheckMakeshopShop` 이 `pickPrecheckConflict` 공통 함수로 통합되며 §9.2 의 "충돌은 scope
  무관, 식별자만 남의 personal 이면 생략" 을 정확히 구현(우선순위 상태·fallback 상태 양쪽 케이스 테스트 존재).
- workflow-assistant 의 `list_integrations`/`integration-selector`/`mcp-server-selector` 전 경로가 `userId` 를
  최종 HTTP 핸들러(`user.sub`)부터 `ExploreToolsService`/`CandidateLookupService` 까지 완전히 관통해 전달하며,
  대상 spec(`4-ai-assistant.md` §4.1·§4.3.1)의 문구가 이미 "요청자에게 보이는 것만" 으로 갱신돼 있어 line-level 로
  일치한다.
- CHANGELOG 최상단 항목이 이번 변경(404 통일·`ADMIN_REQUIRED` 승격·우회 입구 차단)을 정확히 기술하고,
  `Cafe24PrecheckResultDto`/컨트롤러 Swagger 설명 문구도 실제 동작(식별자 생략 조건)과 일치.
- `UpdateIntegrationDto` 에 `scope` 필드가 없어 `PATCH /:id` 로 scope 변경(Admin 우회)이 새지 않음을 확인.

## 요약

Personal/Organization 권한 판정을 `integration-visibility.ts` 순수 함수로 단일화하고, 목록·`:id` 경로 10개·
`oauth/begin` 우회 입구·OAuth 콜백 커밋 직전 재판정·precheck·workflow-assistant 탐색 도구까지 전 표면에 일관되게
적용한 구현이다. spec(`4-integration.md` §8, Rationale)과 line-level 로 대조한 결과 문구·에러 코드(`RESOURCE_NOT_FOUND`/
`ADMIN_REQUIRED`)·판정 순서(보이는가 → Organization 이면 Admin)·조건부 쓰기(judgedRow compare-and-set)·정확히 일치했고,
`:id` 라우트 완결성 리플렉션 캐너리와 e2e(액터 4종 × invariant 전수)로 회귀 방지 장치도 갖췄다. §8 의 "아직 강제되지
않는 것"(노드 실행·pending 재사용·Viewer 자기 personal·상세 화면 버튼)은 spec 자체가 명시적으로 유예했고 별도
followup plan 으로 추적되므로 결함이 아니다. 발견한 두 건은 모두 INFO(성능/락 구간 관련 참고 사항)이며 CRITICAL/WARNING
급 기능 결함이나 spec 불일치는 발견하지 못했다.

## 위험도

LOW
