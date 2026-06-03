# Architecture Review

## 발견사항

### [INFO] 타임스탬프 필드 타입 정의 중복 — LlmCallEntry/TurnToolCallEntry 양측
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 내 `LlmCallRecord` 인터페이스, `codebase/frontend/src/lib/conversation/conversation-utils.ts` 내 `LlmCallEntry` / `TurnToolCallEntry`, `codebase/frontend/src/lib/websocket/use-execution-events.ts` 내 인라인 타입
- 상세: `startedAt?: string` / `finishedAt?: string` 쌍이 백엔드 `LlmCallRecord`, 프론트 `LlmCallEntry`, 프론트 `TurnToolCallEntry`, WS 이벤트 핸들러 인라인 타입, WS payload 인터페이스(`ToolCallStartedPayload`, `ToolCallCompletedPayload`) 등 5개 이상의 독립적인 인터페이스/인라인 정의에서 동일한 형태로 반복된다. 각 레이어가 별도 인터페이스를 유지하는 것은 레이어 경계가 명확하므로 반드시 나쁜 것은 아니나, 동일 의미·동일 타입의 필드 쌍이 spec 참조 주석과 함께 분산 복제되고 있어 향후 ISO8601 표현 변경(예: 유닉스 타임스탬프 전환)이 생기면 다수 지점을 함께 수정해야 한다.
- 제안: 공유 타입 패키지(`codebase/packages/`) 또는 프론트 `@/lib/types/timing.ts` 수준에서 `TimingFields = { startedAt?: string; finishedAt?: string }` 를 한 번만 정의하고 각 인터페이스가 intersection(`& TimingFields`)으로 참조하거나, 최소한 백엔드 WS payload 타입(`ToolCallStartedPayload` 등)과 프론트 대응 인라인 타입을 단일 공유 패키지로 수렴 검토. 단, 현재 레이어 간 타입 공유 정책이 없는 상태라면 `INFO` 수준으로 관리 가능.

---

### [INFO] `toolStatusMapFromItems` 에서 `startedAt` 미전파 — 라이브→히스토리 전환 시 tool 시각 유실
- 위치: `codebase/frontend/src/lib/conversation/conversation-utils.ts`, `toolStatusMapFromItems` 함수 (변경 외 기존 코드, diff에 미포함)
- 상세: `toolStatusMapFromDebug`는 `startedAt`을 `ToolStatusInfo` 맵에 전파하도록 이번에 수정되었다. 그러나 기존 `toolStatusMapFromItems`(`ConversationItem[]`에서 추출)는 `startedAt`을 `ToolStatusInfo`에 포함하지 않는다. WS 이벤트 핸들러가 `ai_message` 스냅샷 도착 시 `toolStatusMapFromItems`로 이전 상태를 보존하는 경우, tool 항목의 `timestamp`(=`startedAt`)가 새 아이템에 전달되지 않아 tool 발생 시각이 히스토리 전환 후 사라질 수 있다.
- 제안: `toolStatusMapFromItems` 함수가 `ConversationItem.timestamp`를 `ToolStatusInfo.startedAt`으로 매핑하도록 보완.

---

### [INFO] 프레젠테이션 레이어 내 시각 렌더 로직 중복 — conversation-inspector.tsx
- 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx`
- 상세: `{item.timestamp ? formatDate(...) : ""}{구분자}{item.durationMs != null ? `${item.durationMs}ms` : ""}` 패턴이 `SummaryView` 내 4개 이상의 섹션에서 거의 동일한 JSX 형태로 반복된다. 같은 로직이 `result-timeline.tsx`의 인라인 버튼 영역에서도 반복되어 프레젠테이션 레이어의 응집도를 낮춘다.
- 제안: `TimingBadge` 또는 `TimestampDuration` 소형 컴포넌트로 추출. `formatDate(ts, format)` + `formatDuration(ms)` + 구분자 조합이 공통 패턴이므로 props `(timestamp?, durationMs?, format?)` 를 받는 단일 컴포넌트로 DRY화.

---

### [INFO] `use-execution-events.ts` 인라인 타입 — 공식 WS payload 타입과 구조 이중화
- 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` diff (lines 611–628, 643–655)
- 상세: `tool_call_started` / `tool_call_completed` 핸들러 내 `payload` 타입이 별도 인라인 정의(`{ toolCallId?: string; name?: string; startedAt?: string; ... }`)로 선언되어 있고, `websocket.service.ts`의 공식 `ToolCallStartedPayload` / `ToolCallCompletedPayload` 타입과 구조를 공유하지 않는다. 파일 상단 주석("Frontend `use-execution-events.ts` maintains a structurally compatible local type; keep the two in sync")이 이를 인식하고 있으나, 이번 `startedAt`/`finishedAt` 추가처럼 필드를 추가할 때 두 곳을 동기화해야 하는 수동 부담이 남는다.
- 제안: 백엔드-프론트 공유 타입 패키지가 없는 현 구조에서는 최소한 eslint 주석 경고 또는 `// SYNC: websocket.service.ts ToolCallStartedPayload` 형태의 표식을 유지. 중장기적으로 공유 패키지로 이동.

---

## 요약

이번 변경은 `startedAt`/`finishedAt` ISO8601 타임스탬프 쌍을 백엔드 LLM 호출·tool 실행 경로에 캡처하고, WS 이벤트 payload와 영속 turnDebug JSON에 동봉하며, 프론트엔드 변환 레이어(`messagesToConversationItems`, `toolStatusMapFromDebug`)와 렌더 레이어(5개 컴포넌트)에 전파하는 수직 관통 기능 추가다. 레이어 책임 분리(백엔드 캡처 → WS payload → 프론트 변환 → 렌더)는 명확하게 유지되며, 기존 아키텍처의 fan-out 패턴·sanitize 레이어·seq allocator 구조에 변경 없이 optional 필드 추가만으로 하위 호환이 보장된다. SOLID 원칙 측면에서 각 모듈의 책임이 확장(OCP)되었고 기존 인터페이스가 깨지지 않았다. 단, 동일한 타임스탬프 필드 쌍이 5개 이상의 인터페이스에 분산 복제되는 구조는 향후 유지보수 비용을 높이며, `toolStatusMapFromItems`에서 `startedAt`이 전파되지 않아 라이브→히스토리 전환 시 tool 발생 시각이 유실될 수 있는 논리 갭이 발견된다.

## 위험도

LOW
