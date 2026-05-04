### 발견사항

---

**[WARNING] `toolCallTraces` 멀티턴에서 턴 간 누적 — 점진적 메모리 증가 + 잘못된 debug 데이터**
- 위치: `ai-agent.handler.ts` — 멀티턴 경로 `const toolCallTraces: ToolCallTrace[] = []`
- 상세: `toolCallTraces`가 while 루프 **바깥**에서 한 번 선언되고 turnDebug에 `[...toolCallTraces]`로 포함된다. 결과적으로 Turn 2의 debug 항목은 Turn 1의 trace까지 포함하고, 턴이 늘어날수록 배열이 누적 성장한다. 10턴 × 5 tool calls = Turn 10 debug에 50개 trace가 들어가는 O(n²) 공간 소비.
- 제안:
  ```typescript
  // while 루프 내부에서 매 턴 초기화
  while (true) {
    const toolCallTraces: ToolCallTrace[] = [];
    // ...
  }
  ```

---

**[WARNING] `upsertToolItem`의 O(n) 중복 검사**
- 위치: `execution-store.ts` — `upsertToolItem` 구현
- 상세: 매 `tool_call_started` WS 이벤트마다 `state.conversationMessages.some(i => i.toolCallId === item.toolCallId)`로 전체 배열을 선형 스캔한다. 대화 기록이 길어질수록 (수십 턴 × 다수 tool calls) 매 이벤트마다 O(n) 탐색이 발생한다.
- 제안: 스토어에 `toolCallIdSet: Set<string>`을 보조 자료구조로 유지해 O(1) 중복 검사:
  ```typescript
  upsertToolItem: (item) => set((state) => {
    if (!item.toolCallId) return { conversationMessages: [...state.conversationMessages, item] };
    if (state.toolCallIdSet.has(item.toolCallId)) return {};
    return {
      conversationMessages: [...state.conversationMessages, item],
      toolCallIdSet: new Set([...state.toolCallIdSet, item.toolCallId]),
    };
  }),
  ```

---

**[WARNING] `ai_message` 이벤트마다 전체 메시지 히스토리 재파싱**
- 위치: `use-execution-events.ts` — `handleAiMessage` 콜백
- 상세: `ai_message`를 수신할 때마다 `messagesToConversationItems(payload.messages, ...)` 호출로 대화 전체를 재처리한다. 멀티턴 에이전트에서 각 Turn 완료 시마다 누적된 모든 메시지가 재파싱되어 O(total_messages) 작업이 반복된다. 또한 `setConversationMessages(items)`는 전체 React 트리를 재렌더링한다.
- 제안: 이미 파싱된 이전 아이템을 재사용하고, 증분 업데이트(마지막 턴만 append)를 고려. 최소한 `useMemo`나 `useCallback` 내에서 이전 결과를 캐싱.

---

**[INFO] `[...toolCallTraces]` 불필요한 배열 복사**
- 위치: `ai-agent.handler.ts` — turnDebug 빌드 시 4곳에서 `{ toolCalls: [...toolCallTraces] }` 사용
- 상세: `toolCallTraces`는 로컬 변수로 외부에 공유되지 않으므로 spread 복사가 불필요하다. 참조 그대로 전달해도 안전하다.
- 제안: `{ toolCalls: toolCallTraces }` (단, WARNING #1 수정 후 턴 단위 배열을 사용)

---

**[INFO] `tryParseJson` 중복 정의**
- 위치: `use-execution-events.ts:1-8`, `conversation-utils.ts` 내부
- 상세: 동일한 `tryParseJson`이 두 파일에 독립적으로 정의된다. 기능 중복이지만 성능 영향은 없다.
- 제안: `conversation-utils.ts`에서 export해 재사용.

---

**[INFO] `WebsocketService.emitExecutionEvent`의 `new Date().toISOString()` 호출 빈도**
- 위치: `websocket.service.ts` — `emitExecutionEvent` 메서드
- 상세: 모든 이벤트 emission마다 `new Date()` 객체를 생성하고 `.toISOString()`을 호출한다. tool call 이벤트가 2회(started/completed) 추가됨에 따라 호출 빈도가 증가했다. V8에서 `Date.now()`가 `new Date().toISOString()`보다 저렴하지만 실제 영향은 매우 낮다.
- 제안: 이미 `runProviderTool`에서 `Date.now()`로 측정한 timestamp를 payload에 포함시켜 전달하면 중복 Date 생성을 줄일 수 있다. 우선순위 낮음.

---

### 요약

이번 변경의 핵심 성능 리스크는 두 가지다. **첫째**, 멀티턴 AI 에이전트 핸들러에서 `toolCallTraces`가 턴 경계를 가로질러 누적되어 O(n²) 공간 소비와 debug 데이터 오염이 발생한다 — 이는 버그이기도 하다. **둘째**, 프론트엔드 스토어의 `upsertToolItem`이 O(n) 선형 스캔을 사용해 tool call이 많은 긴 대화에서 불필요한 탐색 비용이 쌓인다. `handleAiMessage`의 전체 메시지 재파싱 역시 대화가 길어질수록 누적 비용이 된다. 나머지 항목들은 소규모 할당 최적화 수준이며 실제 영향은 미미하다.

### 위험도

**MEDIUM**