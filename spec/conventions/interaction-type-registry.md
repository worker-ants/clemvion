---
id: interaction-type-registry
status: implemented
code:
  - codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts
  - codebase/backend/src/modules/execution-engine/execution-engine.service.ts
  - codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts
  - codebase/backend/src/modules/execution-engine/button-interaction.service.ts
  - codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts
  - codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts
  - codebase/backend/src/modules/execution-engine/waiting-surface-guard.ts
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

> **내부 4값 ↔ EIA 외부 3값 매핑**: 위 `WaitingInteractionType` 은 **엔진 내부** 4값이다. EIA(External Interaction API) HTTP 외부 표면은 `ai_form_render` 를 `ai_conversation` 으로 통합해 **3값(`form` / `buttons` / `ai_conversation`)** 만 노출한다 — 이 4→3 통합은 **`chat-channel.dispatcher` 및 EIA 응답 DTO(`external-interaction/dto/responses/execution-status-response.dto.ts`) 계층의 책임**이다. SoT: [EIA §6.2 페이로드](../5-system/14-external-interaction-api.md) · [channel-web-chat 아키텍처 §매핑](../7-channel-web-chat/0-architecture.md). 따라서 `3-workflow-editor/3-execution.md` · `0-canvas.md` 등 **내부 관점** 문서가 4값 전체를 열거하지 않더라도, 외부 표면 3값과 모순이 아니다 (관점 차이).
>
> **또 다른 3값 소비처 — publisher 표면 가드**: continuation 명령 사전 검증(`waiting-surface-guard.ts` 의 `WaitingSurface` = `form`/`buttons`/`ai_conversation`)도 같은 4→3 통합의 소비처다 — `ai_form_render` 를 `ai_conversation` 으로 흡수해 "대기 표면별 허용 명령 집합"(§1.3)을 판정하고, 불일치 시 `INVALID_EXECUTION_STATE` 로 거부한다. SoT: [실행 엔진 §7.5.1](../5-system/4-execution-engine.md#751-publisher-측-사전-검증--invalid_execution_state). `WaitingSurface`(3값, 명령 허용 판정)는 `WaitingInteractionType`(4값, 처리 분기)의 **파생 뷰**이지 별도 enum SoT 가 아니다.

### 1.2 값 → 처리 분기 매트릭스

| Enum value | Backend emit 위치 | Frontend 처리 분기 (필수 N) |
|---|---|---|
| `form` | engine waiting emit `'form'` (form 노드 핸들러) | (a) `use-execution-events.handleExecutionResumed` (b) `handleWaitingForInput` 의 분기 (c) `apply-execution-snapshot.ts` 의 reconcile + waiting hydration + maybeSeed (d) `use-result-detail-waiting.ts` `deriveFlags` 의 `isWaitingForm` (에디터 drawer·실행 상세 page 공용 — 두 소비처가 hook 에 위임) (e) `result-detail.tsx` formPreview |
| `buttons` | engine waiting emit `'buttons'` (presentation 노드 + 버튼; via `ButtonInteractionService` — C-1 분할 후 엔진 위임) | (a)~(d) 동등 (`deriveFlags` 의 `isWaitingButtons`) + `pauseForButtons` |
| `ai_conversation` | ai-agent.handler multi-turn waiting → `AiTurnOrchestrator.emitAiWaitingForInput` (interactionType meta; C-1 분할 후 엔진 위임) | (a)~(d) 동등 (`deriveFlags` 의 `isWaitingConversation`) + (e) 동등 + `pauseForConversation` + conversation timeline hydration |
| `ai_form_render` | ai-agent.handler 의 render_form blocking 진입 → `AiTurnOrchestrator.emitAiWaitingForInput` (C-1 분할 후 엔진 위임) | (a)~(c) 동등 + `conversationConfig.pendingFormToolCall: { toolCallId, formConfig }` 동봉 + 위 ai_conversation 의 모든 hydration 경로 + (d) `use-result-detail-waiting.ts` `deriveFlags` 의 `isWaitingConversation` 로 흡수 (별도 formPreview stack 아님 — drawer·page 공용) + (e) `AssistantPresentationsBlock` case `"form"` 의 active 분기 (`payload.toolCallId === pendingFormToolCall.toolCallId` 매칭 시 interactive `DynamicFormUI`, 그 외 `FormSubmittedContent`) + (f) `resumeFromAiRenderForm` (별도 신규 action — `pendingFormToolCall` 만 nested null patch, 나머지 affordance 보존). SoT: [AI Agent §6.1.d.ii / §12.5](../4-nodes/3-ai/1-ai-agent.md#125-render_form-활성-form-의-timeline-인라인-표현-통합) |

**규칙**:
1. 표의 모든 위치를 한 PR 안에서 동시 갱신.
2. exhaustive switch (`switch (value) { case ...; default: const _exhaustive: never = value }`) 패턴으로 TypeScript 컴파일러가 누락을 직접 fail 시킨다 (`codebase/frontend/src/lib/utils/exhaustive.ts` 의 `assertNever` 헬퍼 사용).
3. AST 가드 (`interaction-type-exhaustiveness.test.ts` 의 `REGISTRY_SITES`) 가 매트릭스의 모든 enum 값이 **등록된 grep 대상 파일**에 string literal 로 등장하는지 검증한다. 현재 `REGISTRY_SITES` 는 3개 파일 — `use-execution-events.ts` (위 (a)·(b)), `apply-execution-snapshot.ts` ((c)), `use-result-detail-waiting.ts` ((d) — 에디터 drawer·실행 상세 page 가 공유하는 `deriveFlags` 단일 파생 site). (e) `result-detail.tsx` formPreview / `AssistantPresentationsBlock` 은 grep 가드가 아니라 TS exhaustive `default: never` (switch) 로만 커버된다 (동작 drift 아님). drawer 의 잔여 `isLiveConversation`(ai_conversation·ai_form_render 2값만 구분) 은 **exhaustive 분기가 아닌 subset 소비처**(plain `||` 비교, switch·`assertNever` 아님)라 두 가드(grep·TS exhaustive) 어느 쪽도 아니며, 신규 enum 값은 여기서 자동으로 non-live 로 처리된다 — isLiveConversation 이 의도적으로 "live AI turn" 2값만 구분하는 binary 이므로 허용된다(신규 blocking AI 타입 추가 시 함께 점검). switch 기반이 아닌 if/else·flag 파생 소비처를 잡기 위한 보조 가드이며, switch 누락은 rule 2 의 컴파일러 단계에서 별도로 fail 한다.

> **재개(resume) turn 라우팅 진입점 (backend)**: 위 "Backend emit 위치" 열은 *최초 waiting 진입* 기준이다. park 후 **재개** 시 `form`/`buttons`/`ai_conversation` turn 라우팅은 `driveResumeAwaited`(top-level)·`driveResumeFrame`(중첩) 양쪽에서 단일 진입점 `dispatchResumeTurn`(ordered `resumeTurnRegistry`, first-match-wins: form → buttons → ai_conversation, `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts`)으로 일원화돼 있다. `ai_form_render` 는 별도 registry 항목이 아니라 **`ai_conversation` AI turn 경로(`isAiConversation`)를 공유**해 재개되고, frontend 측 affordance 정리는 별도 `resumeFromAiRenderForm` action 이 맡는다(위 §1.2 매트릭스 `ai_form_render` 행 (f) 참조). 새 blocking 노드 타입은 registry 항목 1개 등록으로 plug-in 되므로, §1.1 enum 추가 시 이 registry 도 함께 점검한다 (enum 신규 추가 아님 — 매트릭스 완전성 보강). SoT: [execution-engine §7.5](../5-system/4-execution-engine.md).

> **최초 park 진입(park-entry) dispatch 라우팅 (backend)**: 위 "Backend emit 위치" 열의 *최초 waiting 진입* 분기는 `runExecution`(메인 루프)·`executeInline`(중첩 sub-workflow)·`runNodeDispatchLoop`(retry/resume 드라이브) **세 곳**에서 단일 진입점 `dispatchParkEntry`(ordered `parkEntryRegistry`, first-match-wins: form → buttons → ai_conversation, `codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts`)으로 일원화돼 있다 — resume 측 `dispatchResumeTurn`(위 노트)과 대칭(M-4). `form` 은 핸들러 metadata(`getMetadata().interaction === 'form'`)로, `buttons`/`ai` 는 런타임 cached `meta.interactionType`(`getInteractionType`)로 선택한다. `ai_form_render` 는 별도 registry 항목이 아니라 `ai_conversation` 항목이 함께 매칭해 `waitForAiConversation` 경로를 공유한다(resume 측 `isAiConversation` 정책과 동일). 세 사이트는 선택 로직만 공유하고 `PARK_RELEASED` 후 control-flow 반응은 사이트별로 다르므로(메인 루프 = bare `return`, 중첩 = `ParkReleaseSignal` throw, 드라이브 = `{ parked: true }`) registry 는 `ProcessTurnResult` 만 반환하고 escape 는 호출측이 유지한다. 새 blocking 노드 타입은 `buildParkEntryRegistry` factory 에 항목 1줄 등록으로 plug-in. SoT: [execution-engine §7.5](../5-system/4-execution-engine.md).

---

## 2. ConversationTurnSource

`source` enum — [`spec/conventions/conversation-thread.md` §1.1](./conversation-thread.md#11-conversationturnsource) 단일 진실. **frontend union 7개** (`presentation_user`, `ai_user`, `ai_assistant`, `ai_tool`, `system`, `system_error`, `rag`); **backend 누적 enum 은 `system_error`·`rag` 제외 5값** — 둘 다 frontend 합성 source 다 (`system_error` 는 WS 에러 이벤트로 — §1.1.1, `rag` 는 `meta.turnDebug[].ragSources` 로 — §1.1.2). 아래 매트릭스는 frontend 7값 기준이다.

### 2.1 처리 분기 매트릭스

| Enum value | UI 분기 위치 |
|---|---|
| `presentation_user` | `threadTurnsToConversationItems` 의 source switch · `ConversationTimelineItem` 의 🧩 카드 렌더 · spec §9.1 매핑표 |
| `ai_user` | 동일 함수 · 👤 user bubble |
| `ai_assistant` | 동일 함수 · 🤖 assistant bubble (presentations 부착 분기 포함) |
| `ai_tool` | 동일 함수 · 🔧 tool row |
| `system` | 동일 함수 · ℹ️ system note (v1 자동 push 없음 — 미리 분기 구현) |
| `system_error` | **AST 가드 대상 코드 파일** (test `SOURCE_REGISTRY_SITES` — grep 검증 대상은 `threadTurnsToConversationItems` switch 1개뿐): `codebase/frontend/src/lib/conversation/conversation-utils.ts`. **렌더 분기 (TS exhaustive 커버, grep 가드 비대상)**: 좌측 timeline chip 은 `ConversationTimelineItem` (`codebase/frontend/src/components/editor/run-results/conversation-timeline-item.tsx` 의 `item.type === "system_error"` 분기 — `result-timeline.tsx` 는 이 컴포넌트에 위임만, 자체 source 분기 없음), 우측 인스펙터는 `SelectedItemDetail` / `SystemErrorRow` (`codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx` — `[다시 시도]` 버튼 surface). **spec cross-ref (AST 가드 비대상)**: `conversation-thread.md §9.1` 매핑표 — ❌ 빨간 라인 + `<nodeLabel> · <code>` chip + `data.message` 본문 + `data.retryable === true` 시 `[다시 시도]` 버튼. |
| `rag` | **AST 가드 대상 코드 파일** (test `SOURCE_REGISTRY_SITES`): `codebase/frontend/src/lib/conversation/conversation-utils.ts` — `mergeRagRetrievalItems` 가 `meta.turnDebug[].ragSources` 에서 합성하고, `threadTurnsToConversationItems` 의 exhaustive switch 에도 **`rag` case 명시 의무** (아래 주석). **렌더 분기 (TS exhaustive 커버, grep 가드 비대상)**: 좌측 timeline 은 `ConversationTimelineItem` (`conversation-timeline-item.tsx` 의 `item.type === "rag"` 분기 — `result-timeline.tsx` 는 위임만), 우측 인스펙터는 `SummaryView` 의 `RagRetrievalRow` — `SelectedItemDetail` 도 **같은 `RagRetrievalRow` 를 재사용**한다 (별도 detail 컴포넌트 없음: 행 자체가 문서명+청크 수를 담고 청크 본문은 References 탭이 SoT 라 중복 정의를 피한다 — Inv-9) (`conversation-inspector.tsx`). **spec cross-ref (AST 가드 비대상)**: `conversation-thread.md §9.1` 매핑표 — 🔎 점선 라인 + `KB · <N> chunk(s)` chip + 문서명 목록, References 탭 점프. `ai_tool`(🔧 실선 카드) 과 §9.2 3중 신호로 구분. |

`threadTurnsToConversationItems` 의 switch 는 이미 exhaustive `default: never` 패턴 적용됨 (`const _exhaustive: never = turn.source`). `system_error` 추가 시 새 case 명시 의무.

> **`rag` 도 switch case 를 갖는다 (`system_error` 와 동일)**: `rag`·`system_error` 는 wire (`conversationThread.turns`, backend enum 5값) 에 실려오지 않지만 **둘 다 `ConversationTurnSource` 유니온의 값**이므로, `threadTurnsToConversationItems` 의 `const _exhaustive: never = turn.source` 패턴이 **컴파일 타임에 case 를 강제**한다. 실 도달하지 않는 방어 case 이며 — 실제 `rag` item 은 후처리 병합 `mergeRagRetrievalItems` 가 만든다 (conversation-thread.md §9.11). 유니온에서 빼면 그 함수의 반환 타입이 `ConversationItem['type']` 과 어긋나므로 유니온에 두는 편이 정합이다.

> **`execution.user_message` 와 `ConversationTurnSource`**: WS 이벤트 `execution.user_message` ([WebSocket §4.4](../5-system/6-websocket-protocol.md#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input)) 는 **신규 `ConversationTurnSource` 값을 추가하지 않는다** — optimistic user bubble 은 기존 `ai_user` 분기를 그대로 재사용한다. 이벤트 자체의 store 변환 책임은 frontend `use-execution-events` 의 신규 핸들러(store 의 `conversationMessages` 에 optimistic `ai_user` append, dedup by `receivedAt`)에 있으며, 변환 계약 SoT 는 [Conversation Thread §9.7](./conversation-thread.md#97-ws-이벤트--store-변환-계약). `WaitingInteractionType`(§1) 에도 영향 없다 — `user_message` 는 waiting 진입 이벤트가 아니라 진행 신호다.

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

## 4. AI 노드 `endReason` — **패키지가 SoT** (가드 비대상)

`endReason` 은 위 세 enum 과 **같은 문제 계열**이다 — backend 가 선언하고 frontend 가 소비하는 cross-cutting 값 도메인이고, 실제로 `error`·`condition` 누락으로 **대화 미리보기 탭이 사라지는 회귀가 두 번** 났다 (PR #959).

**그러나 해법이 다르다.** 위 세 enum 은 "매트릭스 + AST 가드 + exhaustive switch" 로 **사본을 감시**하지만, endReason 은 **사본 자체를 없앴다**:

| | |
|---|---|
| **SoT** | [`@workflow/ai-end-reason`](../../codebase/packages/ai-end-reason/) — `AiAgentEndReason` / `InformationExtractorEndReason` / 파생 `ConversationEndReason` + 런타임 배열 `CONVERSATION_END_REASONS` |
| **강제 방식** | 패키지 내부의 `satisfies`(배열 ⊆ 유니온) + `Exclude`(유니온 ⊆ 배열). 어느 노드 유니온에 값이 추가되면 **패키지 컴파일이 깨진다** |
| **매트릭스** | **불필요** — 소비처가 패키지를 import 하므로 "N곳에 흩어진 분기" 자체가 없다 |
| **AST 가드** | **불필요** — grep 할 사본이 없다 |

**두 유니온을 합치지 않는 이유**: IE 는 `condition` 라우팅이 없고 대신 `completed`·`max_retries` 를 갖는다. 합치면 각 노드의 종결 의미가 흐려지므로, 각자 유니온을 유지하고 소비자용 **파생 유니온**만 만든다.

> **왜 이 문서에 적는가**: 본 문서는 "cross-cutting enum 누락" 문제의 거버넌스 진입점이다. endReason 이 다른 메커니즘을 쓴다는 사실이 여기 없으면, 다음 사람이 같은 문제를 발견했을 때 **매트릭스에 endReason 이 없는 것을 누락으로 오인**하거나 중복 가드를 만든다.

> **경계**: 값의 **의미·port 매핑** 은 [AI Agent §7](../4-nodes/3-ai/1-ai-agent.md) · [Information Extractor](../4-nodes/3-ai/3-information-extractor.md), 출력 **봉투 구조** 는 [node-output.md](./node-output.md) 가 소유한다 — 패키지는 **값 도메인**만.

---

## 5. Rationale

presentation tool family 도입 과정의 연속 회귀 (SchemaForm key 중복 + buildTools 가드, 실행 내역 렌더 / i18n / system prompt / 페이지 복귀) 는 **모두 동일 패턴**:

> "하나의 enum 값을 추가했는데 N개의 처리 분기 위치 중 일부를 빠뜨림"

사람의 working memory 로는 N=5~7 분기를 항상 동시에 다루기 어렵다. 본 컨벤션은:

1. spec 의 **매트릭스가 SoT** — 모든 분기 위치를 한 표로 응집.
2. **AST 가드** 가 매트릭스 vs 코드 grep 결과를 build 단계에서 비교 fail.
3. **TypeScript exhaustive switch** 가 컴파일러 단계에서 누락 fail.

이 3중 가드가 같은 패턴의 회귀를 차단한다.

> **강도 정정 (2026-07-17 실측)**: 옛 문구는 *"영구히 차단한다"* 였으나 그 표현은
> 과장이었다. ③ 은 정상 동작하나 — `threadTurnsToConversationItems` 의
> `const _exhaustive: never = turn.source` 가 실제로 `rag` 추가를 컴파일 차단했다
> — **② 의 선결 조건이 무너져 있었다**:
>
> - ② 는 목록(`ENUM_VALUES` / `SOURCE_ENUM_VALUES`) 의 각 값이 각 사이트에
>   등장하는지 grep 한다. **그 목록이 타입과 일치한다는 전제** 위에서만 의미가 있다.
> - 그 전제를 지키라고 놓였던 `const _typecheck: ReadonlyArray<T> = VALUES` 는
>   **`VALUES ⊆ 타입` 만 검사**해 타입에 값이 추가돼도 통과했다 (주석은 반대로
>   주장). 게다가 그 단언이 살던 파일이 **테스트 파일**이라
>   `tsconfig.json` 의 `src/**/__tests__/**` exclude 에 걸려 **tsc 가 아예 읽지
>   않았다** — 명백한 타입 에러를 넣어도 0건 보고. 즉 그 축은 **약한 게 아니라
>   부재**였다.
>
> **해소**: 목록을 tsc 가 읽는 소스 모듈
> [`lib/conversation/interaction-type-registry.ts`](../../codebase/frontend/src/lib/conversation/interaction-type-registry.ts)
> 로 옮기고, `satisfies`(목록 ⊆ 타입) + `Exclude`(타입 ⊆ 목록) 로 **양방향**을
> 잠갔다. 두 방향 모두 mutation 주입으로 red 전환을 실측 확인했다.
>
> **교훈**: 가드는 "있다" 가 아니라 **"깨뜨려 봤다"** 로만 신뢰할 수 있다. 이
> 문서가 보증을 쓸 때는 그 보증이 실측된 것인지 함께 적는다.
