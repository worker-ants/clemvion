# 신규 식별자 충돌 검토 — spec/4-nodes/6-presentation (impl-done)

## 발견사항

없음 (CRITICAL/WARNING 없음).

검토 중 식별했으나 **이미 target 문서 자신 또는 인접 spec 이 명시적으로 충돌 가능성을 인지하고 구분해 둔** 항목들 (조치 불요, 참고용 INFO):

- **[INFO]** `'form_submitted'` 문자열 리터럴의 4-layer 재사용
  - target 신규 식별자: §10.9 internal continuation bus payload sentinel `{ type: 'form_submitted', formData }`
  - 기존 사용처: `interaction_data.interactionType`(data-model, DB enum) / `output.interaction.type`(node-output §4.5) / LLM tool_result content `type`(AI Agent §6.2)
  - 상세: 같은 문자열 `'form_submitted'` 가 (1) DB 기록 enum, (2) NodeOutput interaction 타입, (3) LLM 향 tool_result 타입, (4) engine-internal continuation bus payload sentinel 4곳에서 등장. 의미는 layer 마다 독립적이나 표면적으로는 동일 토큰.
  - 근거: target §10.9 본문이 "4 layer 분리 (모두 문자열 `'form_submitted'` 가 등장하지만 의미 독립)" 표를 두어 명시적으로 구분·cross-reference 하고 있고, `spec/1-data-model.md:2266` 도 `interaction_data.interactionType` 이 `WaitingInteractionType`(`ai_form_render` 등) 과 "이름만 같고 별개 enum" 임을 이미 별도로 명문화해 둠. 실제 코드도 `ai-turn-orchestrator.service.ts` 의 dispatch 가 `action.type` 명시 매칭으로 분기해 혼선 여지가 낮음.
  - 제안: 조치 불요. 신규 spec/코드 작성자가 이 4-layer 구분을 놓치지 않도록 향후 관련 절 편집 시 §10.9 의 "4-layer 정렬" 표를 계속 SoT 로 유지·참조할 것.

- **[INFO]** BullMQ 큐명 `execution-continuation`(하이픈) ↔ 폐기된 pub/sub 채널명 `execution:continuation`(콜론) 의 시각적 유사
  - target 신규 식별자: 없음(§10.9 는 기존 큐를 재인용) — 다만 target 문서가 이 이름을 다시 노출하므로 확인차 기록.
  - 기존 사용처: `spec/5-system/4-execution-engine.md:1162`(큐 목록), `spec/data-flow/0-overview.md:216`, `spec/4-nodes/4-integration/2-database-query.md:412-413`
  - 상세: 하이픈/콜론 한 글자 차이라 텍스트 검색·수기 인용 시 오타로 오인되기 쉽다. 다만 이미 모든 언급처가 "옛 `execution:continuation` 채널은 폐기" 문구를 동반해 재확인 부담이 낮다.
  - 제안: 조치 불요(신규 도입 아님, 기존 명명). 향후 문서에서도 "폐기" 라벨을 계속 동반할 것.

- **[INFO]** `interaction.type` "4값 중 하나" 서술과 목록 3개 표기
  - target 신규 식별자: 없음 — §10.9 layer(3) 행이 "`'form_submitted'` enum 값 (`button_click`/`button_continue`/`form_submitted` **4값 중 하나**)" 라고 적어 4개를 암시하지만 이름은 3개만 나열.
  - 기존 사용처: `spec/conventions/node-output.md:243` 의 `interaction.type` enum 이 `form_submitted | button_click | button_continue | message_received` 4개로 정의됨.
  - 상세: 목록 누락(`message_received`)이지 이름 충돌은 아니다. 엄밀히는 "신규 식별자 충돌" 스코프 밖(내부 완전성 이슈)이라 별도 채점 대상은 아니라고 판단해 정보성으로만 기록.
  - 제안: naming-collision 스코프 밖 — 필요 시 별도 internal-consistency 리뷰에서 처리.

## 점검한 주요 신규/재확인 식별자 (충돌 없음 확인)

아래는 target 문서(§10.5~§10.9, Rationale)가 명시하거나 새로 강조하는 식별자들로, `git grep` 으로 실제 워크트리(`codebase/`, `spec/`) 전체를 조회해 의미 충돌이 없음을 확인했다:

