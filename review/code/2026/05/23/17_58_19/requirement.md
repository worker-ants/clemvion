# Requirement Review — render_form submit 흐름 종합 수정

**대상 파일**: `execution-engine.service.ts` / `execution-engine.service.spec.ts` / `use-execution-interaction-commands.ts` / `use-execution-interaction-commands.test.ts` / `plan/in-progress/render-form-submit-fix.md` / consistency review files

**관련 Spec**: `spec/4-nodes/6-presentation/0-common.md` §10.9 (신설) · `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 step 2

---

## 발견사항

### [CRITICAL] spec §10.9 sentinel wrap 책임 위치가 구현과 불일치

- **위치**: `execution-engine.service.ts` `continueExecution()` (line ~1897) vs `registerContinuationHandlers()` 의 `'continue'` listener
- **상세**: spec §10.9 (worktree 버전, line 372) 은 다음과 같이 명시한다:
  - "`continueExecution(executionId, formData)` 는 raw `formData` 를 그대로 publish 하지 않고 `{ type: 'form_submitted', formData }` 로 wrap 한 뒤 … bus.publish({ type: 'continue', executionId, payload: { type: 'form_submitted', formData } }) 에 publish 한다. `'continue'` listener 는 wrap 된 payload 를 그대로 `resolvePending(executionId, payload)` 로 forward 한다 (unwrap 하지 않음)."
  - 즉, wrap 의무는 **`continueExecution`** 에 있고 `'continue'` listener 는 단순 forward 역할이어야 한다.
  - **실제 구현**: `continueExecution` 은 `payload: formData` 로 raw publish 하고, `'continue'` listener 에서 `{ type: 'form_submitted', formData: msg.payload }` 로 wrap 한다 — wrap 책임 위치가 반대.
  - **기능적 동등성**: end-to-end 동작 결과는 동일하다. `resolvePending` 에 도달하는 값이 spec 명세 sentinel과 일치한다.
  - **spec fidelity 불일치 판정**: spec 의 4-layer SSOT 정렬 표는 `continueExecution (wrap)` 을 명시하나 실제 코드에서 `continueExecution` 은 wrap 하지 않는다. spec 본문의 책임 위치 기술이 구현과 line-level 로 다르다.
  - **위험도**: 기능 회귀는 없으나 spec을 따라 미래 구현자가 `continueExecution` 에서 wrap 을 기대할 때 동작 이해 오류 발생 가능. spec 또는 구현 중 하나가 정합화 필요.
- **제안**: `continueExecution` 에서 `payload: { type: 'form_submitted', formData }` 로 wrap 하도록 구현 변경 OR spec §10.9 의 "wrap 책임은 `'continue'` listener" 로 수정 (`project-planner` 위임). 현 구현 방향을 유지할 경우 spec 을 `listener` 가 wrap 한다고 정정해야 한다.

---

### [WARNING] `waitForAiConversation` dispatch 에 `'button_click'` 케이스 없음 (spec §10.9 dispatch 표 불일치)

- **위치**: `execution-engine.service.ts` `waitForAiConversation()` while loop (line ~2036)
- **상세**: spec §10.9 의 dispatch 4 케이스 표에 `'button_click'` 이 명시되어 있다 ("별도 경로 ([§3] Blocking Mode)"). 그러나 `waitForAiConversation` 의 while loop 에는 `button_click` case 가 없다. `registerContinuationHandlers` 의 `'button_click'` 핸들러는 `{ type: 'button_click', buttonId }` 로 `resolvePending` 을 호출하므로, AI conversation 대기 중에 `button_click` 이 도달하면 `else` 분기 (warn log + loop 재진입) 로 처리된다.
  - spec 표는 이 케이스를 "별도 경로 (§3 Blocking Mode)" 로 분류하나 그 별도 경로의 코드 경로가 어떻게 연결되는지가 spec 에서 불명확하다.
  - 실제로 AI conversation (`waitForAiConversation`) 대기 중에 `button_click` 이 발생할 경우 warn log 만 남고 해당 버튼 클릭이 무시된다 — 이것이 의도된 동작인지 spec 이 명확히 기술하지 않는다.
- **제안**: spec §10.9 의 `'button_click'` dispatch 케이스 설명을 "AI conversation 대기 중에는 도달하지 않음 (button_click 은 Blocking Mode 의 별개 pendingContinuation 으로 처리)" 으로 명확화 OR 코드에서 `button_click` case 추가 (`project-planner` 위임).

---

### [WARNING] `formData ?? {}` 기본값이 spec §10.9 table 과 미세 차이

- **위치**: `execution-engine.service.ts` line ~2045: `const formData = action.formData ?? {};`
- **상세**: spec §10.9 dispatch 표는 `handleAiMessageTurn(executionId, node, JSON.stringify(action.formData), ...)` 로 명시하나, 구현은 `null`/`undefined` payload 시 `{}` 로 교체한다. spec 은 이 fallback 을 명시하지 않는다. `JSON.stringify(undefined)` 는 `undefined` 를 반환하므로 runtime TypeError 를 방어하기 위한 구현이지만, spec 과 line-level 차이가 있다.
  - `null` payload 테스트 케이스 (`continue 핸들러 — null / undefined payload 도 wrap`)가 `formData: undefined` 를 `resolvePending` 에 전달하는 것은 맞으나, `waitForAiConversation` 의 `form_submitted` dispatch 에서 `undefined ?? {}` → `{}` 로 변환되어 `JSON.stringify({})` = `"{}"` 가 `handleAiMessageTurn` 에 전달된다. LLM 이 빈 form 제출로 인식하는 것이 의도된 동작인지 spec 에 명시되지 않음.
- **제안**: spec §10.9 의 `'form_submitted'` dispatch 처리에 `action.formData` 가 `null`/`undefined` 인 경우 `{}` 로 fallback 함을 명시 (`project-planner` 위임).

---

### [WARNING] frontend `submitForm` — WS ack 실패 시 optimistic UI 부분 롤백만 수행 (spec 기술과 부분 불일치)

- **위치**: `use-execution-interaction-commands.ts` `submitForm` 내 `emitWithAck` 실패 콜백 (line ~114)
- **상세**: plan 문서 (변경 범위 §A) 는 "WS ack 실패 시 두 작업 모두 롤백 + `toast.error`" 라고 명시한다. 그러나 실제 구현은 `setWaitingAiResponse(false)` 만 호출 (spinner 해제) + `toast.error` 이고, `addConversationMessage` 로 추가한 optimistic presentation_user 아이템은 롤백하지 않는다. 코드 내 주석에 "optimistic presentation_user 는 유지 (재시도 안내 차원)" 라고 명시되어 있으며 테스트도 이를 검증한다.
  - 이는 plan 의 "두 작업 모두 롤백" 과 달리 단일 롤백 + 1 유지 로 다르다.
  - 코드 주석과 테스트는 내부 일관성이 있다. 다만 plan 문서의 기술이 부정확하다.
- **제안**: plan 문서의 해당 기술을 "spinner 해제 + toast; optimistic presentation_user 는 재시도 안내 차원에서 유지" 로 정정 (`project-planner` 위임). 현재 구현 동작 자체는 `sendMessage` 패턴과 대칭이며 UX 상 합리적.

---

### [INFO] `waitForAiConversation` 의 `button_click` 미처리 — 무한 루프 위험 명시 부재

- **위치**: `execution-engine.service.ts` `waitForAiConversation` else 분기 (line ~2058)
- **상세**: 미매칭 action.type 에 대해 warn log 후 loop 재진입하는 구현은 spec §10.9 의 "무한 루프 방어는 `maxTurns` cap 이 별도 layer 에서 담당" 에 근거한다. spec 에서 참조하는 `maxTurns` cap 이 실제로 구현되어 있는지, 그리고 warn log 후 무한 loop 에 빠지는 경로가 없는지 확인 필요. 이 PR 의 변경 범위에는 포함되지 않으나 spec 의 cross-ref 구현 검증이 필요하다.
- **제안**: `maxTurns` cap 구현 여부를 별도 확인 (기존 코드). 이 PR 에서 해결 의무는 없음.

---

### [INFO] `turnIndex` 계산에서 `"user"` 와 `"presentation"` 타입 모두 카운트

- **위치**: `use-execution-interaction-commands.ts` line ~103-105
- **상세**: `submitForm` 의 turnIndex 계산은 `m.type === "user" || m.type === "presentation"` 로 필터한다. `sendMessage` 는 `m.type === "user"` 만 카운트한다. plan 문서에 두 함수의 turnIndex 계산 기준 차이에 대한 명시가 없다. `presentation` 타입 아이템을 turnIndex 카운트에 포함하는 것이 ConversationThread spec 과 정합하는지 확인이 필요하다.
- **제안**: 두 counting 기준의 의미 차이를 코드 주석 또는 spec 에 명시 권장.

---

### [INFO] spec §10.9 신설 확인 — CHANGELOG·Rationale 포함

- **위치**: `spec/4-nodes/6-presentation/0-common.md` §10.9 (worktree 버전)
- **상세**: 코드가 참조하는 spec §10.9 가 worktree 에 실제로 신설되어 있다. CHANGELOG (2026-05-23 항목) 와 `### form submission wire format wrap (2026-05-23)` Rationale 단락 모두 포함되어 있음. spec 3섹션 구성 정합.

