# Rationale 연속성 검토 결과

검토 모드: --impl-prep  
검토 대상: multi-turn AI Agent turn 실패 (LLM throw — 429 등) 시 NodeExecution.status=FAILED 전이 + finalize 누락 픽스  
관련 plan: `plan/in-progress/ai-agent-turn-fail-finalize.md`  
충돌 가능 영역: `spec/5-system/4-execution-engine.md` 상태머신, `spec/conventions/conversation-thread.md` mutation 진입점

---

## 발견사항

### 발견사항 1

- **[INFO]** `waiting_for_input → failed` NodeExecution 전이가 스펙 다이어그램에 미표기이나 Recovery 경로에서 묵시적 허용 — 명시 보완 권장
  - target 위치: `plan/in-progress/ai-agent-turn-fail-finalize.md` §변경범위 1번 마지막 항 (`finalizeAiNode` 에 `FAILED` 분기 추가)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §1.2` NodeExecution 상태머신 다이어그램. 현재 다이어그램은 `waiting_for_input → completed` 전이만 명시하고 `waiting_for_input → failed` 는 표기 없음.
  - 상세: §1.2 다이어그램은 `waiting_for_input → completed (폼 제출, 버튼 클릭, 또는 AI 대화 종료 시)` 만을 표시한다. 그러나 같은 스펙의 §7.4 Recovery 절은 `recoverStuckExecutions` 가 stale `WAITING_FOR_INPUT` row 를 `FAILED` 로 일괄 UPDATE 하는 경로를 이미 인정한다 (`started_at < now() - 30분` 가드). 코드도 같은 패턴을 확인(`execution-engine.service.ts:2160` 주석: "server restart triggers `recoverStuckExecutions` → FAILED"). 즉 `waiting_for_input → failed` 전이는 이미 묵시적으로 허용된 전이이며, plan 의 in-session fix 는 그 전이를 recovery 이전에 즉시 실행하는 것이다. Rationale 충돌은 아니지만, §1.2 다이어그램이 이 전이를 누락 표기하고 있어 spec 다이어그램 갱신이 없으면 향후 검토자가 plan 의 의도를 오해할 수 있다.
  - 제안: `spec/5-system/4-execution-engine.md §1.2` 다이어그램과 허용 전이 표에 `waiting_for_input → failed (AI 대화 중 오류 / recovery)` 전이를 추가하는 spec 갱신을 별도 project-planner 위임으로 등록. 본 impl-prep 은 차단하지 않음.

---

### 발견사항 2

- **[WARNING]** `endMultiTurnConversation(state, 'error')` 가 spec §7.9 shape 인 `output.error.{code, message, details}` 를 생성하지 않음 — 계획 구현이 spec shape 와 불일치할 가능성
  - target 위치: `plan/in-progress/ai-agent-turn-fail-finalize.md` §변경범위 1번 "resumeState 누적치를 활용해 `endMultiTurnConversation` 호출 분기를 신설 — 부분 결과 + `output.error.{code, message, details}` 가 병존하는 spec §7.9 shape 생성"
  - 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 출력 예시 — `output.error.{code, message, details}` + 부분 `output.result.*` 병존 구조.
  - 상세: 현재 `ai-agent.handler.ts:1806` 의 `endMultiTurnConversation` 는 내부적으로 `buildMultiTurnFinalOutput(messages, lastResponse, turnCount, 'error', ...)` 를 호출하고, 이 함수는 `output: { result: { response, messages, turnCount, endReason } }` 만 생성한다 (`output.error` 없음). spec §7.9 는 `output.error: { code: "LLM_RATE_LIMITED", message: "...", details: {...} }` 를 명시하며, 주석 "부분 수집 결과(`output.result.*`)와 `output.error` 가 병존 가능" 을 강조한다. plan §변경범위 2번은 "기존 `buildMultiTurnFinalOutput` 가 spec §7.9 와 일치하는지 확인 후 갈래" 라고 서술하여 이 불일치를 인지하고 있으나, `endMultiTurnConversation` 를 그대로 재사용하는 경우 `output.error` 가 포함되지 않아 spec 을 위반하게 된다. 신규 식별자 `handleAiTurnError` 의 구현에서 `output.error` 주입 책임자가 명확하지 않은 채 plan 이 진행되면 shape 누락 회귀가 발생한다.
  - 제안: `handleAiTurnError` 내에서 `endMultiTurnConversation(state, 'error')` 결과를 그대로 쓰지 말고, `buildMultiTurnFinalOutput` 호출 후 반환 객체의 `output` 에 `error: { code, message, details }` 를 추가하는 별도 래핑 단계를 명시하거나, `buildMultiTurnFinalOutput` 에 optional `errorPayload` 파라미터를 추가해 `output.error` 를 함께 생성하도록 확장해야 한다. 구현 착수 전 이 책임 소재를 plan 에 명시 보완 권장.

---

### 발견사항 3

- **[INFO]** `handleAiEndConversation` 패턴을 참조할 때 동기(sync) vs 비동기(async) 차이 주의 — 새 `handleAiTurnError` 는 async 필요
  - target 위치: `plan/in-progress/ai-agent-turn-fail-finalize.md` §변경범위 1번 "신규 helper `handleAiTurnError` 추출 — `handleAiEndConversation` 과 같은 패턴"
  - 과거 결정 출처: 없음 (과거 Rationale 결정과 충돌하지 않음)
  - 상세: `handleAiEndConversation` 는 sync (`private handleAiEndConversation`) 이고 cache 갱신만 수행하지만, 계획된 `handleAiTurnError` 는 DB `NodeExecution.outputData` persist + `updateExecutionStatus` (트랜잭션) + WS 이벤트 emit 을 수행해야 하므로 async 가 필요하다. 이는 `handleAiMessageTurn` 안에서 await 로 호출해야 하며, `handleAiEndConversation` 처럼 fire-and-forget 으로 처리하면 finalize 가 레이스 상태에 놓인다 (plan §위험/비결정 결정 항목과 관련). 과거 Rationale 결정과의 직접 충돌은 아니지만 패턴 참조 오독 가능성.
  - 제안: plan 에 `handleAiTurnError` 를 `async` 메서드로 명시하고, `handleAiMessageTurn` 내 catch 블록이 `await this.handleAiTurnError(...)` 로 호출함을 명시. `handleAiEndConversation` 패턴은 cache 갱신 로직만 참조.

---

### 발견사항 4

- **[INFO]** 이벤트 dual-emit 전략 (`AI_MESSAGE` + `NODE_FAILED`) — `WebsocketService` 단일 sink 결정과 정합, 그러나 `NODE_FAILED` 이벤트 타입이 스펙에 미정의
  - target 위치: `plan/in-progress/ai-agent-turn-fail-finalize.md` §위험/비결정 결정 "이벤트 channel: ... 잠정: 둘 다 발사 (AI_MESSAGE 는 사용자 시각화, NODE_FAILED 는 노드 상태 finalize)"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §4.4` 이벤트 발행 sink — `WebsocketService` 단일 sink 정책. 열거된 이벤트 유형: `NODE_STARTED / NODE_COMPLETED / EXECUTION_* / AI_MESSAGE` 등.
  - 상세: `WebsocketService` 단일 sink 결정은 이벤트 유형을 제한하는 것이 아니라 sink 를 제한하므로, `NODE_FAILED` 이벤트 타입을 `WebsocketService` 를 통해 emit 하는 것 자체는 §4.4 결정과 모순되지 않는다. 그러나 `NODE_FAILED` 이벤트 타입이 `spec/5-system/6-websocket-protocol.md` 또는 어떤 스펙에도 명시되어 있지 않을 가능성이 있다 (현재 스펙에서 `NODE_COMPLETED` 는 명시, `NODE_FAILED` 는 `NODE_COMPLETED` 의 `status=FAILED` variant 로 처리하는지 별도 이벤트 타입인지 불명확). Rationale 기각 대안 충돌은 아니지만 미정의 이벤트 타입 도입 시 frontend 처리 계약이 불확실해진다.
  - 제안: WebSocket 프로토콜 스펙 (`spec/5-system/6-websocket-protocol.md`) 에서 `NODE_FAILED` 타입 정의 여부를 확인하고, 미정의이면 `NODE_COMPLETED` 의 `status=FAILED` payload 로 통일 처리하는 안을 검토. plan 의 "frontend 충돌 시 단일로 정리" 전제를 구현 착수 전 결정.

---

## 요약

본 plan 은 `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 가 이미 정의한 multi-turn 오류 종결 shape 에 구현을 맞추는 작업으로, 새 spec 을 도입하거나 과거 Rationale 결정을 뒤집지 않는다. 가장 주목할 문제는 현재 `buildMultiTurnFinalOutput` 가 `endReason='error'` 시에도 `output.error` 를 포함하지 않아, plan 이 `endMultiTurnConversation` 를 그대로 재사용하면 spec §7.9 의 `output.error.{code, message, details}` 병존 요건을 충족하지 못할 수 있다는 점 (발견사항 2 — WARNING). `NodeExecution` 의 `waiting_for_input → failed` 전이는 Recovery 경로에서 묵시적으로 허용되어 있어 Rationale 위반이 아니지만, §1.2 다이어그램에 누락 표기된 상태이다 (발견사항 1 — INFO). 나머지 두 사항 (handleAiTurnError async 필요성, NODE_FAILED 이벤트 타입 정의)도 각각 INFO 수준의 구현 착수 전 확인 권장 사항이다. 기각된 대안의 재도입이나 합의된 invariant 직접 위반은 발견되지 않았다.

---

## 위험도

MEDIUM
