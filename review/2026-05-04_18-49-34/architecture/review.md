### 발견사항

---

**[WARNING] 프론트엔드 레이어 역전: `lib/` → `components/` 의존성**
- 위치: `frontend/src/lib/websocket/use-execution-events.ts` → `@/components/editor/run-results/conversation-utils`
- 상세: `lib/websocket/` 계층은 `components/` 계층에 의존해서는 안 된다. 일반적으로 `components/`가 `lib/`를 import하는 방향이 올바르다. 현재 구조는 `use-execution-events.ts`가 컴포넌트 디렉터리 내 유틸리티에 의존하여 빌드 그래프 방향이 역전되어 있다.
- 제안: `conversation-utils.ts`를 `frontend/src/lib/conversation/` 또는 `frontend/src/lib/utils/`로 이동. `components/`는 해당 경로에서 re-import.

---

**[WARNING] 도메인→인프라 직접 의존: 노드 핸들러가 `WebsocketService` 구체 클래스를 import**
- 위치: `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts:18-22`
- 상세: `nodes/` 디렉터리는 도메인 로직 계층이다. `modules/websocket/websocket.service.ts`라는 인프라 구체 클래스를 직접 import하면 도메인이 인프라에 의존하는 클린 아키텍처 위반이 된다. 테스트에서 `mockWebsocketService as never`로 우회하는 것이 이 결합을 방증한다.
- 제안: `IToolCallEventEmitter` 등의 인터페이스를 `nodes/core/` 또는 `nodes/ai/ai-agent/`에 정의하고 `WebsocketService`가 이를 구현하도록. 핸들러는 인터페이스에만 의존.

---

**[WARNING] ISP 위반: `HandlerDependencies`에 단일 핸들러만 소비하는 필드 추가**
- 위치: `backend/src/nodes/core/node-component.interface.ts:252-254`
- 상세: `websocketService?`를 현재 `AiAgentHandler` 하나만 사용함에도 모든 핸들러의 공통 의존성 bag에 추가했다. 미래에 WS 이벤트가 필요한 핸들러가 늘어날수록 `HandlerDependencies`가 점점 비대해지는 구조적 압력이 생긴다.
- 제안: 단기적으로는 현 구조를 유지하되, WS 이벤트 소비 핸들러가 2개 이상이 되면 `HandlerDependencies`를 base/extended로 분리하거나 별도 `TelemetryDeps` 믹스인으로 분리.

---

**[INFO] DRY 위반: `toolCallTraces` 조건부 spread 패턴 4회 중복**
- 위치: `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (line ~483, ~622, ~856, ~974)
- 상세: `...(toolCallTraces.length > 0 ? { toolCalls: [...toolCallTraces] } : {})` 가 단일/멀티 턴 두 코드 경로에서 각각 2회씩, 총 4번 반복된다.
- 제안: `toToolCallsField(traces: ToolCallTrace[])` 헬퍼로 추출하거나, turnDebug 객체 빌더 함수를 공통화.

---

**[INFO] 매직 넘버: 단일 턴 경로의 `turnIndex: 1` 하드코딩**
- 위치: `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (single-turn `runProviderTool` 호출부)
- 상세: 단일 턴 경로에서 `turnIndex: 1`을 리터럴로 전달한다. 실제로는 단일 턴이 항상 turn 1이므로 기능적으로는 옳지만, 나중에 단일 턴 핸들러 구조가 변경될 때 조용히 틀린 값이 전달될 위험이 있다.
- 제안: `const SINGLE_TURN_INDEX = 1` 상수를 정의하거나, 상위에서 `turnIndex`를 변수로 관리.

---

**[INFO] 병렬 인터페이스: `ToolCallTrace` (백엔드) ↔ `TurnToolCallEntry` (프론트엔드) 스키마 이중 정의**
- 위치: `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts:19-26` / `frontend/src/components/editor/run-results/conversation-utils.ts`
- 상세: 두 인터페이스는 `toolCallId`, `name`, `status`, `durationMs`, `error` 필드를 각자 독립적으로 정의한다. 한쪽에 필드가 추가되면 다른 쪽이 묵묵히 깨질 수 있다. 현재는 공유 패키지나 스펙 문서로 이 계약이 관리되지 않는다.
- 제안: `spec/` 문서에 WS 페이로드 형상을 명시적으로 기술하고, 장기적으로는 `@workflow/shared-types` 패키지에 공통 타입을 두거나 OpenAPI/zod 스키마를 SSOT로 활용.

---

### 요약

이번 변경은 AI Agent 도구 호출을 실시간 디버깅 타임라인에 가시화하는 기능으로, 전반적인 설계는 명확하고 테스트 커버리지도 충실하다. 가장 주목해야 할 구조적 문제는 두 가지다: **프론트엔드에서 `lib/websocket/`가 `components/`를 역방향 import**하는 레이어 역전, 그리고 **도메인 핸들러(`ai-agent.handler.ts`)가 인프라 구체 클래스(`WebsocketService`)에 직접 의존**하는 점이다. 나머지 사항은 코드베이스 성장에 따른 잠재적 마찰 요인이지만 현 시점에서 기능 동작에 영향을 주지는 않는다.

### 위험도

**LOW**