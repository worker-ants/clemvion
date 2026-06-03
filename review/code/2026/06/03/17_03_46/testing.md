# Testing Review — 요소별 발생 시각·소요시간 노출 (workflow-turn-timing)

## 발견사항

### **[WARNING]** `toolStatusMapFromItems`가 `startedAt`을 수집하지 않아 ai_message 스냅샷 교체 시 tool timestamp 유실
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-turn-timing-69fee2/codebase/frontend/src/lib/conversation/conversation-utils.ts` L596–610
- 상세: `toolStatusMapFromItems`는 live 이벤트(`tool_call_completed`)로 채워진 tool item의 `timestamp`(`startedAt`)를 `ToolStatusInfo` Map에 수집하지 않는다. `ai_message` 스냅샷이 도착해 conversationMessages를 교체할 때 이 Map을 이용해 status/durationMs/error를 재합성하지만, `startedAt`은 누락된다. 결과적으로 live 경로에서 정확히 표시되던 tool timestamp가 `ai_message` 스냅샷 교체 후 `undefined`로 리셋될 수 있다. `toolStatusMapFromDebug` 경로(영속 히스토리)는 `startedAt`을 올바르게 수집하므로 두 경로 간 비대칭이 생긴다.
- 제안: `toolStatusMapFromItems` 내부에서 `startedAt: item.timestamp`를 Map entry에 포함시킨다. 관련 테스트(`use-execution-events.test.ts`의 "ai_message snapshot preserves toolStatus from prior tool_call_completed events" 케이스)에 `timestamp` 보존 assertion을 추가한다.

### **[WARNING]** `use-execution-events.ts` — `tool_call_started`/`tool_call_completed`의 `startedAt` 전파 로직에 대한 전용 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-turn-timing-69fee2/codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` L1430–1530
- 상세: 핵심 변경 사항인 (1) `tool_call_started` 수신 시 `payload.startedAt` → `item.timestamp` 설정, (2) `tool_call_completed` 수신 시 `payload.startedAt`으로 `item.timestamp` reconcile, (3) `startedAt` 미동봉(legacy) 시 `new Date().toISOString()` 폴백 — 이 세 경로 모두 기존 테스트가 커버하지 않는다. 현재 `tool_call_started` 테스트는 payload에 `startedAt` 없이 작성되어 있고, `timestamp` 필드를 assert하지 않는다.
- 제안: 다음 세 케이스를 각각 추가한다. (1) `startedAt` 동봉 시 `item.timestamp === payload.startedAt`, (2) `startedAt` 미동봉 시 `item.timestamp`가 ISO8601 형식의 client 수신 시각으로 채워짐, (3) `tool_call_completed`의 `startedAt`이 기존 `item.timestamp`를 덮어씌워 reconcile됨.

### **[WARNING]** `toolStatusMapFromItems` `startedAt` 누락 — 테스트에서 검증 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-turn-timing-69fee2/codebase/frontend/src/lib/conversation/__tests__/conversation-utils.test.ts`
- 상세: `toolStatusMapFromItems` 함수 자체의 유닛 테스트가 없다. 이 함수는 live → snapshot 교체 시 status 보존을 담당하는 중요 경로인데, `startedAt`/`timestamp` 전파 여부를 검증하는 테스트가 전무하다.
- 제안: `toolStatusMapFromItems`의 독립 유닛 테스트를 추가한다. tool item에 `timestamp`가 있을 때 map entry에 `startedAt`이 포함되는지, 없을 때 `undefined`가 되는지 각각 검증한다.

### **[INFO]** `ai-agent.handler.spec.ts` — `startedAt`/`finishedAt` ISO8601 형식 검증 없음 (타입만 체크)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-turn-timing-69fee2/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts` L2712–2723 (diff 기준 추가 라인)
- 상세: 추가된 테스트는 `typeof llmCalls[0].startedAt === 'string'` / `typeof toolCalls[0].startedAt === 'string'`만 확인한다. 값이 실제 ISO8601 형식인지(예: `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/`) 검증하지 않아, 임의 문자열이 들어가도 통과한다. 또한 `startedAt < finishedAt` 인과 관계도 검증하지 않는다.
- 제안: `toMatch(/^\d{4}-\d{2}-\d{2}T/)` 등의 형식 검증을 추가한다. 또한 `new Date(startedAt) <= new Date(finishedAt)` 불변 조건을 assert하면 시간 역전 버그를 사전에 잡을 수 있다.

