### 발견사항

---

**[WARNING] `chatParams`의 `messages` 스냅샷이 tool call 루프 이전에 고정됨**
- 위치: `ai-agent.handler.ts`, `processMultiTurnMessage` — `chatParams` 생성 위치
- 상세: `chatParams.messages`는 tool call 루프 시작 전 스냅샷이므로, tool call이 발생한 턴에서 `requestPayload`는 실제 최종 LLM 호출 파라미터와 다름. tool call이 없는 경우엔 무해하지만, 디버깅 목적으로 캡처된 값의 신뢰도가 낮아질 수 있음
- 제안: tool call 루프 종료 후 최종 호출에 사용된 파라미터를 별도로 캡처하거나, 첫 번째 호출임을 명시하는 필드(`isFirstCall`) 추가

---

**[WARNING] `execution.ai_message` 이벤트의 `payload.message === ""`인 경우 guard 조건 변경으로 인한 의도치 않은 동작**
- 위치: `use-execution-events.ts:221` — `if (!payload.message && payload.message !== "") return;`
- 상세: 변경 전 `if (!payload.message) return;`은 빈 문자열도 필터링했으나, 변경 후 빈 문자열(`""`)을 허용함. AI가 빈 응답을 반환하는 경우 타임라인에 빈 assistant 메시지가 추가되어 사용자에게 혼란을 줄 수 있음
- 제안: 의도적으로 빈 응답을 허용하는 것이라면 UI에서 `(empty)` 처리가 있으므로 수용 가능. 그러나 백엔드에서 `message: ""`를 실제로 전송하는 케이스가 없다면 `if (payload.message == null) return;`으로 명확화 권장

---

**[WARNING] 초기 턴(userPrompt가 있는 경우)에는 `lastTurnRequest/Response/DurationMs`가 `_multiTurnState`에 없음**
- 위치: `ai-agent.handler.ts`, `executeMultiTurn` — 첫 번째 LLM 호출 결과를 `_multiTurnState`에 저장하지 않음
- 상세: `processMultiTurnMessage`에서 처리되는 2번째 턴 이후에만 디버그 정보가 캡처됨. 초기 `execution.waiting_for_input` 이벤트에는 `metadata`, `requestPayload`, `responsePayload`, `durationMs`가 없어서 첫 번째 턴의 디버그 정보는 inspector에서 볼 수 없음
- 제안: `executeMultiTurn` 내 첫 번째 LLM 호출에도 동일하게 `lastTurnRequest`, `lastTurnResponse`, `lastTurnDurationMs`를 캡처하여 `_multiTurnState`에 포함, `execution.waiting_for_input` 이벤트 emitting 시 같이 전송

---

**[WARNING] `SummaryView`의 history 모드에서 `turnIndex` 계산 오류**
- 위치: `conversation-inspector.tsx`, `SummaryView` — `turnIndex: Math.floor(i / 2) + 1`
- 상세: `messages` 배열에서 user/assistant 메시지를 순서대로 처리할 때 `i`는 필터 후 인덱스이므로 `[user(0), assistant(1), user(2), assistant(3)]` 구조에서 `Math.floor(i/2)+1`은 `[1, 1, 2, 2]`를 생성함. 그러나 시스템 메시지가 있다면 필터로 제거되므로 이 계산은 맞음. 단, 도구 호출 메시지(`role: "tool"`, `role: "assistant" with toolCalls`)는 이미 필터링되어 있어 실제 turnIndex와 맞지 않을 수 있음
- 제안: 실제 턴 번호를 정확히 계산하려면 user 메시지 카운트를 추적하거나, 서버가 각 메시지에 `turnIndex`를 포함해 전송하는 방식으로 개선

---

**[INFO] `UsageTab`의 `ragChunks` 필드가 항상 표시되지 않음**
- 위치: `conversation-inspector.tsx`, `UsageTab`
- 상세: `ConversationItem.metadata`에 `ragChunks` 필드가 있으나, `use-execution-events.ts`의 `handleAiMessage`에서 `metadata` 매핑 시 `ragChunks`가 누락됨. RAG가 사용된 경우에도 `ragChunks`는 항상 `undefined`
- 제안: `handleAiMessage`의 metadata 매핑에 `ragChunks` 추가. 단, 백엔드 이벤트 페이로드에 `ragChunks`가 없는 경우 백엔드도 함께 수정 필요

---

**[INFO] `TabBar` 제네릭 컴포넌트의 타입 파라미터가 실제로 타입 안전성을 제공하지 못함**
- 위치: `conversation-inspector.tsx`, `TabBar<T extends string>`
- 상세: `ASSISTANT_TABS`는 `{ id: AssistantTabId; label: string }[]`이나, `TabBar`에 전달 시 `T`가 `string`으로 추론되므로 실제 제네릭 효과 없음. 기능상 문제는 아님
- 제안: `tabs: readonly { id: T; label: string }[]`로 `readonly` 추가하거나 제네릭 없이 단순화 가능

---

### 요약

이번 변경은 AI 에이전트 멀티턴 대화의 디버깅 가시성(request/response payload, latency, usage)을 향상시키는 기능으로 전반적으로 잘 구현되어 있습니다. 그러나 **첫 번째 턴의 디버그 정보가 캡처되지 않는 점**(WARNING)과 **tool call이 있는 경우 `requestPayload`가 실제 최종 호출과 다를 수 있는 점**(WARNING)은 디버깅 도구로서의 정확성을 저해합니다. `ragChunks` 누락으로 RAG 사용 시 Usage 탭에서 관련 정보가 항상 0으로 표시되는 점도 개선이 필요합니다. 크리티컬한 버그는 없으나 디버깅 기능의 완전성 측면에서 위 WARNING 사항들을 보완하면 더 신뢰도 높은 도구가 됩니다.

### 위험도

**LOW**