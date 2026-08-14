# 부작용(Side Effect) 리뷰

## 발견사항

- **[CRITICAL]** `execution.failed` WS wire 페이로드의 `error` 필드가 string → object 로 바뀌면서, **같은 payload 를 그대로 받는 프런트엔드 에디터 WS 소비자가 갱신되지 않아 런타임에 깨진다**
  - 위치(원인, 이번 diff):
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:664` (`failFirstSegmentSetup`), `:3268-3271`·`:3277`·`:3312` (`finalizeStalledExhausted`), `:4870` (`finalizeFailedExecution`)
    - `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:965-967` (`failRetryExecution`)
  - 위치(영향받는 소비자, diff 밖 — `Read` 로 직접 확인한 실제 줄 번호):
    - `codebase/frontend/src/lib/websocket/use-execution-events.ts:253-264` (`handleExecutionFailed`) — 여전히 `data as { error?: string }` 로 캐스팅하고 `payload.error` 를 그대로 문자열처럼 사용
    - `codebase/frontend/src/lib/stores/execution-store.ts:24`(`NodeStatusInfo.error?: string`)·`:170`(`ConversationItem.error?: string`)·`:736-754`(`failExecution: (error?: string) => void`)·`:947-959`(`flushPendingToolItemsAsError: (reason: string) => void`, 대입 `error: reason`)
    - `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:475-479` — `{item.error}` 를 **object 를 문자열이라 가정하고 JSX child 로 직접 렌더**
    - 대조: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:1123-1128`·`:1881-1895` — 지금도 `handler({ error: "backend crashed" })` 처럼 **문자열**을 전제로 테스트한다(이번 PR 이 건드리지 않음 → 계약 불일치를 이 테스트가 못 잡는다).
  - 상세:
    이번 PR 은 `execution.failed` 를 emit 하는 **4개 지점 전부**(`ExecutionEngineService.failFirstSegmentSetup`/`finalizeStalledExhausted`/`finalizeFailedExecution`, `RetryTurnService.failRetryExecution`)를 `toTerminalErrorPayload(...)` 로 통일해 `error` 를 `{code, message, nodeId, details?}` 객체로 바꿨다. 이 payload 는 `ExecutionEventEmitter.emitExecution` → `WebsocketService.emitExecutionEvent` 를 거쳐 **`wireEnvelope`(내부 에디터 socket.io 채널, `gateway.broadcastToChannel`)에도 그대로 들어간다** (`websocket.service.ts:432-442`) — sanitize 는 credential 마스킹만 하고 shape 을 바꾸지 않는다. `EXECUTION_FAILED` 를 실제로 emit 하는 지점은 이 4곳이 전부라서(`button-interaction`/`form-interaction`/`ai-turn-orchestrator` 는 `EXECUTION_WAITING_FOR_INPUT`/`AI_MESSAGE`/`EXECUTION_RESUMED` 만 직접 emit 하고, 실패는 결국 `finalizeFailedExecution` 으로 수렴) **`execution.failed` 를 구독하는 모든 프런트 클라이언트가 100% 이 변경의 영향을 받는다.**
    그런데 프런트 `use-execution-events.ts`(diff 밖, 이번 PR 이 건드리지 않음)의 `handleExecutionFailed` 는 여전히 `payload.error` 를 문자열로 취급해 `flushPendingToolItemsAsError(payload.error ?? "...")` 와 `failExecution(payload.error)` 에 그대로 넘긴다. `flushPendingToolItemsAsError` 는 `pending` 상태인 tool 항목의 `ConversationItem.error`(타입 `string`)에 이 값을 **그대로 대입**하고, `ConversationInspector` 의 `ToolDetail` 이 `{item.error}` 를 **JSX child 로 직접 렌더**한다(`conversation-inspector.tsx:477`). object 가 들어오면 React 가 `"Objects are not valid as a React child"` 런타임 에러를 던진다.
    재현 조건은 특별하지 않다 — "AI Agent 가 tool 을 호출한 상태에서 execution 이 실패"하는, multi-turn 에서 흔한 시나리오면 즉시 발생한다(pending tool 이 없어도 `failExecution` 은 여전히 object 를 `NodeStatusInfo.error`(`"__execution__"` sentinel)에 심는다 — 현재는 그 값을 직접 렌더하는 곳이 없어 즉시 크래시로는 안 이어지지만 여전히 타입 계약 위반이다).
    이 PR 의 스코프 문서(`plan/in-progress/eia-terminal-payload.md` 재판정 ③-d)는 `chat-channel/types.ts` 의 `EiaFailedEvent`(외부 채널 어댑터 전용 타입) drift 는 짚고 고쳤지만, **동일 payload 를 그대로 받는 내부 에디터 WS 채널 소비자**는 감사 대상에 없었다 — `websocket.service.ts` 의 자체 주석(`wireEnvelope`/`fanoutEnvelope` 분리 설명)이 "wire 는 frontend 호환성을 유지한다"고 명시하는데 정작 이번 변경으로 그 wire 의 `error` shape 이 깨졌다.
  - 제안: `use-execution-events.ts`(및 `execution-store.ts` 의 `failExecution`/`flushPendingToolItemsAsError`/`NodeStatusInfo.error`/`ConversationItem.error`)를 `error: string | { code: string | null; message: string; nodeId?: string | null; details?: unknown } | null` 형태로 갱신하고, `ToolDetail`(`conversation-inspector.tsx:475-479`)에서 object 인 경우 `.message` 만 추출해 렌더하도록 고친다. 프런트 유닛 테스트(`use-execution-events.test.ts`)도 object 케이스를 추가해 이 계약을 고정할 것. 백엔드/프런트가 별도 워크트리·별도 PR 이더라도, 같은 wire 이벤트를 공유하는 이상 이번 PR 의 스코프에 반드시 포함하거나 최소한 후속 작업으로 명시 등재해야 한다.

