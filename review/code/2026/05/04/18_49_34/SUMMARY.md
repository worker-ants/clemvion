파일 저장 권한이 필요합니다. 승인해주시면 SUMMARY.md를 작성하겠습니다. 아래에 보고서 내용을 먼저 출력합니다.

---

# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — 기능 동작 자체는 정상이나, 멀티턴 race condition으로 인한 UX 결함, 보안 정보 노출, 멀티턴 성능 버그 3건이 즉시 조치가 필요한 수준이다.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | Concurrency / Side Effect / Requirement | **`ai_message` 스냅샷 교체 시 tool 상태 배지 소실** — `handleAiMessage`에서 `setConversationMessages` 호출 시 `toolStatusByCallId`가 전달되지 않아, `tool_call_completed`로 채워진 `toolStatus`·`durationMs`·`error`가 전량 초기화된다. 라이브 실행 중 success/error 배지가 `ai_message` 도착 즉시 사라지는 UX 결함. | `use-execution-events.ts` — `handleAiMessage` | `ai_message` 처리 전, 현재 store의 `toolCallId → { toolStatus, durationMs, error }` 맵을 추출하여 `messagesToConversationItems`의 `toolStatusByCallId` 옵션으로 전달. |
| W-2 | Performance | **멀티턴 `toolCallTraces` 누적 — O(n²) 공간 소비 + debug 데이터 오염** — `toolCallTraces`가 while 루프 바깥에서 선언되어 턴 간 누적된다. Turn N debug에 Turn 1~N-1 trace가 모두 포함되는 버그. | `ai-agent.handler.ts` — 멀티턴 while 루프 | `const toolCallTraces: ToolCallTrace[] = []`를 while 루프 **내부**로 이동하여 매 턴 초기화. |
| W-3 | Security | **`TOOL_CALL_COMPLETED` 페이로드에 tool 실행 결과 원문 포함** — `result.content`(KB 검색 문서 청크, MCP 결과 전문)가 WS 채널 구독자 전원에게 브로드캐스트된다. | `ai-agent.handler.ts` — `runProviderTool` emit | `content`를 제거하거나 200자 preview로 잘라서 전송. 전체 결과는 `ai_message` 스냅샷 경로에서만 수신. |
| W-4 | Security | **내부 예외 메시지가 WS 이벤트로 클라이언트 UI까지 노출** — `e.message`가 `ToolCallTrace.error` → `TOOL_CALL_COMPLETED.error` → 프론트엔드 에러 배지로 그대로 흐른다. DB 접속 오류, 내부 서비스 URL 포함 가능. | `ai-agent.handler.ts` catch block, `kb-tool-provider.ts`, `mcp-tool-provider.ts` | Provider 레이어에서 사용자용 메시지와 내부 로그를 분리. `AgentToolResult.error`는 안전한 메시지 상수로 채우고 원본 예외는 서버 로그에만 기록. |
| W-5 | Scope / Side Effect | **`provider.execute()` 예외 흡수 — 기존 실패 처리 동작 변경** — 이전에는 throw가 전파되어 노드 실행 실패로 처리됐으나, 이제 catch 후 LLM에 error content 주입 후 turn 계속 진행. 오류가 정상 완료로 보일 수 있음. | `ai-agent.handler.ts` — `runProviderTool` catch block | 의도된 변경이라면 spec에 명기. `status: 'error'` trace를 `Logger.warn` 로깅하거나 run-results UI에 toolErrorCount 노출. |
| W-6 | Architecture / Dependency | **프론트엔드 레이어 역전: `lib/websocket/` → `components/`** — `use-execution-events.ts`가 `components/editor/run-results/conversation-utils`를 직접 import. | `frontend/src/lib/websocket/use-execution-events.ts` | `conversation-utils.ts`를 `frontend/src/lib/conversation/`으로 이동. `components/`는 해당 경로에서 re-export. |
| W-7 | Architecture / Dependency | **도메인→인프라 직접 의존: 노드 핸들러가 `WebsocketService` 구체 클래스를 import** — 클린 아키텍처 위반. 테스트에서 `mockWebsocketService as never` 우회가 이를 방증. | `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` | `IToolCallEventEmitter` 인터페이스를 `nodes/core/`에 정의하고, 핸들러는 인터페이스에만 의존. |
| W-8 | Concurrency | **`tool_call_completed`가 `tool_call_started`보다 먼저 도달 시 dangling pending item** — 재연결 시나리오에서 이벤트 순서 역전 시 pending spinner가 영구 잔류. | `use-execution-events.ts` — `handleToolCallCompleted` / `handleToolCallStarted` | `pendingCompletions: Map<toolCallId, patch>` 임시 저장소 추가. |
| W-9 | Requirement | **`execution.failed`/`completed` 시 pending tool 아이템 미처리** — `tool_call_started` 후 실행 실패 시 `tool_call_completed`가 발행되지 않아 무한 스피너 잔류. | `use-execution-events.ts` — `handleExecutionFailed` | `handleExecutionFailed`/`handleExecutionCancelled`에서 pending tool 아이템을 `error`로 일괄 전환. |
| W-10 | Testing | **멀티턴 resume 경로의 tool call telemetry 테스트 부재** — 새 spec 블록 4개가 전부 단일턴만 검증. 멀티턴 재개 시 `turnIndex: turnCount` 전달 여부 미검증. | `ai-agent.handler.spec.ts` | multi-turn resume 시나리오 픽스처를 추가하여 WS 이벤트 `turnIndex`가 1이 아닌 값임을 검증. |
| W-11 | Testing | **`KbToolProvider`/`McpToolProvider` 에러 반환 필드 추가 단위 테스트 부재** — `status: 'error'`, `error` 필드 추가 후 provider 레벨 spec 파일 수정 없음. | `kb-tool-provider.ts`, `mcp-tool-provider.ts` | `kb-tool-provider.spec.ts`에 에러 경로에서 `{ status: 'error', error: '...' }` 반환 검증 케이스 추가. |
| W-12 | Architecture | **ISP 위반: `HandlerDependencies`에 단일 핸들러만 소비하는 `websocketService?` 추가** | `node-component.interface.ts` | WS 이벤트 소비 핸들러가 2개 이상 될 때 base/extended 분리 또는 `TelemetryDeps` 믹스인으로 분리. |
| W-13 | Maintainability | **`tryParseJson` 함수 두 파일에 중복 정의** | `use-execution-events.ts`, `conversation-utils.ts` | `lib/utils/parse-json.ts`로 추출. W-6 해결과 함께 일괄 정리 가능. |
| W-14 | Testing | **`execution.waiting_for_input` 핸들러 새 message 파싱 경로 미검증** — 기존 수동 루프 → `messagesToConversationItems` 대체 후 tool message 포함 케이스 미커버. | `use-execution-events.ts`, `use-execution-events.test.ts` | tool message 포함 `messages` payload 주입 테스트 추가. |
| W-15 | Documentation | **`ExecutionContext.nodeId` — "set by engine" 문구 누락** | `node-handler.interface.ts` | `"Set by the engine before each handler call; may be absent in legacy resume state"` 한 줄 추가. |
| W-16 | Documentation | **`upsertToolItem` — `toolCallId` 없을 때 dedup 불가 동작 JSDoc 미기술** | `execution-store.ts` — `upsertToolItem` | JSDoc에 `"When item.toolCallId is undefined, falls back to plain append without dedup."` 추가. |
| W-17 | Scope | **`kb-tool-provider.ts` `message` 필드 추가 — 텔레메트리 범위 초과** — LLM에 전달되는 tool_result content 변경. | `kb-tool-provider.ts` | LLM 품질 개선 의도라면 별도 커밋으로 분리. |
| W-18 | API Contract | **신규 WS 이벤트 페이로드에 공식 타입 정의 없음** — 백엔드-프론트엔드 계약이 인라인 캐스트로만 관리. | `websocket.service.ts`, `use-execution-events.ts` | `ToolCallStartedPayload`, `ToolCallCompletedPayload` shared 인터페이스 정의. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 |
|---|----------|----------|------|
| I-1 | Performance | `upsertToolItem` O(n) 중복 검사 → `Set<string>` 보조 자료구조로 O(1) 전환 권장 | `execution-store.ts` |
| I-2 | Performance | `[...toolCallTraces]` 불필요한 spread copy 4곳 → 원본 참조 공유로 충분 | `ai-agent.handler.ts` |
| I-3 | Maintainability | `toolCallTraces` 조건부 spread 패턴 4~5회 중복 → `toToolCallsField()` 헬퍼 추출 | `ai-agent.handler.ts` |
| I-4 | Maintainability | `turnIndex: 1` 하드코딩 → `const SINGLE_TURN_INDEX = 1` 상수 정의 | `ai-agent.handler.ts` |
| I-5 | Maintainability | `handleToolCallCompleted`의 `patch` 타입이 `Record<string, unknown>` → `Partial<ConversationItem>` 사용 | `use-execution-events.ts` |
| I-6 | Architecture | `ToolCallTrace`(백엔드) ↔ `TurnToolCallEntry`(프론트엔드) 스키마 이중 정의 → spec 문서 또는 shared 타입으로 SSOT 관리 | `ai-agent.handler.ts`, `conversation-utils.ts` |
| I-7 | API Contract | `TOOL_CALL_COMPLETED` `content` 필드가 JSON 문자열임을 타입에 미명시 | `ai-agent.handler.ts`, `use-execution-events.ts` |
| I-8 | API Contract | `ai_message` 이벤트 append/replace 두 모드가 spec에 미명시 | `use-execution-events.ts` |
| I-9 | Security | LLM 응답 `toolCallId`/`arguments` 무검증 브로드캐스트 (길이·형식 검증 권장) | `ai-agent.handler.ts` |
| I-10 | Security | `nodeId`(내부 그래프 UUID) WS 이벤트 경유 외부 노출 | `ai-agent.handler.ts` |
| I-11 | Maintainability | `nodeId` fallback 빈 문자열 — `nodeId` 없을 때 emit skip guard 또는 TODO 명시 | `ai-agent.handler.ts` |
| I-12 | Testing | `setConversationMessages` selection index 보존 로직 미검증 | `execution-store.test.ts` |
| I-13 | Testing | `provider.execute` throw 없이 `status: 'error'` 반환 경로 미검증 | `ai-agent.handler.spec.ts` |
| I-14 | Testing | WS 핸들러 guard 조건(`!payload.toolCallId`) 미검증 | `use-execution-events.test.ts` |
| I-15 | Testing | `durationMs` 검증이 타입 체크만 (`>= 0` 조건 미포함) | `ai-agent.handler.spec.ts` |
| I-16 | Documentation | `TurnToolCallEntry.status`가 `"pending"` 미포함 이유 주석 없음 | `conversation-utils.ts` |
| I-17 | Documentation | `messagesToConversationItems` `options` 파라미터 JSDoc 미흡 | `conversation-utils.ts` |
| I-18 | Side Effect | `parseHistoryMessages` 출력 형태 변경 — 타 소비자 존재 여부 확인 권장 | `conversation-utils.ts` |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | MEDIUM | TOOL_CALL_COMPLETED에 결과 원문 포함, 내부 예외 메시지 UI 노출 |
| Performance | MEDIUM | 멀티턴 `toolCallTraces` 누적 버그(O(n²)), `upsertToolItem` O(n) 중복 검사 |
| Concurrency | MEDIUM | `ai_message` 스냅샷이 tool_call_completed 패치 덮어씀, 이벤트 순서 역전 시 dangling pending |
| Requirement | MEDIUM | `ai_message` 스냅샷 tool 배지 소실, `execution.failed` 시 pending 미처리 |
| Side Effect | MEDIUM | provider.execute 예외 흡수로 오류가 정상 완료 처리, `ai_message` tool 상태 소실 |
| Testing | MEDIUM | 멀티턴 텔레메트리·provider 에러 반환·waiting_for_input 파싱 경로 미검증 |
| Architecture | LOW | 프론트엔드 레이어 역전, 도메인→인프라 직접 의존, ISP 위반 |
| Maintainability | LOW | `toolCallTraces` 누적 패턴 중복, `tryParseJson` 이중 정의 |
| Dependency | LOW | `lib/` → `components/` 역방향 결합 |
| API Contract | LOW | 신규 WS 이벤트 페이로드 공유 타입 없음 |
| Documentation | LOW | `nodeId` 주석 누락, `upsertToolItem` edge case 미기술 |
| Scope | LOW | provider.execute 예외 흡수 동작 변경, `message` 필드 범위 초과 |
| Database | NONE | 데이터베이스 접근 계층 변경 없음 |

