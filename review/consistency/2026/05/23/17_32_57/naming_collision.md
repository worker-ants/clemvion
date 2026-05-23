# Naming Collision Check

**대상**: `plan/in-progress/render-form-submit-fix.md` (spec 변경 surface)

**평가 범위**: 새로 도입되는 식별자 (sentinel `form_submitted` action.type) · 기존 SoT 와의 layer 분리 · 함수명/필드명 충돌.

---

## Critical 위배

없음.

---

## WARNING

없음.

---

## INFO

| # | 발견 | 위치 | 제안 |
|---|------|------|------|
| 1 | `'form_submitted'` 문자열 sentinel — 이미 3 layer 에서 사용됨: (A) NodeOutput `output.interaction.type` 4값 enum 의 한 값 (node-output §4.5) / (B) AI Agent tool_result content `{type:'form_submitted', data:{…}}` (ai-agent §6.2 step 2.c) / (C) DB `interaction_data.interactionType` enum (data-model §2.14). 본 작업이 추가하는 internal bus payload sentinel `{type:'form_submitted', formData}` 는 **새로운 4번째 layer** — 의도적 layer 분리 | (다층) | §10.9 본문에 4 layer 분리를 명문화 — internal bus 의 `type:'form_submitted'` 는 dispatch sentinel 한정. NodeOutput surface 의 `interaction.type` SoT 와 shape 동형이나 의미적으로 다른 layer 임을 명시 |
| 2 | `'ai_message'` / `'ai_end_conversation'` / `'button_click'` — `execution-engine §7.4` 의 Continuation Bus 메시지 타입 5종 (`continue / cancel / button_click / ai_message / ai_end_conversation`) 에 박혀 있음. 본 작업의 `waitForAiConversation` dispatch action.type 도 동명 사용. 단 layer 다름 — bus 메시지 type (외부 인터페이스) vs payload action.type (internal dispatch sentinel) | spec/5-system/4-execution-engine.md §7.4 | §10.9 본문에 두 layer 분리 명시 — bus 메시지 type 표는 변경 없음, payload action.type 만 도입 |
| 3 | `pendingFormToolCall` 식별자 — ai-agent §7.4 `_resumeState.pendingFormToolCall` invariant 와 §6.2 step 2 의 매칭 검증에 사용. 본 작업의 handler fallback 은 이 필드 누락 시 경로 — 명명 동일 사용 | spec/4-nodes/3-ai/1-ai-agent.md §6.2·§7.4 | 정합 — 기존 식별자 재사용 |
| 4 | 변경되는 함수명 — `continueExecution` / `waitForAiConversation` / `processMultiTurnMessage` / `registerContinuationHandlers` 모두 기존 함수명 유지. 본 작업은 함수 시그니처 변경 없이 dispatch 로직 내부만 변경 (sentinel wrap + 명시 매칭) | codebase/backend/src/modules/execution-engine/execution-engine.service.ts | 정합 |
| 5 | `'form_submitted'` literal — `internal bus action.type` 으로 사용 시 (A)(B)(C) 3 layer 의 동명 식별자를 모두 SoT 로 유지. 다 layer 간 의미 분리가 명시적이라 collision 아님. 단 spec 본문 명시 의무 | spec/4-nodes/6-presentation/0-common.md §10.9 (신설) | 4 layer 분리 표 또는 한 줄 명시 권장 |

---

## Checker 종합

- **새 식별자**: 본 작업이 도입하는 새 식별자는 internal bus payload sentinel `{type:'form_submitted', formData}` 한 케이스. 기존 enum 값 `'form_submitted'` 와 shape 동형이나 layer 분리.
- **함수명 collision**: 없음 — 모든 변경이 기존 함수 내부 로직 변경.
- **4 layer 의 동명 식별자 분리**: spec §10.9 본문에 명문화 의무 — naming_collision 가 아니라 의도적 alignment.

---

## 위험도

**NONE** — Naming collision 없음. INFO 5건 모두 동명 식별자의 layer 분리를 spec 본문에 명시하라는 가이드.
