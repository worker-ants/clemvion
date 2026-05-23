# Cross-Spec 일관성 검토 결과

검토 모드: `--spec`
Target: `plan/in-progress/ai-presentation-form-inline.md`
검토 일시: 2026-05-23

---

## 발견사항

### 1. [CRITICAL] WS §4.4 `formConfig` 위치 — target 정의 vs 현행 spec 직접 모순

- **target 위치**: `plan/in-progress/ai-presentation-form-inline.md §2.7`, `§4.1 (spec/5-system/6-websocket-protocol.md §4.4 갱신 지시)`
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.4` (줄 334–337)
- **상세**:
  현행 WS spec §4.4 표는 다음과 같이 정의되어 있다.

  > `formConfig` | `interactionType = form` 또는 `ai_form_render` 시 **존재** (top-level)

  즉 `ai_form_render` 일 때도 `formConfig` 는 payload **최상위**에 위치한다. 그리고 `conversationConfig.pendingFormToolCall` 의 shape 는 `{ toolCallId }` 만이다 (`formConfig` 없음).

  target plan §2.7 은 이것을 뒤집어, `ai_form_render` 의 `formConfig` 를 `conversationConfig.pendingFormToolCall.formConfig` 안으로 nest 해야 한다고 결정한다. 이 변경이 spec 에 반영되기 전까지는 두 spec 문서가 `formConfig` 의 위치에 대해 정반대로 기술하게 된다.

  아울러 현행 AI Agent §7.4 는 `_resumeState.pendingFormToolCall` shape 를 `{ toolCallId: string, formConfig: object }` 로 정의하고 있다. 즉 **backend 내부 `_resumeState` 에는 `formConfig` 가 이미 존재**하지만, WS wire 로 클라이언트에 emit 되는 `waiting_for_input.conversationConfig.pendingFormToolCall` 에는 현행 spec 상 `{ toolCallId }` 만 있다. target plan 의 §1.2 ("코드가 `conversationConfig.pendingFormToolCall.formConfig` 를 읽는다") 는 코드가 이미 nest 형태로 동작한다는 사실을 적시하지만, 현행 WS spec 은 `formConfig` 가 top-level 에 있다고 선언한다.

  결론: target plan §4.1 이 WS spec §4.4 를 갱신하는 것이 목표지만, **갱신 전 현 시점에서 plan 내부의 "결정 §2.7"과 WS spec §4.4 표가 직접 충돌**한다. 갱신 후에는 WS spec §4.4 표(`formConfig` 행, `conversationConfig.pendingFormToolCall` 행)와 §4.4 예시 JSON 블록도 반드시 함께 갱신해야 한다.

- **제안**:
  `spec/5-system/6-websocket-protocol.md §4.4` 의 다음 두 행을 동시 갱신:
  1. `formConfig` 행: `interactionType = form` 시 top-level, `interactionType = ai_form_render` 시 `conversationConfig.pendingFormToolCall.formConfig` 위치임을 명시. 현행 "또는 `ai_form_render`" 통합 기술 제거.
  2. `conversationConfig.pendingFormToolCall` 행: shape 을 `{ toolCallId: string, formConfig: object }` 로 갱신 (현재 `{ toolCallId }` 만 기재됨).
  3. `ai_form_render` 의 JSON 예시 블록 (현재 없음) 추가 또는 기존 `ai_conversation` 예시 옆에 병기.

---

### 2. [WARNING] AI Agent §7.4 `_resumeState.pendingFormToolCall` shape vs WS spec §4.4 `conversationConfig.pendingFormToolCall` shape 비일관

- **target 위치**: `plan/in-progress/ai-presentation-form-inline.md §2.7`, §4.1
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §7.4` (줄 657) vs `spec/5-system/6-websocket-protocol.md §4.4` (줄 337)
- **상세**:
  AI Agent §7.4 는 `_resumeState.pendingFormToolCall` 을 `{ toolCallId: string, formConfig: object }` 로 정의한다.
  WS spec §4.4 는 `conversationConfig.pendingFormToolCall` 을 `{ toolCallId }` 만으로 기술한다 (formConfig 없음).
  현재 plan §1.2 에 따르면 실제 코드는 `conversationConfig.pendingFormToolCall.formConfig` 를 읽는다. 이는 WS spec 과 다르고 AI Agent §7.4 의 내부 shape 와는 일치한다.

  따라서 backend `_resumeState` 형태 (§7.4) 와 WS wire emit 형태 (§4.4) 가 스펙 상 다르게 기술되어 있는데, target plan 이 실제 코드 동작(`formConfig` 가 `pendingFormToolCall` 안에 있음)을 WS spec 에 반영하겠다는 의도이므로 갱신 방향 자체는 올바르다. 단, AI Agent §7.4 는 내부 상태(`_resumeState`)의 shape 이므로 WS wire 로 emit 되는 `conversationConfig.pendingFormToolCall` 과 동일 shape 로 간주해도 되는지 명시가 필요하다.

