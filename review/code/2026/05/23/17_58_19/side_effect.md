# 부작용(Side Effect) 리뷰

## 발견사항

### [WARNING] `submitForm` 내부에서 `useExecutionStore.getState()` 직접 호출 — React 렌더 사이클 외부 상태 스냅샷 시점 문제
- 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts`, `submitForm` 콜백 내부 (`const { conversationMessages, waitingNodeId, nodeResults } = useExecutionStore.getState()`)
- 상세: `useCallback` 클로저 안에서 `useExecutionStore.getState()`를 직접 호출하는 것은 Zustand 패턴상 허용되지만, `conversationMessages` 스냅샷을 캡처한 시점과 실제 `addConversationMessage` 호출 시점 사이에 비동기 업데이트가 끼어들면 `turnIndex` 계산이 stale 값 기반이 된다. 특히 사용자가 연속으로 빠르게 form 을 제출하거나 다른 WS 이벤트가 동시에 `conversationMessages` 를 갱신하는 경우 `turnIndex` 가 중복될 수 있다. `sendMessage` 도 동일 패턴이지만, 두 경로가 동시에 활성화될 수 있는 시나리오(AI 대화 중 form 렌더)에서 충돌 가능성이 높아진다.
- 제안: `turnIndex` 산정을 `addConversationMessage` reducer 내부로 이전하거나, 호출 직전 최신 스냅샷을 단일 원자적 연산으로 처리 (`setState` selector 로 업데이트)하는 방식 권장. 단기적으로는 `sendMessage` 와 동일 패턴이므로 기존 위험도와 동등하다.

---

### [WARNING] `resolvePending` → unwrap 폴백 로직이 이중 wrap 경로를 방어하지 않음
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, 라인 +188~+193 (`const formData = submitted !== null && typeof submitted === 'object' && (submitted as {...}).type === 'form_submitted' ? ... : submitted`)
- 상세: `waitForAiConversation` 에서 `submitted` 가 `{type:'form_submitted', formData}` 이면 `formData` 를 꺼내고, 그렇지 않으면 `submitted` 자체를 사용하는 폴백이 추가되었다. 이 폴백은 "sentinel 이 아닌 값이 resolvePending 에 들어오는 경우" 를 위한 방어 코드인데, 동시에 새로운 우회 경로가 된다. 예를 들어 다른 코드 경로가 sentinel 없이 `resolvePending` 을 호출하면 조용히 통과하고, dispatch 4 케이스 매칭에서 `action.type` 이 없어 warn log + loop 재진입으로 빠지게 된다. 이 경우 무한 루프 방어가 `maxTurns` cap 에만 의존하게 된다.
- 제안: 폴백 분기에 warn log 를 추가하여 sentinel 없이 도착한 케이스를 조기에 탐지하도록 보완 권장: `this.logger.warn('[waitForAiConversation] submitted without form_submitted sentinel — using raw value', {executionId})`.

---

### [WARNING] `else` 분기(unknown action.type) — loop 재진입이 무한 루프 위험을 내포
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, 신규 `else` 블록 (`this.logger.warn(...)`)
- 상세: 알 수 없는 `action.type` 발생 시 warn log 후 while 루프 재진입으로 다음 resume 신호를 대기한다. `maxTurns` cap 이 별도 layer 에서 방어한다고 spec 에 명시되어 있으나, 이 분기에서 cap 감소가 이루어지지 않는다면 unknown action 이 반복적으로 들어오는 시나리오(버그성 race condition, 테스트 환경 오발화 등)에서 `maxTurns` 를 우회한 채 루프가 지속될 수 있다. 현재 코드에서는 unknown action 이 turn count 에 포함되지 않는다.
- 제안: `maxTurns` cap 의 감소 로직이 명시적 매칭 분기(처리된 케이스)에만 있는지, unknown 분기도 동일하게 cap 을 소비하는지 확인 필요. unknown 분기 전용 counter 나 최대 unknown skip 수 제한을 별도 추가하는 것이 안전하다.

---

### [INFO] `'continue'` bus listener — sentinel wrap 후 resolvePending 에 `{type:'form_submitted', formData}` 를 그대로 forward
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `registerContinuationHandlers` 의 `'continue'` 핸들러
- 상세: 변경 전에는 `resolvePending(msg.executionId, msg.payload)` (raw formData 직접 forward). 변경 후에는 sentinel wrap 된 객체를 전달한다. `resolvePending` 의 signature 와 내부 동작 자체는 변경되지 않았으므로 다른 호출자(cancel 핸들러 등)에는 영향 없다. 의도된 변경이다.
- 제안: 없음 — 정합.

---

### [INFO] `useExecutionStore` 공유 상태 변경 — `addConversationMessage` + `setWaitingAiResponse(true)` 가 WS emit 이전에 실행됨
- 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts`, `submitForm` 내부
- 상세: optimistic UI 패턴으로 store 를 먼저 갱신한 뒤 WS emit 하고, ack 실패 시 `setWaitingAiResponse(false)` 만 롤백한다. `addConversationMessage` 로 추가된 presentation 아이템은 실패 시에도 store 에 잔존한다. 이는 `sendMessage` 와 동일한 설계 결정("optimistic presentation_user 는 유지 — 재시도 안내")이며 의도적이다. 다만 서버가 reject 했음에도 사용자 화면에 제출 내용이 남아있게 되어, 아이템 제거 없이 재시도할 경우 중복 아이템이 쌓일 수 있다.
- 제안: 재시도 시 중복 아이템 dedup 또는 제거 로직이 별도 존재하는지 확인 필요. 현 변경 범위 내에서는 `sendMessage` 와 동일 trade-off 이므로 신규 부작용은 아님.

