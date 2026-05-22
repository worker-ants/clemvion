# Cross-Spec 일관성 검토 결과

**대상 문서**: `plan/in-progress/ai-presentation-tools.md`
**검토 일시**: 2026-05-22
**검토 유형**: spec draft (`--spec`)

---

## 발견사항

### [WARNING] `render_*` 도구 prefix 분류 체계와 기존 dispatcher 분류 로직의 충돌 가능성

- **target 위치**: §2 결정사항 2항 / §4.3 dispatcher 분류 로직
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 step 3a — 도구 분류 로직: `cond_*` / `kb_*` / `mcp_*` / `tool_*` 4-prefix 체계
- **상세**: 현재 AI Agent spec 의 §6.1.3a 는 `toolCalls` 를 `cond_*` / `kb_*` / `mcp_*` / `tool_*` 네 카테고리로 분류하며, "provider 의 `matches()` 가 우선 판정, 어디에도 매칭 안 되면 일반 도구로 분류" 라고 명시한다. target 은 여기에 5번째 카테고리인 `render_*` provider 를 삽입하고자 한다. 기존 spec 에는 이 5번째 슬롯이 없기 때문에, target 이 갱신을 요구하는 §6.1·§6.2 실행 로직 서술이 정확히 어떤 위치에 `render_*` 분류·dispatch 흐름을 기술해야 하는지 spec 과의 정합 지점이 명시되지 않은 상태다. spec 갱신 없이 구현이 선행되면 두 문서가 서로 다른 분류 체계를 갖게 된다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1·§6.2 를 갱신할 때 tool 분류 순서 표(`cond_*` → `kb_*` → `mcp_*` → `render_*` → `tool_*`)와 각 prefix 의 우선순위를 명시한다. `render_*` 는 blocking(form) 과 non-blocking(display-only) 두 sub-class 로 나뉘므로 dispatcher 단계를 분기 기술 필요.

---

### [WARNING] `_resumeState.pendingFormToolCall` 신규 필드가 기존 `_resumeState` 스키마에 없음

- **target 위치**: §4.3 — `render_form: _resumeState.pendingFormToolCall: {toolCallId}` 저장
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.4 `_resumeState` 구조 (`llmConfigId`, `model`, `temperature`, `maxTokens`, `knowledgeBases`, `ragTopK`, `ragThreshold`, `maxToolCalls`, `maxTurns`, `mcpServers`, `conditions`, `messages`, `turnCount`, ...)
- **상세**: 기존 spec 의 §7.4 예시 JSON 과 설명에는 `_resumeState` 하위 필드가 열거되어 있고 `pendingFormToolCall` 은 없다. `render_form` blocking 흐름을 위해 새 필드를 추가하면 이 목록이 불완전해진다. `_resumeState` 는 expression resolver 에서 비노출(Principle 4.2)이지만 spec 상 단일 진실이 요구되는 구조체이므로, 신규 필드 추가 시 §7.4 의 구조 설명을 함께 갱신해야 한다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.4 에 `_resumeState.pendingFormToolCall?: { toolCallId: string }` (render_form blocking 대기 중일 때만 설정) 항목을 추가하고, 이 필드의 해소(form 제출 시 tool_result 생성) 흐름을 §6.2 multi-turn 흐름에 기술한다.

---

### [WARNING] `ConversationTurn.data` 필드 용도와 `presentations: PresentationPayload[]` 누적 위치 충돌

- **target 위치**: §2 결정사항 10항 — "기존 `data?` 자유 필드에 `presentations: PresentationPayload[]` 추가"
- **충돌 대상**: `spec/conventions/conversation-thread.md` §1.2 `ConversationTurn` 정의 — `data?` 필드는 "구조화 원본 — `output.interaction.data` snapshot" 으로 정의되고 "interaction.type 별 shape 은 node-output §4.5 의 단일 정의를 따른다"고 명시
- **상세**: `data?` 필드의 기존 정의는 _사용자 인터랙션의 output.interaction.data 스냅샷_ 을 저장하는 목적이다. target 은 이 필드에 `presentations: PresentationPayload[]` 를 함께 담으려 한다. 이는 목적이 다른 두 관심사(사용자 인터랙션 데이터 vs AI 응답 중 렌더링 페이로드)가 같은 필드를 공유하는 형태로, `data?` 의 현재 type contract 를 확장하는 것이다. 기존 spec 에는 이 shape 확장이 전혀 기술되어 있지 않으며, `data?` 의 "단일 정의"를 언급하는 node-output §4.5 참조도 훼손된다.
- **제안**: `ConversationTurn` 에 `presentations?: PresentationPayload[]` 를 `data?` 와 분리된 독립 필드로 추가하는 방안을 검토한다. 만약 `data?` 내부에 두기로 결정한다면 `spec/conventions/conversation-thread.md` §1.2 의 `data?` 타입 설명을 "interaction.type 별 snapshot + ai_assistant turn 의 `presentations` 배열" 로 재정의하고, node-output §4.5 cross-ref 가 여전히 유효한지 확인한다. 어느 방법이든 spec 갱신이 선행되어야 한다.

