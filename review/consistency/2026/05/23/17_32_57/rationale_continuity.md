# Rationale Continuity Check

**대상**: `plan/in-progress/render-form-submit-fix.md` (spec 변경 surface)

**평가 범위**: 본 작업의 새 결정 (form submission wire format sentinel) 이 기존 Rationale 라인 (`button.id` UUID backfill / `option.value` 결정적 backfill / `userMessage` 하이브리드 / Continuation Bus 분산 정책) 과 정합하는지.

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
| 1 | 본 작업의 §Rationale 단락은 PR #279 (`button.id` UUID backfill) 및 PR #285 (`option.value` 결정적 backfill) 의 (C) 안 "backend SoT 가드 + frontend defense-in-depth" 라인과 **동형 reasoning** — LLM/사용자가 emit 하는 free-form 데이터에서 dispatch/비교 휴리스틱이 silent failure 의 root cause. sentinel wrap 으로 명시화 | spec/4-nodes/6-presentation/0-common.md §Rationale | §Rationale 단락 안에 직전 두 결정과의 평행 reasoning 을 explicit 한 줄로 박으면 연속성 명확 (본 작업 의뢰의 §Rationale 항목에 이미 명시) |
| 2 | 본 작업의 결정은 **internal bus layer** 한정 — 외부 WS wire (`execution.submit_form` payload shape) 는 변경 없음. 이는 §10.7 ConversationThread 운반의 "외부 surface 와 internal layer 분리" 원칙과 동형 | spec/4-nodes/6-presentation/0-common.md §10.7 | §Rationale 에서 "외부 wire 호환 유지 (정합 §10.7 의 layer 분리 원칙)" 한 줄 cross-ref 권장 |
| 3 | Continuation Bus 의 메시지 타입 5종 (execution-engine §7.4 `continue / cancel / button_click / ai_message / ai_end_conversation`) — 본 작업은 **bus 메시지 타입 표는 변경하지 않음**. `'continue'` 메시지의 **payload** 안에 sentinel `{type:'form_submitted', formData}` 를 wrap. 이 layer 분리는 §7.4 의 "메시지 타입 vs 메시지 스키마 payload" 구조와 정합 | spec/5-system/4-execution-engine.md §7.4 | §Rationale 에 "execution-engine §7.4 의 bus 메시지 타입 표는 변경 없음 — payload 안 sentinel 만 도입" 한 줄 명시 권장 |
| 4 | handler fallback (pendingFormToolCall 미존재 시 plain user 메시지 push) 의 spec 화 — 본 결정의 reasoning 은 ai-agent §6.2 의 "사용자 응답 dispatch 가 단일 경로" 원칙과 정합. 현재 silent 동작을 spec 화 + warn log 의무는 "graceful degradation" (§12.4 ai-agent) 의 KB/MCP 격리 패턴과 동형 — surface 가 끊기지 않되 진단 메타로 surface | spec/4-nodes/3-ai/1-ai-agent.md §12.4 | ai-agent §6.2 step 2 (또는 §6.1.d.ii) 에 fallback 규약 명문 + Rationale 에 §12.4 graceful degradation 라인 cross-ref 권장 |
| 5 | PR #285 (`option.value` 결정적 backfill) 의 §Rationale "결정적 값인 이유" 라인 — LLM 후속 turn 에서 의미 인식 가능해야 함. 본 작업의 sentinel `{type:'form_submitted', formData}` 도 동일 원칙 — dispatch sentinel 은 의미가 명시적이고 LLM 후속 turn 에 tool_result 로 회신될 때도 `data: { … }` shape 그대로 회신됨 (이미 §6.2 step 2.c 에 박혀 있음) | spec/4-nodes/6-presentation/0-common.md §Rationale (PR #285) | 본 작업 §Rationale 에 cross-ref 권장 — "PR #285 결정과 정합" |

---

## Checker 종합

- **연속성**: 본 작업 §Rationale 단락이 PR #279·PR #285 의 결정 라인을 명시 cross-ref 하면 reasoning 연속성이 명확. 의뢰서의 §Rationale 항목에 "결정 근거 (silent collision 회피) + PR #285 `option.value` backfill 결정과 평행 reasoning" 이 이미 명시되어 있어 충족.
- **새 결정 vs 기존 라인 모순 없음**: 본 작업은 internal bus layer 한정 변경이라 외부 surface (WS wire / NodeOutput interaction / thread push) 의 기존 결정과 충돌하지 않음.
- **graceful degradation 원칙 적용**: handler fallback 의 spec 화 (warn log + plain user 메시지 push) 는 ai-agent §12.4 의 "KB/MCP 의 graceful degradation" 패턴과 동형.

---

## 위험도

**LOW** — Rationale 라인 끊김 없음. INFO 5건 모두 본 작업 §Rationale 단락 안에 cross-ref 한 줄씩 박으면 연속성 더 명확해지는 제안.
