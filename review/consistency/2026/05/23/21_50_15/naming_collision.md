# 신규 식별자 충돌 검토 — `ai-presentation-form-inline`

> 검토 대상: `plan/in-progress/ai-presentation-form-inline.md`
> 검토 시점: 2026-05-23
> 검토 모드: spec draft (--spec)

---

## 검토 범위

plan 이 도입하는 신규 식별자 목록:

| 분류 | 신규 식별자 |
|---|---|
| Store action | `resumeFromAiRenderForm` |
| Predicate 함수 | `isActiveFormCall(toolCallId)` |
| React prop | `waitingPendingFormToolCallId` |
| tool_result content type | `{type: 'cancelled', reason: 'user_sent_message_instead'}` |
| Invariant ID | `Inv-7` |
| 시나리오 ID | `CT-S12`, `CT-S13`, `CT-S14` |
| Spec 섹션 | `§12.5` (ai-agent), `§9.10 CT-S12/13/14` (conversation-thread) |

---

## 발견사항

### [INFO] `resumeFromAiRenderForm` — 신규 action 이름, 기존 `resumeFromForm` 과 명확히 구분됨

- target 신규 식별자: `resumeFromAiRenderForm`
- 기존 사용처: `codebase/frontend/src/lib/stores/execution-store.ts:449` — `resumeFromForm: () => set({ status: "running", ...CLEAR_INPUT_AFFORDANCE })`. `use-execution-events.ts`, `apply-execution-snapshot.ts`, `run-results-drawer.tsx`, `page.tsx` 에서 사용 중.
- 상세: 이름이 접두사 `resumeFrom` 을 공유하지만 `AiRenderForm` suffix 가 명확히 다른 의미(AI render_form 제출 후 partial-clear)를 나타낸다. 기존 `resumeFromForm` 은 그래프 form 노드 전용 full-clear, 신규 action 은 `pendingFormToolCall` 만 null patch — 의미 충돌 없음. spec 에도 이미 §9.7.1 표에 두 action 이 별개 행으로 나란히 정의됨.
- 제안: 이상 없음. 기존 `resumeFromForm` 과의 역할 분리가 spec 및 plan §3 "기각된 대안" 에 명시적으로 설명되어 있어 혼동 위험 낮음.

### [INFO] `{type: 'cancelled', reason: 'user_sent_message_instead'}` — 기존 `Execution.status = 'cancelled'` 와 namespace 분리됨

- target 신규 식별자: tool_result content shape `{type: 'cancelled', reason: 'user_sent_message_instead'}`
- 기존 사용처: `Execution.status` enum `'cancelled'` (`codebase/backend/migrations/V001__initial_schema.sql:220`, `codebase/frontend/src/lib/api/executions.ts:8`). 기존 `form_submitted` tool_result content type (`ai-agent.handler.ts:1633`).
- 상세: 세 위치가 모두 다른 layer 에 속한다. `Execution.status = 'cancelled'` 는 DB row 상태 enum, `{type: 'cancelled'}` 는 LLM tool_result content 내 JSON 키값, `form_submitted` 는 같은 tool_result content 의 정상 케이스 type. namespace 가 분리되어 런타임 충돌 없음. 다만 `form_submitted` vs `cancelled` 라는 두 type 값이 같은 JSON 구조 `{type, ...}` 를 공유하므로, 파싱 코드에서 exhaustive switch 를 통한 분기 필요.
- 제안: 이상 없음. form bypass 분기를 구현할 때 `ai-agent.handler.ts` 의 `processMultiTurnMessageInner` 내 tool_result content 분기 로직에 `type === 'cancelled'` 케이스를 명시적으로 처리해야 함을 구현 단계에서 확인할 것.

### [INFO] `CT-S12`, `CT-S13`, `CT-S14` — 기존 `CT-S11` 까지 순차 점유됨, 신규 번호 충돌 없음

