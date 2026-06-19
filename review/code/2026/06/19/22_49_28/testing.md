# 테스트(Testing) 리뷰 결과

**대상 파일**: 파일 1-7 (코드 변경), 파일 8-15 (plan/review 산출물)
**리뷰 일시**: 2026-06-19

---

## 발견사항

### [INFO] `WorkflowForbiddenWorkspaceError` — typed error 계약 테스트 누락 (workflow-errors.spec.ts 미포함)

- **위치**: `/codebase/backend/src/modules/execution-engine/workflow-errors.ts` + `/codebase/backend/src/modules/execution-engine/workflow-errors.spec.ts`
- **상세**: `workflow-errors.spec.ts` 는 `ExecutionError` 계층(`InvalidExecutionStateError`·`RetryLastTurnError`·`MessageTooLongError`·`FormValidationError`)의 typed error 계약을 체계적으로 검증한다. 이번 변경에서 추가된 `WorkflowForbiddenWorkspaceError` 는 이 파일에서 직접 테스트되지 않는다. `workflow.handler.spec.ts` 에서 `mapSubWorkflowError` 동작은 검증되지만, `WorkflowForbiddenWorkspaceError` 자체의 typed 계약(`.name`, `.targetWorkspaceId`, `.callerWorkspaceId` 필드 보존, mismatch vs missing-context 분기별 message 형태)은 전용 단위 테스트가 없다.
- **제안**: `workflow-errors.spec.ts` 에 `WorkflowForbiddenWorkspaceError` describe 블록 추가. (a) mismatch 케이스: `targetWorkspaceId`/`callerWorkspaceId` 필드 단언 + message에 두 ID 포함 확인. (b) missing-caller 케이스: `callerWorkspaceId === undefined` + message에 targetId 포함. (c) `.name === 'WorkflowForbiddenWorkspaceError'` 확인. (d) `instanceof Error` 확인. 비차단 수준이나 타 에러 클래스와 일관성 유지를 위해 권장.

---

### [INFO] `execution-engine.service.spec.ts` — `assertSameWorkspace` 테스트가 regex 기반으로 typed error 인스턴스 타입 미검증

- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` L878, L943, L1842, L1849, L1957, L1964
- **상세**: 기존 `assertSameWorkspace` 테스트 6건 모두 `.rejects.toThrow(/WORKFLOW_FORBIDDEN_WORKSPACE/)` 패턴을 사용한다. 이번 변경에서 `throw new Error('WORKFLOW_FORBIDDEN_WORKSPACE: ...')` → `throw new WorkflowForbiddenWorkspaceError(...)` 로 전환했으나, 테스트는 여전히 message regex 매칭에만 의존한다. `instanceof WorkflowForbiddenWorkspaceError` 타입 가드는 검증되지 않아 향후 누군가 에러 클래스를 바꿔도 이 테스트가 통과할 수 있다.
- **제안**: 최소 1개 테스트에 `expect(err).toBeInstanceOf(WorkflowForbiddenWorkspaceError)` 단언 추가. `rejects.toThrow(WorkflowForbiddenWorkspaceError)` 를 사용하면 클래스와 message를 동시에 검증할 수 있다. 회귀 보호가 강화된다.

---

### [INFO] `ai-agent.handler.spec.ts` — `LlmCallRecord[]` 타입 전환 후 정적 타입 계약 테스트 없음

- **위치**: `/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (L1491, L2412) + `/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts`
- **상세**: `llmCalls` 를 인라인 익명 타입에서 `LlmCallRecord[]` 로 전환했다. 기존 테스트(L2298-2301)는 `turnDebug[0].llmCalls` shape 를 `Record<string, unknown>` 으로 캐스팅해 `startedAt`/`finishedAt` 필드 존재를 확인하지만, `durationMs` 의 optional 여부(shared 타입에서 `durationMs?`)가 이전 인라인 타입의 필수 `durationMs` 와 다르다. 런타임 값 검증은 `typeof llmCalls[0].durationMs === 'number'` 가 없으므로 shared 타입이 필드를 선택적으로 완화했어도 빌드만 통과하면 런타임 누락을 탐지하지 못한다.
- **제안**: `ai-agent.handler.spec.ts` 에서 LLM 호출 경로를 검증하는 테스트에 `llmCalls[i].durationMs` 가 실제로 설정됨을 단언(`expect(typeof llmCalls[0].durationMs).toBe('number')`)하는 어서션 추가. push site 가 "항상 전 필드를 공급"한다고 주석에 명시된 계약을 런타임에서도 검증해야 한다.