### **[INFO]** `execution-engine.service.spec.ts` — `finishedAt` 미동봉 케이스(backward compat) 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-turn-timing-69fee2/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (추가된 테스트 근방)
- 상세: 추가된 테스트는 `startedAt`/`finishedAt`이 모두 있는 경우만 커버한다. `startedAt`/`finishedAt`이 없는 과거 데이터(optional 필드)가 들어왔을 때 `buildAiMessageDebugFromResumeState`가 `llmCalls[0].startedAt === undefined`를 반환하는지(대신 crash하지 않는지) 검증하는 케이스가 없다.
- 제안: `startedAt`/`finishedAt`이 없는 llmCalls 입력에서 `debug.llmCalls?.[0].startedAt`이 `undefined`이고 예외가 발생하지 않음을 확인하는 케이스를 추가한다.

### **[INFO]** `date.test.ts` — `time-seconds` 포맷의 Korean locale 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-turn-timing-69fee2/codebase/frontend/src/lib/utils/__tests__/date.test.ts` L2838–2844
- 상세: 추가된 `time-seconds` 포맷 테스트는 `en` locale만 검증한다. Korean locale(`ko-KR`)에서 `toLocaleTimeString`이 다른 형식(예: `오후 9:00:34`)을 반환하는 환경에서 regex가 통과하지 않을 수 있으나, 실제 사용처는 Korean locale에서도 호출된다.
- 제안: `formatDate("2026-01-15T12:00:34Z", "time-seconds", "ko")`가 "34"를 포함하고 `—`가 아님을 확인하는 간단한 케이스를 추가한다.

### **[INFO]** 프론트엔드 UI 컴포넌트(`conversation-inspector.tsx`, `result-timeline.tsx`, `conversation-timeline-item.tsx`) — timestamp 렌더 변경에 대한 컴포넌트 테스트 없음
- 위치: `codebase/frontend/src/components/editor/run-results/__tests__/conversation-inspector.test.tsx`, `result-timeline.test.tsx`
- 상세: `item.timestamp`를 받아 `formatDate`로 표시하는 렌더 경로 변경이 여러 컴포넌트에 추가됐으나, 이를 직접 검증하는 렌더 테스트가 추가되지 않았다. `timestamp`가 있을 때와 없을 때의 렌더 차이, `durationMs` 단독 표시, 구분자(`·`) 조건부 렌더 등이 모두 미검증 상태다.
- 제안: 최소한 (1) `timestamp` + `durationMs` 둘 다 있을 때 둘 다 렌더됨, (2) `timestamp`만 있을 때 구분자 없이 시각만 렌더됨, (3) 둘 다 없을 때 해당 section이 렌더되지 않음 세 케이스를 `conversation-inspector.test.tsx` 또는 `result-timeline.test.tsx`에 추가한다.

## 요약

이번 변경은 LLM 호출 및 tool 실행의 절대 발생 시각(`startedAt`/`finishedAt`) 데이터를 backend에서 생성해 WS 이벤트와 영속 turnDebug에 동봉하고, frontend에서 이를 수집해 타임라인에 렌더하는 전체 경로를 포함한다. 핵심 데이터 변환 경로(`messagesToConversationItems`)와 `formatDate("time-seconds")` 유틸에는 유닛 테스트가 잘 추가되어 있다. 그러나 live 이벤트 경로에서 `tool_call_started`/`tool_call_completed`의 `startedAt` 전파를 검증하는 이벤트 핸들러 테스트가 없고, 특히 `toolStatusMapFromItems`가 `startedAt`을 수집하지 않아 ai_message 스냅샷 교체 시 tool timestamp가 유실되는 버그(코드 결함)가 존재한다. 이를 드러내는 회귀 테스트도 없다.

## 위험도

MEDIUM
