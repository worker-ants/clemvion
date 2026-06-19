# 요구사항(Requirement) Review 결과

**리뷰 대상**: C-1 dev 잔꼬리 (작업 1b) — PR #641
- 1b-1: `WORKFLOW_FORBIDDEN_WORKSPACE` enum 등재 + surface 정합
- 1b-2: `ai-agent.handler.ts` inline `llmCalls` → shared `LlmCallRecord`
- 1b-3: frontend `TurnDebugEntry` → `TurnRagDelta` rename

**관련 spec 식별**:
- `spec/4-nodes/2-flow/1-workflow.md §2 W-6·§4·§6` — WorkflowForbiddenWorkspace 정의
- `spec/5-system/3-error-handling.md §1.4·§3.2` — Sub-workflow 에러 카탈로그
- `spec/5-system/4-execution-engine.md §Rationale C-1` — assertSameWorkspace fail-closed
- `spec/4-nodes/3-ai/0-common.md §6` — LLM trace 타입 SoT (`TurnDebugEntry`, `LlmCallRecord`)

---

## 발견사항

### [WARNING] [SPEC-DRIFT] spec §4 step 4 runtime 에러 열거에 `WORKFLOW_FORBIDDEN_WORKSPACE` 미포함

- 위치: `spec/4-nodes/2-flow/1-workflow.md` L108 (spec-drift-c1-ea8bcb 워크트리 기준)
- 상세: 코드는 `mapSubWorkflowError` 에 `instanceof WorkflowForbiddenWorkspaceError` 분기를 추가해 `WORKFLOW_FORBIDDEN_WORKSPACE` 를 반환하도록 구현했다. 또한 §2 W-6 callout(L75·L77)과 §6 에러 코드 표(L265·L273)는 이 코드를 정확히 반영했다. 그러나 §4 step 4 ("런타임 에러 처리") 본문의 인라인 열거 "`SUB_WORKFLOW_NOT_FOUND` / `SUB_WORKFLOW_TIMEOUT` / `SUB_WORKFLOW_QUEUE_FAILED` / `SUB_WORKFLOW_FAILED` (기본) 로 매핑된다 (§6 표 참조)" 에는 `WORKFLOW_FORBIDDEN_WORKSPACE` 가 없다. §6 표를 참조하도록 포인터는 있으나 §4 자체 열거가 stale 상태다.
- 제안: 코드 유지 + spec 반영. spec §4 step 4 인라인 열거에 `WORKFLOW_FORBIDDEN_WORKSPACE` 를 추가하거나, 열거 대신 "§6 표 참조" 만 남기도록 간소화. 대상: `spec/4-nodes/2-flow/1-workflow.md §4` L108. project-planner 위임.

---

### [INFO] `WorkflowForbiddenWorkspaceError` 가 `ExecutionError` 를 상속하지 않는 점 — 의도 명시 부재

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-drift-c1-ea8bcb/codebase/backend/src/modules/execution-engine/workflow-errors.ts` L80
- 상세: `WorkflowNotFoundError`, `SubWorkflowTimeoutError` 와 동일하게 `extends Error` (plain)로 선언했다. `ExecutionError` 계층은 WS continuation ack boundary 에 도달하는 에러 전용이며, sub-workflow error port 에 surface 되는 이 클래스는 `ExecutionError` 가 되면 안 된다는 설계 결정이 JSDoc 에 명시돼 있지 않다. `ExecutionTimeLimitError` (L179-185)에는 명시적 설계 경계 주석이 있는 반면, `WorkflowForbiddenWorkspaceError` 에는 없다. 기능은 올바르다.
- 제안: 선택적 개선. `WorkflowNotFoundError`·`SubWorkflowTimeoutError` 와 동일 패턴이므로 현 상태 유지 가능. 필요 시 JSDoc 에 "sub-workflow 노드 error-port surface 전용 — ExecutionError 계층 밖 (continuation ack 도달 없음)" 한 줄 추가 권장.

---

### [INFO] 1b-2 `LlmCallRecord` 타입 loosen — optional durationMs 에 대한 정적 계약

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-drift-c1-ea8bcb/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1491, L2412
- 상세: 인라인 타입 `Array<{ requestPayload: unknown; responsePayload: unknown; durationMs: number; startedAt?: string; finishedAt?: string }>` 에서 `LlmCallRecord[]` 로 변경했다. `LlmCallRecord` 는 all-optional superset(`durationMs?` 등)이라 정적으로는 타입이 loosen 됐다. plan 에 "push site 는 항상 전 필드를 공급하므로 데이터 손실 없음, build 가 cascade 검증" 으로 명시돼 있다. 실제 push site 를 확인한 결과 `durationMs`·`requestPayload`·`responsePayload` 는 항상 설정된다. 기능 영향 없음.
- 제안: 현 상태 수용 (plan 결정 인지). trace/debug 구조라 optional 타입 수용 적절.

---

### [INFO] 1b-3 frontend `TurnRagDelta` rename — conversation-utils.ts 의 동명 private `TurnDebugEntry` 와의 관계

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-drift-c1-ea8bcb/codebase/frontend/src/components/editor/run-results/output-shape.ts`
- 상세: `output-shape.ts` 의 exported `TurnDebugEntry`(RAG delta 전용: `turnIndex`, `ragSources`, `ragDiagnostics`) 를 `TurnRagDelta` 로 rename 했다. `conversation-utils.ts` 의 file-private `TurnDebugEntry`(LLM trace 전용: `llmCalls`, `totalDurationMs`)는 별개 파일의 private type 이라 외부 import 없이 독립적이다. rename 은 4개 참조 모두 동일 파일 내에서 처리됐다. `llm-call-trace.ts` 의 `RawTurnDebugEntry` 는 별개 private interface 로 충돌 없음. 본 rename 이 새로운 위험을 추가하지 않는다.
- 제안: 현 상태 수용. rename 의도와 구현이 일치.

---

## 요약

변경 3종(1b-1/1b-2/1b-3) 모두 의도한 기능을 완전히 구현하고 있다. 1b-1 은 `WorkflowForbiddenWorkspaceError` typed error 신설, `error-codes.ts` enum 등재, `mapSubWorkflowError` 분기 추가, message prefix backstop 의 4계층 방어를 모두 갖춰 spec 이 요구하는 W-6 fail-closed 행동과 정합한다. 테스트 3종(typed mismatch, typed missing-context, plain Error backstop)이 분기 케이스를 전수 커버한다. spec fidelity 검토에서 `spec/4-nodes/2-flow/1-workflow.md §4` step 4의 인라인 에러 코드 열거가 `WORKFLOW_FORBIDDEN_WORKSPACE` 를 포함하지 않아 §6 표와 불일치하는 SPEC-DRIFT 를 발견했다 — 코드가 옳고 spec §4 본문만 stale 하므로 코드 되돌리기가 아닌 spec 갱신이 해결책이다. 1b-2는 shared `LlmCallRecord` 타입으로의 리팩터링으로 중복 정의를 제거했으며 데이터 손실 없음이 분석됐다. 1b-3은 4개 참조 1파일에 한정된 rename 으로 동명 충돌을 해소했다.

## 위험도

LOW
