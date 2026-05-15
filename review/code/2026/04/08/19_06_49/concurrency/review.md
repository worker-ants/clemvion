### 발견사항

- **[INFO]** `chatParams` 스냅샷과 실제 최종 요청 간 불일치
  - 위치: `ai-agent.handler.ts`, `processMultiTurnMessage` — `chatParams` 캡처 (~라인 391)
  - 상세: `chatParams.messages`는 첫 번째 LLM 호출 직전의 스냅샷(`[...messages]`)이지만, tool call 루프가 실행되면 `messages` 배열이 변경된 후 추가 LLM 호출이 발생합니다. 결과적으로 `lastTurnRequest`(초기 스냅샷)와 `lastTurnResponse`(최종 tool call 이후 결과)가 서로 다른 요청/응답 쌍이 됩니다. 동시성 버그는 아니지만 디버그 목적으로 노출하는 데이터의 의미가 틀어집니다.
  - 제안: `chatParams`를 최종 LLM 호출 직전에 캡처하거나, tool call이 있을 경우 `lastTurnRequest`를 최종 호출 파라미터로 덮어쓰도록 처리

- **[INFO]** `turnDurationMs`가 tool call 전체 시간을 포함
  - 위치: `ai-agent.handler.ts`, `turnStartedAt` (~라인 394) / `turnDurationMs` (~라인 434)
  - 상세: `turnStartedAt`은 첫 번째 LLM 호출 전에 찍히고 `turnDurationMs`는 tool call 루프 전체가 끝난 후 계산됩니다. `execution.ai_message` 이벤트에서 이 값을 LLM 레이턴시로 표시(`ResponseTab`)하면 의미가 모호해집니다.
  - 제안: 명칭을 `turnTotalDurationMs`로 명확히 하거나 UI에서 "LLM latency"가 아닌 "Turn duration (incl. tool calls)"로 표시

- **[INFO]** Zustand 연속 store 업데이트의 비원자 쌍
  - 위치: `use-execution-events.ts`, `handleAiMessage` (~라인 248–256)
  - 상세: `addConversationMessage()`와 `updateConversationConfig()` 두 개의 별도 `set` 호출이 순차 실행됩니다. Node.js/React 18 자동 배칭 환경에서는 일반적으로 하나의 렌더 사이클로 묶이지만, 이벤트 핸들러 외부(WebSocket 콜백)에서 호출될 경우 React 17 이하나 일부 환경에서 중간 상태로 렌더가 발생할 수 있습니다.
  - 제안: 두 업데이트를 단일 `set` 호출로 통합하는 `handleAiMessage` 전용 store 액션 추가 고려 (현재 구조상 위험도는 낮음)

- **[INFO]** 기존 `pendingContinuations` Map의 논리적 경쟁 (변경사항과 무관, 참고용)
  - 위치: `execution-engine.service.ts`, `waitForAiConversation` 루프 전반
  - 상세: `pendingContinuations.set()` 이후 즉시 사용자 메시지가 들어오면 동일 executionId에 대해 resolve가 중복 시도될 수 있는 구조가 이미 존재합니다. 이번 변경사항은 이를 악화시키지 않습니다.

---

### 요약

이번 변경사항은 AI 멀티턴 대화의 각 턴에 대한 디버그 정보(요청/응답 페이로드, 레이턴시, 토큰 사용량)를 WebSocket 이벤트와 프론트엔드 store에 추가하는 것이 주목적입니다. 변경된 코드는 모두 기존 단일 실행 흐름 내의 로컬 변수 조작과 Zustand 상태 업데이트로 구성되어 있어 새로운 동시성 위험을 도입하지 않습니다. 단, tool call 루프가 존재할 때 `lastTurnRequest`가 초기 요청 스냅샷을 캡처해 `lastTurnResponse`(최종 결과)와 쌍이 맞지 않는 논리적 불일치가 존재하며, 이는 디버그 데이터의 신뢰성에 영향을 줄 수 있습니다.

### 위험도

**LOW**