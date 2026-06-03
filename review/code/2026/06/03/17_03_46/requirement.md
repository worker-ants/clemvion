# 요구사항(Requirement) Review

## 발견사항

### **[WARNING]** spec §9.12 표시 규약과 코드 간 포맷 불일치: `"time"` vs `"time-seconds"`

- 위치: `spec/conventions/conversation-thread.md §9.12` 표시 규약 1항 vs 다수 프론트엔드 파일
- 상세: spec §9.12는 "좁은 row" 에는 `formatDate(item.timestamp, "time")` 사용을 명시한다. 그러나 실제 구현에서 `conversation-timeline-item.tsx`, `result-timeline.tsx`, `conversation-inspector.tsx` (SummaryView), `executions/[executionId]/page.tsx` 의 row-level 표시 코드는 `"time-seconds"` 를 사용한다. `"time-seconds"` 는 `"time"` 에 초(second) 컴포넌트를 추가한 별도 포맷으로, spec 본문에는 등장하지 않는다. spec이 `"time"`으로 규정했으나 코드는 `"time-seconds"`를 선택했다. 기능적으로는 더 많은 정보(초 단위)를 보여주어 "같은 분 안의 turn 구분"이라는 사용 목적에 더 유리하지만, spec 텍스트와 literal 불일치다.
- 제안: spec §9.12 표시 규약 1항을 `"time"` 대신 `"time-seconds"` (또는 `"time" | "time-seconds"` 의 surface별 선택)로 수정해 구현과 일치시킨다 — spec 수정은 `project-planner` 위임. 또는 구현을 spec 대로 `"time"` 으로 되돌린다. 현재는 spec 기술과 코드 사이에 gap 이 있다.

---

