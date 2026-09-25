# 변경 범위(Scope) 리뷰 — integration-personal-owner

## 발견사항

- **[INFO]** 변경 반경이 `codebase/backend/src/modules/integrations/**` 를 넘어 `codebase/backend/src/modules/workflow-assistant/**` (assistant-finish-guard, assistant-tool-router, candidate-lookup, explore-tools, workflow-assistant-stream) 5개 서비스까지 `userId` 전파로 번짐
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:164-176`, `codebase/backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts:49-53,69-91,111-124,166-180`, `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts:28-34,82-119`, `codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.ts` (evaluateReviewGuard 시그니처), `codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` (streamMessage 호출부 4곳)
  - 상세: 이 PR 의 표제(호출자 고지) 는 "통합(Integration)의 Personal 범위 강제"인데 실제 diff 는 워크플로우 어시스턴트의 도구 라우팅 체인 전체(스트림 서비스 → 툴 라우터 → finish-guard → candidate-lookup → explore-tools)에 `userId` 파라미터를 추가한다. 다만 이는 `list_integrations` 툴과 `integration-selector`/`mcp-server-selector` 후보 조회가 내부적으로 `IntegrationsService.findAll`/`ExploreToolsService.listIntegrations` 를 호출하므로, 이 경로를 고치지 않으면 AI 어시스턴트가 여전히 남의 personal 통합을 후보/목록으로 노출하는 우회 경로가 남는다. 호출자 고지가 이를 SoT 로 명시(`spec/3-workflow-editor/4-ai-assistant.md §4.1 · §4.3.1`)하고 있어 의도된 범위로 판단된다. 다만 리뷰 대상 파일이 5개 모듈·9개 파일로 확산돼 "통합 모듈 변경"이라는 1차 인상과 어긋나므로, PR 설명/커밋 메시지에 이 2차 표면(어시스턴트 도구 체인)을 별도로 명시했는지 확인 필요.
  - 제안: 조치 불요(이미 spec·plan 참조로 정당화됨). PR 본문에 "통합 + AI 어시스턴트 두 표면" 임을 한 줄 요약하면 다음 리뷰어의 스코프 판단이 더 빨라진다.

- **[INFO]** `integration-oauth.service.ts` 의 `pickPrecheckConflict` 추출 및 `assertCanRotate` → `assertCanModify` 일반화는 리팩토링이지만 신규 로직(가시성 필터링, 4개 액션 공통 Admin 검사)을 중복 없이 양쪽(cafe24/makeshop, update/remove/rotate/reauthorize)에 적용하기 위해 필요한 변경과 결합돼 있다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:328-360` (`pickPrecheckConflict` 신설), `codebase/backend/src/modules/integrations/integrations.service.ts` (`assertCanRotate` 삭제 → `assertCanModify` 로 대체, 호출부 `rotate`/`requestScopes`/`updateScope` 등)
  - 상세: 순수 "코드 정리" 목적이 아니라 새 파라미터(`viewerId`/`action`)를 두 곳(또는 네 곳)에 동일하게 얹어야 해서 추출이 자연스럽다. 무관한 리팩토링으로 보지 않음.
  - 제안: 조치 불요.

- **[INFO]** `integrations.controller.ts` 의 `@ApiForbiddenResponse`/`@ApiNotFoundResponse` Swagger 설명 문자열이 거의 모든 `:id` 엔드포인트에서 리터럴 → 공유 상수(`FORBIDDEN_MEMBER`, `NOT_FOUND_INTEGRATION` 등)로 바뀜
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` (findOne/listUsages/activity/testConnection/update/rotate/reauthorize/requestScopes/updateScope/remove 데코레이터 전부)
  - 상세: 표면적으로는 각 엔드포인트의 Swagger 문서 리팩토링처럼 보이지만, 실제로는 이번 PR 에서 도입한 `ADMIN_REQUIRED`/`RESOURCE_NOT_FOUND`(남의 personal=404) 의미 변경을 문서에 반영하기 위한 것 — 변경되지 않은 것처럼 보이는 `@ApiForbiddenResponse({ description: FORBIDDEN_MEMBER })` 케이스(findOne 등, 순수 멤버십 체크만 있는 엔드포인트)도 있어 "왜 여기도 바뀌었나" 의문이 들 수 있으나, `NOT_FOUND_INTEGRATION` 상수 자체가 "남의 personal 도 같은 응답" 문구를 담고 있어 해당 엔드포인트 문서 정확성을 위해 필요하다.
  - 제안: 조치 불요 — 스코프 이탈 아님.

- 그 외 8개 항목(호출자 고지가 열거한 "의도된 동작": 남의 personal 404·`FORBIDDEN`→`ADMIN_REQUIRED` 승격 4곳·precheck id/name 은닉·`getForExecution` 후속 제외 등)은 실제 diff 와 대조한 결과 고지 내용과 일치하며 추가 스코프 이탈로 볼 근거를 찾지 못했다.
- 문서 변경(`integration-management.mdx`/`.en.mdx`)은 이번 PR 이 바꾸는 권한·가시성 규칙만 서술 범위로 하며, 무관한 섹션(연결 테스트 규칙·MCP 등)은 손대지 않았다.
- 22개 변경 파일 전부가 `spec/2-navigation/4-integration.md §8`, `spec/3-workflow-editor/4-ai-assistant.md §4.1/§4.3.1`, `spec/5-system/3-error-handling.md §1.2`, `spec/5-system/1-auth.md §3.2` 중 하나에 직접 대응되며, 이 네 spec 밖의 코드 영역(예: 다른 도메인 모듈, 무관한 설정 파일, lint/build 설정 등)에 대한 수정은 발견되지 않았다.
- 포맷팅 전용 변경(공백·줄바꿈만 바뀐 diff hunk)이나 임포트 정리성 변경(사용하지 않는 import 추가/삭제), 불필요한 주석 추가/삭제는 발견되지 않았다 — 모든 주석 변경은 신규 로직(가시성 판정, ADMIN_REQUIRED 승격)을 설명하는 내용이었다.

## 요약

22개 변경 파일 전부가 "Personal 통합은 생성자에게만, Organization 통합 변경은 Admin 이상" 이라는 단일 보안 수정 목표(spec §8, §4.1/§4.3.1, §3.2, §1.2)에 직접 대응한다. 1차 표면(`integrations` 모듈: 서비스·컨트롤러·visibility 헬퍼·oauth precheck)뿐 아니라 2차 표면(워크플로우 어시스턴트의 `list_integrations`/후보 조회 체인)까지 `userId` 를 전파한 것은 처음엔 범위가 넓어 보이지만, 해당 경로가 실제로 통합 목록을 읽는 우회 입구였기 때문에 spec 이 명시적으로 요구하는 동일 수정의 연장선이다. `pickPrecheckConflict` 추출·`assertCanModify` 일반화 같은 리팩토링도 신규 파라미터를 중복 없이 얹기 위한 필요 변경이며, 순수 코드 정리 목적의 무관한 리팩토링은 없다. Swagger 설명 문자열 변경·문서(mdx) 변경도 모두 이번 권한 모델 변경을 정확히 반영하기 위한 것으로, 무관한 섹션은 건드리지 않았다. 포맷팅/주석/임포트 관점에서 실질 변경과 뒤섞인 무의미한 정리도 확인되지 않았다.

## 위험도

NONE
