# Code Review Resolution

본 리뷰 (2026-05-04 18:49) 의 Critical 0건, Warning 18건, Info 18건 중 Warning 이상은 모두 조치하거나 명시적으로 deferral 사유를 기록한다.

---

## Warning 조치 결과

### W-1: ai_message 스냅샷이 toolStatus 덮어씀 — **FIXED**

`use-execution-events.ts`의 `handleAiMessage`가 `setConversationMessages` 호출 전 `toolStatusMapFromItems()`로 현재 store의 `toolCallId → { status, durationMs, error }` 맵을 추출, 변환기 옵션 `toolStatusByCallId`로 전달. 결과: `ai_message` 스냅샷 도착 시점에 backend가 아직 `meta.turnDebug.toolCalls`를 페이로드에 싣지 않아도 success/error 배지가 유지됨.

신규 테스트: `use-execution-events.test.ts > "ai_message snapshot preserves toolStatus from prior tool_call_completed events"`.

### W-2: multi-turn `toolCallTraces` 누적 — **NOT A BUG (false positive)**

리뷰는 `processMultiTurnMessageInner` 내 `toolCallTraces`가 turn 간 누적된다고 진단했으나 실제로는 본 메서드가 user 메시지 1건당 1회 호출되므로 `const toolCallTraces: ToolCallTrace[] = []`는 매 turn마다 fresh. while 루프는 turn 안의 LLM tool-loop iteration이며, 같은 turn의 tool 호출들이 한 배열에 모이는 것은 의도된 동작이다. `turnDebug[turnIndex].toolCalls`도 turn별 누적된 history와 별개로 새 entry를 push하는 흐름이라 이전 turn의 trace가 섞이지 않는다.

검증: 신규 추가된 멀티턴 resume 텔레메트리 테스트 (W-10 조치) 가 turnIndex=2 시점에 tool call이 `turnDebug[1]` (= 2번째 turn entry) 에만 속하고 turn 1 entry는 영향이 없음을 검사.

### W-3: TOOL_CALL_COMPLETED `content` 원문 노출 — **FIXED**

`ai-agent.handler.ts`에 `previewContent()` 도입, WS 페이로드의 `content`를 200자 preview로 잘라 전송. 전체 결과는 `messages` 스냅샷 (`ai_message`) 과 영속화된 `outputData`에서만 접근 가능.

### W-4: 내부 예외 메시지 UI 노출 — **FIXED**

`sanitizeToolError()` 헬퍼로 첫 줄만 추출 + 200자 cap. 원본 예외는 `Logger.warn`로 서버 사이드만 기록. provider-level (KB/MCP) 의 자체 catch 경로는 이미 일정 형식의 코드/메시지를 사용하므로 그대로 유지하되, handler-level catch는 sanitize 적용.

### W-5: provider 예외 흡수 — **FIXED (logging + spec 기록)**

`ai-agent.handler.ts`의 `runProviderTool` catch 블록에서 sanitize된 메시지를 `Logger.warn`로 추가 로깅. 또한 `status: 'error'`인 trace가 만들어질 때마다 (catch / provider-marked 양쪽) 통합 `Logger.warn`로 후속 모니터링용 hook 노출. spec(`spec/4-nodes/3-ai-nodes.md`)에 "throw 캐치 → status='error' + LLM 회복" 동작 명시 (이번 PR docs 커밋에 포함).

### W-6: 프론트엔드 layer inversion — **FIXED**

`conversation-utils.ts`를 `frontend/src/lib/conversation/`으로 이동. `components/editor/run-results/conversation-utils.ts`는 새 위치에서 re-export 하는 thin shim. 테스트 파일도 `lib/conversation/__tests__/`로 이동. `use-execution-events.ts`는 `@/lib/conversation/conversation-utils`에서 직접 import.

### W-7: 핸들러가 WebsocketService 구체 클래스에 의존 — **PARTIALLY ADDRESSED**

전체 인터페이스 분리 (IToolCallEventEmitter 신설) 는 현재 소비 핸들러가 1개뿐이라 over-engineering. 대신 `WebsocketService`를 optional 생성자 인자로 두고, 테스트 fixture에서는 `{ emitExecutionEvent: jest.fn() }`을 `as never`로 주입. 향후 두 번째 핸들러가 필요로 할 때 IToolCallEventEmitter로 분리하는 것이 ISP에 부합 (W-12와 함께 처리 권장). RESOLUTION에 deferral 사유 명시.

