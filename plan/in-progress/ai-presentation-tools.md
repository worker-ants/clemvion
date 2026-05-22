---
worktree: ai-presentation-tools-9b7c5c
started: 2026-05-22
owner: ai-presentation-tools
---

# AI Agent presentation tool family (`render_*`)

> 사용자 합의 (2026-05-22): AI Agent (특히 multi-turn) 가 LLM 판단에 따라 일반 텍스트 응답 대신
> presentation 노드의 렌더링 방식을 tool calling 으로 호출할 수 있게 한다. 워크플로 그래프의
> 다른 노드로 연결하는 방식이 아니라 **AI 노드 세션 내부 가상 도구** 로 동작한다.

## 1. 배경

AI Agent 의 응답 surface 는 현재 텍스트 (`output.result.response`) + Conversation Thread `ai_assistant` 턴 한 가지뿐이다. Carousel/Table/Chart/Form/Template 같은 풍부한 표현은 별도 노드로 연결해야만 사용 가능하고, AI 가 "응답으로 표/차트를 보여줘야겠다" 라고 판단하더라도 시각화 결과를 만들 수단이 없다.

기존 tool-calling 인프라 (`cond_*` / `kb_*` / `mcp_*`) 가 이미 4-prefix 분류 패턴으로 자리 잡혀 있고, 일반 도구 (`tool_*`) 슬롯이 [plan/in-progress/ai-agent-tool-connection-rewrite.md](./ai-agent-tool-connection-rewrite.md) 의 결과를 기다리며 비어 있다. 본 작업은 그 슬롯 옆에 **표현 전담 `render_*` 가족** 을 신설한다 — `tool_*` 재작성과는 직교 (의도·schema 출처 모두 다름).

## 2. 결정사항 (사용자 명시 승인 2026-05-22)

1. **활성화 단위**: per-node opt-in. AI Agent config 신규 필드 `presentationTools[]` 가 비어 있으면 OFF (기본 OFF).
2. **Tool family 이름**: `render_*` prefix. 기존 4 prefix (`cond_/kb_/mcp_/tool_`) 와 동일 분류 패턴.
3. **노출 도구 5종 (1차 출시 동시)**:
   - `render_table`, `render_chart`, `render_carousel`, `render_template` — **display-only** (round-trip 불필요, tool_result 스텁 `{ok:true}`).
   - `render_form` — **interactive** (blocking, 사용자 제출 시 `presentation_user` source 로 thread push + LLM 재호출).
