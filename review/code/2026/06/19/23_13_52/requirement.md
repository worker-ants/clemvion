# 요구사항(Requirement) Review 결과

**리뷰 대상**: C-1 dev 잔꼬리 (작업 1b) — PR #641 후속 리뷰
- 1b-1: `WORKFLOW_FORBIDDEN_WORKSPACE` enum 등재 + surface 정합 (typed error 계층 + 테스트 보강)
- 1b-2: `ai-agent.handler.ts` inline `llmCalls` → shared `LlmCallRecord`
- 1b-3: frontend `TurnDebugEntry` → `TurnRagDelta` rename

**관련 spec 식별**:
- `spec/4-nodes/2-flow/1-workflow.md §2 W-6·§4·§6` — WorkflowForbiddenWorkspace 정의
- `spec/5-system/3-error-handling.md §1.4` — Sub-workflow 에러 카탈로그
- `spec/5-system/4-execution-engine.md §Rationale` — assertSameWorkspace fail-closed

---

## 발견사항

### [INFO] spec §4 step 4 인라인 열거 — 이미 갱신됨 (이전 SPEC-DRIFT 해소)

- 위치: `spec/4-nodes/2-flow/1-workflow.md` L108
- 상세: 이전 리뷰(22_49_28)에서 WARNING [SPEC-DRIFT] 로 지적됐던 §4 step 4 인라인 열거가 현재 워크트리에서 이미 갱신되어 있다. L108 이 `SUB_WORKFLOW_NOT_FOUND / SUB_WORKFLOW_TIMEOUT / SUB_WORKFLOW_QUEUE_FAILED / WORKFLOW_FORBIDDEN_WORKSPACE (W-6 격리 차단) / SUB_WORKFLOW_FAILED (기본)` 를 포함한다. 코드와 spec 이 완전히 일치한다.
- 제안: 없음. 해소 완료.

### [INFO] WorkflowForbiddenWorkspaceError 클래스 계약 — spec 정합 확인

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-drift-c1-ea8bcb/codebase/backend/src/modules/execution-engine/workflow-errors.ts` L80–93
- 상세: `WorkflowForbiddenWorkspaceError` 는 `extends Error` (plain)로 선언되어 `WorkflowNotFoundError` / `SubWorkflowTimeoutError` 와 동일 계층 패턴을 따른다. spec/4-nodes/2-flow/1-workflow.md §2 W-6 callout(L75·L77)이 "typed `WorkflowForbiddenWorkspaceError`(message prefix `WORKFLOW_FORBIDDEN_WORKSPACE:`)를 throw" 라 명시한 것과 구현이 정확히 일치한다. `targetWorkspaceId`·`callerWorkspaceId?` 필드 캡처, `this.name` 설정, 두 케이스(mismatch/missing-caller) 처리가 모두 구현되어 있다. spec §6 에러 코드 표 L265에 등재 완료. `ErrorCode.WORKFLOW_FORBIDDEN_WORKSPACE` enum 등재(error-codes.ts L66) 완료.
- 제안: 없음. 기능 완전성 충족.

### [INFO] mapSubWorkflowError 분기 순서 — 올바른 우선순위

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-drift-c1-ea8bcb/codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` L252–291
- 상세: typed instanceof 분기(`WorkflowForbiddenWorkspaceError`) 가 message backstop(`lower.includes('workflow_forbidden_workspace')`) 보다 먼저 위치한다. spec §6 footnote 가 "typed `WorkflowForbiddenWorkspaceError` 를 매핑" + "mapSubWorkflowError" 을 언급하며, 구현도 이 순서를 따른다. backstop 은 external/queue layer 가 plain Error 로 전달할 경우를 위한 방어 계층이다. 음성 테스트(`workspace quota exceeded` → `SUB_WORKFLOW_FAILED`)가 over-match 를 방지함을 검증한다.
- 제안: 없음.

### [INFO] 1b-2 LlmCallRecord 타입 loosen — shared type SoT 정합

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-drift-c1-ea8bcb/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1491, L2412
- 상세: `LlmCallRecord` 인터페이스의 모든 필드가 optional — shared type SoT 를 `spec/5-system/6-websocket-protocol.md §4.4`로 명시(`llm-call-record.ts` L7). push site 에서 `durationMs`·`requestPayload`·`responsePayload` 는 항상 공급되므로 런타임 데이터 손실 없음. plan 1b-2 에 "trace/debug 구조라 수용" 결정이 기록되어 있고 build cascade 검증을 통과했다.
- 제안: 없음. 기능 완전성 충족, plan 결정 인지.

