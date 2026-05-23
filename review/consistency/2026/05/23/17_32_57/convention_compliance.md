# Convention Compliance Check

**대상**: `plan/in-progress/render-form-submit-fix.md` (spec 변경 surface)

**평가 범위**: Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) · CHANGELOG 형식 · cross-ref 형식 · CONVENTIONS Principle 1.1 / 4.5 / 7 정합.

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
| 1 | 본 작업의 §10.9 신설 — `0-common.md` 의 기존 §10.1~§10.8 (AI Tool 모드 `render_*`) 연속 번호와 정합. §10.8 직후 위치가 자연스러움 | spec/4-nodes/6-presentation/0-common.md §10.9 (신설) | §10.8 직후 (line 357 직전, --- 구분선 이전) 에 신설 |
| 2 | §9 CHANGELOG 형식 — 표 컬럼 (`일자 / 변경`) 기존 형식 유지. 본 작업 항목은 `2026-05-23 | §10.9 신설 — form submission wire format sentinel ...` 형식 | spec/4-nodes/6-presentation/0-common.md §9 | 정합 |
| 3 | §Rationale anchor — 기존 anchor 들 (`button-id-backfill-도입-2026-05-23` / `form-option-value-backfill-2026-05-23` / `file-타입-metadata-only-2026-05-23` / `render_-클릭-user-message-하이브리드-합성-2026-05-23`) 와 동형 명명 권장. `form-submission-wire-format-wrap-2026-05-23` 형식 | spec/4-nodes/6-presentation/0-common.md §Rationale | 본 작업 신규 단락 제목: `### form submission wire format wrap (2026-05-23)` 형식 (한국어·소문자·연도 suffix) |
| 4 | ai-agent §6.2 step 2 (또는 §6.1.d.ii) 의 fallback 규약 명문 — 기존 step 2.c 의 "tool_result content 는 `{type:'form_submitted', data:{…}}` JSON 직렬화로 채워져 LLM 이 다음 호출에서 본다 + `_resumeState.pendingFormToolCall` 클리어" 직후에 한 줄 추가. invariant 예외 처리이므로 §6.2 step 2 본문에 박는 것이 자연스러움 | spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2 | step 2.c 직후에 "**handler fallback (pendingFormToolCall 누락 시)**: `_resumeState.pendingFormToolCall` 이 미존재 (예: 사용자가 `execution.submit_form` 을 `render_form` 없이 직접 보냄, 또는 race condition) 시 form JSON 데이터를 plain user 메시지로 thread 에 push + warn log 의무. silent drop 금지." 형식 |
| 5 | CONVENTIONS Principle 1.1.4 (판별자 금지) — 본 작업의 internal bus payload sentinel `{type: 'form_submitted', formData}` 의 `type` 키는 **internal dispatch sentinel** 로 외부 surface (NodeOutput / WS wire / thread) 에 누설되지 않음. Principle 1.1.4 는 NodeOutput 의 "판별자 type 키 금지" 라 본 작업과 layer 다름 — 위배 아님 | (해당 없음) | 정합 |
| 6 | CONVENTIONS Principle 4.5 (`interaction.type` 4값) — `form_submitted` 는 이미 enum 에 포함. 본 작업의 internal bus action.type 의 `'form_submitted'` 와 동일 문자열이지만 layer 다름 (internal vs NodeOutput interaction surface). 두 layer 의 의미 분리는 §10.9 신설 본문 + §Rationale 에 명시 권장 | spec/conventions/node-output.md §4.5 | 정합 — 별도 변경 불요 |
| 7 | spec/5-system/6-websocket-protocol.md §4.4 cross-ref — 본 작업의 의뢰 (3) 항목 (선택). 추가 시 §4.4 의 `submit_form` payload shape (`{executionId, formData}`) "외부 wire 호환 유지" 한 줄을 박을 위치는 §4.4 표의 `formConfig` 비고 또는 §4.2 표의 `submit_form` 행 비고 | spec/5-system/6-websocket-protocol.md §4.2 / §4.4 | (선택) 추가 시 §4.2 의 `execution.submit_form` 행에 "internal bus 는 `{type:'form_submitted', formData}` sentinel wrap (presentation 공통 §10.9)" 한 줄 추가 |

---

## Checker 종합

- **Spec 3섹션 구성**: 본 작업의 변경은 (Overview 변경 없음) / 본문 §10.9 신설 / Rationale `### form submission wire format wrap (2026-05-23)` 신설 / §9 CHANGELOG 항목 — 3섹션 구성 정합.
- **CHANGELOG 형식**: 정합.
- **cross-ref 형식**: §10.9 본문이 §10.7 (ConversationThread 운반), execution-engine §7.4 (Continuation Bus), ai-agent §6.2 step 2 (handler 흐름), node-output §4.5 (interaction.type SoT) 를 cross-ref 하면 단일 진실 그래프 정합.
- **Principle 정합**: 1.1.4 / 4.5 / 7 모두 정합 — 본 작업의 sentinel 은 internal layer 한정으로 외부 surface 에 누설되지 않음.

---

## 위험도

**LOW** — Convention 위배 없음. INFO 7건 모두 본 작업 spec 본문 작성 시 형식 가이드.