- **[INFO]** `[CCH-ERR-04]` unknown-fallback 구조화 warn 로그의 `code` 필드 값이 바뀐다(`'INTERNAL_ERROR'` → `''`)
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:556`·`:558` (fallback `code: null`) → `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts:105`·`:136-143` (`event.error?.code ?? ''` 후 `logger.warn(JSON.stringify({ kind: 'chat_channel_unknown_failure_code', code, ... }))`)
  - 상세: 의도된 변경이고(주석에 근거가 상세히 기록됨), 저장소 내부에는 `'INTERNAL_ERROR'` 문자열에 의존하는 다른 소비자가 없음을 확인했다(grep 0건). 다만 저장소 밖의 로그 기반 대시보드·알림이 이 warn JSON 의 `code` 값으로 패턴매칭하고 있었다면 조용히 매칭이 끊긴다 — 로그 shape 자체(`kind`/필드 구성)는 그대로라 실질 리스크는 낮다.

- **[INFO]** `finalizeStalledExhausted` 에서 DB `.set({ error: stalledError, ... })` 와 emit `toTerminalErrorPayload(stalledError)` 가 **같은 객체 참조**를 공유한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3268-3271`(`stalledError` 선언)·`:3277`(DB set)·`:3312`(emit)
  - 상세: 의도된 리팩터(주석: "DB 와 emit 이 같은 객체를 쓰게 한 곳에 둔다")이고 `toTerminalErrorPayload` 는 입력을 변형하지 않음이 자체 테스트(`terminal-error-payload.spec.ts` "입력을 변형하지 않는다")로 고정돼 있다. TypeORM `.set()` 이 이 객체를 이후 재사용/변형하지 않는 한 안전 — 실제 위험은 없고 참고용으로만 남긴다.

## 요약

가장 중요한 발견은 이번 PR 의 스코프(백엔드 `execution.failed` emit 4곳 + chat-channel 어댑터 타입)가 "EIA §6.4 object 계약"만 겨냥했는데, 같은 emit 이 내부 에디터 WS wire 채널로도 그대로 나가면서 **아직 갱신되지 않은 프런트엔드 소비자(`use-execution-events.ts`/`execution-store.ts`/`ConversationInspector`)의 문자열 전제를 깬다**는 점이다. 재현 조건이 흔하고(진행 중 tool 호출 상태에서 실행 실패), 실제 React 렌더 크래시로 이어지는 경로(`{item.error}`)까지 확인했다. 그 외 변경(dispatcher `code: null` fallback, `terminal-error-payload.ts` 헬퍼, DB/emit 객체 참조 공유)은 의도가 분명하고 부작용이 없거나 무시할 수준이다.

## 위험도

CRITICAL