4. **Tool parameters schema**: 각 presentation 노드의 input schema (zod) 를 단일 진실로 재사용 (zod → JSON Schema 변환). 사용자가 `defaults?: Partial<Config>` 로 brand/style/buttons 같은 고정값 지정 가능 — LLM 은 데이터만 채움.
5. **멀티블록 응답 허용**: LLM 한 응답에서 텍스트 + 다중 `render_*` 호출 동시 출력 가능. (Anthropic/OpenAI 모두 multi tool_use block 지원.)
6. **종료 트리거 아님**: `render_*` 호출은 turn 종료 트리거가 아니다. display-only 는 tool_result 스텁 회신 후 LLM 이 turn 종료 결정. `cond_*` 와 공존 시 기존 우선순위 (조건 도구 우선) 유지.
7. **Schema 위반 처리**: tool_result 에 error 회신 → 재시도 1회 → 초과 시 텍스트 fallback (해당 turn 의 render 시도 폐기, `error` 포트가 아님).
8. **워크플로 분기 흉내 금지**: render 도구는 표현 전담. 노드 그래프 분기는 `cond_*` 가 담당.
9. **Output cap**: 기존 presentation 노드와 동일 1MB cap (`PRESENTATION_MAX_BYTES`) 적용.
10. **ConversationTurn 확장**: `presentations?: PresentationPayload[]` 를 **top-level 독립 필드** 로 신설 (`data?` 내부에 박지 않는다). 이유: `data?` 는 `output.interaction.data` 스냅샷 단일 진실 (`node-output §4.5`) — `presentations` 는 LLM tool call 결과로 채워지는 다른 의미이므로 separate field 가 drift 방지. `source: 'ai_assistant'` 일 때만 채워질 수 있다. Consistency check W-1, I-9 해소.
11. **WebSocket 이벤트**: 기존 `execution.ai_message` 누적 스냅샷에 `presentations?: PresentationPayload[]` 포함. `spec/5-system/6-websocket-protocol.md §4.4` 페이로드 정의 갱신. EIA `spec/5-system/14-external-interaction-api.md §6.5` SSE payload 도 동일하게 갱신. Consistency check W-4, I-13, I-14 해소.
12. **render_form blocking 의 interactionType**: `interactionType: 'ai_form_render'` 신규 값 (`'ai_conversation'` 과 별개). 클라이언트가 `execution.submit_form` 명령 분기 근거로 사용. WS spec §4.4 의 interactionType 표에 추가. Consistency check W-2 해소.
13. **`_resumeState.pendingFormToolCall` 필드**: `{ toolCallId: string }` 신규 필드를 `_resumeState` schema (ai-agent §7.4) 에 추가. multi-turn engine 이 다음 `submit_form` 수신 시 매칭 근거로 사용. Consistency check W-3 해소.
14. **`PresentationPayload` 단일 진실**: `{ type: 'table'|'chart'|'carousel'|'template'|'form', payload: object, toolCallId: string, renderedAt: string, truncation?: { itemsTruncated?: boolean, rowsTruncated?: boolean, itemsTotalCount?: number, rowsTotalCount?: number } }` 의 type 정의는 `spec/4-nodes/3-ai/1-ai-agent.md §7.10` 에 단일 정의 + `spec/conventions/conversation-thread.md §1.2` 에서 cross-ref. Consistency check I-12 해소.
15. **5-prefix dispatcher 분류 순서**: `cond_* → kb_* → mcp_* → render_* → tool_*` 순서로 §6.1 step 3a 갱신. Consistency check W-5 해소.
16. **`output.result.presentations` path 미사용**: presentations 의 SoT 는 ConversationTurn 의 top-level `presentations[]` 단일 위치. `output.result.*` 에 echo 하지 않는다 (Principle 1.1 직교성 — 같은 데이터를 두 위치에 두지 않음). 다운스트림은 `$thread.turns[*].presentations` 로 접근. Consistency check I-7 해소.
17. **`presentation_user` source 의 UI 분기**: AI render_form 출처와 그래프 presentation 노드 출처는 모두 `presentation_user` source 로 push 되며, AI render_form 출처는 `nodeId === aiAgentNodeId` + `data.via === 'ai_render'` sentinel 로 구분한다. UI 가 nodeLabel chip 을 다르게 렌더 (`<AI Agent 라벨> · form via AI render` vs `<form 노드 라벨> · form submitted`). Consistency check I-15 해소.

## 3. 기각된 대안

| 대안 | 기각 이유 |
|---|---|
| Thin slice 단계 분리 (table+chart 1차 → 나머지 2차) | 사용자가 "전부 동일 PR" 결정 (2026-05-22). 5 도구가 동일 패턴이라 patch 비용 차이가 미미하고, 2단계 출시는 schema·UI·문서가 2번 흔들림 |
| 워크스페이스 전역 토글 | 과금 추적·예측 가능성·노드 단위 정책 충돌. per-node opt-in 이 RBAC 와도 정합 |
| 다른 prefix 이름 (`view_*`, `present_*`) | 기존 4 prefix 와 음절 길이·의미 톤 정합. "render" 가 presentation 노드의 frontend 모듈명 (`presentation-renderers.tsx`) 과 직접 매핑되어 코드 추적 비용 최저 |
| Render 결과의 워크플로 분기 흉내 (버튼 클릭이 다음 노드로) | `cond_*` 의 책임 (분기) 과 중복. 역할 분리 명확화 — AI session 안의 표현 vs 노드 graph 의 분기 |
| Tool parameters 를 별도 schema 로 재정의 | drift 위험. 단일 진실 (presentation 노드 input schema) 재사용 |
| `tool_*` 재작성 안에 흡수 | 의도 다름 — `tool_*` 은 외부 노드 사이드이펙트 호출, `render_*` 은 AI 응답 surface 확장. config 입력 경로도 다름 (전자 미정, 후자 per-node opt-in 명시) |