---

### [INFO] `ai-agent.handler.ts` `pendingFormToolCall` 미존재 시 fallback 경로 — 이 PR 범위 미포함

- **위치**: plan 문서 §변경 범위 (C) backend 두 번째 항목
- **상세**: plan 은 `ai-agent.handler.ts` 의 `pendingFormToolCall` 미존재 시 fallback 경로에 explicit warning log + spec cross-ref 주석 추가를 포함한다. 이 PR 의 diff 에 `ai-agent.handler.ts` 변경이 포함되지 않았다 — 미구현 또는 별도 PR 예정 여부 불명확.
- **제안**: plan 체크리스트에 해당 항목이 미완료인지 확인. 포함되어야 한다면 기능 완전성 미충족.

---

## 요약

이번 변경은 `render_form` submit 후 silent failure 와 dispatch fragility 를 수정하는 것으로, 핵심 기능 목표(backend sentinel wrap / frontend optimistic UI / 테스트 커버리지)는 대체로 달성되었다. 가장 중요한 발견은 spec §10.9 가 `continueExecution` 에 sentinel wrap 책임을 부여하지만 실제 구현은 `'continue'` listener 에서 wrap 한다는 spec-impl 괴리다 — 기능 회귀는 없으나 spec 의 책임 위치 기술이 부정확하여 미래 구현자에게 혼동을 줄 수 있다. `waitForAiConversation` dispatch 루프에 `'button_click'` 케이스가 없는 점도 spec 표와 불일치하여 명확화가 필요하다. frontend rollback 정책(optimistic item 유지)은 코드 및 테스트에서 내부 일관성은 있으나 plan 기술과 차이가 있다. `ai-agent.handler.ts` fallback 경로 변경이 diff 에 포함되지 않은 점은 plan 항목 완료 여부 확인이 필요하다.

---

## 위험도

**MEDIUM**

spec §10.9 wrap 책임 위치 기술 불일치는 기능 회귀 없이 spec 정합성 문제이며, `button_click` dispatch 미처리 및 `ai-agent.handler.ts` 미반영이 주요 잔여 위험이다.
