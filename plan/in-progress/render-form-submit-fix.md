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

- [ ] (S) project-planner 위임 — §10.6/7 wire format + §Rationale + ai-agent §6.2 fallback 규약
- [ ] (S) `/consistency-check --spec` BLOCK:NO
- [ ] (S) spec commit
- [ ] (impl-prep) `/consistency-check --impl-prep spec/4-nodes/`
- [ ] (C) backend dispatch test 선작성
- [ ] (C) backend continueExecution + dispatch + handler fallback 구현
- [ ] (C) backend test PASS
- [ ] (A) frontend test 선작성
- [ ] (A) frontend submitForm optimistic UI 구현
- [ ] (A) frontend test PASS
- [ ] (8) TEST WORKFLOW — lint / unit / build / e2e
- [ ] (9) REVIEW WORKFLOW
- [ ] (10) PR 생성

## 결정 메모

- **wire format sentinel `{type:'form_submitted', formData}`**: `ai_message`/`button_click` 와 평행 구조. dispatch 가 명시적이고 검사 비용 동일.
- **frontend optimistic UI**: `sendMessage` 와 평행 — 일관된 UX 패턴.
- **pendingFormToolCall fallback**: spec 화 후 코드 주석에 cross-ref. 동작은 유지 (회귀 위험 회피).

## Follow-up (별 plan)

없음 — 한 PR 안에서 일괄.