- 함수명: `backfillButtonUuids` / `backfillFormOptionValues` (`render-tool-provider.ts`) — 그래프 노드 본체용 `normalizeNodeButtonIds` (`nodes/core/button-slug.util.ts`) 와 spec 본문이 명시적으로 구분(동일 목적의 다른 함수가 아니라 완전히 별도 함수임을 doc 이 강조).
- 상수: `PRESENTATION_MAX_BYTES`(1MB, `truncate-output.util.ts`) / `MAX_BUTTONS_PER_NODE`(5, `_shared/button.types.ts`) / `FORM_SUBMITTED_MAX_BYTES`(10KB, `ai-turn-executor.ts`) — 세 상수 모두 스코프·값·위치가 spec·코드 간 정합, 서로 다른 의미로 이미 쓰이는 곳 없음.
- 필드: `data.via: 'ai_render'` sentinel — `node-output.md §4.5`, `execution-engine.md`, `ai-agent.md §6.2/§6.1.d.ii`, 코드(`ai-turn-executor.ts:2565`)와 전부 일치.
- 필드: `ButtonDef.userMessage` — `websocket-protocol.md:555` 가 이미 WS `message` 필드와 "무관" 이라고 명시적으로 disambiguate 해 둔 상태(선제적 조치, target 문서 도입 시점에 이미 반영됨).
- 클래스: `AiTurnOrchestrator` — C-1 분할로 이미 존재(`ai-turn-orchestrator.service.ts`), target 문서의 §10.9 SSOT 정렬 표 언급과 실제 코드 위치·역할 일치.
- 필드: ConversationTurn top-level `presentations[]` — `ai-agent.md §7.10`, `websocket-protocol.md:505`, `conversation-thread.md`, `chat-channel` 계열 spec, widget-app.md 전부와 일치. WS `execution.message` 이벤트의 `presentations: [{config,output}]`(비-블로킹 표시 노드용, 다른 shape)와는 `widget-app.md:48` 이 "렌더러가 두 shape 을 모두 수용" 한다고 이미 명문화해 두어 shape 차이로 인한 혼선 방지 조치가 선행됨.
- 함수: `findButtonContext`(`assistant-presentations-block.tsx`) / `renderInteractionText`(`thread-renderer.ts`) — 코드에 이미 존재, spec 인용과 일치.
- 도구명: `render_table`/`render_chart`/`render_carousel`/`render_template`/`render_form` — AI Agent §7.10 이 "dispatcher 분류는 5분류(cond/kb/mcp/render/tool)" 로 명시해 `tool_*`(재작성 대기 중인 일반 MCP 도구 슬롯)과 네임스페이스 충돌하지 않음을 이미 문서화.
- 타입명: `ColumnDef`/`RowDef`/`ItemDef`/`ButtonDef` — 타 영역에서 동명 타입이 다른 의미로 쓰이는 사례 없음(frontend `presentation-renderers.tsx` 의 `ColumnDef` 도 동일 개념의 로컬 표현).

## 요약

target 문서(`spec/4-nodes/6-presentation/0-common.md`, `1-carousel.md`, `2-table.md`)가 이번 개정에서 강조하는 함수명(`backfillButtonUuids`/`backfillFormOptionValues`), 상수(`PRESENTATION_MAX_BYTES`/`MAX_BUTTONS_PER_NODE`/`FORM_SUBMITTED_MAX_BYTES`), 필드(`ButtonDef.userMessage`, `data.via`, ConversationTurn `presentations[]`), 클래스(`AiTurnOrchestrator`), 도구명(`render_*`)을 실제 워크트리 코드·spec 전역에서 대조한 결과 다른 의미로 이미 쓰이고 있는 충돌은 발견되지 않았다. 오히려 본 문서는 잠재적으로 혼동될 수 있는 동명 토큰(`'form_submitted'` 4-layer 재사용, `execution-continuation` 큐명, `ButtonDef.userMessage` vs WS `message` 필드, ConversationTurn `presentations[]` vs `execution.message.presentations[]`)마다 "SSOT 정렬" 표나 "무관" 각주를 선제적으로 붙여 놓아, 신규 식별자 충돌 관점에서는 이례적으로 방어적인 문서다. 상기 INFO 3건은 실제 위험이라기보다 이미 완화된 상태를 기록해 둔 것으로, 조치가 필요한 항목은 없다.

## 위험도

NONE
