# Testing Review

**대상**: render_form submit 흐름 — silent failure + dispatch fragility 종합 수정

**평가 범위**: 백엔드 continuation handler sentinel wrap 테스트 / 프론트엔드 optimistic UI 테스트 / 커버리지 갭 / 엣지 케이스 / mock 적절성 / 회귀 안전성

---

## 발견사항

### [WARNING] `continueExecution` 단위 테스트가 구현 변경과 불일치
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` line 771–778
- 상세: `continueExecution` 단위 테스트는 `bus.publish({ type: 'continue', payload: { name: 'Alice' } })` 를 기대하며, 이는 정확하다 — 실제 구현(`execution-engine.service.ts` line 1897–1903)도 raw `formData` 를 그대로 publish 하고 sentinel wrap 은 `registerContinuationHandlers` 의 listener 에서 수행하기 때문이다. 그러나 테스트 설명(`continueExecution → bus.publish({type:"continue", payload:formData})`)이 이 아키텍처 분리를 전혀 설명하지 않아, 미래 개발자가 "왜 sentinel wrap 이 continueExecution 에서 안 일어나는가" 를 파악하기 어렵다. 더 중요하게는, `continueExecution` → publish → listener → sentinel wrap → `resolvePending` 전체 파이프라인을 하나의 통합 단위로 테스트하는 케이스가 없다. 신규 테스트 3건("form 필드명 type 인 케이스", "null/undefined payload")은 listener 레벨만 검증한다.
- 제안: `continueExecution` 단위 테스트 설명에 "sentinel wrap 은 listener 에서 수행 (하단 continue 핸들러 테스트 참고)" 주석을 달거나, integration-level 테스트에서 `service.continueExecution(id, { type: '주문 문의' })` 를 호출 후 `resolvePending` 이 `{ type: 'form_submitted', formData: { type: '주문 문의' } }` 로 resolve 되는 것을 E2E 로 검증하는 케이스 추가.

### [WARNING] `waitForAiConversation` `form_submitted` dispatch 경로의 단위 테스트 부재
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 2036–2057
- 상세: `waitForAiConversation` 의 `else if (action.type === 'form_submitted')` 분기가 `handleAiMessageTurn` 을 `JSON.stringify(action.formData ?? {})` 로 호출하는 경로는 독립 단위 테스트로 검증되지 않는다. 기존 통합 테스트(`should resume after continueExecution and complete all nodes`, `appends presentation_user turn`)는 이 경로를 간접 커버하지만, `action.formData` 가 null/undefined 일 때 `??{}` fallback 이 정상 작동하는지, `JSON.stringify({})` 가 LLM 에 올바르게 전달되는지를 명시 검증하지 않는다.
- 제안: AI Agent multi-turn describe 블록에 `form_submitted action 을 직접 inject → handleAiMessageTurn 호출 인자 검증` 테스트 추가. `action.formData` 가 null/undefined 인 경우도 별도 케이스.

### [WARNING] `waitForAiConversation` unknown action.type warn + loop re-enter 경로 테스트 없음
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 2058–2065
- 상세: `else` 분기(unknown `action.type`)에서 `this.logger.warn` 호출 후 루프를 재진입하는 동작이 신규 추가됐으나, 이를 검증하는 테스트가 없다. 향후 새 action type 추가 시 이 가드 분기가 실제로 작동하는지 알 수 없다.
- 제안: `action.type = 'totally_unknown_type'` 을 inject 해 (1) `logger.warn` 이 호출되는지, (2) `conversationEnded` 가 false 로 유지되어 루프가 계속 대기하는지 검증하는 케이스 추가. mock `pendingContinuations` 를 직접 조작하는 방식이 적합.

### [WARNING] Form node blocking — sentinel unwrap 경로(`submitted` → `formData`) 테스트 커버리지 공백
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 1756–1761
- 상세: Form 노드 blocking 흐름의 `submitted` 변수에서 `formData` 를 unwrap 하는 로직(sentinel 확인 후 `.formData` 추출, non-sentinel 이면 그대로 사용 — back-compat fallback)이 직접 테스트되지 않는다. 기존 통합 테스트(`appends presentation_user turn`, `should resume after continueExecution`)는 이 경로를 통과하지만, 비-sentinel(`submitted` 가 plain object) 이 들어올 때 back-compat fallback 이 실제로 raw object 를 그대로 `formData` 로 사용하는지를 명시하는 케이스가 없다.
- 제안: Form node blocking describe 블록에 "sentinel 이 아닌 plain payload 가 `resolvePending` 에 직접 전달될 때도 formData 로 unwrap 됨 (back-compat)" 케이스 추가. 단, 현 아키텍처에서 이 경로가 실제로 실행될 수 있는지 확인 필요 — listener 가 항상 sentinel wrap 을 수행하므로 fallback 이 dead code 일 가능성도 있음.

### [INFO] 프론트엔드 테스트 — `submitForm` 중복 등록 케이스 미검증
- 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-interaction-commands.test.ts`
- 상세: `once(ackEvent, handler)` 가 `submitForm` 호출마다 누적 등록될 수 있다. 테스트는 단일 호출만 검증한다. 실제로 `onceCall = onceMock.mock.calls.find(([event]) => event === "execution.form_submitted")` 로 첫 번째 매칭만 꺼내서 테스트하므로, 연속 호출 시 ack listener 가 중첩 등록되는 문제가 감지되지 않는다.
- 제안: `submitForm` 을 연속 2회 호출했을 때 `onceMock` 이 정확히 2번 등록됐는지 확인하는 케이스 추가. `emitWithAck` 함수 자체의 동작(once 먼저 등록, 후 emit)도 커버.

