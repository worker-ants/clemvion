# Side Effect Review

## 발견사항

### [INFO] LlmCallRecord 인터페이스 확장 — 옵셔널 필드 추가 (하위호환)
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `LlmCallRecord` 인터페이스
- 상세: `startedAt?: string` 및 `finishedAt?: string` 이 옵셔널로 추가되었다. 기존 호출자가 해당 필드를 채우지 않아도 컴파일 및 런타임 동작에 영향 없다. 의도치 않은 상태 변경 없음.
- 제안: 현행 유지.

### [INFO] ToolCallTrace 인터페이스 확장 — 옵셔널 필드 추가 (하위호환)
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `ToolCallTrace` 인터페이스
- 상세: `startedAt?: string`, `finishedAt?: string` 이 옵셔널 필드로 삽입됐다. 기존 `ToolCallTrace` 소비자(예: `toolStatusMapFromDebug`)는 신규 필드를 무시하거나 `undefined` 로 받으므로 하위호환 유지.
- 제안: 현행 유지.

### [INFO] ToolCallStartedPayload / ToolCallCompletedPayload 인터페이스 확장 — 공개 API 변경
- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` — `ToolCallStartedPayload`, `ToolCallCompletedPayload`
- 상세: 두 인터페이스 모두 옵셔널 필드(`startedAt?`, `finishedAt?`)가 추가됐다. 이 인터페이스들은 `export` 된 공개 타입이며 프론트엔드(`use-execution-events.ts`)에서도 구조 호환 로컬 타입을 유지한다고 주석에 명시되어 있다. 옵셔널 추가이므로 기존 소비자에게 컴파일 오류 없음. 단, `ToolCallStartedPayload`의 JSDoc에 "adding a required field here is a breaking change for the client"라고 명시되어 있어, 필드가 required 로 승격될 경우 주의가 필요함.
- 제안: 현행(optional) 유지; 향후 required 전환 시 프론트 로컬 타입도 함께 갱신 필요.

### [INFO] `use-execution-events.ts` — `tool_call_started` 의 timestamp 소스 변경
- 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` — `tool_call_started` 핸들러 (라인 ~625)
- 상세: 기존에는 `timestamp: new Date().toISOString()` (클라이언트 수신 시각)를 사용했으나, 이제 `timestamp: payload.startedAt ?? new Date().toISOString()` 으로 변경됐다. 클라이언트 스탬프에서 서버 스탬프 우선으로의 전환이므로 라이브 이벤트의 timestamp 값이 달라진다. 의도된 변경이며, 폴백(fallback)이 보존되어 있으므로 레거시 페이로드도 안전하게 처리된다.
- 제안: 현행 유지.

