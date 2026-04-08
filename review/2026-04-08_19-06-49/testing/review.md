### 발견사항

- **[CRITICAL]** `processMultiTurnMessage` 메서드에 대한 단위 테스트 없음
  - 위치: `ai-agent.handler.ts:388-479`
  - 상세: `lastTurnRequest`, `lastTurnResponse`, `lastTurnDurationMs` 필드가 `_multiTurnState`에 추가되었으나, 이 값들이 올바르게 설정되는지 검증하는 테스트가 없음. 특히 tool call 루프가 실행될 때 `chatParams`가 루프 이전 메시지 스냅샷을 캡처하지만, `turnStartedAt`은 전체 tool call 루프 시간을 포함 — 이 불일치를 검증할 테스트가 없음
  - 제안: `processMultiTurnMessage` 테스트에서 반환된 `_multiTurnState.lastTurnRequest.messages`와 실제 LLM 호출 시점의 메시지가 일치하는지, `lastTurnDurationMs`가 양수인지 검증

- **[CRITICAL]** `waitForAiConversation` 내 웹소켓 이벤트 emit 로직에 대한 통합 테스트 없음
  - 위치: `execution-engine.service.ts:872-898`
  - 상세: `metadata`, `requestPayload`, `responsePayload`, `durationMs` 필드가 `execution.ai_message` 이벤트에 추가되었으나, 이 필드들이 WebSocket으로 올바르게 전송되는지 검증하는 테스트가 전혀 없음. `newState`가 `undefined`일 경우(예: `resultObj._multiTurnState`가 없을 때) 런타임 오류 발생 가능
  - 제안: `WebsocketService.emitExecutionEvent` mock을 사용해 emit 호출 시 payload에 `metadata`, `requestPayload`, `responsePayload`, `durationMs`가 포함되는지 검증. `_multiTurnState`가 없는 경우에 대한 방어 테스트 추가

- **[WARNING]** `handleAiMessage` 핸들러의 빈 문자열 처리 변경에 대한 테스트 없음
  - 위치: `use-execution-events.ts:221`
  - 상세: `if (!payload.message)` → `if (!payload.message && payload.message !== "")` 로 변경되어 빈 문자열 메시지가 허용됨. 이 엣지 케이스(AI가 빈 응답을 반환하는 경우)에 대한 테스트가 없음
  - 제안: `payload.message === ""`일 때 `addConversationMessage`가 호출되는지, `payload.message`가 `undefined`일 때 호출되지 않는지 단위 테스트 추가

- **[WARNING]** `ConversationItem` 타입 변경에 대한 타입 호환성 테스트 없음
  - 위치: `execution-store.ts:45-60`
  - 상세: `timestamp`, `durationMs`, `requestPayload`, `responsePayload`, `metadata.model` 필드 추가. `addConversationMessage`로 기존 코드에서 생성한 아이템(새 필드 없음)이 정상 동작하는지 검증 없음. 특히 `UsageTab`에서 `meta?.inputTokens ?? 0`으로 폴백하지만 `meta`가 아예 없는 경우 렌더링 검증 없음
  - 제안: `ConversationItem` 생성 시 선택적 필드가 없는 경우 `UsageTab`, `ResponseTab`, `RequestTab` 컴포넌트가 정상 렌더링되는지 단위 테스트(RTL) 추가

- **[WARNING]** `SummaryView`의 히스토리 모드 메시지 변환 로직 테스트 없음
  - 위치: `conversation-inspector.tsx:317-330`
  - 상세: `output.messages`를 `ConversationItem` 배열로 변환하는 IIFE 로직에서 `system` 역할 메시지 필터링, `turnIndex` 계산(`Math.floor(i / 2) + 1`)이 올바른지 검증 없음. 홀수 개 메시지, 연속 assistant 메시지 등의 엣지 케이스 미검증
  - 제안: 다양한 메시지 배열(빈 배열, user만, assistant로 시작, system 포함)에 대한 변환 결과를 검증하는 단위 테스트 추가

- **[WARNING]** `chatParams` 스냅샷과 실제 LLM 호출 인자 불일치 가능성
  - 위치: `ai-agent.handler.ts:391-398`
  - 상세: `chatParams.messages`는 `[...messages]` 얕은 복사이지만, 이후 tool call 루프에서 `messages` 배열이 변경됨. `lastTurnRequest`에 저장된 `messages`는 루프 전 상태를 반영하나 실제 마지막 LLM 호출의 `messages`와 다를 수 있음. 디버깅 목적이라면 실제 마지막 호출 payload와 달라 혼란 유발
  - 제안: tool call 발생 시 `chatParams`가 초기 요청을 나타내는 의도인지 명시적 주석 추가 및 이를 검증하는 테스트 작성

- **[INFO]** `TabBar` 제네릭 컴포넌트에 대한 렌더링 테스트 없음
  - 위치: `conversation-inspector.tsx:74-96`
  - 상세: 탭 클릭 시 `onChange` 콜백 호출 여부, 활성 탭 스타일 적용 여부 미검증
  - 제안: RTL로 탭 클릭 → 콜백 호출 → 활성 상태 변경 플로우 테스트

- **[INFO]** `run-results-drawer.tsx`의 `timestamp` 추가에 대한 테스트 없음
  - 위치: `run-results-drawer.tsx:157-163`
  - 상세: `handleSendMessage`에서 `new Date().toISOString()` 사용으로 시간 의존성 발생. 테스트에서 날짜 모킹 없이는 정확한 값 검증 불가
  - 제안: `jest.useFakeTimers()` + `jest.setSystemTime()`으로 타임스탬프 고정 후 검증

### 요약

이번 변경은 AI 대화 디버깅 기능(request/response payload, 토큰 메타데이터, 레이턴시 측정)을 추가했으나, 변경된 6개 파일 모두에 걸쳐 테스트가 전혀 작성되지 않았습니다. 특히 `processMultiTurnMessage`의 새 필드 설정 로직, `waitForAiConversation`의 WebSocket emit payload, 빈 문자열 메시지 처리 변경, 히스토리 모드의 메시지 변환 IIFE는 잠재적 런타임 오류나 데이터 불일치를 유발할 수 있는 고위험 경로임에도 검증이 없습니다. `chatParams` 스냅샷이 tool call 루프 이전 시점을 캡처하는 것도 디버깅 도구로서의 신뢰도를 저하시킵니다.

### 위험도
**HIGH**