---

### [INFO] `output-shape.test.ts` — `TurnRagDelta` rename 후 export name 계약 테스트 없음

- **위치**: `/codebase/frontend/src/components/editor/run-results/output-shape.ts` + `/codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts`
- **상세**: `TurnDebugEntry` → `TurnRagDelta` rename 은 export 이름 변경이므로 이 타입을 import 하는 외부 소비자에 영향을 줄 수 있다. 기존 `extractTurnDebug` 테스트(L272-329)는 함수 동작을 검증하고 반환 타입의 구조를 간접적으로 확인하나, `TurnRagDelta` 가 올바른 이름으로 export 되는지 또는 `conversation-utils.ts` 의 파일-private `TurnDebugEntry`(llmCalls/toolCalls)와 완전히 구별되는지를 명시적으로 검증하지 않는다. 현재 `conversation-utils.ts:664` 에서 `meta.turnDebug as TurnDebugEntry[]` 캐스팅이 있어 rename 후 타입 불일치가 생길 수 있으나 TypeScript 빌드가 통과했으면 안전하다.
- **제안**: `output-shape.test.ts` 에 `TurnRagDelta` 를 명시적으로 import 해 shape 계약(필드: `turnIndex`, `ragSources`, `ragDiagnostics`)을 단언하는 테스트 1건 추가. 이는 `conversation-utils.ts` 의 동명 파일-private 타입과의 의도적 분리를 문서화하는 역할도 한다.

---

### [INFO] `mapSubWorkflowError` backstop 분기 — 음성 테스트(negative test) 누락

- **위치**: `/codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` L282-284 + `/codebase/backend/src/nodes/flow/workflow/workflow.handler.spec.ts`
- **상세**: backstop 분기는 `lower.includes('workflow_forbidden_workspace')` (소문자 변환 후 비교)를 사용한다. 신규 테스트 3건 중 backstop 테스트(L679)는 `'WORKFLOW_FORBIDDEN_WORKSPACE: Sub-workflow ws-A ...'` (대문자) 를 사용해 `lower.includes` 경로를 실제로 커버한다. 그러나 prefix 가 없는 plain Error 가 `SUB_WORKFLOW_FAILED` fallback 으로 정상 라우팅되는지 확인하는 음성 테스트가 없어 backstop 분기의 범위가 테스트로 명시되지 않는다.
- **제안**: "WORKFLOW_FORBIDDEN_WORKSPACE" prefix 가 없는 plain Error 는 `SUB_WORKFLOW_FAILED` 로 fallback 되는지 확인하는 음성 테스트 1건 추가. 이는 backstop 분기의 범위를 명확히 문서화한다.

---

## 요약

이번 변경의 테스트 전략은 전반적으로 적절하다. `mapSubWorkflowError` 에 3개 신규 케이스(typed branch mismatch, typed branch missing-caller, plain Error backstop)가 추가되어 W-6 fail-closed 동작의 핵심 분기를 커버한다. `execution-engine.service.spec.ts` 의 `assertSameWorkspace` 기존 테스트 6건도 throw 동작을 검증하므로 회귀 보호는 유지된다. 주요 갭은 (1) `WorkflowForbiddenWorkspaceError` 클래스 계약 자체의 단위 테스트 부재 - typed error 계층의 다른 멤버들과 일관성이 깨진다, (2) `assertSameWorkspace` 테스트가 여전히 regex 기반으로 instanceof 타입 가드를 검증하지 않는 점, (3) `LlmCallRecord[]` 전환 후 push site 의 런타임 필드 공급 계약이 테스트로 보장되지 않는 점이다. 세 갭 모두 즉각적 회귀 위험보다는 중기 유지보수성 문제이므로 INFO 등급으로 분류한다.

---

## 위험도

LOW
