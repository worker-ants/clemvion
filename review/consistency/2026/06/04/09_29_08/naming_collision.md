# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-done`, scope: `spec/4-nodes/3-ai/`, diff-base: `origin/main`

---

## 발견사항

### 발견사항 없음

모든 검토 관점을 적용한 결과 실질적 충돌은 발견되지 않았다. 아래에 검토 내용을 관점별로 정리한다.

---

### 관점 1: 요구사항 ID 충돌

target 에서 새로 등장하는 요구사항 ID 계열: `ND-AG-27` ~ `ND-AG-30`, `AGM-01` ~ `AGM-11`.

- `ND-AG-27`~`ND-AG-30` — `/spec/4-nodes/3-ai/_product-overview.md` + `/spec/4-nodes/_product-overview.md` 양쪽이 동일 내용(메모리 전략·summary_buffer·persistent·meta echo)으로 정합하여 사용. 기존 번호와의 겹침 없음.
- `AGM-01`~`AGM-11` — `/spec/5-system/17-agent-memory.md` 에서만 사용. 다른 영역 spec 에서 동일 prefix `AGM-` 이 없음.
- `ND-AG-25` (포트 색상 구분)는 기존 사용처(`spec/4-nodes/_product-overview.md:216`)와 의미 일치. `ND-AG-26` (Presentation Tool) 역시 동일.
- System Context Prefix 기능은 `0-common.md §11` 에서 산문으로 정의하며 별도 요구사항 ID(예: `ND-SCP-*`)를 부여하지 않는다 — **ID 충돌 대상 없음**.

### 관점 2: 엔티티/타입명 충돌

신규 도입 타입:
- `McpServerRef` — `spec/4-nodes/3-ai/0-common.md §3` 에서 정의. 기존 `spec/5-system/11-mcp-client.md` · `spec/2-navigation/4-integration.md` 등에서 동일 컨텍스트(MCP 서버 참조 구조체)로 참조되며 다른 의미로 쓰이는 곳 없음.
- `ConditionDef` — `spec/4-nodes/3-ai/1-ai-agent.md §1` 에서 정의. 기존 사용처(`spec/4-nodes/3-ai/_product-overview.md` 등)와 의미 일치.
- `PresentationToolDef` — 동일 파일에서 신규 정의. 다른 영역 spec 에서 같은 이름의 다른 의미 엔티티 없음.
- `WaitingInteractionType` enum 값 `'ai_form_render'` — `/spec/conventions/interaction-type-registry.md:30` 에서 이미 정식 등록(`'form' | 'buttons' | 'ai_conversation' | 'ai_form_render'`). target spec 은 동일 의미로 참조 — 충돌 없음.

### 관점 3: API endpoint 충돌

target(`spec/4-nodes/3-ai/`)은 API endpoint 를 새로 정의하지 않는다. 모든 실행·재개 진입점(`execution.submit_message`, `execution.submit_form`, `execution.end_conversation`, `execution.retry_last_turn`)은 기존 WebSocket 프로토콜(`spec/5-system/6-websocket-protocol.md`)에 이미 정의된 명령어이며, 해당 파일에서 동일 의미로 사용된다.

### 관점 4: 이벤트/메시지명 충돌

target 에서 참조·사용하는 WS 이벤트: `execution.ai_message`, `execution.user_message`, `execution.waiting_for_input`, `execution.tool_call_started`, `execution.tool_call_completed`, `execution.retry_last_turn`.

- 이들은 모두 `/spec/5-system/6-websocket-protocol.md §4.4` 에 이미 정의된 이름이다.
- `meta.interactionType` 값 `'ai_conversation'` · `'ai_form_render'` 는 `/spec/conventions/interaction-type-registry.md` 에 정식 등록. 다른 의미로 사용되는 곳 없음.
- `output.interaction.type` 값 `'message_received'` · `'form_submitted'` — `/spec/conventions/node-output.md §4.5` 에서 `ai_agent`/`information_extractor` 대상으로 등록됨. target 은 동일 의미로 사용.

### 관점 5: 환경변수·설정키 충돌

target 에서 참조하는 환경변수: `process.env.TZ` (System Context Prefix §11.3 timezone SoT fallback).

- `TZ` 는 Node.js/OS 표준 환경변수이며, 본 spec 에서 다른 의미로 쓰이는 곳 없음.
- 신규 config 필드 (`includeSystemContext`, `systemContextSections`, `memoryStrategy`, `memoryTokenBudget`, `memoryKey`, `memoryTopK`, `memoryThreshold`, `memoryTtlDays`, `compactedMessages`)는 모두 `spec/4-nodes/3-ai/` 영역 내에서만 정의 및 참조됨. 타 영역 spec 에서 동일 이름을 다른 의미로 쓰는 사례 없음.
- `meta.memory.*` 하위 필드(`strategy`, `summarized`, `recalledCount`, `tokenBudgetUsed`, `compactedMessages`) — `spec/4-nodes/3-ai/` 및 `spec/5-system/17-agent-memory.md` 이외에는 정의·참조 없음.

### 관점 6: 파일 경로 충돌

target 파일:
- `spec/4-nodes/3-ai/0-common.md` — 기존 파일이며 신규 `§10`, `§11` 섹션만 추가됨. 파일 경로 충돌 없음.
- `spec/4-nodes/3-ai/1-ai-agent.md` — 기존 파일 수정. 충돌 없음.
- `spec/5-system/17-agent-memory.md` — 기존 파일. 충돌 없음.
- `codebase/backend/src/nodes/ai/shared/system-context-prefix.ts` — `spec/4-nodes/0-overview.md:38` 에서 파일 위치 패턴 예시로 이미 등재됨. 실제 파일도 `dist/` 에서 확인. 명명 컨벤션 위반 없음.

---

## 요약

`spec/4-nodes/3-ai/` target 영역이 도입하는 신규 식별자(요구사항 ID `ND-AG-27`~`ND-AG-30` / `AGM-*`, 타입명 `McpServerRef`·`ConditionDef`·`PresentationToolDef`, config 필드군, `meta.memory.*` 서브필드, 이벤트·interactionType 값, 환경변수 `TZ`)는 모두 기존 사용처와 의미가 일치하거나 신규 고유 영역에서만 사용된다. 다른 의미로 이미 사용 중인 식별자와의 충돌은 발견되지 않았다.

---

## 위험도

NONE
