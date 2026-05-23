# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음. 호출자 차단 불요.

---

## 전체 위험도

**LOW** — 5개 checker 모두 Critical/WARNING 발견 없음. 전체 23건의 INFO 항목은 spec 본문 작성 시 형식 가이드 및 cross-ref 명문화 권장으로, 차단 사유 없음.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

없음.

---

## 참고 (INFO)

아래 항목들은 중복 제거 후 통합. 동일 위치를 다수 checker 가 지적한 경우 가장 강한 표현으로 통합.

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec / Naming Collision | `'form_submitted'` 식별자가 4개 layer 에서 사용됨: NodeOutput `interaction.type` enum (node-output §4.5) / AI Agent tool_result content (ai-agent §6.2 step 2.c) / DB `interactionType` enum (data-model §2.14) / 본 작업 internal bus payload sentinel (신규). 의도적 layer 분리이며 collision 아님 — 단 명문화 의무 | spec/4-nodes/6-presentation/0-common.md §10.9 (신설) | §10.9 본문에 4 layer 분리 표 또는 명시 한 줄 추가. "internal bus 의 `type:'form_submitted'` 는 dispatch sentinel 전용 — NodeOutput interaction.type SoT 와 shape 동형이나 다른 layer" 명시 |
| 2 | Cross-Spec / Rationale Continuity | internal bus payload sentinel `{type:'form_submitted', formData}` 은 `'continue'` 메시지 타입의 payload 안에 들어감 — bus 메시지 타입 표 (execution-engine §7.4, 5종) 는 변경 없음. `action.type` (internal payload) vs bus `type` (외부 인터페이스) layer 분리가 명확하지 않으면 구현자 혼동 가능 | spec/5-system/4-execution-engine.md §7.4, spec/4-nodes/6-presentation/0-common.md §10.9 | §10.9 본문 및 §Rationale 에 "bus 메시지 타입 표 변경 없음 — payload action.type sentinel 만 추가" 한 줄 cross-ref. §Rationale anchor 권장명: `form-submission-wire-format-wrap-2026-05-23` |
| 3 | Rationale Continuity / Convention Compliance | ai-agent §6.2 step 2.c 직후 handler fallback 규약 미명문화 — `pendingFormToolCall` 누락 시 plain user 메시지 push + warn log 의무 (silent drop 금지). 현재 spec 에 없음 | spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2 | step 2.c 직후에 "handler fallback (pendingFormToolCall 누락 시): `_resumeState.pendingFormToolCall` 이 미존재 시 form JSON 데이터를 plain user 메시지로 thread push + warn log 의무. silent drop 금지." 추가. §Rationale 에 ai-agent §12.4 graceful degradation 라인 cross-ref |
| 4 | Rationale Continuity | §Rationale 에 PR #279 (`button.id` UUID backfill) 및 PR #285 (`option.value` 결정적 backfill) 와의 평행 reasoning 명시 부재 — 세 결정 모두 "LLM/사용자가 emit 하는 free-form 데이터에서 dispatch 휴리스틱이 silent failure root cause → sentinel/SoT 명시화" 동형 | spec/4-nodes/6-presentation/0-common.md §Rationale | §Rationale 신설 단락에 "PR #279·PR #285 의 결정 라인과 평행 reasoning — dispatch 휴리스틱 제거 공통 패턴" 한 줄 명시 |
| 5 | Convention Compliance | §10.9 신설 위치 — 기존 §10.1~§10.8 (AI Tool 모드 `render_*`) 연번 정합. §10.8 직후, 구분선 이전 삽입 | spec/4-nodes/6-presentation/0-common.md §10 | §10.8 직후 (구분선 이전) 에 §10.9 삽입. §9 CHANGELOG 항목: `2026-05-23 | §10.9 신설 — form submission wire format sentinel 도입` |
| 6 | Convention Compliance | WS protocol §4.2 `execution.submit_form` 행에 internal bus sentinel 연결 cross-ref (선택 항목) | spec/5-system/6-websocket-protocol.md §4.2 | (선택) §4.2 `execution.submit_form` 행 비고에 "internal bus 는 `{type:'form_submitted', formData}` sentinel wrap (presentation 공통 §10.9)" 한 줄 추가 |
| 7 | Plan Coherence | `execution-engine.service.ts` 동시 편집 경합 가능성 — 본 작업 (C) 구현 착수 전 다른 in-progress plan 의 해당 파일 편집 여부 재확인 필요 | codebase/backend/src/modules/execution-engine/execution-engine.service.ts | 현 시점 spec 변경 surface 한정 충돌 없음. (C) 구현 착수 직전 `consistency-check --impl-prep` 재실행으로 경합 재확인 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | Critical/WARNING 없음. INFO 6건 — `'form_submitted'` 4 layer 분리 명문화, bus 메시지 타입 표 변경 불요 확인, 외부 WS wire 정합 확인 |
| Rationale Continuity | LOW | Critical/WARNING 없음. INFO 5건 — PR #279·#285 평행 reasoning cross-ref 권장, handler fallback graceful degradation 라인 연결 권장 |
| Convention Compliance | LOW | Critical/WARNING 없음. INFO 7건 — §10.9 삽입 위치·CHANGELOG 형식·Rationale anchor 명명 가이드 |
| Plan Coherence | LOW | Critical/WARNING 없음. INFO 6건 — spec 동시 편집 경합 없음. `ai-presentation-tools.md` 잔여 항목과 surface 직교 확인 |
| Naming Collision | NONE | Critical/WARNING 없음. INFO 5건 — 함수명 collision 없음. 동명 식별자 `'form_submitted'` layer 분리 의도적 — spec 명문화만 필요 |

---

## 권장 조치사항

BLOCK 사유 없음. spec 작성 시 아래 순서로 반영 권장.

1. (필수) `spec/4-nodes/6-presentation/0-common.md` §10.9 신설 — §10.8 직후 삽입. 본문에 4 layer 분리 표 포함. bus 메시지 타입 표 변경 없음 명시. cross-ref: ai-agent §6.2 / execution-engine §7.4 / node-output §4.5 / WS §4.2.
2. (필수) `spec/4-nodes/6-presentation/0-common.md` §Rationale 신설 — anchor `form-submission-wire-format-wrap-2026-05-23`. PR #279·PR #285 평행 reasoning 한 줄. "외부 wire 호환 유지 (§10.7 layer 분리 원칙)" 한 줄. "bus 메시지 타입 표 변경 없음 (execution-engine §7.4)" 한 줄.
3. (필수) `spec/4-nodes/6-presentation/0-common.md` §9 CHANGELOG — `2026-05-23 | §10.9 신설` 항목 추가.
4. (필수) `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 step 2 fallback 명문 — step 2.c 직후 pendingFormToolCall 누락 시 plain user 메시지 push + warn log 의무 한 줄 추가.
5. (선택) `spec/5-system/6-websocket-protocol.md` §4.2 cross-ref — `execution.submit_form` 행 비고에 sentinel cross-ref.
6. (C) 구현 착수 직전 `consistency-check --impl-prep` 재실행으로 `execution-engine.service.ts` 동시 편집 경합 재확인.