## 4. 작업 단위

### 4.1 Spec 작성 (본 PR 1차 산출물)

- [x] `plan/in-progress/ai-presentation-tools.md` 작성 (본 문서)
- [x] `spec/4-nodes/3-ai/1-ai-agent.md` 갱신
  - §1 config 표: `presentationTools` 필드
  - §4 Tool Area 박스 아래 `render_*` 가족 신설 + dispatcher 5-prefix 분류 순서 명시 (#15)
  - §6.1 (single-turn) / §6.2 (multi-turn) 실행 로직: `render_*` 분류·dispatch·스텁·schema-violation retry·form blocking 흐름. interactionType `ai_form_render` 명시 (#12)
  - §7.4 `_resumeState` schema 에 `pendingFormToolCall` 추가 (#13)
  - §7.10 신설: top-level `presentations[]` 운반 + `PresentationPayload` type 단일 정의 (#14)
  - §10 에러 코드: 에러 코드 신설 X — `meta.presentationSchemaViolations[]` 단일 surface (#16)
  - §12 Rationale: per-node opt-in / 동시 5종 출시 / `tool_*` 슬롯 관계 / 기각된 대안
- [x] `spec/4-nodes/6-presentation/0-common.md` 갱신
  - 새 섹션 "AI tool 모드" — input schema 단일 진실 재사용, `defaults` overlay 규칙, 1MB cap 동일 적용, 다섯 도구의 종류·`render_form` interactive 차이. interactionType `ai_form_render` cross-ref (#12), `presentation_user` source 분기 (#17)
- [x] `spec/4-nodes/_product-overview.md` §6.1 AI Agent 요구사항 표에 ND-AG-26 (presentation tool family) 추가
- [x] `spec/4-nodes/3-ai/_product-overview.md` §3.2 동일 ND-AG-26 추가
- [ ] `spec/conventions/conversation-thread.md` §1.2 갱신
  - `ConversationTurn` 표에 top-level `presentations?: PresentationPayload[]` 행 추가 (data? 와 별개, #10)
  - 기존 §1.2 data? 행에 잘못 박혀있던 cross-ref 제거 (W-1 해소)
  - PresentationPayload 본문 정의는 ai-agent §7.10 단일 진실, 본 §1.2 는 cross-ref 만 (#14)
- [ ] `spec/5-system/6-websocket-protocol.md` §4.4 갱신 (#11, #12)
  - `execution.ai_message` payload 에 `presentations?: PresentationPayload[]` 추가
  - `execution.waiting_for_input` 의 `interactionType` enum 에 `'ai_form_render'` 값 추가 + `conversationConfig.pendingFormToolCall?: {toolCallId}` 메타 (클라이언트 분기 근거)
- [ ] `spec/5-system/14-external-interaction-api.md` §6.5 (또는 SSE payload 정의 섹션) 갱신 (#11)
  - SSE `execution.ai_message` 페이로드에 `presentations` 추가
- [ ] `spec/conventions/node-output.md` §4.5 갱신 (#17)
  - `form_submitted` shape 정의에 AI `render_form` 출처 변형 명시 — `data.via?: 'ai_render'` sentinel 한 줄 추가. 출처 분기 근거

### 4.2 Consistency check (spec 단계)

main Claude 가 `/consistency-check --spec` 호출. Critical 0 확인 후 구현 단계 진입.

### 4.3 백엔드 구현 (TDD)

- [ ] `ai-agent.schema.ts` — `presentationTools` zod 정의 (5 type enum + `defaults?: Partial<Config>`)
- [ ] `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` 신설
  - 5 도구 ToolDef 빌드 (presentation node schema → JSON Schema 변환 유틸 `zodToToolParams`)
  - `defaults` overlay 적용 (LLM 페이로드 ∪ defaults — defaults 가 LLM 입력을 override)
- [ ] dispatcher 분류 로직 (`ai-agent.handler.ts`):
  - `render_*` prefix 분류 (`renderToolProvider.matches()`)
  - display-only: zod validate → 1MB cap → push to `_resumeState.presentations` accumulator → tool_result `{ok:true}` 스텁
  - render_form: presentation/form handler 재사용 → `status:'waiting_for_input'`, `interactionType:'ai_conversation'` 유지하되 `_resumeState.pendingFormToolCall: {toolCallId}` 저장 → form 제출 시 `presentation_user` source 로 thread push + tool_result content 채워 LLM 재호출
  - schema 위반 → tool_result error → 재시도 1회 → 초과 시 silent drop + `meta.presentationSchemaViolations` 누적 (turn 종료 시 텍스트만 남음)
- [ ] ConversationTurn `data.presentations` 누적 + WS `execution.ai_message` 스냅샷 포함

### 4.4 프론트엔드 구현 (TDD)

- [ ] AI Agent 설정 패널 — `presentationTools` 다중 선택 UI (5 도구 체크박스 + 각 `defaults` JSON editor)
- [ ] chat UI (`SummaryView` / `ResultTimeline`) — `ai_assistant` 턴 데이터에 `presentations[]` 가 있으면 기존 `presentation-renderers.tsx` 컴포넌트 inline 렌더
- [ ] `render_form` blocking 케이스 — multi-turn waiting 형식에 form 카드 inline 렌더, 제출 시 `execution.submit_form` (기존 form 흐름 재사용)

### 4.5 테스트

- unit: zod schema validate / cap truncate / defaults overlay / dispatcher 분류 / schema 위반 retry+fallback
- integration: AI Agent multi-turn 안에서 `render_table` → text 응답 + chart inline. `render_form` blocking → 제출 → LLM 재호출
- e2e: ai-agent 멀티턴 + render_chart 1건 (PROJECT.md e2e 패턴)

### 4.6 유저 가이드 동반 갱신

- `codebase/frontend/src/content/docs/02-nodes/ai.{ko,en}.mdx` — `presentationTools` 설정 + render 도구 종류 + form blocking 흐름
- `codebase/frontend/src/content/docs/02-nodes/presentation.{ko,en}.mdx` — AI tool 모드 사용법 cross-link
- i18n dict KO/EN parity

### 4.7 코드 리뷰 + PR

- `/ai-review` 실행, 발견 사항 반영, 단일 PR 생성

## 5. 영향 받는 SoT 파일

| 파일 | 변경 |
|---|---|
| `spec/4-nodes/3-ai/1-ai-agent.md` | §1·§4·§6.1·§6.2·§7·§10·§12 |
| `spec/4-nodes/6-presentation/0-common.md` | "AI tool 모드" 섹션 신설 |
| `spec/4-nodes/_product-overview.md` | §6.1 ND-AG-26 추가 |
| `spec/4-nodes/3-ai/_product-overview.md` | §3.2 ND-AG-26 추가 |
| `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` | `presentationTools` 필드 |
| `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` | 신규 |
| `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` | dispatcher 분기 |
| `codebase/frontend/src/components/editor/run-results/.../SummaryView.tsx` | presentations inline 렌더 |
| `codebase/frontend/src/content/docs/02-nodes/ai.{ko,en}.mdx` | 사용자 가이드 |

## 6. 완료 조건

- `presentationTools: []` 인 기존 워크플로 무영향 (default OFF 검증)
- AI Agent + `presentationTools: ['table','chart']` 로 LLM 이 텍스트 + chart 동시 응답 → chat UI 에 둘 다 표시 + downstream 노드의 `output.result.response` 는 텍스트만 운반
- AI Agent + `presentationTools: ['form']` 로 LLM 이 form 호출 → `waiting_for_input` 진입 → 사용자 제출 → 다음 turn LLM 응답
- schema 위반 시 1회 재시도 후 fallback, AI Agent 는 `error` 포트로 흐르지 않고 정상 turn 으로 종료