### [INFO] `use-execution-events.ts` — `tool_call_completed` 에서 `timestamp` 덮어쓰기
- 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` — `tool_call_completed` 핸들러 (라인 ~654-658)
- 상세: `payload.startedAt` 가 존재하면 `patch.timestamp = payload.startedAt` 로 덮어쓴다. 이전에 `tool_call_started` 로 설정한 `timestamp` 를 `completed` 이벤트가 도착할 때 동일 값으로 재확인(reconcile)하는 방식이다. 시작 이벤트가 손실된 경우에도 정확한 시각이 복원된다. 기존 `timestamp` 가 다른 값이었다면 덮어쓰기가 발생하지만, 이는 의도된 reconciliation 동작이다.
- 제안: 현행 유지. 단, `startedAt` 과 기존 `timestamp` 가 다를 경우(이벤트 순서 역전 등) 잠재적 플리커링이 있을 수 있으나, 서버 스탬프가 권위적이므로 허용 가능한 범위다.

### [INFO] `DateFormat` 타입 union 확장 — `"time-seconds"` 추가
- 위치: `codebase/frontend/src/lib/utils/date.ts` — `DateFormat` 타입
- 상세: `DateFormat` 타입에 `"time-seconds"` 가 추가됐다. `formatDate()` 함수의 공개 시그니처(매개변수 타입)가 넓어졌으므로 기존 호출자에게 breaking change가 없다. 기존에 exhaustive switch를 사용하는 소비자가 있다면 컴파일러 경고가 발생할 수 있으나, 이 함수는 if-else 체인이므로 해당 없음.
- 제안: 현행 유지.

### [INFO] `toolStatusMapFromItems` — `startedAt` 미전달
- 위치: `codebase/frontend/src/lib/conversation/conversation-utils.ts` — `toolStatusMapFromItems` 함수 (라인 ~2588-2601)
- 상세: `toolStatusMapFromItems` 는 현재 live 이벤트 교체 시 `ConversationItem[]` 에서 `ToolStatusInfo` 맵을 추출하는데, 변경된 `ToolStatusInfo` 에 `startedAt?` 필드가 추가되었으나 `toolStatusMapFromItems` 는 `item.timestamp` (즉, `startedAt`) 를 맵에 담지 않는다. 따라서 `ai_message` 스냅샷으로 타임라인이 교체된 후 live 이벤트 경로에서 `startedAt` 이 유실되는 경우가 있다. 그러나 `ai_message` 스냅샷 자체가 `toolCalls[].startedAt` 을 포함하므로 `toolStatusMapFromDebug` 경로(영속 재구성)에서 정확히 복원된다. 라이브 mid-run 경로에서만 일부 edge case 존재.
- 제안: `toolStatusMapFromItems` 에서 `startedAt: item.timestamp` 도 함께 전달하면 완전한 일관성이 확보된다. 현재 동작에서 기능 결함은 없으나 라이브 tool 재생 시 timestamp 가 일부 리셋될 수 있다.

### [INFO] `new Date(callStartedAt).toISOString()` 패턴 — 반복적 Date 객체 생성
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — 여러 지점
- 상세: `callStartedAt = Date.now()` 를 캡처한 후 `new Date(callStartedAt).toISOString()` 으로 ISO 문자열을 파생하는 패턴이 4개 위치에서 반복된다. 각 위치에서 `new Date()` 를 두 번 호출하는 것은 성능상 미미하지만 중복 코드다. 부작용(side effect) 측면에서는 문제 없음.
- 제안: 헬퍼 함수 `msToIso(ms: number): string { return new Date(ms).toISOString(); }` 로 추출하면 DRY 원칙 충족.

### [INFO] `finishedAt = new Date().toISOString()` — durationMs 계산과 시간 불일치 가능성
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — tool 실행 완료 직후 (라인 ~772, 839)
- 상세: `durationMs = Date.now() - startedAt` 을 계산한 직후 `finishedAt = new Date().toISOString()` 으로 현재 시각을 새로 찍는다. `Date.now()` 와 `new Date()` 사이에 코드 실행이 있으므로 `finishedAt` 이 `startedAt + durationMs` 와 정확히 일치하지 않는다. 이는 spec 주석에서 "ms 단위 미세 차이 가능"으로 명시되어 있어 허용된 동작이다.
- 제안: 완전한 일관성을 원한다면 `const finishedAtMs = Date.now(); const durationMs = finishedAtMs - startedAt; const finishedAtIso = new Date(finishedAtMs).toISOString();` 패턴으로 단일 `Date.now()` 호출로 통합.

## 요약

이번 변경은 기존 인터페이스의 옵셔널 필드 추가와 새 `DateFormat` 열거값 추가로 구성된 하위호환 확장이다. 전역 변수 수정, 파일시스템 부작용, 환경 변수 읽기/쓰기, 의도치 않은 네트워크 호출은 없다. 이벤트 처리에서 `tool_call_started`/`completed` 의 `timestamp` 소스가 클라이언트 스탬프에서 서버 스탬프 우선으로 변경되는 의도된 동작 변경이 포함되어 있으며 적절한 fallback이 보존된다. `toolStatusMapFromItems` 에서 `startedAt` 을 맵에 포함하지 않는 미완성 부분이 있으나 영속 경로(`toolStatusMapFromDebug`)에서 보완되므로 기능적 결함은 없다. 전체적으로 부작용 위험은 낮다.

## 위험도
LOW