- target 신규 식별자: `CT-S12`, `CT-S13`, `CT-S14`
- 기존 사용처: `spec/conventions/conversation-thread.md §9.10` — CT-S1 ~ CT-S11 이 이미 정의됨 (CT-S9/S10/S11 은 2026-05-23 직전 커밋에서 추가됨).
- 상세: spec 파일 확인 결과 CT-S12/S13/S14 는 이미 `spec/conventions/conversation-thread.md:543-545` 에 추가됨. 번호 충돌 없이 순차 부여됨. 특기 사항 없음.
- 제안: 이상 없음.

### [INFO] `Inv-7` — 기존 Inv-6 까지 순차 점유됨, 충돌 없음

- target 신규 식별자: `Inv-7`
- 기존 사용처: `spec/conventions/conversation-thread.md §9.9` — Inv-1 ~ Inv-6 이 정의됨. Inv-6 은 2026-05-23 이전 커밋에서 추가됨.
- 상세: Inv-7 은 `spec/conventions/conversation-thread.md:524` 에 이미 추가됨. 순차 부여, 충돌 없음.
- 제안: 이상 없음.

### [INFO] `§12.5` (ai-agent Rationale) — §12.4 까지 순차 점유됨, 충돌 없음

- target 신규 식별자: `§12.5 render_form 활성 form 의 timeline 인라인 표현 통합`
- 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md` §12.1 ~ §12.4 가 이미 존재. §12.4 는 "Presentation Tool Family 도입 (2026-05-22)".
- 상세: §12.5 는 `spec/4-nodes/3-ai/1-ai-agent.md:1156` 에 이미 추가됨. 순차 부여, 충돌 없음.
- 제안: 이상 없음.

### [INFO] `isActiveFormCall` — 신규 predicate 이름, codebase 에 미존재

- target 신규 식별자: `isActiveFormCall(toolCallId)` — `AssistantPresentationsBlock` 내 분기 predicate
- 기존 사용처: codebase 전수 검색 결과 없음. spec 본문에서만 개념적 명칭으로 등장.
- 상세: 구현 시 신규 함수로 추가되므로 충돌 없음. plan §4.4 에서는 inline predicate (`waitingConversationConfig.pendingFormToolCall.toolCallId === toolCallId` 체크) 로도 기술되어 있어 별도 named function 이 아닐 수 있음 — 구현 단계에서 결정.
- 제안: named function 으로 export 하는 경우 `isActiveAiRenderFormToolCall` 처럼 `Ai`/`AiRender` 접두사를 고려해도 좋으나 필수는 아님.

### [INFO] `waitingPendingFormToolCallId` — prop 이름, 기존 store 필드와 의미 연속성 있음

- target 신규 식별자: `waitingPendingFormToolCallId` — `AssistantPresentationsBlock` 의 신규 prop
- 기존 사용처: `codebase/frontend/src/lib/stores/execution-store.ts` 에 `waitingConversationConfig.pendingFormToolCall` (nested object) 로 존재. prop 은 해당 object 에서 `toolCallId` 를 추출한 derived scalar.
- 상세: store 의 `waitingConversationConfig.pendingFormToolCall.toolCallId` 에서 파생된 scalar prop. 명명 패턴이 길지만 충돌 없고 의미 명확.
- 제안: 이상 없음. 다만 `activeFormToolCallId` 등 더 짧은 이름도 고려 가능.

---

## 요약

target plan 이 도입하는 모든 신규 식별자 — `resumeFromAiRenderForm`, `isActiveFormCall`, `waitingPendingFormToolCallId`, `{type:'cancelled', reason:'user_sent_message_instead'}`, `Inv-7`, `CT-S12/S13/S14`, `§12.5` — 는 기존 사용 중인 식별자와 의미·네임스페이스 충돌이 없다. 가장 근접한 기존 식별자는 `resumeFromForm` (store action) 과 `Execution.status = 'cancelled'` (DB enum) 이나, 각각 suffix 와 layer 가 명확히 구분된다. spec 파일들은 이미 본 plan 의 §4.1 변경사항을 반영한 상태이고, 구현(codebase)에서는 아직 신규 식별자가 존재하지 않아 구현 단계에서 신규 추가로 처리된다. 충돌 위험은 없다.

---

## 위험도

NONE