### **[WARNING]** `toolStatusMapFromItems` 가 `startedAt` 을 보존하지 않아 라이브 → ai_message REPLACE 시 tool timestamp 소실 가능

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-turn-timing-69fee2/codebase/frontend/src/lib/conversation/conversation-utils.ts` 596-610행
- 상세: `toolStatusMapFromItems` 는 `ai_message` 스냅샷이 도착해 타임라인을 REPLACE 할 때 live 이벤트로 이미 설정된 tool 상태(status/durationMs/error)를 보존하는 함수다. 이번 변경으로 tool item 의 `timestamp` 가 `tool_call_started.startedAt` 으로 라이브에서 설정되었으나, `toolStatusMapFromItems` 는 `ToolStatusInfo` 에 `startedAt` 필드를 추가하지 않아 REPLACE 시 live에서 stamp된 `timestamp` 가 유실된다. `toolStatusMapFromDebug` (영속 경로)는 `startedAt` 을 전파하므로 영속 경로는 문제없지만, 라이브 → REPLACE 경로에서는 `meta.turnDebug.toolCalls[].startedAt` 이 권위값으로 덮어쓰므로 결과적으로 최종 값은 올바르다. 단, `startedAt` 이 영속 turnDebug에는 있고 `toolStatusMapFromItems` 에는 없는 불일치는 나중에 유지보수 혼란을 줄 수 있다.
- 제안: `ToolStatusInfo` 인터페이스와 `toolStatusMapFromItems` 에 `startedAt?: string` 을 추가하고 `item.timestamp` 를 보존하도록 수정. spec §4.4 Reconciliation 노트("turnDebug.toolCalls 가 권위적")를 감안하면 블로킹 버그는 아니나, 방어적 완성도 측면에서 보완 권장.

---

### **[INFO]** `LlmCallRecord`(`execution-engine.service.ts`) 의 `TurnDebugEntry` 에 `toolCalls` 필드 미포함

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-turn-timing-69fee2/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 346-350행
- 상세: 백엔드의 `TurnDebugEntry` (execution-engine 내부 인터페이스)는 `llmCalls?: LlmCallRecord[]` 와 `totalDurationMs?` 만 갖고 있으며 `toolCalls` 필드가 없다. `buildAiMessageDebugFromResumeState` 가 `llmCalls[].startedAt/finishedAt` 을 전파하는 경로는 구현되어 있으나, tool trace 의 `startedAt/finishedAt` 은 `ToolCallTrace` 를 통해 handler 내부에서 직접 WS 이벤트 emit 및 `turnDebug` 에 포함되는 별도 경로다. 두 경로는 각자 역할이 분리되어 있으므로 spec 위반은 아니다.
- 제안: 명시적 확인 — `ToolCallTrace` 의 `startedAt/finishedAt` 이 `turnDebugHistory[].toolCalls[]` 에 영속되는 경로(ai-agent.handler 내부)가 별도로 있음을 코멘트나 확인으로 명시하면 코드 이해에 도움이 된다.

---

### **[INFO]** spec §9.12 `system_error` turn 의 발생 시각 출처가 "노드 `finishedAt`"으로 정의되어 있으나 실제 출처 불명

- 위치: `spec/conventions/conversation-thread.md §9.12` 표 (`system_error` 행) vs `conversation-utils.ts` `threadTurnsToConversationItems`
- 상세: spec §9.12 표에서 `system_error` 의 발생 시각 출처를 `turns[].timestamp` 또는 "노드 `finishedAt`" 으로 설명한다. 그러나 `threadTurnsToConversationItems` 내 `system_error` 케이스는 `timestamp: turn.timestamp` 만 사용하며, "노드 finishedAt" 폴백 로직은 없다. spec의 "또는 노드 finishedAt" 부분은 구현에 반영되지 않았다. spec 자체의 표현이 모호하거나 과잉 정의일 수 있으며, 구현 누락일 수도 있다.
- 제안: spec의 "노드 `finishedAt`" 폴백이 실제 구현 의도인지 `project-planner` 와 확인. 의도된 경우라면 `threadTurnsToConversationItems` 에 폴백 로직 추가 필요.

---

### **[INFO]** `use-execution-events.ts` 의 `tool_call_completed` 핸들러: `started` 이벤트 유실 시 timestamp 정합

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-turn-timing-69fee2/codebase/frontend/src/lib/websocket/use-execution-events.ts` 657-660행
- 상세: `tool_call_completed` 핸들러에서 `payload.startedAt` 이 있으면 `patch.timestamp = payload.startedAt` 으로 권위값으로 덮어쓰는 로직이 추가되어 있다. spec §4.4 Reconciliation 노트의 "started 이벤트 유실 시에도 completed 에서 복원" 의도와 일치한다. 단, `finishedAt` 은 `patch` 에 추가되지 않는다 — `ConversationItem` 에 `finishedAt` 필드가 없기 때문에 정상이며, tool item 은 `startedAt` 만 `timestamp` 로 노출한다.
- 제안: 확인 완료. 현재 구현이 spec 의도와 일치.

---

## 요약

변경 전체가 "워크플로우 실행 디버깅 UI 요소별 절대 발생 시각 + 소요시간 노출" 기능 요구사항을 충족한다. 백엔드는 `ai-agent.handler.ts` 의 LLM 호출·tool 실행 시작/종료 지점에서 `startedAt`/`finishedAt` ISO8601 값을 캡처해 WS 이벤트 페이로드(`tool_call_started`, `tool_call_completed`, `ai_message.llmCalls[]`) 및 영속 `turnDebug` 에 동봉한다. 프론트엔드는 라이브 이벤트 경로(`use-execution-events.ts`)와 영속 히스토리 경로(`conversation-utils.ts::messagesToConversationItems`)에서 이 값을 `ConversationItem.timestamp` 로 매핑하고, 5개 렌더 surface에 `formatDate` 를 통해 노출한다. spec `6-websocket-protocol.md §4.4` 및 `conversation-thread.md §9.12` 요구 필드·행위가 코드에 line-level로 반영되어 있다. 주요 경고 사항은 spec §9.12 표시 규약이 `"time"` 포맷을 지정하나 구현이 `"time-seconds"` 를 사용하는 literal 불일치(기능적으로 더 나은 선택이나 spec 텍스트와 어긋남)이며, `toolStatusMapFromItems` 가 `startedAt` 을 보존하지 않아 라이브 tool timestamp 가 REPLACE 시 turnDebug 권위값으로만 복원되는 경로 완전성 이슈가 있다.

## 위험도

LOW
