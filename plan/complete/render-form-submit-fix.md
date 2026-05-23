---
worktree: render-form-submit-fix-3f10bf
started: 2026-05-23
owner: developer
---

# render_form submit 흐름 — silent failure + dispatch fragility 종합 수정

## 배경

사용자 보고 (2026-05-23): "form submit 을 하면 정상 동작을 하지 않는다."

worktree 분석 결과 root cause 3건:

| # | 영역 | 문제 | 위험도 |
|---|---|---|---|
| 1 | frontend | `submitForm` 가 WS 만 emit. `addConversationMessage` / `setWaitingAiResponse(true)` 없음 → submit 클릭 후 form 만 사라지고 0 frame visual feedback. 사용자 입장에서 "동작 안 함" | HIGH |
| 2 | backend | `waitForAiConversation` 의 dispatch 가 `!('type' in action)` 휴리스틱 — form 필드명이 `type` 인 페이로드는 silent drop. 빈 객체/null payload 도 TypeError 가능 | HIGH |
| 3 | backend | `pendingFormToolCall` 미존재 시 form JSON 이 plain user 채팅 메시지로 fallback (ai-agent.handler L1658 else 분기) | MED |

PR #285 (`fix(render-form): option.value collision`) 의 후속 — submit 단계의 흐름 견고화.

## 사용자 결정 (2026-05-23)

> 전체 한번에

→ S/A/C 3계층 + 테스트 전부 한 PR. follow-up 분리 없음.

## 변경 범위 (S/A/C 3축)

### (S) spec

- `spec/4-nodes/6-presentation/0-common.md`
  - §10.6 또는 §10.7 (또는 새 §10.9) 에 **form submission wire format** 명문화 — backend 의 continuationBus / `continueExecution` 가 `{type:'form_submitted', formData}` sentinel wrap 으로 publish 한다. raw formData 직접 publish 는 dispatch fragility 의 root cause 이며 폐기.
  - §Rationale 단락 1건 — dispatch wire format wrap 결정 근거 (PR #285 의 `option.value` collision 결정과 평행 — silent collision 패턴 일관 처리).
  - §9 CHANGELOG 2026-05-23 항목.
- `spec/4-nodes/3-ai/1-ai-agent.md`
  - §6.2 step 2 또는 §6.1.d.ii (render_form 흐름) 에 form submission round-trip 명세 보강 — `state.pendingFormToolCall` 누락 시 명시 fallback 규약 (현재 silent fallback → spec 화).
- `spec/5-system/6-websocket-protocol.md` (해당 시)
  - `execution.submit_form` payload shape 명문화. frontend 가 보내는 wire 와 backend `continueExecution` 의 internal wire 분리 — 외부 WS event 는 raw `{executionId, formData}` 유지, internal bus 는 sentinel wrap.

### (C) backend

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
  - `continueExecution(executionId, formData)` 가 bus 에 publish 하는 payload 를 `{type:'form_submitted', formData}` 로 wrap.
  - `registerContinuationHandlers` 의 `'continue'` listener 는 wrap 된 payload 를 그대로 resolvePending — 또는 unwrap 후 forward (decision).
  - `waitForAiConversation` 의 dispatch elif 를 `action.type === 'form_submitted'` 명시 매칭으로 변경. `!('type' in action)` 휴리스틱 제거. action.type 미매칭 케이스는 명시 warn log + loop 재진입 (현재 silent skip).
- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
  - `processMultiTurnMessage` 에서 `state.pendingFormToolCall` 미존재 시 form JSON fallback 분기에 explicit warning log + spec cross-ref 주석. 동작은 유지 (LLM 이 raw JSON 받아 reasoning) — 단 spec 화된 fallback 으로 명시.
- 테스트
  - `execution-engine.service.spec.ts` 또는 새 spec — form submit dispatch 매칭 / `type` 필드명 collision 회귀 / 빈 formData / null payload
  - `ai-agent.handler` — pendingFormToolCall 누락 fallback 경로

### (A) frontend

- `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts`
  - `submitForm(formData)` 에 다음 추가:
    - `addConversationMessage({ type: 'presentation', interactionType: 'form_submitted', data: formData, ... })` — chat 에 사용자 제출 즉시 표시
    - `setWaitingAiResponse(true)` — AI 응답 대기 스피너 활성화
    - WS ack 실패 시 (`error` callback) 두 작업 모두 롤백 + `toast.error`
  - `sendMessage` 의 optimistic UI 패턴을 form 에도 평행 적용 (spec §6.2 step 2 의 `presentation_user` turn 과 정합)
- 테스트
  - `use-execution-interaction-commands.test.ts` — submitForm 호출 시 store mutation 확인 / WS error rollback / WS ack success 동작

## TDD 체크리스트

- [x] (S) project-planner 위임 — §10.9 신설 + §Rationale + ai-agent §6.2 (commit `9da7df95`)
- [x] (S) `/consistency-check --spec` BLOCK:NO
- [x] (S) spec commit (`9da7df95`)
- [x] (impl-prep) `/consistency-check --impl-prep spec/4-nodes/` BLOCK:NO
- [x] (C) backend dispatch test 선작성
- [x] (C) backend continueExecution + dispatch + handler fallback 구현 (commit `57db2766`)
- [x] (C) backend test PASS (151/151)
- [x] (A) frontend test 선작성
- [x] (A) frontend submitForm optimistic UI 구현 (commit `033dca99`)
- [x] (A) frontend test PASS (13/13)
- [x] (8) TEST WORKFLOW — lint / unit 4560 / build / e2e 98 PASS
- [x] (9) REVIEW WORKFLOW — `/ai-review` + resolution-applier (review/code/2026/05/23/17_58_19) + spec 정합화 (commit `2de8d113`)
- [x] (10) PR 생성

## 결정 메모

- **wire format sentinel `{type:'form_submitted', formData}`**: `ai_message`/`button_click` 와 평행 구조. dispatch 가 명시적이고 검사 비용 동일.
- **frontend optimistic UI**: `sendMessage` 와 평행 — 일관된 UX 패턴.
- **pendingFormToolCall fallback**: spec 화 후 코드 주석에 cross-ref. 동작은 유지 (회귀 위험 회피).

## Follow-up (별 plan)

본 PR 안에서 모두 일괄 처리. ai-review 후속 spec 정합화도 본 PR commit chain 에 포함:

- `plan/complete/spec-fix-form-submission-w1-w2-w15.md` (W1/W2/W15 spec drift 정합 — commit `2de8d113`)

향후 강화 후보 (별 task, 본 PR scope 밖):

- 민감 폼 필드 마스킹 정책 (password 타입 → store data `'***'` 치환)
- WS ack 이벤트명 통일 (`execution.form_submitted` → `execution.submit_form.ack`)

## Closeout (2026-05-23)

본 worktree 작업 완료. commit chain:

- spec: `9da7df95` — §10.9 form submission wire format sentinel 신설
- backend dispatch: `57db2766` — `'continue'` listener wrap + dispatch 명시 매칭
- frontend optimistic UI: `033dca99` — submitForm presentation_user + spinner
- ai-review fix: `a67de956` + `323876aa` — SUMMARY#C1/W5~W15/I1~I10 일괄
- RESOLUTION: `f3121614` + `934d5cf9`
- spec 정합화: `2de8d113` — W1/W2/W15 invariant + fallback + SSOT 중복 제거

TEST 최종: lint PASS / unit **4560** PASS / build PASS / e2e **98** PASS.
PR: https://github.com/worker-ants/clemvion/pull/288