---

### [INFO] `submitForm` useCallback 의존성 배열에 `addConversationMessage`, `setWaitingAiResponse` 추가
- 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts`, 라인 `[executionId, addConversationMessage, setWaitingAiResponse]`
- 상세: 기존에는 `[executionId]` 만이었다. Zustand selector 로 구독하는 action 함수들은 참조 안정성이 보장되므로 의존성 배열 추가는 불필요한 re-creation 을 일으키지 않는다. 정합.
- 제안: 없음.

---

### [INFO] `waitForAiConversation` dispatch — `action.formData ?? {}` 의 nullish coalescing
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, 라인 `const formData = action.formData ?? {}`
- 상세: `action.formData` 가 `undefined` 인 경우 빈 객체 `{}` 를 대신 사용한다. `JSON.stringify({})` 가 LLM 에게 전달되는 경우 LLM 이 빈 form 제출로 해석할 수 있는데, 이는 기존 `null`/`undefined` payload 시 TypeError 를 낼 수 있었던 문제보다 양호한 동작이다. 단, `undefined` payload 를 `{}` 로 대체하면 frontend 가 의도적으로 formData 없이 sentinel 을 보낸 케이스와 payload 누락 케이스를 구분할 수 없다.
- 제안: 현재 스펙 범위 내에서는 허용 가능. 향후 empty form 과 form 없는 호출을 구분해야 한다면 별도 sentinel 필드 추가 필요.

---

### [INFO] 테스트 파일 — `pendings` Map 의 직접 조작 (private 상태 접근)
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`, 신규 테스트 케이스들
- 상세: `(service as unknown as {...}).pendingContinuations` 로 private 필드를 type assertion 으로 우회해 직접 세팅한다. 기존 테스트도 동일 패턴을 사용하고 있으므로 신규 부작용은 없다. 단 서비스 내부 구조 변경 시 테스트가 무음으로 오작동할 위험이 있다.
- 제안: 테스트 전용 노출 또는 reflection 기반 접근으로 개선하면 더 안전하나, 현재 범위에서는 기존 패턴과 동등.

---

### [INFO] spec 문서 변경 — `spec/4-nodes/6-presentation/0-common.md` §10.9 신설, `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 step 2.c.fallback 추가, `spec/5-system/6-websocket-protocol.md` §4.2 비고 추가
- 위치: 각 spec 파일
- 상세: spec 문서는 읽기 전용 참조 문서로 런타임 부작용이 없다. 내용적으로 외부 WS wire shape 변경이 없음을 명문화하고 있어 backward compatibility 에 영향 없다.
- 제안: 없음.

---

## 요약

본 변경은 backend 의 continuation bus `'continue'` listener 를 sentinel wrap (`{type:'form_submitted', formData}`) 방식으로 교체하고, frontend `submitForm` 에 optimistic UI 갱신을 추가하는 두 축의 버그 수정이다. 부작용 관점에서 핵심 위험은 두 가지다. (1) frontend 에서 `useExecutionStore.getState()` 스냅샷 시점의 stale `turnIndex` — `sendMessage` 와 동일한 기존 위험도이나, form 과 메시지가 동시에 활성화되는 시나리오에서 중복 인덱스가 발생할 수 있다. (2) backend 의 알 수 없는 `action.type` 에 대한 warn + 재진입 분기가 `maxTurns` cap 과 별도로 동작하여 unknown 케이스가 반복될 경우 무한 루프 방어가 cap 에만 의존하게 된다. 외부 API 시그니처(`execution.submit_form` WS wire), public 함수 시그니처(`continueExecution`, `registerContinuationHandlers`, `waitForAiConversation`), 전역 변수, 환경 변수, 파일시스템에 대한 의도치 않은 부작용은 발견되지 않았다.

## 위험도

MEDIUM
