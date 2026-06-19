# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] WorkflowForbiddenWorkspaceError JSDoc — executeSync 언급 정확성
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` L75–78
- 상세: JSDoc 에 "`executeInline` / `executeSync` / `executeAsync` 진입에서 발생"이라고 기재되어 있다. 그러나 consistency-check SUMMARY I-3 이 지적하듯 `executeSync` 는 `spec/4-nodes/2-flow/1-workflow.md §4` 에 없는 메서드명이며 canonical 명칭은 `executeInline`/`executeAsync` 두 가지다. 프로덕션 호출자도 0건으로 확인된 바 있다(plan c1-engine-split.md ★ 절). JSDoc 이 구현 현실을 정확히 반영하되 비-canonical 명칭을 포함하면 독자가 혼동할 수 있다.
- 제안: JSDoc 에서 `executeSync` 를 제거하고 `executeInline` / `executeAsync` 두 가지만 표기. 또는 괄호로 "(executeSync 는 현재 프로덕션 호출자 없음)" 명시.

### [INFO] error-codes.ts WORKFLOW_FORBIDDEN_WORKSPACE 주석 — surface 경로 기술 보강 가능
- 위치: `codebase/backend/src/nodes/core/error-codes.ts` L61–66
- 상세: 주석에 W-6 맥락·spec 좌표·deny-by-default 설명이 잘 갖춰져 있다. 다만 이제 `mapSubWorkflowError` 의 typed branch 를 통해 직접 surface 되어 더 이상 `SUB_WORKFLOW_FAILED` 로 fallthrough 하지 않는다는 사실이 주석에 반영되어 있지 않다. 이전 spec 상태와 혼동될 여지가 있다.
- 제안: "Surfaced at the Sub-Workflow node's error port via `mapSubWorkflowError` typed branch (no longer falls through to `SUB_WORKFLOW_FAILED`)." 로 보강 (선택적).

### [INFO] ai-agent.handler.ts 인라인 주석 — 한국어·영어 혼용 비일관성
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1487–1488, L2407–2408
- 상세: 두 곳에 추가된 인라인 주석 "// Canonical shared trace type (C-1 후속 ③ / dev 1b). all-optional superset\n// 이지만 아래 push site 는 항상 전 필드를 공급한다." 은 영어·한국어가 혼합되어 있다. 동일 파일의 다른 주석들("// Per-call trace so the frontend LlmInformationTab can inspect each")은 영어 단독이다.
- 제안: 파일의 기존 주석 언어(영어)에 맞춰 "// Canonical shared trace type (C-1 follow-up / dev 1b). all-optional superset;\n// push sites always supply every field." 로 통일하거나, 프로젝트 주석 언어 정책에 따라 일관되게 정리.

### [INFO] output-shape.ts의 TurnRagDelta rename 이력 주석 부재
- 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts` L307–312
- 상세: `TurnDebugEntry` → `TurnRagDelta` rename 이후 인터페이스 앞 주석이 "한 턴 동안 호출된 KB tool 의 chunk delta + 진단." 한 줄만 남아 있다. rename 의도(conversation-utils.ts 의 file-private `TurnDebugEntry`(llmCalls/toolCalls)와의 동명 충돌 해소)가 전혀 언급되지 않아 이후 독자가 이름 선택 이유를 파악하기 어렵다.
- 제안: `TurnRagDelta` 인터페이스 주석에 "(formerly `TurnDebugEntry` — renamed to disambiguate from the canonical `TurnDebugEntry` in `conversation-utils.ts` which holds llmCalls/toolCalls)" 한 줄 추가.

### [INFO] workflow.handler.ts mapSubWorkflowError — W-6 이중 처리 패턴 JSDoc 미기술
- 위치: `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` L248–291
- 상세: `mapSubWorkflowError` 에 typed branch(instanceof WorkflowForbiddenWorkspaceError, L259–261)와 message backstop(L286–289) 이중 처리가 추가되었다. 이 패턴이 @internal JSDoc 본문에 언급되지 않아 이후 수정자가 중복처럼 보이는 두 블록을 정리 대상으로 오해할 가능성이 있다.
- 제안: `mapSubWorkflowError` JSDoc 에 "@remarks typed branch (instanceof) takes priority; a message-token backstop handles the case where an external executor re-throws as a plain Error preserving the WORKFLOW_FORBIDDEN_WORKSPACE prefix." 한 줄 추가 (선택적).

### [INFO] plan/in-progress/c1-dev-followups-1b.md — 워크플로 체크박스 실시간 미반영
- 위치: `plan/in-progress/c1-dev-followups-1b.md` L30–34 (`## 워크플로`)
- 상세: 전체 파일 컨텍스트에서 `TEST WORKFLOW` 는 체크 완료로 표기되어 있으나 `/ai-review`, `/consistency-check`, `RESOLUTION.md` 항목은 미체크(`[ ]`)다. plan 파일이 실제 완료 상태를 반영하지 않는 채로 PR 에 포함되면 독자가 리뷰 완료 여부를 오판할 수 있다.
- 제안: `/ai-review` 완료 및 SUMMARY 생성 후 해당 항목을 `[x]` 로 갱신하고 커밋에 포함. (project MEMORY "plan 체크박스 = 실제 상태" 규약 준수.)

## 요약

이번 변경셋은 전반적으로 문서화 품질이 양호하다. `WorkflowForbiddenWorkspaceError` 클래스에는 스펙 참조·동작 조건·throw 지점을 명확히 기술한 JSDoc 이 갖춰져 있고, `error-codes.ts` 의 인라인 주석도 W-6 맥락과 spec 좌표를 충실히 기술한다. `workflow.handler.ts` 의 defensive backstop 인라인 주석도 의도가 명확하다. 주요 관찰은: (1) JSDoc 의 `executeSync` 비-canonical 명칭 혼입으로 인한 오해 가능성, (2) `TurnRagDelta` rename 이력 주석 부재, (3) ai-agent.handler.ts 인라인 주석의 언어 혼용, (4) plan 파일 워크플로 체크박스의 실시간 미반영 — 모두 INFO 수준으로 기능·보안에 영향을 주지 않으나 장기 유지보수성 개선을 위해 권장된다. Critical 또는 Warning 수준의 문서화 결함은 발견되지 않았다.

## 위험도

LOW
