---
id: interaction-type-registry
status: implemented
code:
  - codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts
  - codebase/backend/src/modules/execution-engine/execution-engine.service.ts
  - codebase/frontend/src/lib/conversation/conversation-utils.ts
  - codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts
  - codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts
---

# Interaction Type Registry

> 관련 문서: [Spec WebSocket Protocol §4.4](../5-system/6-websocket-protocol.md#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input) · [Spec AI Agent §6.1.d.ii](../4-nodes/3-ai/1-ai-agent.md) · [Spec Conversation Thread §1.1](./conversation-thread.md)

cross-cutting **enum 값** 의 단일 진실 + **처리 분기 위치 매트릭스**. enum 1개 값 추가 시 N개 위치를 동시 갱신해야 하는 문제를 spec/harness 양쪽에서 차단한다.

신규 enum 값은 본 문서 매트릭스에 반드시 등록한다 — 등록되지 않은 값을 코드에 추가하면 단위 테스트 `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` 가 hard fail.

---

## 1. WaitingInteractionType

backend `WaitingInteractionType` ([execution-engine §1.3](../5-system/4-execution-engine.md)) — 사용자 입력 대기 종류.

### 1.1 단일 진실 위치

| Side | 파일 | 정의 |
|---|---|---|
| Backend | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` | `type WaitingInteractionType = 'form' \| 'buttons' \| 'ai_conversation' \| 'ai_form_render'` |
| Frontend | `codebase/frontend/src/lib/stores/execution-store.ts` | `export type WaitingInteractionType = ...` (값 동일, 순서 동일) |

신규 값 추가 시 **두 위치를 동시 변경** + 본 §1.2 매트릭스에 행 추가.

> **내부 4값 ↔ EIA 외부 3값 매핑**: 위 `WaitingInteractionType` 은 **엔진 내부** 4값이다. EIA(External Interaction API) HTTP 외부 표면은 `ai_form_render` 를 `ai_conversation` 으로 통합해 **3값(`form` / `buttons` / `ai_conversation`)** 만 노출한다 — 이 4→3 통합은 **`chat-channel.dispatcher` 및 EIA 응답 DTO(`external-interaction/dto/responses.dto.ts`) 계층의 책임**이다. SoT: [EIA §6.2 페이로드](../5-system/14-external-interaction-api.md) · [channel-web-chat 아키텍처 §매핑](../7-channel-web-chat/0-architecture.md). 따라서 `3-workflow-editor/3-execution.md` · `0-canvas.md` 등 **내부 관점** 문서가 4값 전체를 열거하지 않더라도, 외부 표면 3값과 모순이 아니다 (관점 차이).

### 1.2 값 → 처리 분기 매트릭스

| Enum value | Backend emit 위치 | Frontend 처리 분기 (필수 N) |
|---|---|---|
| `form` | engine waiting emit `'form'` (form 노드 핸들러) | (a) `use-execution-events.handleExecutionResumed` (b) `handleWaitingForInput` 의 분기 (c) `apply-execution-snapshot.ts` 의 reconcile + waiting hydration + maybeSeed (d) `run-results-drawer.tsx` `isWaitingForm` (e) `executions/[id]/page.tsx` `isWaitingForm` (f) `result-detail.tsx` formPreview |
| `buttons` | engine waiting emit `'buttons'` (presentation 노드 + 버튼) | (a)~(e) 동등 + `pauseForButtons` |
| `ai_conversation` | ai-agent.handler multi-turn waiting (interactionType meta) | (a)~(f) 동등 + `pauseForConversation` + conversation timeline hydration |
| `ai_form_render` | ai-agent.handler 의 render_form blocking 진입 | (a)~(c) 동등 + `conversationConfig.pendingFormToolCall: { toolCallId, formConfig }` 동봉 + 위 ai_conversation 의 모든 hydration 경로 + (d) `result-detail.tsx` `isWaitingConversation` 분기 (별도 formPreview stack 아님) + (e) `executions/[id]/page.tsx` `isWaitingConversation` 분기 + (f) `AssistantPresentationsBlock` case `"form"` 의 active 분기 (`payload.toolCallId === pendingFormToolCall.toolCallId` 매칭 시 interactive `DynamicFormUI`, 그 외 `FormSubmittedContent`) + (g) `resumeFromAiRenderForm` (별도 신규 action — `pendingFormToolCall` 만 nested null patch, 나머지 affordance 보존). SoT: [AI Agent §6.1.d.ii / §12.5](../4-nodes/3-ai/1-ai-agent.md#125-render_form-활성-form-의-timeline-인라인-표현-통합) |

**규칙**:
1. 표의 모든 위치를 한 PR 안에서 동시 갱신.
2. exhaustive switch (`switch (value) { case ...; default: const _exhaustive: never = value }`) 패턴으로 TypeScript 컴파일러가 누락을 직접 fail 시킨다 (`codebase/frontend/src/lib/utils/exhaustive.ts` 의 `assertNever` 헬퍼 사용).
3. AST 가드 (`interaction-type-exhaustiveness.test.ts` 의 `REGISTRY_SITES`) 가 매트릭스의 모든 enum 값이 **등록된 grep 대상 파일**에 string literal 로 등장하는지 검증한다. 현재 `REGISTRY_SITES` 는 4개 파일 — `use-execution-events.ts` (위 (a)·(b)), `apply-execution-snapshot.ts` ((c)), `run-results-drawer.tsx` ((d)), `executions/[executionId]/page.tsx` ((e)). (f) `result-detail.tsx` formPreview / `AssistantPresentationsBlock` 은 grep 가드가 아니라 TS exhaustive `default: never` 로만 커버된다 (동작 drift 아님). switch 기반이 아닌 if/else·flag 파생 소비처를 잡기 위한 보조 가드이며, switch 누락은 rule 2 의 컴파일러 단계에서 별도로 fail 한다.

---

## 2. ConversationTurnSource

`source` enum — [`spec/conventions/conversation-thread.md` §1.1](./conversation-thread.md#11-conversationturnsource) 단일 진실. **frontend union 6개** (`presentation_user`, `ai_user`, `ai_assistant`, `ai_tool`, `system`, `system_error`); **backend 누적 enum 은 `system_error` 제외 5값** (`system_error` 는 frontend 가 WS 에러 이벤트로 합성하는 6번째 source — conversation-thread.md §1.1.1). 아래 매트릭스는 frontend 6값 기준이다.

### 2.1 처리 분기 매트릭스

| Enum value | UI 분기 위치 |
|---|---|
| `presentation_user` | `threadTurnsToConversationItems` 의 source switch · `ConversationTimelineItem` 의 🧩 카드 렌더 · spec §9.1 매핑표 |
| `ai_user` | 동일 함수 · 👤 user bubble |
| `ai_assistant` | 동일 함수 · 🤖 assistant bubble (presentations 부착 분기 포함) |
| `ai_tool` | 동일 함수 · 🔧 tool row |
| `system` | 동일 함수 · ℹ️ system note (v1 자동 push 없음 — 미리 분기 구현) |
| `system_error` | **AST 가드 대상 코드 파일** (test `SOURCE_REGISTRY_SITES` — grep 검증 대상은 `threadTurnsToConversationItems` switch 1개뿐): `codebase/frontend/src/lib/conversation/conversation-utils.ts`. **렌더 분기 (TS exhaustive 커버, grep 가드 비대상)**: 좌측 timeline chip 은 `ConversationTimelineItem` (`codebase/frontend/src/components/editor/run-results/conversation-timeline-item.tsx` 의 `item.type === "system_error"` 분기 — `result-timeline.tsx` 는 이 컴포넌트에 위임만, 자체 source 분기 없음), 우측 인스펙터는 `SelectedItemDetail` / `SystemErrorRow` (`codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx` — `[다시 시도]` 버튼 surface). **spec cross-ref (AST 가드 비대상)**: `conversation-thread.md §9.1` 매핑표 — ❌ 빨간 라인 + `<nodeLabel> · <code>` chip + `data.message` 본문 + `data.retryable === true` 시 `[다시 시도]` 버튼. |

`threadTurnsToConversationItems` 의 switch 는 이미 exhaustive `default: never` 패턴 적용됨 (`const _exhaustive: never = turn.source`). `system_error` 추가 시 새 case 명시 의무.

> **`execution.user_message` 와 `ConversationTurnSource`**: WS 이벤트 `execution.user_message` ([WebSocket §4.4](../5-system/6-websocket-protocol.md#44-실행-진행-이벤트)) 는 **신규 `ConversationTurnSource` 값을 추가하지 않는다** — optimistic user bubble 은 기존 `ai_user` 분기를 그대로 재사용한다. 이벤트 자체의 store 변환 책임은 frontend `use-execution-events` 의 신규 핸들러(store 의 `conversationMessages` 에 optimistic `ai_user` append, dedup by `receivedAt`)에 있으며, 변환 계약 SoT 는 [Conversation Thread §9.7](./conversation-thread.md#97-ws-이벤트--store-변환-계약). `WaitingInteractionType`(§1) 에도 영향 없다 — `user_message` 는 waiting 진입 이벤트가 아니라 진행 신호다.

---

## 3. Presentation type (`render_*` 도구 5종)

[Spec AI Agent §4.1·§7.10](../4-nodes/3-ai/1-ai-agent.md#41-presentation-tool-family-render_) 의 `PresentationType`. 값 5개 (`table`, `chart`, `carousel`, `template`, `form`).

### 3.1 단일 진실

| Side | 파일 | 정의 |
|---|---|---|
| Backend | `codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts` | `PRESENTATION_TYPES` const tuple + `PresentationType` 파생 |
| Frontend | `codebase/frontend/src/lib/conversation/conversation-utils.ts` | `PresentationType` (값 동일) |

### 3.2 처리 분기 매트릭스

| Enum value | Backend dispatch | Frontend 렌더 |
|---|---|---|
| `table` | `SCHEMA_BY_TYPE['table'] = tableNodeConfigSchema` (render-tool-provider) | `AssistantPresentationsBlock` 의 `TableContent` |
| `chart` | `SCHEMA_BY_TYPE['chart'] = chartConfigSchema` | `ChartContent` |
| `carousel` | `SCHEMA_BY_TYPE['carousel'] = carouselNodeConfigSchema` | `CarouselContent` |
| `template` | `SCHEMA_BY_TYPE['template'] = templateNodeConfigSchema` | `TemplateContent` |
| `form` | `SCHEMA_BY_TYPE['form'] = formNodeConfigSchema` | `AssistantPresentationsBlock` case `"form"` — active 분기 (`payload.toolCallId === pendingFormToolCall.toolCallId`) 면 interactive `DynamicFormUI`, 그 외 `FormSubmittedContent` (display-only) ([AI Agent §6.1.d.ii](../4-nodes/3-ai/1-ai-agent.md#61-single-turn-모드-mode--single_turn) — assistant turn timeline 인라인 단일 진실) |

신규 type 추가 시: backend `PRESENTATION_TYPES` 1줄 추가 → `SCHEMA_BY_TYPE` 1줄 추가 → frontend `PresentationType` union 추가 → `AssistantPresentationsBlock` switch 1 case 추가. exhaustive `default: never` 가 누락 차단.

---

## 4. Rationale

presentation tool family 도입 과정의 연속 회귀 (SchemaForm key 중복 + buildTools 가드, 실행 내역 렌더 / i18n / system prompt / 페이지 복귀) 는 **모두 동일 패턴**:

> "하나의 enum 값을 추가했는데 N개의 처리 분기 위치 중 일부를 빠뜨림"

사람의 working memory 로는 N=5~7 분기를 항상 동시에 다루기 어렵다. 본 컨벤션은:

1. spec 의 **매트릭스가 SoT** — 모든 분기 위치를 한 표로 응집.
2. **AST 가드** 가 매트릭스 vs 코드 grep 결과를 build 단계에서 비교 fail.
3. **TypeScript exhaustive switch** 가 컴파일러 단계에서 누락 fail.

이 3중 가드가 같은 패턴의 회귀를 영구히 차단한다.