---

### [WARNING] `execution.ai_message` WebSocket 이벤트에 `presentations` 포함 여부가 기존 이벤트 스키마와 불일치

- **target 위치**: §2 결정사항 11항 — "기존 `execution.ai_message` 누적 스냅샷에 presentations 포함"
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.1 / §4.4 — `execution.ai_message` 페이로드 정의: `{ executionId, nodeId, message, turnCount, messages, metadata?, llmCalls?, durationMs? }`
- **상세**: 기존 spec 의 `execution.ai_message` 페이로드 필드 목록에는 `presentations` 가 없다. target 이 이 이벤트에 presentations 를 추가하려면 WebSocket spec 의 페이로드 정의를 갱신해야 한다. 클라이언트 파싱 로직도 변경이 필요하기 때문에 API 계약 변경에 해당한다.
- **제안**: `spec/5-system/6-websocket-protocol.md` §4.1 의 `execution.ai_message` 페이로드 정의에 `presentations?: PresentationPayload[]` 필드를 추가하고, 해당 필드가 동봉되는 조건(display-only render 호출 포함 시)을 명시한다.

---

### [WARNING] `render_form` blocking 중 `interactionType` 값과 기존 `interactionType` 열거형 충돌 가능성

- **target 위치**: §4.3 — `render_form: status:'waiting_for_input', interactionType:'ai_conversation'` 유지
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.4 — `interactionType` 정의: `"form"` / `"buttons"` / `"ai_conversation"` 3종
- **상세**: target 은 `render_form` blocking 중에 기존 `interactionType: 'ai_conversation'` 을 그대로 유지한다고 기술한다. 이는 `render_form` 이 Multi Turn AI Agent 의 tool_result 대기 상태임을 숨기고, 클라이언트가 이를 일반 ai_conversation 대기와 구분할 수단이 없는 문제를 초래한다. 특히 클라이언트가 `execution.submit_form` WS 명령으로 제출해야 하는지 `execution.submit_message` 로 처리해야 하는지를 구분하는 근거가 사라진다. 기존 spec 에서 `interactionType` 은 어떤 WS 명령을 사용해야 하는지 결정하는 API 계약 신호다.
- **제안**: `render_form` blocking 케이스에서 사용할 `interactionType` 값을 명확히 결정하고 spec 에 기술한다. 예를 들어 `"ai_conversation"` 유지 + `conversationConfig` 내 신규 플래그(`pendingFormRender: true`) 를 추가하거나, 새 값(`"ai_form_render"`)을 도입하는 방안이 있다. 어느 경우든 `spec/5-system/6-websocket-protocol.md` §4.4 의 `interactionType` 정의를 갱신해야 한다.

---

### [INFO] 요구사항 ID ND-AG-26 의 출처가 target 에만 존재하며 다른 spec 에는 미등록

- **target 위치**: §4.1 — `spec/4-nodes/_product-overview.md` §6.1 및 `spec/4-nodes/3-ai/_product-overview.md` §3.2 에 ND-AG-26 추가 예정
- **충돌 대상**: `spec/4-nodes/_product-overview.md` §6.1 (ND-AG-25 까지 정의됨), `spec/4-nodes/3-ai/_product-overview.md` §3.2 (ND-AG-25 까지 정의됨)
- **상세**: 현재 두 product-overview spec 의 AI Agent 요구사항 ID 는 ND-AG-25 까지 연속 정의되어 있고 ND-AG-26 은 존재하지 않는다. target 이 새로 부여하려는 ND-AG-26 은 아직 다른 spec 에 사용 중이지 않아 ID 충돌은 없다. 다만 plan 문서에만 존재하고 spec 에는 반영되지 않은 상태로, spec 작성 완료 후 ID 정합성을 확인할 필요가 있다.
- **제안**: spec 작성 시 양쪽 product-overview 에 동일한 ND-AG-26 정의를 추가하고, 두 위치의 목록이 동기화된 상태인지 검토한다.

