# 신규 식별자 충돌 검토 결과

target: `plan/in-progress/ai-presentation-tools.md`
검토일: 2026-05-22

---

## 발견사항

### 1. 요구사항 ID 충돌

변경 없음. `ND-AG-26` 은 target 이 처음 부여한 ID 로, 기존 코퍼스에서 다른 의미로 사용된 흔적이 없다. `ND-AG-25` 는 `spec/4-nodes/_product-overview.md §6.1` 에 이미 존재하는 별도 요구사항(포트 색상 구분)으로, target 은 이 번호를 재사용하지 않는다.

### 2. 엔티티/타입명 충돌

- **[INFO]** `PresentationPayload` 타입명 — spec 에서 새로 도입됨
  - target 신규 식별자: `PresentationPayload` (ConversationTurn `data.presentations[]` 의 원소 타입)
  - 기존 사용처: `spec/conventions/conversation-thread.md` §1.2 `data?` 설명 라인에 `data.presentations?: PresentationPayload[]` 로 이미 등장. 별도 정의 섹션은 없으나 동일한 의미로 일관되게 사용됨.
  - 상세: target 이 도입하려는 `PresentationPayload` 타입이 conversation-thread.md 에 이미 이름이 박혀 있으므로 의미 충돌은 없다. 단, 아직 어느 파일에도 타입 정의(interface / zod schema) 위치가 명시되어 있지 않다. 구현 시 타입 정의 위치를 한 곳에 명시하지 않으면 frontend / backend 두 곳에서 각자 다르게 정의할 drift 위험이 있다.
  - 제안: `spec/conventions/conversation-thread.md §1.2` 또는 `spec/4-nodes/3-ai/1-ai-agent.md §7.10` 에 `PresentationPayload` 의 필드 목록(type, payload, truncation 등)을 단일 진실로 정의하는 한 줄을 추가하면 혼선을 방지할 수 있다.

- **[INFO]** `PresentationToolDef` 구조체명 — spec 에서 새로 도입됨
  - target 신규 식별자: `PresentationToolDef` (AI Agent `presentationTools[]` 배열의 원소 구조체)
  - 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md §1` 에 이미 `PresentationToolDef 구조:` 라는 표가 정의되어 있음. target plan 문서가 해당 spec 갱신을 작업 항목으로 기술하는 것이므로 의미 일치.
  - 상세: 충돌 없음. 확인 차원 기록.

### 3. 설정 필드명 충돌

- **[INFO]** `presentationTools` 필드 — spec 기준 신규, 코드베이스 미존재
  - target 신규 식별자: `presentationTools: PresentationToolDef[]` (AI Agent config 필드)
  - 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md §1` 에 이미 기술됨. 코드베이스(`codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`)에는 아직 구현되지 않음.
  - 상세: 충돌 없음. spec 과 target plan 이 동일한 의미로 사용.

### 4. 이벤트/메시지명 충돌

- **[INFO]** `presentation_user` ConversationTurn source — 기존 정의와 의미 확장 여부
  - target 신규 식별자: target 은 `render_form` 제출 시 `presentation_user` source 로 thread push 한다고 명시 (결정사항 §4.3.4 에 해당하는 구현 단위)
  - 기존 사용처: `spec/conventions/conversation-thread.md §1.4` 에 `presentation_user` source 는 "Form / Carousel / Table / Chart / Template 의 `output.interaction.{type}` 가 `form_submitted` / `button_click` / `button_continue` 일 때" 라고 이미 정의되어 있음. 코드베이스에서도 `conversation-inspector.tsx`, `use-execution-events.ts` 등 다수 파일에서 동일 source 값으로 쓰임.
  - 상세: target 이 `render_form` 의 AI tool 모드 제출에도 `presentation_user` source 를 재사용하는 것은 기존 정의와 의미가 일치한다(`form_submitted` interaction type 재사용). 충돌은 없으며, `spec/4-nodes/6-presentation/0-common.md §10.7` 에도 동일 사실이 명문화되어 있다. 다만 기존 정의("그래프 상 presentation 노드의 버튼·폼 인터랙션")와 신규 사용처("AI 내부 render_form 의 제출")가 같은 source 값을 공유함으로써 UI 렌더 코드가 두 출처를 구별하지 못할 가능성이 있다. `spec/4-nodes/6-presentation/0-common.md §10.7` 은 이 경우 "같은 시각 형식으로 렌더"를 의도한 설계임을 명시하고 있으므로 의도적 공유.
  - 제안: UI 렌더 코드 구현 시 두 출처를 구별할 필요가 있는 케이스(예: form 제출의 nodeId 가 null 인지 여부)에 대한 분기 조건을 미리 spec 에 기술하면 구현 혼선을 줄일 수 있다.

