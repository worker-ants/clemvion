# 부작용(Side Effect) 리뷰 — integration-personal-owner

## 검증 방법

프롬프트가 잘라낸 전체 파일 컨텍스트는 `Read` 로 직접 열어 확인했고, 특히 시그니처가 바뀐 메서드들은
`grep -rn` 으로 저장소 전체(`codebase/backend/src`)에서 다른 호출자가 남아 있는지 전수 확인했다
(스크래치 디렉터리·저장소 뮤테이션 없이 read-only 로만 진행 — `git status --short` 로 트리 무변경 확인 완료).

## 발견사항

- **[INFO]** 광범위한 시그니처 변경 — 저장소 전체 grep 으로 누락 호출자 없음을 확인
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (`findAll`·`findById`·`getUsages`·`getActivity`·`testConnection`·`update`·`remove`·`reauthorize`) · `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (`precheckCafe24Mall`·`precheckMakeshopShop`) · `codebase/backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts` (`fillCandidates`·`lookupIntegrations`·`lookupMcpServers`) · `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts` (`listIntegrations`) · `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` (`dispatchExplore`/`handleExploreCall`) · `codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.ts` (`evaluateReviewGuard`)
  - 상세: 이들 메서드에 `userId`/`userRole` 필수 파라미터가 새로 추가되거나 기존 파라미터 사이에 삽입됐다(예: `getActivity(id, workspaceId, limit, days)` → `getActivity(id, workspaceId, userId, limit, days)`, `findAll(workspaceId, query)` → `findAll(workspaceId, userId, query)`). 이런 "중간 삽입형" 시그니처 변경은 미갱신 호출자가 있으면 타입이 맞아떨어져 조용히 잘못된 인자가 밀려 들어갈 위험이 있다(예: 문자열 자리에 숫자가 들어가는 식). `IntegrationsService` 를 참조하는 파일 전체(`grep -rln "IntegrationsService"`)와 `assistant-tool-router`/`candidate-lookup`/`explore-tools` 의 실제 호출부를 대조한 결과, 컨트롤러(`integrations.controller.ts`)·`workflow-assistant-stream.service.ts`·관련 spec 파일 외에는 이 메서드들을 부르는 코드가 없었고, 노드 실행 경로(`nodes/integration/**`, `nodes/ai/ai-agent/tool-providers/**`)는 전용 메서드 `getForExecution`(아래 참조)만 쓰므로 영향이 없다.
  - 제안: 없음 — 확인 완료. 향후 이 메서드들에 새 호출자를 추가할 때 중간 삽입형 파라미터 순서를 다시 참고하도록 주석(이미 일부 존재)을 유지할 것.

- **[INFO]** `getForExecution` 은 새 personal 가시성 판정을 의도적으로 우회한다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `getForExecution()` (여전히 `requireEntity` 사용, `requireVisible` 아님)
  - 상세: 이번 PR 의 `requireVisible`/`isIntegrationVisibleTo` 판정은 HTTP 요청 경로(`findById`·`update`·`remove`·`testConnection`·`rotate`·`reauthorize`·`requestScopes`·`updateScope`·`getUsages`·`getActivity`)와 `list_integrations`/`fillCandidates` 후보 조회 경로에만 적용됐다. 실행 엔진 전용 `getForExecution` 은 여전히 워크스페이스 스코프만 검사해, 워크플로 실행 시점에는 남의 personal 통합이라도 그 통합을 참조하는 노드가 있으면 자격 증명을 그대로 읽어 쓸 수 있다. 이는 호출자 고지·plan(`integration-personal-owner-followup.md`)·spec Rationale("아직 강제되지 않는 것")에서 이미 후속으로 명시된 알려진 잔여 갭이며, 이 diff 가 새로 만든 결함은 아니다.
  - 제안: 새 결함이 아니므로 조치 불필요 — 다만 이 PR 의 보안 수정 범위가 "관리 API 접근"에 한정되고 "노드 실행 시점 자격 증명 사용"까지는 닫지 않는다는 점을 리뷰 판단에 반영할 것(이미 후속 plan 에 있음, 재기재 아님).

- **[INFO]** 거부 코드 승격(`FORBIDDEN` → `ADMIN_REQUIRED`)은 기존 엔드포인트의 에러 응답 바디를 바꾸는 의도된 인터페이스 변경
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `rotate`(구 `assertCanRotate`)·`updateScope`·`create`(organization scope 생성)·`requestScopes`
  - 상세: HTTP 상태 코드는 403 으로 동일하지만 응답 바디의 `error.code` 문자열이 `FORBIDDEN` 에서 `ADMIN_REQUIRED` 로 바뀐다. 프런트엔드 코드(`codebase/frontend/src`)에는 이 값에 의존하는 곳이 없음을 grep 으로 확인했고, 호출자 고지에도 "기존 `FORBIDDEN` 4곳도 승격"이 의도된 동작으로 명시돼 있다. 다만 이 API 를 직접 호출하는 외부 클라이언트(문서화된 공개 API 소비자가 있다면)가 `code === 'FORBIDDEN'` 문자열 매칭을 하고 있었다면 이번 배포로 그 매칭이 깨진다.
  - 제안: 의도된 변경이므로 코드 수정 불요. CHANGELOG 에 이미 반영됐는지만 확인(호출자 고지가 CHANGELOG 최상단 항목을 SoT 로 지목하고 있어 별도 조치 불필요로 판단).

- **[INFO]** 컨트롤러의 `resolveRole()` 추가 호출은 기존에 이미 있던 패턴을 확장한 것 — 새로운 이상 패턴 아님
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` — `update`·`remove`·`reauthorize`·`oauthBegin`(reauthorize/request_scopes 모드)
  - 상세: `reauthorize`·`requestScopes`·`updateScope` 라우트에는 `@Roles('editor')` 데코레이터가 없다(grep 확인 — `@Roles` 는 `create`·`update`·`rotate`·`remove` 에만 있음). 즉 `RolesGuard` 는 이 라우트들에서 보통 경로(토큰 기반 멤버십 확정 시)에는 DB 를 왕복하지 않는다. 이번 PR 이 추가한 `resolveRole()` 호출은 이 라우트들에 대해 **새로운 필수 DB 왕복**을 요청마다 추가한다. 다만 이 패턴 자체(`resolveRole` 뒤 서비스에 role 전달)는 `create()` 에 이미 diff 이전부터 존재했던 기존 관례와 동일해, 일관성 문제는 없다.
  - 제안: 기능적 결함은 아님(Admin 판정을 위해 역할 조회가 필수) — 성능 최적화가 필요하면 `RolesGuard` 가 조회한 역할을 `request` 에 캐싱해 재사용하는 방안을 별도 후속으로 고려할 수 있으나 이 리뷰 범위 밖.

- **[INFO]** `INTEGRATION_VIEWER_PARAM`(`'integrationViewerId'`) 이름 충돌 가능성 — 실제로는 없음, 확인 완료
  - 위치: `codebase/backend/src/modules/integrations/integration-visibility.ts` · 사용처 `integrations.service.ts::findAll`, `explore-tools.service.ts::listIntegrations`
  - 상세: TypeORM `QueryBuilder.andWhere(sql, params)` 는 같은 이름의 파라미터가 여러 번 바인딩되면 뒤에 것이 앞의 것을 덮어쓴다. `findAll`/`listIntegrations` 모두 이 파라미터를 한 번만 바인딩하고, 그 외 `q`/`status`/`serviceType`/`workspaceId` 등과 이름이 겹치지 않아 실제 충돌은 없음을 코드 대조로 확인했다.
  - 제안: 없음(확인 목적의 기재).

## 요약

이번 diff 는 통합(Integration) 도메인의 10여 개 서비스/컨트롤러 메서드 시그니처에 `userId`/`userRole` 를 일관되게 추가해 personal-scope 가시성과 Organization-scope Admin 강제를 배선한다. 시그니처 변경 폭이 크지만(중간 삽입형 파라미터 포함) 저장소 전체 grep 으로 미갱신 호출자가 없음을 확인했고, 새 전역 변수·예상치 못한 파일시스템 쓰기·의도치 않은 네트워크 호출은 발견되지 않았다(테스트의 `http-connection-tester` mock 은 오히려 실제 외부 호출을 차단하는 의도적 조치). 유일하게 의도된 형태로 남아 있는 잔여 부작용은 (1) `getForExecution`(노드 실행 엔진)이 새 판정을 우회한다는 점과 (2) 4곳의 거부 코드가 `FORBIDDEN`→`ADMIN_REQUIRED` 로 바뀌어 외부 API 소비자에게 보이는 응답 바디가 달라진다는 점인데, 둘 다 호출자 고지·spec Rationale·plan 후속 문서에 이미 명시된 의도된 동작이라 이 리뷰에서 새로 발견한 결함으로 취급하지 않는다.

## 위험도

LOW
