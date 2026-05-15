### 발견사항

- **[CRITICAL]** `processMultiTurnMessage`에서 `buildTools(state)` 호출 시 도구 데이터 손실
  - 위치: `ai-agent.handler.ts` `processMultiTurnMessage` 메서드
  - 상세: `state` 객체에는 `toolNodeIds`/`toolOverrides`가 저장되지 않음 (`_multiTurnState`에 포함되지 않음). 결과적으로 후속 턴에서 도구가 항상 빈 배열로 반환되어 멀티턴 중 tool calling이 동작하지 않음
  - 제안: `_multiTurnState`에 `toolNodeIds`/`toolOverrides` 포함, 후속 턴 tool calling 동작을 검증하는 테스트 추가

- **[WARNING]** `waitForAiConversation`, `continueAiConversation`, `endAiConversation` 서비스 메서드 테스트 부재
  - 위치: `execution-engine.service.ts`
  - 상세: 실행 엔진의 핵심 대화 제어 로직(Promise 기반 blocking, timeout, 상태 전환)에 대한 단위 테스트가 전혀 없음. 특히 타임아웃 경로, 동시 호출 시 race condition, `pendingContinuations` 미존재 시 에러 처리가 검증되지 않음
  - 제안: `execution-engine.service.spec.ts`에 해당 메서드 테스트 추가

- **[WARNING]** WebSocket 신규 핸들러 테스트 부재
  - 위치: `websocket.gateway.ts` — `handleSubmitMessage`, `handleEndConversation`
  - 상세: 기존 `handleSubmitForm`, `handleClickButton`에 대응하는 게이트웨이 테스트가 없음. 인증 실패 경로, 서비스 예외 전달 등 검증 누락
  - 제안: 게이트웨이 스펙 파일에 두 핸들러에 대한 테스트 추가 (인증 실패, 정상 동작, 서비스 예외)

- **[WARNING]** `maxTurns = 0` (무제한) 경계값 테스트 누락
  - 위치: `ai-agent.handler.spec.ts` `processMultiTurnMessage`
  - 상세: `isLastTurn = maxTurns > 0 && turnCount >= maxTurns` 조건에서 `maxTurns = 0`이 무제한으로 동작하는지 검증하는 테스트가 없음
  - 제안: `maxTurns: 0` 상태에서 `processMultiTurnMessage` 호출 시 `status: 'waiting_for_input'`을 반환하는지 테스트 추가

- **[WARNING]** `waitForAiConversation` 내 `setTimeout` 클리어 미처리
  - 위치: `execution-engine.service.ts` while 루프 내 `setTimeout` 생성
  - 상세: 대화가 정상 종료(user_ended/max_turns)되어도 이전에 등록된 타이머가 남아있음. 타이머 발화 시 `pendingContinuations.has(executionId)`가 `false`여서 실제 동작 오류는 없으나, 타이머 누적으로 메모리/불필요한 체크가 발생. 타이머 기반 테스트 작성 시 fake timer로 모든 경로를 검증하기 어려움
  - 제안: `const timerId = setTimeout(...); return () => clearTimeout(timerId)` 패턴으로 교체하여 테스트 용이성 확보

- **[WARNING]** RAG 결과를 `system` 메시지로 mid-conversation 삽입하는 동작 미검증
  - 위치: `ai-agent.handler.ts` `processMultiTurnMessage` 내 RAG 삽입, `ai-agent.handler.spec.ts`
  - 상세: RAG 결과를 `{ role: 'system', content: ... }` 메시지로 대화 중간에 삽입하는 것은 비표준 동작으로 일부 LLM 프로바이더(Anthropic 등)에서 오류 유발 가능. 현재 RAG 테스트는 `search` 호출 여부만 검증하고 메시지 배열 구조를 검증하지 않음
  - 제안: RAG 결과 삽입 후 `messages` 배열에 system 메시지가 올바른 위치에 포함되는지 assert 추가

- **[INFO]** 멀티턴 첫 번째 턴에서 tool calling 루프 테스트 누락
  - 위치: `ai-agent.handler.spec.ts` `execute - multi_turn`
  - 상세: `executeMultiTurn` 내 tool calling 루프가 있으나, 첫 턴에서 tool_calls가 발생하는 시나리오에 대한 테스트가 없음
  - 제안: 첫 턴 tool calling → 최종 응답 시나리오를 `execute - multi_turn` 섹션에 추가

- **[INFO]** 테스트 상태 객체에 `temperature`/`maxTokens` 누락 (RAG 테스트)
  - 위치: `ai-agent.handler.spec.ts` `processMultiTurnMessage` > RAG 테스트
  - 상세: 해당 상태 객체에 `temperature`, `maxTokens` 필드가 없음. 실제 코드에서 `state.temperature`/`state.maxTokens`를 사용하므로 `undefined`로 LLM에 전달됨. 명시적으로 포함하거나 `undefined` 동작을 의도적으로 문서화해야 함

---

### 요약

`ai-agent.handler.spec.ts`는 validate, execute(단일/멀티턴), processMultiTurnMessage, buildMultiTurnFinalOutput에 대한 핵심 케이스를 잘 커버하고 있으나, **`processMultiTurnMessage` 내 `buildTools(state)` 호출이 실제로 도구를 전달하지 못하는 버그**가 테스트로 검증되지 않은 채 존재한다. 또한 실행 엔진 서비스의 대화 흐름 제어 메서드(waitForAiConversation, continueAiConversation, endAiConversation)와 WebSocket 신규 핸들러에 대한 테스트가 전혀 없어, 가장 복잡한 비동기 흐름(Promise blocking, timeout, 상태 전환)이 회귀 위험에 노출되어 있다.

### 위험도

**HIGH**