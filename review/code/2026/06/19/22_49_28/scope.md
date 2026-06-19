# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] 파일 3 (ai-agent.handler.ts) — 인라인 타입 선언 2곳 모두 교체
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1488, L2413
- 상세: plan `c1-dev-followups-1b.md` §1b-2 는 "L1488·L2413 인라인 Array<...> 2곳 → `LlmCallRecord[]`" 로 명시하고 있으며, 실제 diff 도 정확히 이 2개 위치만 수정한다. 기능 변경 없음, 타입 선언 정리만이므로 범위 내.

### [INFO] 파일 7 (output-shape.ts) — `TurnDebugEntry` → `TurnRagDelta` rename, 동일 파일 4개 참조 전부 변경
- 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts` L301-324
- 상세: plan §1b-3 이 "`output-shape.ts` exported `TurnDebugEntry` → `TurnRagDelta` rename(4 refs, 1파일)" 로 정확히 기술하며 diff 도 interface 선언·타입 별칭 사용·함수 반환 타입·내부 변수 4곳만 변경한다. 범위 내.

### [INFO] 파일 8-9 (plan/complete/) — 신규 완료 plan 파일 2개 추가
- 위치: `plan/complete/c1-engine-split.md`, `plan/complete/c1-pr2-aiturn-blueprint.md`
- 상세: 이 파일들은 c1-engine-split 전체 작업의 Gate C 이동(완료 처리)에 해당한다. `c1-engine-split.md` L536-537 에 "Gate C: plan/complete/ 이동" 이 명시되어 있고, 현재 PR(spec-drift-c1-ea8bcb)이 c1 마지막 단계이므로 이 이동은 작업 범위에 포함된다.

### [INFO] 파일 10 (plan/in-progress/c1-dev-followups-1b.md) — 워크플로 체크박스 갱신
- 위치: `plan/in-progress/c1-dev-followups-1b.md` L747 (`TEST WORKFLOW` 체크)
- 상세: 전체 파일 컨텍스트(최신 상태)와 diff 를 비교하면 `TEST WORKFLOW` 항목이 체크 완료 상태로 갱신되어 있고 `/ai-review`, `/consistency-check --impl-done` 은 미완. plan 체크박스는 실제 작업 수행 후 갱신하는 것이 프로젝트 규약이므로 범위 내.

### [INFO] 파일 11-17 (review/consistency/...) — consistency-check --spec 산출물
- 위치: `review/consistency/2026/06/19/21_40_43/` 하위 6개 파일
- 상세: `/consistency-check --spec` 수행 결과물로, 코드 파일 변경과 직접 연계된 spec 검증 산출물이다. `review/` 경로는 CLAUDE.md 정책상 지정 위치이며, spec-drift 반영 컨텍스트에서 일관성 검증은 필수 단계. 범위 내.

### [INFO] 파일 1-2 (execution-engine.service.ts, workflow-errors.ts) — typed error 클래스 도입
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `workflow-errors.ts`
- 상세: plan §1b-1 에서 `WorkflowForbiddenWorkspaceError` typed error 추가 및 `assertSameWorkspace` 의 inline `Error(...)` 를 typed throw 로 교체를 명시. diff 는 이 변경만 포함하며 코드 구조·로직 변경 없음. 범위 내.

### [INFO] 파일 4 (error-codes.ts) — `WORKFLOW_FORBIDDEN_WORKSPACE` enum 등재
- 위치: `codebase/backend/src/nodes/core/error-codes.ts`
- 상세: plan §1b-1 의 "error-codes.ts: `WORKFLOW_FORBIDDEN_WORKSPACE` enum 등재" 와 정확히 일치. 추가된 JSDoc 주석은 코드 맥락 설명으로 과도하지 않다.

### [INFO] 파일 5-6 (workflow.handler.spec.ts, workflow.handler.ts) — mapSubWorkflowError 분기 추가 및 테스트
- 위치: `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts`, `workflow.handler.spec.ts`
- 상세: plan §1b-1 의 "mapSubWorkflowError: instanceof WorkflowForbiddenWorkspaceError 분기" + "테스트: mapSubWorkflowError 분기" 와 정확히 일치. 3개 테스트 케이스(mismatch / missing caller context / plain Error backstop)는 양 케이스와 defensive backstop 을 커버하며 범위 내.

## 요약

변경된 17개 파일 전체가 `plan/in-progress/c1-dev-followups-1b.md` 에 명시된 dev 1b 3개 작업(1b-1 `WORKFLOW_FORBIDDEN_WORKSPACE` enum 등재, 1b-2 ai-agent inline llmCalls 타입 통합, 1b-3 frontend `TurnDebugEntry` → `TurnRagDelta` rename)과 c1 Gate C plan 이동, consistency-check --spec 산출물로 구성된다. 의도 이상의 변경, 무관한 리팩토링, 불필요한 기능 확장, 포맷팅 혼입, 임포트 정리 범위 일탈 등 범위 이탈 징후는 발견되지 않는다. 모든 수정이 plan 문서에 사전 기술된 항목과 1:1 대응하며 최소 범위를 유지한다.

## 위험도

NONE
