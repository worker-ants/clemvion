# Testing Review — render_form 활성 form 인라인 통합 + form bypass

## 발견사항

### [INFO] 테스트 존재 여부 — 전반적으로 양호

- 위치: 전체 변경 세트
- 상세: 커밋이 명시한 핵심 시나리오(CT-S12 / CT-S13 / CT-S14)를 모두 단위 테스트로 커버한다. 백엔드 4건(`ai-agent.handler.spec.ts` — form_submitted / ai_message bypass / no-pending / 하위 호환), 프론트엔드 6건(execution-store.test.ts 2건 + assistant-presentations-block.test.tsx 4건)이 신규 추가됐다.
- 제안: 해당 없음(양호).

---

### [WARNING] `execution-engine.service.spec.ts` — source 검증 범위가 form_submitted 경로만 커버

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` diff (라인 96–100)
- 상세: 엔진 레벨 통합 스펙은 `form_submitted` source 전달만 검증한다. `ai_message` source 경로(`action.message` 경유 dispatch)에 대해서는 엔진 스펙에 대응 테스트가 없다. handler 단위 테스트가 ai_message 분기를 다루지만, 엔진이 실제로 `'ai_message'` 를 올바르게 전달하는지를 검증하는 스펙이 부재하다.
- 제안: `execution-engine.service.spec.ts` 에 ai_message 액션 경로에서 `processMultiTurnMessage` 가 `{ source: 'ai_message' }` 로 호출되는지를 검증하는 테스트를 추가한다.

---

### [WARNING] `resumeFromAiRenderForm` — `waitingNodeId` 보존 검증이 간접적

- 위치: `codebase/frontend/src/lib/stores/__tests__/execution-store.test.ts` 3037–3075행
- 상세: 첫 번째 테스트는 `waitingNodeId` 를 `"node-ai"` 로 설정 후 `resumeFromAiRenderForm()` 을 호출하고 `expect(state.waitingNodeId).toBe("node-ai")` 를 검증한다. 그러나 `pauseForConversation` 의 내부 구현이 `waitingNodeId` 를 세트하는 방식으로 간접 의존하기 때문에, `pauseForConversation` 의 구현이 변경되면 테스트 전제가 조용히 무너질 수 있다. `waitingInteractionType: 'ai_form_render'` 는 직접 `setState` 로 주입하는 반면 `waitingNodeId` 는 `pauseForConversation` 부작용에 의존한다 — 설정 경로가 혼재한다.
- 제안: `waitingNodeId` 도 명시적으로 `setState({ waitingNodeId: "node-ai" })` 로 직접 주입하거나, 헬퍼 함수로 ai_form_render waiting state 전체를 한 곳에서 설정하도록 정리한다.

---

### [WARNING] form bypass — `ai_message` source 인데 tool_result stub 이 없는 케이스 분기 커버 불완전

- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 1690–1693행, `ai-agent.handler.spec.ts` CT-S14 테스트 블록
- 상세: 구현에서 `stubIndex < 0` 이면 `messages.push(cancelledToolResult)` 로 fallback 한다. 테스트의 baseState 는 항상 `role: 'tool', toolCallId: 'call_form_1'` stub 을 포함한 상태이므로 `stubIndex >= 0` 경로만 검증된다. stub 이 없는 경우(`stubIndex < 0` → push 경로)는 테스트에서 커버되지 않는다. form_submitted 분기도 동일 패턴이지만 그 분기도 stub-absent 경로 테스트가 없다.
- 제안: `stubIndex < 0` 상황(messages 에 pending tool_result 가 없음)에 대한 테스트 케이스를 추가한다. baseState 에서 stub 메시지를 필터링한 state 를 별도로 준비하거나 파라미터화된 테스트로 처리한다.

---

### [INFO] `AssistantPresentationsBlock` CT-S13 — form submit 실제 호출 검증 부재

- 위치: `codebase/frontend/src/components/editor/run-results/__tests__/assistant-presentations-block.test.tsx` 1473–1485행
- 상세: active DynamicFormUI 렌더 여부(입력 필드·버튼 존재)는 검증하지만, 실제로 submit 버튼을 클릭했을 때 `onSubmitForm` 이 올바른 데이터와 함께 호출되는지는 테스트하지 않는다. CT-S12(제출 후 timeline persist)는 store 레벨 테스트가 담당하나, 컴포넌트 → 콜백 연결 경로는 빈틈이다.
- 제안: active 케이스 테스트에 `fireEvent.submit` 또는 `fireEvent.click(submitBtn)` 후 `expect(onSubmitForm).toHaveBeenCalledWith(...)` 검증을 추가한다. 폼 데이터까지 정확히 검증하면 DynamicFormUI 내부의 submit 흐름과 onSubmitForm prop 연결을 함께 보증할 수 있다.

---

### [INFO] `information-extractor.handler.ts` — options 파라미터 무시 선언, 테스트 없음

- 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` diff
- 상세: `_options` 파라미터를 인터페이스 호환용으로만 받고 실제로 사용하지 않는다고 주석으로 명시했다. 이 정책(information_extractor 는 render_form 을 발행하지 않음)에 대한 단위 테스트는 없다. 구현 의도는 올바르나, 추후 해당 핸들러가 render_form 을 발행하게 변경될 경우 silent bug 가 될 수 있다.
- 제안: 현재 상태에서 테스트가 없어도 LOW 위험이나, 최소한 "options 가 전달돼도 동일 결과를 반환"하는 smoke 테스트를 추가하면 인터페이스 계약을 명시적으로 고정할 수 있다.

