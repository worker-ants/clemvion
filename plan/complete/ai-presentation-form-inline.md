---
worktree: ai-presentation-form-inline-89a291
started: 2026-05-23
owner: project-planner
---

# AI Agent `render_form` 활성 form 의 timeline 인라인 표현 통합

> 사용자 합의 (2026-05-23): 기존 ai-presentation-tools 출시 (PR #273, #277-#288)
> 후 발견된 `render_form` 의 활성 단계 UX 3가지 회귀를 한 덩어리로 정리한다.
> 단일 진실은 "`render_form` 활성 단계의 UI 표면은 assistant turn 의 timeline
> 메시지 아이템" 이며, 이로부터 3가지 이슈가 자연스럽게 정리된다.
>
> 사용자 결정: (1) spec/구현/테스트/유저가이드 전체, (2) form 활성 중에도
> MessageInput 그대로 활성 (form 우회 허용).

## 1. 배경

`ai-presentation-tools` 의 `render_form` blocking flow 가 정식 출시된 뒤
(`spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii`, PR #273-#288) 사용자가 멀티턴
대화 중 `render_form` 활성 상태에서 다음 3가지 UX 회귀를 보고했다
(2026-05-23). 보고 시점의 코드 상태는 본 worktree base (main `27297176`) 와
동일.

### 1.1 보고된 이슈와 root cause

| # | 이슈 | Root cause |
|---|---|---|
| 1 | submit 직후 timeline 과 detail 이 모두 사라지고, AI 응답 완료 후 다시 표시 | `result-detail.tsx:853` `handleFormSubmit` 가 `commands.submitForm(data)` 로 optimistic presentation turn 추가 + `setWaitingAiResponse(true)` 호출 직후 `onFormSubmit() === resumeFromForm()` (`execution-store.ts:449`) 가 `set({ status: "running", ...CLEAR_INPUT_AFFORDANCE })` 로 `waitingNodeId / waitingInteractionType / waitingConversationConfig / isWaitingAiResponse` 를 한꺼번에 클리어 → `isWaitingConversation` / `isWaitingForm` 둘 다 false → `conversationPreview` 가 `isCompletedConversation` 으로 떨어지는데 server-side 는 아직 waiting → `result.status !== "completed"` → preview = `null` |
| 2 | submit 후에도 form 이 안 사라짐 | 두 surface 동작 차이. (a) run-results-drawer (`result-detail.tsx:1072`) 는 conversationPreview + formPreview vertical stack, resumeFromForm 후 둘 다 null 로 정상 사라짐. (b) execution-detail page (`executions/[executionId]/page.tsx:594-622`) 는 `isWaitingConversation` 이 먼저 매칭돼 ConversationInspector 만 그리고 `DynamicFormUI` 자체가 안 그려짐 — 거기 form 이 보인다면 assistant turn 의 `presentations[]` 안 `form` 페이로드가 `assistant-presentations-block.tsx:210` case `"form"` 에서 항상 `FormSubmittedContent` 로 영구 history 잔존하는 게 원인 |
| 3 | form 이 message input UI **아래** 에 위치해 부자연스러움 | `result-detail.tsx:1072-1078` 가 `[ConversationInspector(timeline+MessageInput)] → [DynamicFormUI]` 순으로 stack. ConversationInspector 의 MessageInput 이 form 위에 끼어 있음. 캐러셀이 `AssistantPresentationsBlock` 으로 assistant turn 안에 inline 되는 시각 패턴과 대조적 |

3가지가 같은 layer 의 동일 문제 — "`render_form` 활성 단계의 UI 표면이
timeline 메시지가 아니라 별도 surface" 이기 때문. timeline 메시지로 통합하면
1·2·3 모두 정리된다.

### 1.2 추가로 발견된 spec drift (본 작업과 함께 정리)

코드 vs spec 의 위치 mismatch — WS §4.4 spec 은 `pendingFormToolCall: { toolCallId }`
만 명시하지만 frontend (`page.tsx:387-392`, `run-results-drawer.tsx:287-293`)
는 `conversationConfig.pendingFormToolCall.formConfig` 를 읽어 form config 를
꺼낸다. 본 작업의 SoT 정합 단계에서 spec 표현을 코드 동작에 맞춰 명시한다
(formConfig 위치는 `pendingFormToolCall` 내부로 단일화).

## 2. 결정사항 (사용자 명시 승인 2026-05-23)

1. **단일 진실**: `render_form` 활성 단계의 UI 표면은 assistant turn 의
   timeline 메시지 아이템. 별도 surface 로 stack 하는 기존 패턴 폐기.
2. **활성 vs 제출 분기**: `AssistantPresentationsBlock` 의 `case "form":` 가
   다음 단일 predicate 로 분기:
   - `isActiveFormCall(toolCallId)` (해당 turn 의 form payload 가 현재 pending
     중인 `render_form` 도구 호출과 toolCallId 일치) → interactive
     `DynamicFormUI`
   - 그 외 (이미 제출 / 다른 toolCall) → display-only `FormSubmittedContent`
     (기존 동작 유지)
3. **store action 분리**: `resumeFromForm` 는 그래프 form 노드 (`interactionType: 'form'`)
   전용으로 유지. AI render_form 의 form 제출은 신규 action
   `resumeFromAiRenderForm` 을 사용 — pendingFormToolCall 만 클리어, 나머지
   conversation 상태 (`waitingInteractionType`, `waitingConversationConfig`,
   `waitingNodeId`) 와 `isWaitingAiResponse: true` 는 보존.
4. **MessageInput 그대로 활성** (사용자 선택 2026-05-23): form 활성 중에도
   사용자는 일반 텍스트 메시지를 보낼 수 있다. backend 의 form-bypass 처리는
   §3 결정.
5. **Form bypass 처리** (backend): `pendingFormToolCall` 가 set 된 상태에서
   `execution.submit_message` 가 들어오면 backend 는 (a) 그 render_form
   도구 호출의 tool_result content 를 `{type: 'cancelled', reason:
   'user_sent_message_instead'}` 로 채우고, (b) `pendingFormToolCall` 클리어
   후 (c) 일반 `ai_user` turn 흐름으로 진행. 이 시점 LLM 은 form 호출이
   취소됐다는 신호를 받고 다음 reasoning 에서 form 재호출 여부를 스스로 결정.
6. **두 surface 통합**: `result-detail.tsx` 의 별도 `formPreview` stack 과
   `executions/[id]/page.tsx` 의 `DynamicFormUI` 분기 모두 제거. form 활성/제출
   모두 ConversationInspector 안 timeline 메시지로 통합. 그래프 form 노드의
   기존 standalone form (`waitingInteractionType === "form"`) 은 영향 없음.
7. **`formConfig` 위치 단일화**: WS `execution.waiting_for_input` payload 의
   `formConfig` 는 `interactionType === 'form'` (그래프 form 노드) 에서만
   top-level. `interactionType === 'ai_form_render'` 의 경우 `conversationConfig
   .pendingFormToolCall.formConfig` 안으로 nest — spec drift 정리. type
   정의는 본 plan §4.1 의 spec 갱신에서 명시.
8. **다음 turn 의 form payload 시각 일관성**: 한 turn 에서 form 이 제출돼
   다음 LLM turn 으로 진입하면, 이전 turn 의 form payload 는 자동으로
   "non-active" 가 되어 `FormSubmittedContent` 로 렌더된다. assistant turn 이
   여러 turn 누적된 경우, 가장 최신 turn 의 active toolCallId 만 1개가
   interactive 로 보이고 나머지는 history.

## 3. 기각된 대안

| 대안 | 기각 이유 |
|---|---|
| MessageInput form 활성 중 hidden 또는 disabled | 사용자가 "그대로 활성 (form 우회 허용)" 선택 (2026-05-23). |
| `resumeFromForm` 분기 (`ai_form_render` 케이스만 보존) | 단일 action 에 두 의미 분기 → conditional set, 호출자가 어떤 컨텍스트인지 식별해야 함. 신규 action `resumeFromAiRenderForm` 으로 명시 분리가 더 명확. |
| `output.result.presentations[]` echo 에 active state 박기 | runtime state (어떤 toolCallId 가 pending) 는 backend `_resumeState` 에 보관 + WS 로 정상 운반. **클라이언트 predicate** (`payload.toolCallId === pendingFormToolCall.toolCallId`) 는 WS emit 경로의 정상 운반값 (waitingConversationConfig) 을 사용 — Principle 1.1 echo 예외가 아니라 echo 자체를 회피하는 단일 진실 운반. payload (NodeExecution outputData) 에 active 마커를 박는 것은 immutable history 와 mutable runtime state 의 의미 혼동. |
| Active form 을 별도 ConversationTurn source (`ai_form_pending`) 로 분리 | source enum 확장 영향 (Conversation Thread §1.1 + UI 5 source 매핑 + WS 마커 매핑 모두 갱신). `presentations[]` payload 안의 `type: 'form'` 이 이미 분류 정보를 들고 있고 active 여부는 별도 toolCallId match 로 판별 가능 — source 확장 불필요. |
| Form bypass 시 backend 가 자동 form 재호출 prompt 박기 | LLM 의 reasoning autonomy 침해. tool_result `cancelled` 신호만 주고 다음 행동은 LLM 결정에 맡김. |

## 4. 작업 단위

### 4.1 Spec 갱신

- [x] `spec/4-nodes/3-ai/1-ai-agent.md`
  - §6.1.d.ii: render_form blocking flow 의 frontend surface 정의 갱신 —
    "assistant turn 의 `presentations[*].form` 페이로드가 단일 진실이고,
    `pendingFormToolCall.toolCallId` 와 일치하는 turn 의 form 만 interactive
    렌더" 명시
  - §6.2 step 2: form bypass (사용자가 form 활성 중 일반 메시지 발송) 처리
    추가 — `pendingFormToolCall` 매칭하는 도구의 tool_result content 를
    `{type:'cancelled', reason:'user_sent_message_instead'}` 로 채우고
    `pendingFormToolCall` 클리어 후 정상 ai_user turn 진행
  - §7.4 `_resumeState.pendingFormToolCall` shape 갱신 — 이미 spec 상
    `{toolCallId: string, formConfig: object}` 로 정의됨. cancelled 흐름 시
    클리어 invariant 추가
  - §12 Rationale: §12.5 신설 — "form active 단계의 timeline 인라인 표현 통합
    (2026-05-23)" 결정 근거 (위 §2 의 8개 결정 요약 + 기각 대안)

- [x] `spec/4-nodes/6-presentation/0-common.md`
  - §10.6 Blocking vs Display-only — `render_form` 행에 "활성 form 의 UI
    표면은 assistant turn 의 `presentations[*].form` payload (`AssistantPresentationsBlock`
    case "form" 의 active 분기), `pendingFormToolCall.toolCallId` 매칭 시
    interactive `DynamicFormUI` / 그 외 `FormSubmittedContent`" 본문 보강
  - §Rationale 신설 — "render_form 활성 form 의 timeline 인라인 통합
    (2026-05-23)"

- [x] `spec/conventions/conversation-thread.md`
  - §1.2 `presentations?` 행 비고에 "`type: 'form'` payload 가 `ai_form_render`
    waiting 중인 경우 active form 의 UI 단일 진실 — assistant turn 의 timeline
    아이템 안에서 `pendingFormToolCall.toolCallId` 매칭 시 interactive 렌더"
    cross-ref 추가
  - §9.1 source 별 시각 매핑 — `ai_assistant` 행 비고에 "presentations[] 안
    type='form' 페이로드가 active 면 chat bubble 내 inline interactive form
    렌더" 추가
  - §9.7 WS 이벤트 → store 변환 계약 — `waiting_for_input (interactionType=ai_form_render)`
    행 신설: REPLACE 정책은 ai_conversation 과 동일하되 추가로 `pendingFormToolCall`
    저장
  - §9.7.1 store reset 정책 — `resumeFromAiRenderForm` 행 신설 (입력
    affordance reset: ❌ 미적용 — `pendingFormToolCall` 만 nested null patch,
    나머지 affordance 보존, conversation snapshot: ❌ 미적용)
  - §9.9 Inv-7 신설 — multi-turn 컨텍스트 보존 invariant
  - §9.10 회귀 차단 시나리오 — CT-S12, CT-S13, CT-S14 신설 (위 3 이슈 회귀
    방지)

- [x] `spec/5-system/6-websocket-protocol.md`
  - §4.4 `formConfig` 행 본문 정정 — `interactionType: 'form'` 시 top-level
    `formConfig`, `interactionType: 'ai_form_render'` 시 `conversationConfig
    .pendingFormToolCall.formConfig` (nest). spec drift 정리 — 본 변경은
    `ai-presentation-tools.md §2` 결정 #12/#13 의 spec drift 후속 정리
  - §4.4 `pendingFormToolCall` 행 추가 — shape `{ toolCallId: string,
    formConfig: object }`, cross-ref [AI Agent §7.4]
  - §4.2 `execution.submit_message` 행에 form bypass cross-ref 추가
    (`pendingFormToolCall` set + `submit_message` 수신 → cancelled tool_result
    fallback)
  - §Rationale "`ai_form_render` 의 `formConfig` 위치 단일화 — `pendingFormToolCall`
    안으로 nest (2026-05-23)" 신설

- [x] `spec/conventions/interaction-type-registry.md`
  - §1.2 `ai_form_render` 행 Frontend 처리 분기 목록 갱신 — `formPreview`
    stack 제거 / `AssistantPresentationsBlock` case "form" active 분기 신설 /
    `resumeFromAiRenderForm` action 추가 반영. SoT cross-ref `AI Agent §12.5`
    명시
  - §3.2 `form` Presentation type 행 렌더 설명 갱신 — "interactive blocking
    흐름은 별 경로" → "`AssistantPresentationsBlock` case "form" active 분기"
    로 SoT 통합

### 4.2 Consistency check (spec 단계)

main Claude 가 `/consistency-check --spec` 호출. Critical 0 확인 후 구현 단계
진입.

### 4.3 백엔드 구현 (TDD)

- [x] `ai-agent.handler` 의 `processMultiTurnMessage` form bypass 분기
  - `pendingFormToolCall` set + 일반 `submit_message` 수신 시 cancelled
    tool_result 채우고 normal ai_user turn 진행
  - unit: cancelled tool_result content shape, pendingFormToolCall 클리어
    invariant, LLM 재호출 messages 시퀀스
- [x] WS payload builder — `interactionType: 'ai_form_render'` 의 `formConfig`
  를 `pendingFormToolCall.formConfig` 안으로 nest (top-level `formConfig` 는
  `'form'` 한정). 기존 코드가 이미 그렇게 동작한다면 spec 만 따라잡으면 됨
  — `Read` 로 확인 후 결정.

### 4.4 프론트엔드 구현 (TDD)

- [x] `lib/stores/execution-store.ts`
  - `resumeFromAiRenderForm` action 신규 — `set({ status: 'running' })` 만
    적용 + `waitingConversationConfig.pendingFormToolCall: null` 패치 (deep
    clear 가 아닌 nested null), 나머지 affordance 보존. `isWaitingAiResponse`
    유지
- [x] `lib/websocket/use-execution-interaction-commands.ts`
  - `submitForm` 의 호출자가 ai_form_render 임을 식별할 수 있도록 시그니처
    유지 (formData 만). optimistic presentation turn 추가는 기존대로.
- [x] `components/editor/run-results/result-detail.tsx`
  - `conversationWithFormPreview` 별도 stack 제거. `formPreview` 는 `interactionType === 'form'`
    한정 (즉 그래프 form 노드 standalone form) 시에만 렌더.
  - `handleFormSubmit` 분기: `waitingInteractionType === 'ai_form_render'`
    면 `resumeFromAiRenderForm()`, 그 외 `onFormSubmit()` (기존 그대로)
- [x] `app/(main)/workflows/[id]/executions/[executionId]/page.tsx`
  - `isWaitingForm` 분기를 `interactionType === 'form'` 한정으로 축소.
    `ai_form_render` 는 ConversationInspector 만 렌더.
  - DynamicFormUI 의 별도 분기 제거.
- [x] `components/editor/run-results/renderers/assistant-presentations-block.tsx`
  - `case "form":` 가 `isActiveFormCall(toolCallId)` predicate 분기:
    - active → `<DynamicFormUI formConfig={p.payload} onSubmit={...} />`
    - 비활성 → 기존 `FormSubmittedContent`
  - predicate 는 `waitingConversationConfig.pendingFormToolCall.toolCallId === toolCallId`
    체크. SummaryView / SelectedItemDetail 양쪽에서 store selector 로 동일
    값 사용 (Inv-5 와 동형)
  - `onSubmit` prop 은 `useExecutionInteractionCommands.submitForm` 을 호출
    + `resumeFromAiRenderForm()` 호출
- [x] `components/editor/run-results/conversation-inspector.tsx`
  - `SelectedItemDetail` 의 assistant turn 에서 `AssistantPresentationsBlock`
    에 `waitingPendingFormToolCallId` prop 추가 (store selector)
  - `SummaryView` 의 assistant turn 카드도 동일하게 prop drill

### 4.5 테스트

- unit
  - `execution-store.test.ts`: `resumeFromAiRenderForm` 가 `waitingConversationConfig`
    의 다른 필드 보존 + `pendingFormToolCall` 만 null + `isWaitingAiResponse`
    보존 검증
  - `assistant-presentations-block.test.tsx`: case "form" + active toolCallId
    → DynamicFormUI 렌더, mismatch → FormSubmittedContent
  - backend `ai-agent.handler.test`: form bypass 시 cancelled tool_result
    content shape + pendingFormToolCall 클리어
- integration
  - AI Agent multi-turn → render_form → 사용자 제출 → 다음 turn AI 응답
    flow 에서 timeline 이 비지 않는지 (이슈 1 회귀 방지). live + history view
    양쪽
  - render_form 활성 중 사용자가 일반 메시지 발송 → backend 의 cancelled
    fallback → LLM 이 정상 turn 으로 진행 (이슈 4 — form bypass)
- e2e
  - ai-agent 멀티턴 + render_form 1건 (제출 후 timeline persist 확인,
    PROJECT.md e2e 패턴)

### 4.6 유저 가이드 동반 갱신

`PROJECT.md §변경 시 동반 갱신 매트릭스` 의 trigger 매칭:

- AI Agent multi-turn behavior 변경 → `codebase/frontend/src/content/docs/02-nodes/ai.{ko,en}.mdx`
  - "render_form 활성 form 의 위치" 섹션 갱신 — chat 메시지 안 inline 표시
  - form bypass 동작 ("form 활성 중 텍스트 보내면 form 호출이 취소되고
    일반 대화로 진행")
- Presentation 노드 공통 → `codebase/frontend/src/content/docs/02-nodes/presentation.{ko,en}.mdx`
  - 영향 없음 (그래프 form 노드 동작 무변경) — 명시 검토 후 통과

### 4.7 코드 리뷰 + PR

- `/ai-review` 실행, 발견 사항 반영, 단일 PR 생성

## 5. 영향 받는 SoT 파일

| 파일 | 변경 |
|---|---|
| `spec/4-nodes/3-ai/1-ai-agent.md` | §6.1.d.ii·§6.2·§7.4·§12.5 |
| `spec/4-nodes/6-presentation/0-common.md` | §10.6·§Rationale |
| `spec/conventions/conversation-thread.md` | §1.2·§9.1·§9.7·§9.10 |
| `spec/5-system/6-websocket-protocol.md` | §4.2·§4.4·§Rationale (formConfig 위치 + pendingFormToolCall shape + submit_message bypass + 위치 단일화 Rationale) |
| `spec/conventions/interaction-type-registry.md` | §1.2·§3.2 (ai_form_render 처리 분기 + form 렌더 설명) |
| `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` | form bypass 분기 |
| `codebase/backend/src/nodes/ai/ai-agent/__tests__/*.test.ts` | bypass 단위 테스트 |
| `codebase/frontend/src/lib/stores/execution-store.ts` | `resumeFromAiRenderForm` 신규 action |
| `codebase/frontend/src/components/editor/run-results/result-detail.tsx` | formPreview stack 제거 + ai_form_render 분기 |
| `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx` | DynamicFormUI 분기 제거 |
| `codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx` | case "form" active 분기 |
| `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx` | pendingFormToolCallId prop drill |
| `codebase/frontend/src/content/docs/02-nodes/ai.{ko,en}.mdx` | 활성 form 위치 + bypass 동작 |

## 6. 완료 조건

- `presentationTools: ['form']` 워크플로 — LLM 이 form 호출 시 chat timeline
  안 assistant 카드 inline 에 form 입력 UI 렌더. MessageInput 그대로 활성
- 사용자가 form 제출 → optimistic presentation_user turn 추가 → AI 응답 대기
  spinner 유지 → timeline 비지 않음 (이슈 1 회귀 방지)
- 응답 후 같은 form payload 가 `FormSubmittedContent` 로 history 위치에 유지,
  사라지지 않음 — 그러나 새로운 active form 호출 시 그 payload 만 interactive
  (이슈 2 정리)
- form 활성 중 사용자가 텍스트 메시지 발송 → backend 가 cancelled tool_result
  로 fallback → LLM 정상 응답 (이슈 4 — form bypass)
- 기존 그래프 form 노드 standalone 동작 무변경 (regression 0)
- live + history view 양쪽 모두 위 동작 일치
