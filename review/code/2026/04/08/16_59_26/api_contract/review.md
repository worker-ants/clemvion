## 발견사항

### WebSocket 프로토콜 (API 계약)

- **[WARNING]** `execution.waiting_for_input` 페이로드 타입 정의와 실제 접근 방식 불일치
  - 위치: `use-execution-events.ts` — `handleWaitingForInput`
  - 상세: 스펙(`spec/3-execution.md §8.1`)은 `conversationConfig?`을 페이로드 직접 필드로 정의하지만, 구현체의 타입 정의에는 해당 필드가 없고 `payload.nodeOutput.conversationConfig`로 간접 접근함. 반면 `buttonConfig`는 `payload.buttonConfig`(직접) + `payload.nodeOutput.buttonConfig`(폴백) 두 경로를 모두 지원하여 일관성이 없음.
  - 제안: 타입 정의에 `conversationConfig?: unknown` 추가하고 `buttonConfig`와 동일한 패턴으로 `payload.conversationConfig ?? output?.conversationConfig` 순서로 접근

- **[WARNING]** `updateConversationConfig(payload)` 호출 시 config 데이터 손실
  - 위치: `use-execution-events.ts` — `handleAiMessage` (line ~220)
  - 상세: `execution.ai_message` 페이로드 `{ nodeId, message, turnCount, messages }`로 전체 `waitingConversationConfig`를 덮어씀. 원본 config의 `maxTurns`, `turnTimeout` 등이 소실됨. `SummaryView`에서 `config?.maxTurns`를 읽으므로 AI 응답 수신 후 "Turn N/∞"로 표시가 바뀌는 부작용 발생.
  - 제안: `updateConversationConfig`를 merge 방식으로 수정하거나, `handleAiMessage`에서 `turnCount`만 별도 상태로 업데이트

- **[INFO]** `WaitingInteractionType` 유니온 확장 — 하위 호환성 유지
  - 위치: `execution-store.ts`
  - 상세: `"ai_conversation"` 추가는 additive change. `handleExecutionResumed`에서 `ai_conversation` → `buttons` → form 순으로 처리하여 기존 흐름에 영향 없음.

- **[INFO]** 신규 WebSocket 명령 추가 (`execution.submit_message`, `execution.end_conversation`)
  - 위치: `result-detail.tsx` — `handleSendMessage`, `handleEndConversation`
  - 상세: 기존 명령과 독립적으로 추가됨. `nodeId` 필드가 신규로 필요하여 서버측 라우팅 구현 확인 필요. 스펙과 일치.

- **[WARNING]** 중복 메시지 방지 로직이 취약
  - 위치: `use-execution-events.ts` — `handleWaitingForInput` (~line 175)
  - 상세: `conversationMessages.length === 0` 조건으로만 중복 방지. 서버가 동일 `waiting_for_input`을 재전송하되 새 메시지가 포함된 경우(재연결 시나리오) 메시지 누락 가능. 또한 `useExecutionStore.getState()`를 useCallback 내에서 직접 호출하여 stale closure 위험 존재.
  - 제안: 메시지 ID 기반 중복 제거 또는 마지막 처리된 turnCount 비교 방식 사용

---

**추가 버그 (코드 오류):**
- **[CRITICAL - 런타임 오류]** `result-timeline.tsx` render 함수 내 `isLiveNode` 사용 전 선언:
  ```ts
  const isExpanded = isLiveNode || ...  // ← isLiveNode 미선언 상태
  const isLiveNode = ...
  ```
  `const`는 호이스팅되지 않으므로 ReferenceError 발생. `isLiveNode` 선언을 `isExpanded` 앞으로 이동 필요.

---

## 요약

이번 변경은 AI Agent Multi-Turn 대화를 위한 WebSocket 프로토콜 확장으로, `ai_conversation` 인터랙션 타입과 `execution.ai_message` / `execution.submit_message` / `execution.end_conversation` 이벤트를 추가한다. 기존 `form`/`buttons` 인터랙션에 대한 하위 호환성은 유지되나, `execution.waiting_for_input` 페이로드에서 `conversationConfig`를 직접 필드가 아닌 `nodeOutput` 내부에서 접근하는 방식이 스펙 및 기존 `buttonConfig` 패턴과 불일치하고, `handleAiMessage`에서 전체 config를 AI 메시지 페이로드로 교체하여 `maxTurns` 등 원본 설정이 소실되는 문제가 있다. 또한 `result-timeline.tsx`의 `isLiveNode` 선언 순서 오류는 즉시 수정이 필요한 런타임 버그다.

## 위험도
**HIGH**