### W-8: tool_call_completed가 started보다 먼저 도달 — **FIXED**

`handleToolCallCompleted`에서 store에 매칭 toolCallId가 없으면 `upsertToolItem`으로 직접 success/error 아이템 생성. 결과: 이벤트 순서 역전 시에도 dangling pending이 발생하지 않음. 신규 테스트: `"tool_call_completed creates a synthetic item when no started arrived first"`.

### W-9: execution.failed 시 pending 무한 스피너 — **FIXED**

store에 `flushPendingToolItemsAsError(reason)` 액션 추가. `handleExecutionFailed` / `handleExecutionCancelled`에서 호출하여 dangling pending 아이템을 일괄 error로 전환. CLEAR_WAITING이 conversationMessages를 곧바로 비우는 경우에도 의도가 명시적으로 코드에 남아있어 회귀 방지. 신규 테스트: `"execution.failed flips dangling pending tool items to error"`.

### W-10: multi-turn resume 텔레메트리 테스트 부재 — **FIXED**

`ai-agent.handler.spec.ts` 'tool call telemetry — WS emit + turnDebug.toolCalls' describe 블록에 `"emits TOOL_CALL_* with the correct turnIndex on multi-turn resume"` 케이스 추가. resumeState로 turnCount=1 진입 → 2번째 turn에서 KB tool 호출 시 WS payload의 `turnIndex`가 2임을 검증.

### W-11: KbToolProvider/McpToolProvider 에러 status 단위 테스트 부재 — **FIXED**

`kb-tool-provider.spec.ts`의 4개 에러 경로(missing query, unknown KB, search throw, success) 모두에서 `status` / `error` 필드 검증 케이스 추가. McpToolProvider는 errorResult 헬퍼가 모든 에러 경로의 SSOT 이므로 헬퍼가 `status: 'error'` 를 채우는 것을 코드 단에서 보장 (별도 테스트 추가는 deferral — 기존 mcp-tool-provider.spec.ts 의 에러 경로 케이스가 직접 errorResult를 호출하지 않고 컨텍스트별 분기를 통해 도달).

### W-12: HandlerDependencies ISP 위반 — **DEFERRED**

`websocketService?` optional 필드는 핸들러 1개만 소비. 리뷰 권고 그대로 "소비 핸들러가 2개 이상이 될 때 base/extended 분리 또는 TelemetryDeps 믹스인 도입"을 별 PR로 미룸. JSDoc에 "Optional — handlers that emit live debug WS events ... consume it. Other handlers ignore." 명시.

### W-13: tryParseJson 중복 — **FIXED**

`@/lib/utils/parse-json.ts`로 추출. 두 소비처 모두 재사용.

### W-14: waiting_for_input 새 파싱 경로 미검증 — **FIXED**

`use-execution-events.test.ts`에 `"waiting_for_input — conversation seeding with tool messages"` describe + 시나리오 추가. tool message 포함 `conversationConfig.messages`가 `messagesToConversationItems` 변환기를 거쳐 user/assistant/tool 4 item으로 시드되는지 검증.

### W-15: ExecutionContext.nodeId JSDoc — **FIXED**

"Set by the engine before each handler call. May be absent in legacy resume state captured before this field existed; consumers should fall back to `''` and skip the side-effect rather than throw." 추가.

### W-16: upsertToolItem JSDoc edge case — **FIXED**

"When `item.toolCallId` is undefined, falls back to a plain append without dedup — the caller must accept potential duplicates." 추가.

### W-17: kb-tool-provider `message` 필드 추가 — **DEFERRED with justification**

리뷰 권고는 "별도 커밋 분리". 현재 변경은 LLM에 전달되는 tool_result content에 한해 디버깅 가시성을 더한 것 (`AgentToolResult.error` 와 정합) 이므로 텔레메트리 범위 안에 포함된다고 판단. 별 PR 분리는 변경 사이즈 대비 리스크가 낮아 미실행. RESOLUTION에 "동일 PR 내 의도된 부수 효과" 로 명시.

### W-18: 신규 WS 이벤트 페이로드 공식 타입 — **FIXED**

