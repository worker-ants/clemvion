# 요구사항(Requirement) 리뷰 결과

리뷰 대상: M-3 1단계 — `AssistantToolRouter` 추출 (explore dispatch + kind 분류 분리)
리뷰 일시: 2026-06-23

---

## 발견사항

### [INFO] `verify_workflow` 인자 `requestCoverage` / `concerns` 서버 측 미사용
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` `buildVerifyWorkflowResult` (라인 629–665)
- 상세: spec §4.1 표에서 `verify_workflow` 인자는 `{verifiedNodeIds, verifiedEdgeIds, requestCoverage: string, concerns?: string[]}` 이며, `requestCoverage`는 "Stored on the tool_calls row for audit"으로 정의된다. 그러나 `buildVerifyWorkflowResult`는 `verifiedNodeIds` / `verifiedEdgeIds` 만 참조하고 `requestCoverage`와 `concerns`는 읽지도 저장하지도 않는다. 이 gap은 이번 refactor가 **verbatim 이동**한 것이므로 pre-existing 상태이며, 이번 PR이 도입한 결함이 아니다.
- 제안: `requestCoverage` 저장 누락은 별도 이슈로 추적한다(spec §4.1 "Stored on the tool_calls row" 약속 미이행). 본 PR 범위 밖.

---

### [INFO] [SPEC-DRIFT] schemaCache 소유권 명세가 리팩토링 후 구 파일 기준으로 남아 있음
- 위치: `spec/3-workflow-editor/4-ai-assistant.md` §Part A "schemaCache 정책" (L928)
- 상세: spec은 "`workflow-assistant-stream.service.ts` 의 턴 스코프 `schemaCache: Map<string, { result, hits }>`" 로 표현하며, 이 상수 변경 시 "서비스 L137–142 주석 + L459–462 inline 주석" 을 동시 수정하라고 지시한다. 그러나 이번 리팩토링으로 schemaCache 의 **policy 로직(hits 증가, warning, hard-stop)**은 `AssistantToolRouter.dispatchExplore`로 이동했고, 상수 `SCHEMA_LOOKUP_HARD_STOP`도 router 로 이동했다. schemaCache 의 **할당 소유**는 여전히 `streamMessage`에 남아 있으나, 변경 가이드의 파일명·라인 번호가 실제 코드 위치와 더 이상 일치하지 않는다. 코드 구현은 의도적이고 합리적이며 되돌리는 것이 오답이다.
- 제안: 코드 유지 + spec 반영. `spec/3-workflow-editor/4-ai-assistant.md` §Part A "schemaCache 정책" 절에서 "policy 로직·상수는 `assistant-tool-router.service.ts` 의 `dispatchExplore`로 이전, 캐시 맵 할당 소유는 `streamMessage`에 잔류" 로 서술을 갱신하고, 유지보수 체크리스트(L990) "서비스 L137–142…" 부분을 router 파일 기준으로 수정한다.

---

### [INFO] spec §4.1 표의 `get_current_workflow` 반환 필드 `ok` 명시 여부 vs 구현
- 위치: `assistant-tool-router.service.ts` `buildCurrentWorkflowResult` (L613–615)
- 상세: spec §4.1 표에서 `get_current_workflow`의 반환은 `{ok, nodes, edges}` 로 명시되어 있다. 구현은 `{ ok: true, ...toWorkflowView(shadow.snapshot()) }` 으로 `ok: true` 를 포함한다. 일치함 — 이상 없음.

---

### [INFO] 테스트 파일 `makeExploreTools` mock에서 `verify_workflow` · `get_current_workflow` 메서드 부재 (의도적)
- 위치: `assistant-tool-router.service.spec.ts` `makeExploreTools` (L83–92)
- 상세: `verify_workflow`와 `get_current_workflow`는 `ExploreToolsService`에 위임하지 않고 router 내부에서 shadow 접근으로 처리하므로 mock에 포함하지 않는 설계가 올바르다. 테스트가 이를 단언(L179 `exploreTools.getNodeSchema.not.toHaveBeenCalled()`)으로 확인하고 있다. 이상 없음.

---

### [INFO] 단위 테스트 커버리지 — `get_workflow`, `list_knowledge_bases`, `get_workflow_executions`, `get_execution_details` 위임 단언 부재
- 위치: `assistant-tool-router.service.spec.ts` `dispatchExplore` describe (L146–346)
- 상세: `list_integrations`와 `list_workflows`는 위임 인자까지 단언하는 테스트가 있으나, 나머지 4개 explore 도구(`get_workflow`, `list_knowledge_bases`, `get_workflow_executions`, `get_execution_details`)는 mock 선언만 있고 실제 dispatch 단언 테스트가 없다. 통합 테스트(`workflow-assistant-stream.service.spec.ts`)가 이를 간접 커버하므로 기능 결함은 아니다.
- 제안: 선택적 보강. 특히 `get_workflow`의 `mode` 인자 검증 로직(`args.mode === 'full' ? 'full' : 'summary'`)은 단위 테스트가 없어 회귀 위험이 약간 높다.

---

## 요약

이번 변경은 `streamMessage` 루프에서 explore 도구 dispatch와 kind 분류를 `AssistantToolRouter`로 분리하는 **순수 리팩토링**이다. 기능 로직은 verbatim 이동이 확인되었으며 (`buildCurrentWorkflowResult`, `buildVerifyWorkflowResult`, `handleExploreCall`, `SCHEMA_LOOKUP_HARD_STOP`), SSE 순서·가드 발동·캐시 동작 의미는 그대로 보존된다. `schemaCache` 소유와 `reviewCompleted` 신호 패턴도 spec §10 Phase 1/2/3 계약을 충족한다. 발견된 이슈는 모두 pre-existing 이거나 spec 갱신 누락(SPEC-DRIFT) 수준이며, 이번 PR이 새로 도입한 요구사항 위반은 없다. `requestCoverage` 필드 미저장은 기존 구현의 gap으로 별도 추적이 필요하다.

## 위험도

LOW

---

STATUS: SUCCESS