---

## 발견 없는 에이전트

- **Database** — 데이터베이스 스키마·쿼리·마이그레이션·트랜잭션 관련 변경 없음

---

## 권장 조치사항

### 즉시 조치 (버그 / MEDIUM 위험도)

1. **[W-1] `ai_message` 핸들러 `toolStatusByCallId` 누락 수정** — `setConversationMessages` 전 store에서 `toolCallId → status` 맵을 추출하여 전달. `waiting_for_input` 핸들러도 동일 처리.
2. **[W-2] 멀티턴 `toolCallTraces` 초기화 위치 수정** — while 루프 내부로 이동. UX 버그이자 O(n²) 성능 버그.
3. **[W-9] `execution.failed` 시 pending tool 아이템 `error` 전환** — 무한 스피너 방지.
4. **[W-3, W-4] 보안 — 결과 원문 노출 및 예외 메시지 필터링** — `content` preview 200자 제한, 예외 메시지 래핑.
5. **[W-5] provider 오류 모니터링 보완** — `status: 'error'` trace를 `Logger.warn` 로깅.

### 단기 조치 (구조 / 테스트)

6. **[W-10, W-11, W-14] 테스트 커버리지 보완** — 멀티턴 텔레메트리, provider 에러 반환, WS guard 조건, `waiting_for_input` 파싱 경로.
7. **[W-8] 이벤트 순서 역전 방어** — `pendingCompletions` 캐시 추가.
8. **[W-6, W-13] 레이어 역전 해소 + `tryParseJson` 통합** — `conversation-utils.ts`를 `lib/conversation/`으로 이동.
9. **[W-7] 도메인→인프라 결합 — 인터페이스 분리** — `IToolCallEventEmitter` 인터페이스 정의.
10. **[W-18] WS 이벤트 페이로드 타입 공식화** — `ToolCallStartedPayload`, `ToolCallCompletedPayload` shared 인터페이스 정의.