### [INFO] 프론트엔드 테스트 — `turnIndex` 계산이 `presentation` 타입 포함 필터 기반인 점 검증 부재
- 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` line 839-841
- 상세: `turnIndex` 계산이 `m.type === "user" || m.type === "presentation"` 필터 기반이다. 이미 `presentation` 메시지가 있을 때 `submitForm` 을 호출하면 `turnIndex` 가 올바르게 증가하는지 검증하는 케이스가 없다. `sendMessage` 의 `turnIndex` 는 `user` 타입만 필터하므로 두 함수가 비대칭 — 혼합 시나리오에서 `turnIndex` 충돌 가능성이 있다.
- 제안: `presentation` 메시지가 이미 store 에 존재하는 상태에서 `submitForm` 호출 시 `turnIndex` 가 2 가 되는지 (1이 아닌) 검증하는 케이스 추가.

### [INFO] `pauseForForm` mock — 테스트 격리에서 `waitingNodeId` 설정 의존
- 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-interaction-commands.test.ts` line 300–302
- 상세: `submitForm uses waitingNodeId's label/type for the optimistic item` 테스트가 `useExecutionStore.getState().pauseForForm("ai-1", ...)` 를 직접 호출해 store 를 세팅한다. `pauseForForm` 함수가 `waitingNodeId` 를 어떤 값으로 설정하는지 이 테스트만 봐서는 알 수 없다 — `pauseForForm` 구현에 암묵적 의존. `pauseForForm` 의 side-effect 가 변경되면 이 테스트도 무음 실패할 수 있다.
- 제안: 테스트 내에 `useExecutionStore.getState().setWaitingNodeId("ai-1")` 등으로 명시적 상태 설정을 추가하거나, `pauseForForm` 이 `waitingNodeId` 를 세팅하는 동작을 별도 테스트로 분리.

### [INFO] 프론트엔드 테스트 — `toastErrorMock` 에 fallback `"Unknown error"` 케이스 미검증
- 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-interaction-commands.test.ts` line 329–334
- 상세: ack 실패 테스트에서 `{ success: false, error: "form rejected" }` 로 구체적인 error 문자열을 제공한다. `emitWithAck` 의 fallback `response.error ?? "Unknown error"` 경로 — `error` 필드가 undefined 인 경우(`{ success: false }`) `toast.error("Unknown error")` 가 호출되는지 검증하는 케이스가 없다.
- 제안: `{ success: false }` (error 미포함) ack 시 `toastErrorMock.toHaveBeenCalledWith("Unknown error")` 케이스 추가.

---

## 요약

변경된 테스트 코드는 이번 수정의 핵심 회귀 — form 필드명이 `type` 인 경우 silent drop, null/undefined payload — 를 직접 타격하는 명확한 케이스 3건(백엔드)과 optimistic UI 흐름 전체를 커버하는 케이스 4건(프론트엔드)을 신규 추가해 전반적으로 우수한 테스트 보강이다. 다만 두 가지 중요한 커버리지 공백이 남아 있다: (1) `waitForAiConversation` 의 `form_submitted` dispatch 분기와 unknown type warn+reenter 분기가 단위 테스트로 직접 검증되지 않으며, (2) `continueExecution` 테스트가 구현의 아키텍처(publish raw, wrap at listener)를 반영하지 않아 테스트 설명과 실제 동작 사이에 인지 갭이 존재한다. 프론트엔드 테스트는 mock 격리(emitMock/onceMock/toastErrorMock vi.hoisted), store reset, renderHook+act 패턴 모두 적절하며 독립 실행 가능하다.

---

## 위험도

MEDIUM