---

### [INFO] `PRESENTATION_MAX_BYTES` 1MB cap 적용 근거와 기존 presentation 노드 cap 정의의 명명 일관성

- **target 위치**: §2 결정사항 9항 — "기존 presentation 노드와 동일 1MB cap (`PRESENTATION_MAX_BYTES`) 적용"
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md` §4 — `PRESENTATION_MAX_BYTES = 1024 × 1024` 정의
- **상세**: 기존 spec 이 정의한 `PRESENTATION_MAX_BYTES` 상수를 target 이 그대로 참조하는 것은 일관성이 있다. 다만 기존 cap 은 "Carousel items / Table rows" 등 _배열형 output_ 에 적용되는 것으로 정의되어 있고, AI 응답에서 생성된 render payload 에 동일 상수가 어떻게 적용되는지(단일 PresentationPayload 별? 누적 합산?) 에 대한 명세가 target 에 없다. 의미상의 gap 이 있다.
- **제안**: `spec/4-nodes/6-presentation/0-common.md` 의 "AI tool 모드" 신설 섹션에서 `PRESENTATION_MAX_BYTES` 가 개별 render payload 각각에 적용되는지, 아니면 turn 전체 누적에 적용되는지를 명시한다.

---

### [INFO] `output.result.response` 와 `presentations[]` 의 관계 — downstream 노드 output 계약

- **target 위치**: §6 완료 조건 — "downstream 노드의 `output.result.response` 는 텍스트만 운반"
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 `output.result.response` 정의 — "LLM 최종 응답 텍스트 (`responseFormat=json` 시 parsed object)"
- **상세**: 기존 spec 은 `output.result.response` 가 LLM 응답의 완전한 텍스트를 운반한다고 정의한다. `render_*` 호출이 LLM 응답에 포함되는 경우, LLM 이 생성한 텍스트 중 일부가 tool_use block 으로 처리되어 `output.result.response` 에서 제외되는지, 아니면 텍스트 부분만 추출하여 저장하는지에 대한 처리 정책이 기존 spec 에는 없다. 이 정책이 명확하지 않으면 downstream 노드가 `output.result.response` 를 참조할 때 기대와 다른 값을 받을 수 있다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md` §7 출력 구조 갱신 시, `render_*` 도구 호출이 있는 경우 `output.result.response` 가 LLM 최종 텍스트 부분(non-tool_use content) 을 추출해 저장한다는 정책을 명시하고, 텍스트 부분이 없는 경우(tool_use 만 emit) 의 처리(빈 문자열? 직전 응답?) 를 정의한다.

---

## 요약

target 문서(`ai-presentation-tools.md`)는 전반적으로 기존 4-prefix 분류 패턴(`cond_*/kb_*/mcp_*/tool_*`)에 잘 맞춰 설계되어 있고, 1MB cap·presentation 노드 schema 재사용·`execution.submit_form` WS 명령 재사용 같은 핵심 결정이 기존 spec 과 올바르게 정합한다. 다만 다섯 개의 WARNING 이 존재한다. 가장 중요한 것은 (1) `ConversationTurn.data?` 필드에 `presentations` 를 추가하는 방식이 기존 해당 필드의 단일 진실 contract 를 훼손한다는 점, (2) `render_form` blocking 중 `interactionType` 이 `'ai_conversation'` 으로 동일하게 유지되어 클라이언트가 WS 명령 분기 근거를 잃는다는 점, (3) `_resumeState` 에 추가되는 `pendingFormToolCall` 필드가 기존 §7.4 schema 정의에 없다는 점이다. 이 세 사항은 구현 착수 전에 spec 갱신으로 해소되어야 한다. 나머지 WARNING 두 건(`execution.ai_message` schema, dispatcher 분류 체계)도 spec 내 API 계약 변경을 수반하므로 spec 작성 단계에서 함께 반영해야 한다.

---

## 위험도

**MEDIUM**

> Critical 수준의 "즉각적 작동 불가" 충돌은 없으나, `ConversationTurn.data?` 필드의 의미 재정의와 `render_form` blocking 의 `interactionType` 모호성은 구현 시 의도치 않은 클라이언트 버그 또는 spec drift 를 유발할 잠재 충돌이다. spec 갱신이 구현 선행 조건이다.