- **[INFO]** `execution.ai_message` WebSocket 이벤트 payload 확장
  - target 신규 식별자: `execution.ai_message` 스냅샷에 `presentations` 필드 포함 (결정사항 §11)
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md §4.4`, `spec/3-workflow-editor/3-execution.md §10`, EIA spec 등 다수. 현재 payload 는 `{ executionId, nodeId, message, turnCount, messages, metadata?, llmCalls?, durationMs? }`.
  - 상세: target 은 기존 이벤트 이름(`execution.ai_message`)을 그대로 사용하되 payload 에 presentations 를 추가하는 방식. 이벤트 명 충돌은 없다. payload 확장은 `spec/4-nodes/3-ai/1-ai-agent.md §7.10` 에 명시적으로 기술되어 있다. 기존 WS spec 파일(`6-websocket-protocol.md`)의 payload 테이블을 함께 갱신해야 spec 간 불일치가 생기지 않는다 — target plan 의 §4.1 작업 단위 목록에 해당 파일 갱신이 포함되어 있지 않다.
  - 제안: `spec/5-system/6-websocket-protocol.md §4.4` 의 `execution.ai_message` payload 표에 `presentations?: PresentationPayload[]` 행을 추가하는 작업을 target plan §4.1 Spec 작성 항목에 추가할 것을 권장.

### 5. tool prefix 충돌

변경 없음. `render_*` prefix 는 기존 4-prefix 패턴(`cond_*` / `kb_*` / `mcp_*` / `tool_*`)에 새로 추가되는 것으로, 기존 코드베이스 및 spec 어디에서도 `render_` prefix 로 등록된 tool 이름은 발견되지 않는다.

### 6. 상수·설정키 충돌

- **[INFO]** `PRESENTATION_MAX_BYTES` — 기존 구현과 동일 이름, 동일 의미
  - target 신규 식별자: target plan §4 결정사항 §9 에 "기존 presentation 노드와 동일 1MB cap (`PRESENTATION_MAX_BYTES`) 적용" 으로 언급.
  - 기존 사용처: `codebase/backend/src/nodes/core/truncate-output.util.ts:13` 에 `export const PRESENTATION_MAX_BYTES = 1024 * 1024` 로 이미 정의·사용됨.
  - 상세: 충돌 없음. 기존 상수를 재사용하는 것이 target 의 의도이며, spec 과 구현이 일치한다.

- **[INFO]** `meta.presentationSchemaViolations` — spec 기준 신규 meta 필드
  - target 신규 식별자: `meta.presentationSchemaViolations[]` (handler accumulator 필드)
  - 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md §7.1` 및 §7.10 에 이미 정의됨. 코드베이스에는 미구현.
  - 상세: 충돌 없음.

- **[INFO]** `meta.presentationCalls` — spec 에 이미 정의
  - target 신규 식별자: target plan 에서 명시적 언급은 없으나 `spec/4-nodes/3-ai/1-ai-agent.md §7.10` 에 `meta.presentationCalls[]` 가 정의되어 있음. target plan 의 §4.3 구현 단위와 연결되는 신규 필드.
  - 기존 사용처: spec 내 신규. 코드베이스 미구현.
  - 상세: 충돌 없음.

### 7. 파일 경로 충돌

- **[INFO]** `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` — 신규 파일
  - target 신규 식별자: `render-tool-provider.ts` (신규 생성 파일)
  - 기존 사용처: 해당 경로에 파일 없음. `tool-providers/` 디렉터리 자체가 존재하는지 확인이 필요하나, 기존 네이밍 컨벤션(`{name}-tool-provider.ts` 패턴)과 일치하며 충돌 없음.
  - 상세: 경로 충돌 없음. 확인 차원 기록.

### 8. 누락된 spec 파일 갱신 항목 (INFO 수준)

- **[INFO]** `spec/5-system/6-websocket-protocol.md` 갱신 항목 누락
  - target 신규 식별자: `execution.ai_message` payload 에 `presentations` 포함
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md §4.4` payload 표
  - 상세: target plan §4.1 의 Spec 작성 항목 목록 및 §5 영향 받는 SoT 파일 표에 `spec/5-system/6-websocket-protocol.md` 가 누락되어 있다. 해당 파일의 `execution.ai_message` payload 표를 갱신하지 않으면 WS spec 이 구현과 drift 된다.
  - 제안: §4.1 체크리스트 및 §5 SoT 파일 표에 `spec/5-system/6-websocket-protocol.md` — `execution.ai_message` payload 에 `presentations?` 필드 추가 항목을 추가할 것을 권장.

- **[INFO]** `spec/5-system/14-external-interaction-api.md` 갱신 항목 누락
  - target 신규 식별자: `execution.ai_message` payload 확장
  - 기존 사용처: EIA spec §6.5 에서 `execution.ai_message` payload 를 WS spec 에서 그대로 포함한다고 기술됨.
  - 상세: WS spec 과 동일한 이유로 EIA spec 도 payload 확장에 영향을 받는다. target plan §4.1 및 §5 에 포함되어 있지 않다.
  - 제안: target plan §4.1 및 §5 에 EIA spec 갱신 항목 추가 권장 (WS spec 갱신과 묶어 처리 가능).

---

## 요약

target 문서(`plan/in-progress/ai-presentation-tools.md`)가 도입하는 신규 식별자 — `ND-AG-26`, `render_*` prefix(5종 tool 이름), `presentationTools` 설정 필드, `PresentationToolDef` / `PresentationPayload` 타입명, `meta.presentationSchemaViolations` / `meta.presentationCalls` 메타 필드, `PRESENTATION_MAX_BYTES` 상수 재사용 — 은 모두 기존에 다른 의미로 사용되는 식별자와 충돌하지 않는다. `presentation_user` source 와 `execution.ai_message` 이벤트는 기존 정의를 의도적으로 확장·재사용하는 방식으로, 설계상 명확하게 정당화되어 있다. 다만 `spec/5-system/6-websocket-protocol.md` 와 `spec/5-system/14-external-interaction-api.md` 두 파일이 target plan 의 SoT 갱신 목록에서 누락되어 있어, 구현 후 spec drift 가 발생할 가능성이 있다. 이 두 항목을 plan §4.1 및 §5 에 추가하는 것이 권장된다.

---

## 위험도

LOW