- **제안**:
  `spec/4-nodes/3-ai/1-ai-agent.md §7.4` 행의 `pendingFormToolCall` 비고에, 내부 `_resumeState.pendingFormToolCall.formConfig` 가 WS emit 시 `conversationConfig.pendingFormToolCall.formConfig` 로 노출됨을 cross-ref 추가. WS spec §4.4 갱신(발견 1)과 함께 처리.

---

### 3. [WARNING] `resumeFromAiRenderForm` 신규 action — Conversation Thread §9.7 store 변환 계약 누락

- **target 위치**: `plan/in-progress/ai-presentation-form-inline.md §2.3`, §4.4 (execution-store 신규 action 지시)
- **충돌 대상**: `spec/conventions/conversation-thread.md §9.7` (줄 448–450, WS 이벤트 → store 변환 계약 표)
- **상세**:
  Conversation Thread §9.7 표에는 `resumeFromForm` / `resumeFromButtons` / `resumeFromConversation` 3개의 "waiting 해제" action 이 정의되어 있다 (줄 465, 473). target plan §2.3 은 신규 action `resumeFromAiRenderForm` 을 추가하고, 이것이 `pendingFormToolCall` 만 클리어하고 나머지 affordance 를 보존한다고 결정한다. 그런데 §9.7 의 WS 이벤트 → store 변환 계약 표는 `waiting_for_input (interactionType=ai_form_render)` 행이 아직 없다 (target plan §4.1 이 신설하겠다고 명시하나, 해당 행의 REPLACE/APPEND 정책과 신규 action 의 affordance reset 범위가 명시되지 않음).

  `resumeFromConversation` 은 전체 affordance 를 클리어하고, `resumeFromAiRenderForm` 은 `pendingFormToolCall` 만 null 처리하면서 나머지 (`waitingInteractionType`, `waitingConversationConfig`, `waitingNodeId`, `isWaitingAiResponse: true`) 를 보존한다. 이 부분 클리어 정책이 Conversation Thread §9.7 표와 §9.10 회귀 시나리오에 명시되어야 한다.

- **제안**:
  Conversation Thread §9.7 표에 `waiting_for_input (interactionType=ai_form_render)` 행 추가 시, store action 이 `resumeFromAiRenderForm` 임을 명시하고, affordance reset 범위 (`pendingFormToolCall` 만 null, 나머지 보존) 를 표 비고에 기록. `resumeFromForm` (그래프 form 노드 전용, 전체 affordance 클리어) 와의 동작 차이도 inline 비고로 분리.

---

### 4. [WARNING] form bypass (§2.5) 결정 — WS spec `execution.submit_message` 와 `pending_form_tool_call` 상태의 교차 처리 미기술