### [INFO] 1b-3 TurnRagDelta rename — output-shape.ts 범위 내 완전 처리

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-drift-c1-ea8bcb/codebase/frontend/src/components/editor/run-results/output-shape.ts`
- 상세: `TurnDebugEntry` (RAG delta 전용) → `TurnRagDelta` rename 이 4개 참조(`AiMetadata.turnDebug`, 인터페이스 정의, `extractTurnDebug` 반환·내부 변수) 모두 동일 파일 내에서 처리됐다. `TurnRagDelta` 인터페이스 주석에 rename 이력(`formerly TurnDebugEntry — 동명 충돌 해소`)이 추가되어 있다. `llm-call-record.ts` 의 `TurnDebugEntry`(llmCalls/toolCalls canonical)와의 동명 충돌이 올바르게 해소됐다. 외부 import 0건이므로 파급 범위 확인 완료.
- 제안: 없음.

### [INFO] assertSameWorkspace 테스트 — instanceof 단언 추가됨

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-drift-c1-ea8bcb/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` L1840–1851
- 상세: 이전 리뷰(22_49_28)의 I-5 권장사항(`instanceof WorkflowForbiddenWorkspaceError` 단언)이 적용됐다. fail-closed 테스트가 이제 `rejects.toThrow(/WORKFLOW_FORBIDDEN_WORKSPACE/)` (regex) 와 `rejects.toBeInstanceOf(WorkflowForbiddenWorkspaceError)` (typed) 두 단언을 모두 포함한다. 동일 인수로 deterministic mock 환경에서 두 번 호출하는 패턴이므로 기능 완전성 관점에서 요건 충족.
- 제안: 없음.

### [INFO] workflow-errors.spec.ts WorkflowForbiddenWorkspaceError 클래스 계약 테스트 — 이전 권장사항 반영됨

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-drift-c1-ea8bcb/codebase/backend/src/modules/execution-engine/workflow-errors.spec.ts` L117–149
- 상세: 이전 리뷰(22_49_28) I-4 권장사항 — mismatch/missing-caller 양 케이스의 필드 캡처·message prefix·name·instanceof 검증 describe 블록이 추가됐다. 구체적으로: `err.name === 'WorkflowForbiddenWorkspaceError'`, `err instanceof Error`, `err.targetWorkspaceId`, `err.callerWorkspaceId`(undefined), `err.message` prefix `WORKFLOW_FORBIDDEN_WORKSPACE:`, `'without caller workspace context'` 포함 여부. 기능 완전성 충족.
- 제안: 없음.

---

## 요약

이번 변경셋(1b-1/1b-2/1b-3 + RESOLUTION 보강)은 의도한 기능을 완전히 구현하고 있으며, 전 리뷰 세션(22_49_28)에서 제기된 SPEC-DRIFT·WARNING·INFO 항목이 모두 적절히 처리됐다. spec fidelity 측면에서: `spec/4-nodes/2-flow/1-workflow.md §4` step 4 인라인 열거가 `WORKFLOW_FORBIDDEN_WORKSPACE`를 포함하도록 이미 갱신되어 이전 SPEC-DRIFT 가 해소됐고, `spec/5-system/3-error-handling.md §1.4` Sub-workflow 에러 카탈로그(L85)와 `spec/4-nodes/2-flow/1-workflow.md §6` 에러 코드 표(L265)에 완전히 등재됐다. 코드(typed error 클래스, enum 등재, mapSubWorkflowError 분기, assertSameWorkspace 호출) 가 spec 본문과 line-level 로 일치한다. 테스트 4종(typed mismatch, typed missing-context, plain Error backstop, 음성 테스트)이 전 케이스를 커버하며, 1b-2(LlmCallRecord 공유 타입)와 1b-3(TurnRagDelta rename) 모두 기능 동작 무변 refactoring 으로 데이터 손실·회귀 없음이 확인됐다. Critical 또는 Warning 수준 요구사항 미충족 사항이 없다.

## 위험도

NONE
