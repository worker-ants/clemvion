# 테스트(Testing) 리뷰 결과

대상 커밋: `c82b4a03` — test(ai-agent): M-1 3단계 ai-review 보강 — capFormDataBytes·form_submitted resume 직접 테스트

---

## 발견사항

### [INFO] capFormDataBytes 신규 4건 테스트 — 설계 방향 양호, truncate 상한 경계 검증 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` 라인 97~179 (`describe('capFormDataBytes', ...)`)
- 상세: 이번 커밋에서 추가된 4건(cap 미만·string truncate·UTF-8 멀티바이트 경계·비-string-only)은 이전 리뷰(W#7)가 요청한 직접 단위 테스트를 정확히 충족한다. `capFormDataBytes`/`FORM_SUBMITTED_MAX_BYTES` export 추가는 테스트 용이성 측면에서 올바른 결정이다.
  단, 다음 두 경계 케이스가 여전히 미커버 상태다.
  (1) `stringBudget`이 `FORM_DATA_TRUNCATED_MARKER` 길이보다 작은 경우(zero-budget clamp): 내부 `Math.max(0, ...)` 분기가 동작하는지 확인하는 테스트 부재.
  (2) 복수 string 필드가 균등 분배되는 경우(3필드 cap 초과 시 각 필드 budget 균등 배분 검증): 현 테스트는 단일 string 필드(`essay`) 하나에 집중돼 있어 다중 필드 균등 분배 로직이 누락됐다.
- 제안: `it('clamps truncate budget to MARKER length when budget is near zero', ...)`와 `it('distributes budget evenly across multiple string fields', ...)` 2건 추가 권장. 현 상태에서 회귀 위험은 낮으나 spec §12.7 "균등 truncate" 약속과 직결된 경로다.

### [INFO] form_submitted resume 테스트 — 핵심 부작용 1건 검증, 2개 분기 미커버
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` 라인 182~233 (`describe('processMultiTurnMessage — form_submitted resume', ...)`)
- 상세: 추가된 1건의 테스트는 이전 리뷰(W#8)의 핵심 요구사항(splice → LLM 재호출 → waiting 재진입, `pendingFormToolCall` 클리어)을 충족한다. `state.pendingFormToolCall`과 `result._resumeState.pendingFormToolCall` 양쪽 모두 `undefined`로 검증하는 이중 확인은 특히 좋다.
  그러나 이전 testing.md 리뷰(W#8 원문)가 요청한 3개 분기 중 나머지 2건이 빠졌다:
  (1) `ai_message + pendingFormToolCall bypass(cancelled)` 분기: render_form이 pending 상태에서 사용자가 일반 메시지를 보내는 경우 — bypass 처리 후 pendingFormToolCall 클리어가 올바른지.
  (2) `fallback no-pending` 분기: `pendingFormToolCall`이 없는 일반 resume — 새 테스트 없음(기존 `processMultiTurnMessage (resume loop)` describe에서 커버되나 별도 명시 없음).
- 제안: `ai_message bypass cancelled` 분기 테스트 1건 추가. state에 `pendingFormToolCall` 설정 후 source를 `ai_message`로 호출해 cancel 경로와 클리어 부작용을 검증.

### [INFO] form_submitted splice 실패 경로 미커버 (toolCallId 불일치)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` 라인 216~233
- 상세: 추가된 form_submitted 테스트에서 `pendingFormToolCall.toolCallId: 'form-tc-1'`과 messages 내 `toolCalls[0].id: 'form-tc-1'`이 정확히 일치하도록 설정된다. `findIndex`가 -1을 반환하는 경우(toolCallId 불일치)의 fallback 동작은 테스트되지 않는다. 이 경로는 엔진이 잘못된 state를 전달하거나 messages가 truncate된 경우 발생 가능하다.
- 제안: `it('handles missing toolCallId gracefully when splicing form tool_result', ...)` 추가. toolCallId가 messages에 없을 때 에러를 throw하는지 혹은 graceful degrade하는지 확인.

### [INFO] buildMultiTurnFinalOutput it.each — status 검증 추가됐으나 output 구조 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` 라인 241~257
- 상세: `it.each`로 분리된 포트 매핑 테스트는 I#14 개선 요구를 정확히 충족하며 `condition → error` defensive 케이스가 포함된 것이 좋다. 각 케이스마다 `result.port`와 `result.status`를 검증하나, `result.output` 존재 여부나 기본 구조(예: `output.result.messages`)는 검증하지 않는다. 포트만이 아닌 출력 payload shape도 `endReason`별로 다를 수 있으므로(error 시 `output.error` 포함 여부) 추가 검증 여지가 있다.
- 제안: `error` 케이스에서 `result.output.error`가 없거나 기본 구조가 갖춰지는지 검증 1건 추가. 현재 범위에서는 INFO 수준.

### [INFO] baseContext 공유 참조 — 테스트 격리 잠재 위험 (선행 리뷰 미해소)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` 라인 61~65
- 상세: `baseContext`가 `const`로 describe 최상위에서 단 1회 생성된다. 이번 커밋에서 추가된 form_submitted 테스트의 `formResumeState()`는 함수로 분리해 매번 새 객체를 반환하는 올바른 패턴을 쓰고 있으나, `baseContext`는 여전히 공유된다. `makeExecutionContext` 반환 객체가 내부에 가변 구조를 포함한다면 테스트 간 오염 가능성이 있다. 이전 리뷰(prior testing.md INFO)에서도 지적됐으나 이번 커밋에서 해소되지 않았다.
- 제안: `beforeEach`에서 `baseContext`를 재생성하거나 각 테스트에서 spread하는 패턴 적용. 현재 `makeExecutionContext`가 immutable 객체를 반환한다면 실질 위험 없음 — 확인 후 무시 가능.

### [INFO] resolveRetryStateTtlMinutes 환경변수 직접 테스트 — 이번 커밋 미포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` `describe('endMultiTurnConversation', ...)` 블록
- 상세: 이전 testing.md 리뷰(W#3 WARNING)에서 요청한 `AI_RETRY_STATE_TTL_MINUTES` 환경변수 케이스(non-numeric, negative, zero fallback)가 이번 커밋에서 추가되지 않았다. RESOLUTION.md에서 이 항목이 명시적 defer로 처리됐는지 확인이 필요하다. 기존 `ai-agent.handler.spec.ts`에 해당 케이스가 `it.each`로 존재하나, executor 직접 테스트로서의 격리 검증이 없다. `process.env` 오염 방지를 위한 `afterEach` cleanup도 없다.
- 제안: RESOLUTION.md에 defer 근거가 없다면 추가 필요. `afterEach(() => { delete process.env.AI_RETRY_STATE_TTL_MINUTES; })` cleanup과 함께 3케이스(non-numeric, negative, valid) executor 레벨 추가 권장.

### [INFO] Mock 적절성 — mockLlmService.chat이 단일 응답만 반환, tool_call 시나리오 미지원
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` 라인 44~58 (`beforeEach`)
- 상세: `mockLlmService.chat`이 `mockResolvedValue`(단일 고정값)로 설정돼 모든 테스트에서 동일한 text 응답을 반환한다. form_submitted 테스트에서 LLM이 다시 tool_call을 반환하는 경우(render_form 재호출 시 form block 재진입)나 조건 도구를 반환하는 경우는 이 mock으로 검증 불가하다. 이는 기존 spec에서도 동일한 한계였으나, form_submitted resume 테스트 추가로 mock 단순성이 더 두드러진다.
- 제안: 추가 시나리오 필요 시 `mockLlmService.chat.mockResolvedValueOnce(...)` 체이닝으로 다회 응답 시퀀스 시뮬레이션 가능. 현재 우선순위는 낮다.

---

## 요약

이번 커밋은 이전 ai-review(23_06_04) WARNING W#7·W#8 및 INFO I#14를 정확히 타겟한 additive 테스트 보강으로, 신규 17개 스펙이 모두 PASS한다고 명시되어 있다. `capFormDataBytes` 직접 단위 4건(UTF-8 멀티바이트 포함), form_submitted resume의 핵심 부작용(`pendingFormToolCall` 클리어) 검증, `buildMultiTurnFinalOutput it.each` 분리 모두 이전 리뷰 요구를 충실히 이행했다. 테스트 구조는 `formResumeState()`를 매번 새 객체를 반환하는 함수로 분리하는 등 격리 원칙을 잘 따른다. 잔존 갭으로는 `capFormDataBytes`의 zero-budget clamp 및 다중 string 필드 균등 배분 케이스, form_submitted의 `ai_message bypass` 분기 및 toolCallId 불일치 fallback 경로, `resolveRetryStateTtlMinutes` 환경변수 직접 테스트(RESOLUTION에 defer 미기재)가 있다. 이번 변경이 production 코드 무변경 원칙(additive 테스트만) 하에서 이루어진 behavior-preserving 리팩터의 후속임을 고려하면 전반적으로 수용 가능한 수준이며, 지적 사항은 모두 INFO 등급이다.

---

## 위험도

LOW

STATUS=success ISSUES=0
