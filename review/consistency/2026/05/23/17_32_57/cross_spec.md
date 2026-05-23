# Cross-Spec Consistency Check

**대상**: `plan/in-progress/render-form-submit-fix.md` (spec 변경 surface)

**평가 범위**: 본 작업의 spec 변경이 영향을 줄 가능성이 있는 cross-cutting 문서 (Presentation 공통 §10 / AI Agent §6.2 / WebSocket §4.2·§4.4 / Execution Engine §7.4 / node-output §4.5 / Conversation Thread).

---

## Critical 위배

없음.

---

## WARNING

없음.

---

## INFO

| # | 발견 | 위치 | 본 작업 영향 |
|---|------|------|--------------|
| 1 | `spec/5-system/4-execution-engine.md §7.4` "Continuation Bus" 표 — 메시지 타입 5종 (`continue / cancel / button_click / ai_message / ai_end_conversation`) 이 명시. `form_submitted` 는 본 5종에 **추가되지 않음** — 본 작업의 sentinel 은 `'continue'` 메시지 타입의 **payload** 안에 들어가는 `action.type` 이라 layer 가 다르다. | spec/5-system/4-execution-engine.md §7.4 | 기존 SoT 와 충돌 없음 (bus 메시지 type 표는 변경 불요). 본 작업의 §10.9 신설에서 이 layer 분리를 명문 cross-ref 하면 구현자 혼동 방지 |
| 2 | `spec/5-system/6-websocket-protocol.md §4.2` `execution.submit_form` payload `{ executionId, nodeId, formData, toolCallId? }` — frontend → backend WS wire 형식. 본 작업은 이 외부 wire 를 **변경하지 않음**. | spec/5-system/6-websocket-protocol.md §4.2 | 정합. 본 작업이 다루는 것은 internal continuationBus payload 만 (외부 wire ≠ internal bus 구조 분리) |
| 3 | `spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2.c` — form 제출 시 `tool_result content 는 {type:'form_submitted', data:{…}} JSON 직렬화로 채워져 LLM 이 다음 호출에서 본다` — 이미 sentinel `{type:'form_submitted', data:…}` shape 이 LLM-facing tool_result content 형식으로 명시. 본 작업의 internal bus sentinel 과 **shape 동형이나 layer 다름** (internal bus payload vs LLM tool_result content) | spec/4-nodes/3-ai/1-ai-agent.md §6.2 | 정합. 본 작업은 internal bus 의 sentinel 화로 dispatch fragility 를 제거하되 LLM-facing content 형식은 그대로 유지 |
| 4 | `spec/5-system/4-execution-engine.md §7` 흐름의 `output.interaction.type` 4값 (`form_submitted / button_click / button_continue / message_received`) — 본 작업이 다루는 internal bus action.type 4값 (`form_submitted / ai_message / ai_end_conversation / button_click`) 과 **부분 겹침이나 layer 다름**. 전자는 노드 output interaction surface (다운스트림·UI 가시), 후자는 engine 내부 dispatch sentinel (사용자·다운스트림 비가시) | spec/5-system/4-execution-engine.md §7 | 정합. §10.9 신설 시 두 layer 명시 분리 |
| 5 | `spec/conventions/conversation-thread.md §1.4` `presentation_user` 의 source — `form_submitted / button_click / button_continue` 시 thread push. 본 작업은 thread push 로직을 **변경하지 않음** — internal bus sentinel 도입은 dispatch 시점만 영향, thread push 는 handler 가 form 데이터 수신한 후 이루어짐 | spec/conventions/conversation-thread.md §1.4 | 정합 |
| 6 | `spec/4-nodes/3-ai/1-ai-agent.md §7.4` `_resumeState.pendingFormToolCall` invariant — `interactionType: 'ai_form_render'` 진입 ↔ `pendingFormToolCall` set 이 1:1. 본 작업의 handler fallback (pendingFormToolCall 미존재 시 plain user message) 은 본 invariant **위반 케이스의 사후 처리** — `render_form` 도구 없이 사용자가 직접 `execution.submit_form` 을 보낸 경우 또는 race condition 으로 발생 가능 | spec/4-nodes/3-ai/1-ai-agent.md §7.4 | ai-agent §6.2 step 2 (또는 §6.1.d.ii) 에 fallback 규약 명문화로 invariant 의 예외 처리를 spec 화 — 본 작업 의뢰의 (2) 항목과 정합 |

---

## Checker 종합

- **본 작업의 spec 변경 surface (3개)**:
  - `spec/4-nodes/6-presentation/0-common.md` §10.9 신설 + §Rationale + §9 CHANGELOG
  - `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 step 2 (또는 §6.1.d.ii) handler fallback 규약 명문화
  - `spec/5-system/6-websocket-protocol.md` §4.4 cross-ref (선택)
- **외부 cross-cutting 영향**: 없음 — 모든 변경이 internal layer 분리 명문화로, 외부 surface (WS wire / NodeOutput interaction / thread push) 의 shape 은 변경 없음.
- **`render_*` 동형 패턴**: PR #285 `option.value` collision + PR #279 `button.id` backfill 의 reasoning 라인과 동형 — LLM/사용자가 emit 하는 free-form 데이터에서 dispatch 휴리스틱이 silent failure 의 root cause. sentinel wrap 으로 명시화는 일관된 패턴.

---

## 위험도

**LOW** — Cross-cutting 변경 없음. INFO 6건 모두 본 작업 spec surface 가 외부 SoT 와 정합함을 확인.
