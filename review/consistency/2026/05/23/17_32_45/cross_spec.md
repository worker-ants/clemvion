# Cross-Spec 일관성 검토 결과

**검토 모드**: 구현 착수 전 검토 (--impl-prep)
**Target 범위**: `spec/conventions/conversation-thread.md` · `spec/conventions/node-output.md` · `spec/4-nodes/3-ai/1-ai-agent.md`
**검토 일시**: 2026-05-23

---

## 발견사항

### [INFO] `ConversationTurnSource.ai_tool` 에 조건 도구 포함 여부 — 표기 모호
- **target 위치**: `spec/conventions/conversation-thread.md §1.1` — `ai_tool` 행: "KB / MCP / condition tool 결과 (opt-in 시 `includeToolTurns: true`)"
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §7.1` 표 `meta.toolCalls` 설명 — "KB·MCP·일반 도구 호출 횟수 합산 (조건 도구 제외)"; §6.1 단계 2.5 — "tool-loop 중 assistant / tool result push 는 `includeToolTurns: true` 시에만"
- **상세**: conversation-thread.md §1.1 의 `ai_tool` source 정의는 "condition tool 결과" 를 포함한다고 명시한다. 그러나 ai-agent.md §7.1 의 `meta.toolCalls` 는 "조건 도구 제외" 라고 하며, 조건 도구 (`cond_*`) 는 단순 라우팅 종료 역할이라 tool_result 루프에 참여하지 않는다. 즉 ai_tool push 가 실제로 발생하는 도구 (KB/MCP) 와 조건 도구는 실행 흐름이 달라 conversation-thread.md §1.1 의 표기가 오해를 유발할 수 있다. 조건 도구가 `ai_tool` source 로 push 된다면 별도 실행 경로가 필요하고, 그렇지 않다면 §1.1 표기를 "KB / MCP tool 결과" 로 수정해야 한다.
- **제안**: `conversation-thread.md §1.1` 의 `ai_tool` 행에서 "condition tool 결과" 를 제거하거나, 조건 도구가 `ai_tool` push 경로를 별도로 갖는지 명시. ai-agent.md §6.1 의 tool-loop 기술에도 조건 도구가 `ai_tool` source push 를 발생시키지 않음을 추가하면 drift 예방.

---

### [INFO] `button_click` interaction.data 의 `selectedItem?` 필드 — conversation-thread.md 에 미반영
- **target 위치**: `spec/conventions/node-output.md §4.5` — `button_click` data shape: `{ buttonId, buttonLabel, selectedItem? }`
- **충돌 대상**: `spec/conventions/conversation-thread.md §1.4` — `button_click` 행의 text(LLM-facing) 는 `clicked: <buttonLabel>` 만 언급; UI 카드 본문 컬럼도 `data.buttonLabel` (없으면 `data.buttonId`) 만 참조
- **상세**: node-output.md §4.5 에는 `button_click.data` 에 `selectedItem?` (선택한 아이템 정보) 가 있다. conversation-thread.md §1.4 의 LLM-facing text 생성 규칙과 UI 카드 본문 렌더 규칙 모두 `selectedItem?` 를 언급하지 않는다. LLM-facing text 에 `selectedItem` 를 포함할지, UI 카드에 어떻게 표시할지 명세가 없어 구현자 추측이 필요하다.
- **제안**: `conversation-thread.md §1.4` 의 `button_click` 행에 `selectedItem?` 가 있을 때 LLM-facing text 와 UI 카드 본문 렌더 규칙을 명시. 또는 "의도적으로 생략(LLM payload 에 불포함)" 임을 비고에 추가.

---

### [INFO] `render_form` 호출 후 `presentation_user` push 의 `via: 'ai_render'` sentinel — conversation-thread.md §1.4 표에 미반영
- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §6.2 단계 2.c` / `§6.1.d.ii` — `render_form` 제출 시 `presentation_user` source 로 push + `data.via: 'ai_render'` sentinel 박힘; `spec/conventions/node-output.md §4.5` — `form_submitted` data 에 `via?: 'ai_render'` 명시
- **충돌 대상**: `spec/conventions/conversation-thread.md §1.4` — `form_submitted` 행의 text(LLM-facing) 는 `name=John, age=30` (key=value 리스트, 200자 cap) 으로만 기술. `via: 'ai_render'` sentinel 에 대한 언급 없음
- **상세**: ai-agent.md 와 node-output.md 는 `render_form` 제출 데이터에 `via: 'ai_render'` sentinel 이 박힌다고 명시하나, conversation-thread.md §1.4 의 `form_submitted` LLM-facing text 변환 표에는 sentinel 존재 유무에 따른 분기가 없다. sentinel 이 LLM payload 에 노출될 경우 ("via=ai_render, name=John") prompt injection 표면 여부 검토가 필요하고, 노출되지 않을 경우에는 §1.4 표에 "sentinel 필드는 LLM text 변환 시 skip" 임을 명시해야 한다.
- **제안**: `conversation-thread.md §1.4` 의 `form_submitted` 행에 `via?: 'ai_render'` 필드의 LLM text 변환 처리 방침 명시. node-output.md §4.5 의 `form_submitted` 행 비고에도 "conversation-thread §1.4 의 LLM text 변환 시 `via` 필드는 skip" 등을 추가.