---

### [INFO] `result-detail.tsx` / `run-results-drawer.tsx` — 변경된 prop 경로에 대한 직접 테스트 없음

- 위치: `codebase/frontend/src/components/editor/run-results/result-detail.tsx`, `run-results-drawer.tsx`
- 상세: `pendingFormToolCallId` 와 `onAiRenderFormSubmit` 이 `ResultDetail` 컴포넌트 props 로 추가됐고, 이 값이 `ConversationInspector → AssistantPresentationsBlock` 까지 드릴다운된다. 하지만 `ResultDetail` 이나 `RunResultsDrawer` 에 대한 직접 단위·통합 테스트는 변경 diff 에 포함되지 않았다. prop drill 경로의 정확성은 CT-S13 블록 테스트가 `AssistantPresentationsBlock` 레벨에서 간접 보증하지만, `ResultDetail` 이 실제로 `handleAiRenderFormSubmit` 을 올바르게 구성해 `ConversationInspector` 에 전달하는지를 검증하는 테스트는 없다.
- 제안: e2e 테스트 또는 `ResultDetail` 컴포넌트 스냅샷/통합 테스트에서 `onSubmitForm` prop 전달 경로를 보증하면 좋다.

---

### [INFO] 테스트 격리 — store 테스트가 `beforeEach` reset 없이 `startExecution` 의존

- 위치: `codebase/frontend/src/lib/stores/__tests__/execution-store.test.ts` 3038–3039행
- 상세: `resumeFromAiRenderForm` 테스트는 `useExecutionStore.getState().startExecution("exec-1")` 을 직접 호출해 store 를 세팅한다. 기존 execution-store 테스트 파일이 별도 `beforeEach` 로 store 를 초기화하는지 diff 에서는 확인되지 않는다. 만약 다른 테스트가 store 상태를 오염시킨 채 종료되면 본 테스트가 영향받을 수 있다.
- 제안: `describe` 블록에 `beforeEach(() => { useExecutionStore.getState().reset(); })` 를 추가해 격리를 명시한다. 혹은 기존 파일에 이미 존재하는 reset 패턴을 동일하게 적용한다.

---

### [INFO] 하위 호환 테스트 — `options 미전달` 케이스가 pending form state 없는 조건만 검증

- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts` 468–492행
- 상세: 4번째 테스트("options 미전달 + pendingFormToolCall 없음")는 하위 호환을 검증하지만, `pendingFormToolCall` 이 set 된 상태에서 options 를 미전달한 경우(default `'ai_message'` 로 분기)의 동작은 검증하지 않는다. 구현상 `options?.source ?? 'ai_message'` 이므로 default 가 `'ai_message'` 인 기존 호출자는 pendingFormToolCall 이 있으면 bypass 로 처리된다. 이 행동이 실제로 하위 호환에서 의도된 변경인지를 검증하는 테스트가 없다.
- 제안: "pendingFormToolCall set + options 미전달 → ai_message bypass 경로 진입" 시나리오 테스트를 추가해 default 동작을 명시적으로 고정한다.

---

## 요약

변경의 핵심 로직(form_submitted 경로, ai_message bypass, store Inv-7, active vs submitted 분기)에 대해 단위 테스트가 충분히 추가됐으며 주요 회귀 시나리오(CT-S12, CT-S13, CT-S14)가 테스트로 보호된다. 다만 세 가지 커버리지 갭이 존재한다. 첫째, 엔진 레벨에서 `ai_message` source 전달 경로를 검증하는 통합 스펙이 없다. 둘째, pending tool_result stub 이 없는 상태의 bypass/form_submitted fallback(`stubIndex < 0` 분기)이 테스트되지 않는다. 셋째, `AssistantPresentationsBlock` active 케이스에서 실제 submit 콜백 호출을 검증하지 않는다. 이 세 갭이 보완되면 전체 테스트 스위트는 변경 요구사항을 충분히 보증할 수 있는 수준이다.

## 위험도

LOW