- **target 위치**: `plan/in-progress/ai-presentation-form-inline.md §2.5`, §4.3 백엔드 구현
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.3 / §4.4` (명령 테이블, `execution.submit_message` 항)
- **상세**:
  현행 WS spec 는 `execution.submit_message` (일반 채팅)와 `execution.submit_form` (form 제출) 을 별도 명령으로 정의하며, `submit_form` 은 `pendingFormToolCall` 이 set 된 경우에만 유효하고 미일치 시 reject 라고 명시한다.
  target plan §2.5 는 `pendingFormToolCall` 이 set 된 상태에서 `submit_message` 가 들어오면 backend 가 cancelled tool_result 로 처리하고 일반 `ai_user` turn 으로 진행한다는 form bypass 결정을 추가한다. 이 분기는 현행 WS spec 에 전혀 기술되지 않았다. 특히 WS spec 의 `submit_message` 명령 행에는 `pendingFormToolCall` 상태에서의 예외 처리가 없고, cancelled tool_result content shape (`{type: 'cancelled', reason: 'user_sent_message_instead'}`) 도 spec 에 없다.

- **제안**:
  `spec/5-system/6-websocket-protocol.md` 의 `execution.submit_message` 명령 행에, `pendingFormToolCall` 이 set 된 컨텍스트에서 `submit_message` 수신 시의 bypass 처리를 cross-ref 추가 (`→ AI Agent §6.2 step 2.b` 등). AI Agent §6.2 에 step 2.b (form bypass: `submit_message` 수신 시 cancelled tool_result 채우고 `pendingFormToolCall` 클리어 후 일반 ai_user turn 진행) 를 신설.

---

### 5. [INFO] `FormSubmittedContent` 의 영구 history 잔존 — Conversation Thread §9.1 source 별 시각 매핑과 정합 확인 필요

- **target 위치**: `plan/in-progress/ai-presentation-form-inline.md §1.1 이슈 2`, §2.2, §2.8
- **충돌 대상**: `spec/conventions/conversation-thread.md §9.1` (source 별 시각 매핑 표)
- **상세**:
  target plan §2.8 은 "이전 turn 의 form payload 는 자동으로 'non-active' 가 되어 `FormSubmittedContent` 로 렌더"되고, "가장 최신 turn 의 active toolCallId 만 1개가 interactive" 라고 결정한다.
  현행 CT §9.1 표의 `ai_assistant` 행에는 `presentations[]` 안 `type='form'` payload 가 active/비활성 분기로 어떻게 렌더되는지 구체적 기술이 없다. target plan §4.1 이 §9.1 에 비고를 추가하겠다고 명시하므로 방향은 맞지만, 현재 시점에서 §9.1 이 침묵하고 있어 구현자가 참조할 기준이 없다.

- **제안**:
  `spec/conversations/conversation-thread.md §9.1` `ai_assistant` 행 비고를 spec 갱신 단계(§4.1)에서 반드시 추가. 내용: "presentations[] 안 `type='form'` 은 `pendingFormToolCall.toolCallId` 매칭 시 interactive `DynamicFormUI`, 그 외 `FormSubmittedContent` 로 렌더 — active form 의 단일 진실은 `AssistantPresentationsBlock` case 'form' 의 predicate."

---

### 6. [INFO] CT-S12/S13/S14 회귀 시나리오 추가 — CT §9.10 기존 시나리오 번호 충돌 여부 확인

- **target 위치**: `plan/in-progress/ai-presentation-form-inline.md §4.1 (conversation-thread.md §9.10 지시)`
- **충돌 대상**: `spec/conventions/conversation-thread.md §9.10`
- **상세**:
  target plan 이 CT-S12, CT-S13, CT-S14 를 신설한다고 명시한다. 현행 §9.10 에 이미 S12/S13/S14 번호가 사용 중인지 확인 필요. 기존에 해당 번호가 없다면 충돌 없음.

- **제안**:
  spec 갱신 전 현행 §9.10 에서 마지막 시나리오 번호를 확인하고, CT-S12 이상이 이미 존재하면 연번을 조정.

---

## 요약

target plan 이 제안하는 `render_form` 활성 form 의 timeline 인라인 통합은 전반적으로 기존 AI Agent, Conversation Thread, WS Protocol spec 의 설계 원칙(presentations[] 독립 필드, source 분리, _resumeState 1:1 invariant)과 일치한다. 다만 `formConfig` 위치에 대해 현행 WS spec §4.4 (`formConfig` 가 top-level에 있음)와 target plan §2.7 (nest 방식)이 직접 모순되어 CRITICAL 1건이 발생한다. 또한 신규 action `resumeFromAiRenderForm` 의 affordance reset 범위, form bypass 처리 경로(`submit_message` + cancelled tool_result)가 WS spec 및 CT §9.7 에 기술되지 않은 WARNING 2건이 있다. 이들은 모두 §4.1 spec 갱신 단계에서 함께 처리해야 한다.

---

## 위험도

**MEDIUM** — CRITICAL 1건(WS spec `formConfig` 위치 직접 모순)이 존재하나, target plan §4.1 의 spec 갱신 단계가 이 모순을 해소하는 작업임을 plan 내부에서 명시하고 있다. 갱신 순서(spec 먼저 → 구현 진입)를 plan §4.2(Consistency check 후 구현 진입) 가 강제하고 있으므로, spec 갱신 완료 전 구현에 진입하지 않는 한 실제 충돌은 차단된다. WARNING 2건은 명시적 우선순위 결정이 필요하나 기존 동작을 깨는 성격은 아니다.