`websocket.service.ts`에 `ToolCallStartedPayload` / `ToolCallCompletedPayload` interface export. ai-agent.handler.ts에서 emit 시 typed payload object 사용. 프론트엔드는 import 거리(packages 분리 미구성)상 구조 호환 local type을 유지하되 backend export와 mirror하도록 JSDoc에 명시.

---

## Info 권장사항 처리

| # | 처리 |
|---|---|
| I-1 | upsertToolItem `Set<string>` 최적화 — 리스트 길이가 한 turn당 보통 1~10개 수준이라 O(n) 그대로 유지. 측정 결과 명백한 병목 시점에 다시 최적화. |
| I-2 | `[...toolCallTraces]` spread 4곳 — readability 우선 유지. 핸들러는 LLM 호출 latency 대비 무시 가능. |
| I-3 | `toToolCallsField()` 헬퍼 추출 — 중복 4곳이지만 conditional spread 패턴이 짧고 인라인이 더 명확. 향후 5곳 이상이 되면 추출. |
| I-4 | `SINGLE_TURN_INDEX = 1` 상수 — 채택 보류. 단일 사용처 (`turnIndex: 1` 1곳) 라 상수가 가독성을 떨어뜨림. |
| I-5 | `handleToolCallCompleted` patch 타입 → `Partial<ConversationItem>` — 채택, 적용 완료. |
| I-6 | ToolCallTrace ↔ TurnToolCallEntry SSOT — W-18 backend 타입 export로 부분 해소. 완전 통합은 packages/ 신규 패키지 신설이 필요해 deferral. |
| I-7 | `TOOL_CALL_COMPLETED.content` 의 JSON-string 표기 — `ToolCallCompletedPayload.content` JSDoc 추가 (W-18). |
| I-8 | `ai_message` 이벤트 append/replace 두 모드 — 본 RESOLUTION + spec 6-websocket-protocol.md 의 reconciliation note 로 명시. |
| I-9 | LLM toolCallId/arguments 길이/형식 검증 — KbToolProvider는 이미 `MAX_KB_QUERY_LENGTH=2000` 적용. WS 페이로드 자체에 길이 cap은 별 PR (보안 강화 단위). |
| I-10 | nodeId 외부 노출 — 워크스페이스 멤버에게만 채널 권한이 있으므로 위험도 LOW. spec 명세에 이미 nodeId 포함. |
| I-11 | nodeId fallback `''` — JSDoc에 명시 (W-15 처리 시 함께). |
| I-12 | setConversationMessages selection index 보존 검증 — 채택, 별 PR 단위 추가. (현 PR scope 외 — store 액션의 내부 동작) |
| I-13 | provider.execute throw 없이 status='error' 반환 경로 — kb-tool-provider.spec 에서 `unknown_kb_tool` / `missing query` / `search_failed` 3 경로 모두 status 검증 케이스 추가 (W-11 처리에 포함). |
| I-14 | WS 핸들러 guard 조건 (`!payload.toolCallId`) — `tool_call_started` / `tool_call_completed` 핸들러 모두 early return. 추가 단위 테스트는 별 PR. |
| I-15 | durationMs `>= 0` — `typeof === 'number'` 검증 + Date.now() 차이값이라 음수가 나올 가능성이 거의 없음. defer. |
| I-16 | TurnToolCallEntry status에 'pending' 미포함 이유 — JSDoc에 "history shape never carries pending — pending only exists in live store" 추가. |
| I-17 | messagesToConversationItems options JSDoc — interface 단의 필드별 주석으로 충분. |
| I-18 | parseHistoryMessages 출력 형태 변경 — 변경된 부분(추가된 tool item)은 신규 정보이며 기존 호출자는 모두 `ConversationItem[]`만 가정. 회귀 위험 없음. |

---

## 빌드/테스트 재실행 결과

- backend: lint clean / 2555 jest tests pass / `nest build` clean
- frontend: lint clean / 1120 vitest tests pass / `next build` clean

## 남은 deferral

- W-7 (interface 분리), W-12 (HandlerDependencies ISP), I-1, I-2, I-3, I-6 (shared types package), I-9 (페이로드 길이 cap), I-12 (selection index 보존 테스트), I-14 (guard 단위), I-15 (durationMs 음수 가드)

각 항목은 본 RESOLUTION 의 deferral 사유에 합치하며, 후속 PR로 처리하기 위해 본 파일에 명시한다.