---

### [INFO] `meta.interactionType` 위치 — node-output.md 미정의
- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §7.4` JSON 예시 및 표 — `meta.interactionType: "ai_conversation"` / `"ai_form_render"`
- **충돌 대상**: `spec/conventions/node-output.md` — `meta` (Principle 2) 에 LLM 계열 공통 필드를 나열하나 `interactionType` 은 없음. LLM 계열 meta: `model`, `inputTokens`, `outputTokens`, `totalTokens`, `thinkingTokens?`, `toolCalls?`, `contextInjection?`
- **상세**: ai-agent.md 는 `meta.interactionType` 을 `"ai_conversation"` / `"ai_form_render"` 로 사용하며 이것이 run-results UI 의 conversation Preview 탭 식별자임을 명시한다. 그러나 node-output.md Principle 2 의 LLM 계열 meta 필드 목록에는 `interactionType` 이 없다. Principle 2 는 "실행 메트릭" 전용이므로 `interactionType` 이 Principle 2 의 범주에 해당하는지, 아니면 별도 분류인지 불명확하다.
- **제안**: `node-output.md Principle 2` LLM 계열 표에 `meta.interactionType?` 를 추가하고 "multi-turn blocking 노드에서 UI 탭 식별자 — `ai_conversation` | `ai_form_render`" 로 기술. 또는 ai-agent.md §7.4 표의 `meta.interactionType` 설명에 "Principle 2 의 메트릭이 아니라 UI routing 힌트" 임을 명시해 Principle 2 표 미포함 사유를 inline 설명.

---

### [INFO] `contextScope` 기본값 — conversation-thread.md §5 와 ai-agent.md §1 일치하나 `contextInjectionMode` 기본값 표기 차이
- **target 위치**: `spec/conventions/conversation-thread.md §5` — `contextInjectionMode` 기본값 `messages`
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §1` config 표 — `contextInjectionMode` 기본값 `messages`
- **상세**: 기본값 자체는 일치(`messages`). 그러나 conversation-thread.md §5 의 표에는 `contextScope` 의 기본값이 `none` 으로 명시되어 있고 ai-agent.md §1 도 `none` 으로 일치. 이 항목은 모순 없음 — INFO 수준으로 분류해 양 표의 동기화 상태를 확인용으로 기록.
- **제안**: 기본값이 변경될 경우 두 파일 모두 갱신해야 함을 주석으로 상호 cross-reference 추가 권장.

---

## 요약

세 파일(`conversation-thread.md`, `node-output.md`, `1-ai-agent.md`)은 전반적으로 높은 내부 일관성을 보인다. 데이터 모델(`ConversationTurn`), API 계약(NodeHandlerOutput 5-필드), 상태 전이(`waiting_for_input` → `resumed` → `ended`), RBAC 모델 및 계층 책임 분할 모두 다른 spec 영역과 명시적 모순이 없다. 발견된 4건은 모두 INFO 등급으로, (1) `ai_tool` source 의 조건 도구 포함 표기 모호성, (2) `button_click.selectedItem?` 의 LLM/UI 렌더 규칙 누락, (3) `render_form` 제출 시 `via: 'ai_render'` sentinel 의 conversation-thread §1.4 LLM text 변환 정책 미기술, (4) `meta.interactionType` 이 node-output.md Principle 2 목록에 미등재인 점이다. 어느 것도 구현 착수를 차단하는 모순이 아니나, 구현 중 ambiguity 로 인한 drift 를 예방하기 위해 해당 spec 행에 명시적 기술을 추가하는 것이 권장된다.

---

## 위험도

LOW
