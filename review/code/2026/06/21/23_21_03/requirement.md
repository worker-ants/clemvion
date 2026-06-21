# 요구사항(Requirement) Review — M-1 3단계 테스트 보강 커밋

리뷰 대상: `c82b4a03` — test(ai-agent): M-1 3단계 ai-review 보강 — capFormDataBytes·form_submitted resume 직접 테스트

---

## 발견사항

### [INFO] [SPEC-DRIFT] spec frontmatter `code:` 에 `ai-turn-executor.ts` 미등재 (기존 W#1 → 이번 커밋에서도 미해소)

- 위치: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` frontmatter lines 5–16
- 상세: RESOLUTION.md 에 "planner-only — developer spec 쓰기 권한 밖" 로 명시된 deliberate-defer 항목이다. 이번 커밋은 production 코드를 변경하지 않았으므로 새로운 spec-drift 를 추가하지는 않는다. 기존 drift 가 그대로 잔존한다.
- 제안: 코드 유지 + spec 반영. `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 `ai-turn-executor.ts`, `ai-condition-evaluator.ts`, `ai-memory-manager.ts` 등재 필요 (project-planner 위임).

---

### [INFO] `form_submitted` resume 테스트 — splice 경로가 아닌 push 경로를 실행

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` 라인 326–335 (formResumeState 내 messages 구성)
- 상세: `formResumeState()` 의 `messages` 배열에는 `role: 'assistant'` 메시지(toolCalls 포함)만 있고, `render_form` 처리 단계에서 삽입되는 `role: 'tool'` stub 메시지가 없다. 따라서 `processMultiTurnMessage` 내부의 `messages.findIndex(m => m.role === 'tool' && m.toolCallId === ...)` 는 `-1` 을 반환하고, 코드는 `messages[stubIndex] = newToolResult` (replace) 경로가 아닌 `messages.push(newToolResult)` (append) 경로로 실행된다. 테스트 주석 "splice 가 toolCallId 로 매칭된다"는 실제 실행 경로를 오해하게 만든다. replace splice 경로의 정확한 검증을 위해서는 `messages` 에 `{ role: 'tool', toolCallId: 'form-tc-1', content: '{"ok":true,"pending":"form_submission"}' }` 를 추가해야 한다. 그러나 push 경로도 spec §6.2 step 2.c 의 tool_result 주입 요건을 만족하므로 기능적 회귀는 없다. 테스트 주석과 실제 실행 경로 사이의 의도 표현 불일치.
- 제안: splice replace 경로를 검증하려면 `messages` 에 tool stub `{ role: 'tool', toolCallId: 'form-tc-1', content: '{"ok":true,"pending":"form_submission"}' }` 를 추가한다. 또는 주석을 "tool_result append 경로 검증"으로 수정한다. 기능 상 두 경로 모두 동작하므로 WARNING 수준이 아닌 INFO 로 처리.

---

### [INFO] `capFormDataBytes` UTF-8 멀티바이트 경계 테스트 — round-trip 검증만 수행, truncation 실제 발생 여부 미검증

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` 라인 159–169
- 상세: `'가'.repeat(FORM_SUBMITTED_MAX_BYTES)` 는 10,240개의 한글 문자 = 약 30,720 bytes (한글 3bytes/char). `FORM_SUBMITTED_MAX_BYTES = 10,240` bytes 에 대해 이 입력은 명백히 cap 을 초과한다. 테스트는 `JSON.stringify(capped)` 가 throw 하지 않음과 `capped.ko` 가 문자열임만 검증하며, `formDataTruncation` 이 정의됐는지, 실제로 한글 문자 경계가 올바르게 잘렸는지(예: 3바이트 경계 내에서 짤렸는지) 는 검증하지 않는다. spec §12.7 "UTF-8 byte 단위 truncate — char 단위가 아닌 byte 안전성 보장" 의 핵심 속성은 이 테스트로 충분히 고정되지 않는다. 다만 `Buffer.from(value, 'utf8').subarray(0, keepBytes).toString('utf8')` 구현 자체가 Node.js Buffer 의 유효 UTF-8 보장 메커니즘을 활용하므로 실질 위험은 낮다.
- 제안: `formDataTruncation` 이 defined 임을 추가 검증. 가능하면 `(capped.ko as string).length < big.length` 도 확인해 실제 truncation 이 발생했음을 고정한다.

---

### [INFO] `capFormDataBytes` 과다 초과 케이스 (비-string only) — `capped` 는 원본과 동일하나 `formDataTruncation` 메타가 유용성 없는 상태로 반환됨

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` 라인 171–180 및 `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 라인 292–302
- 상세: 모든 필드가 비-string 이며 cap 초과인 경우, 구현은 `capped: formData` (원본 그대로), `formDataTruncation: { originalBytes, bytesAfterCap: originalBytes, truncatedFields: [] }` 를 반환한다. 테스트는 이를 올바르게 검증한다. 그러나 `bytesAfterCap === originalBytes` 이고 `truncatedFields` 가 빈 배열이라는 것은 메타를 읽는 LLM 또는 소비자에게 "cap 초과지만 아무것도 줄이지 못했다"는 신호인데, spec §12.7 에서 이 케이스의 LLM 노출 동작이 명시적으로 정의되지 않았다. 테스트는 구현 동작을 고정하나 spec 근거가 명시적이지 않다는 점이 INFO.
- 제안: 현행 유지. spec §12.7 "실무에서는 거의 발생 안 함" 주석과 일치하므로 우선순위 낮음.

---

### [INFO] `processMultiTurnMessage — form_submitted resume` 테스트 — `_resumeState.pendingFormToolCall` 클리어 검증은 정확하나 `_resumeState` null 가드 없음

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` 라인 363–364
- 상세: `result._resumeState` 가 undefined 인 경우 `next.pendingFormToolCall` 접근이 TypeError 를 던지지만 jest expect 에서는 이를 잡지 못한다(테스트 자체가 에러로 실패). 실제로 processMultiTurnMessage 가 waiting_for_input 경로로 진행되면 `_resumeState` 는 항상 defined 이므로 실질 위험은 없다. 다만 타입 안전성 측면에서 `expect(next).toBeDefined()` 를 먼저 assert 하는 것이 명확하다.
- 제안: `const next = result._resumeState as Record<string, unknown>; expect(next).toBeDefined();` 를 추가.

---

## spec fidelity 점검

### 점검된 spec 섹션 vs 테스트 매핑

| 테스트 | spec 참조 | 일치 여부 |
|---|---|---|
| `buildMultiTurnFinalOutput` it.each — max_turns/user_ended/error/condition 포트 | spec §3.2 (출력 포트 표, 라인 208–209) + `multiTurnPortForEndReason` 구현 | 일치. spec §3.2 포트 정의(`user_ended`, `max_turns`, `error`)와 테스트 기댓값 일치. `condition` → `error` fallback 은 구현 방어 로직으로 spec 침묵 영역이나 합리적 동작. |
| `capFormDataBytes` cap 미만 → 메타 없음 | spec §12.7 "cap 미만이면 `formDataTruncation` 은 undefined 로 반환" (라인 1271) | 일치. |
| `capFormDataBytes` cap 초과 string truncate | spec §12.7 "string 필드 균등 truncate, `formDataTruncation` 메타" | 일치. |
| `capFormDataBytes` 비-string only cap 초과 | spec §12.7 "실무에서는 거의 발생 안 함 — 보강 메타만 부착" (라인 293–302 구현) | 구현 동작은 spec 주석과 일치. |
| form_submitted resume → `pendingFormToolCall` 클리어 | spec §6.2 step 2.c "tool_result content 채워 LLM 재호출 + `_resumeState.pendingFormToolCall` 클리어" (라인 397) | 일치. |
| form_submitted resume → LLM 1회 호출 | spec §6.2 step 2.c 흐름 | 일치. |
| form_submitted 후 `status: 'waiting_for_input'` | spec §6.2 multi-turn 정상 종료는 다시 waiting 재진입 | 일치. LLM 이 `stop` 응답 시 루프가 waiting 으로 돌아오는 경로가 올바르게 검증됨. |

---

## 요약

이번 커밋은 ai-review 23_06_04 의 W#7(capFormDataBytes 단위 테스트 누락)·W#8(form_submitted resume executor 직접 테스트 없음)·I#14(buildMultiTurnFinalOutput 단일 it 분기 혼재)를 **production 코드 무변경** 원칙 아래 테스트 additive 보강으로 해소한다. spec §3.2·§6.2 step 2.c·§12.7 의 요구사항을 커버하는 총 8개 신규 테스트는 기능 관점에서 의도한 동작을 대체로 정확하게 고정한다. 주목할 것은 form_submitted resume 테스트가 messages 에 tool stub 을 포함하지 않아 내부적으로 splice replace 경로 대신 append 경로로 실행된다는 점이다 — 기능 회귀는 없으나 테스트 주석과 실행 경로 사이에 의도 불일치가 있다. 잔존 WARNING(W#1: conditionToolCalls 에서 toolCallCount++ — spec §7.1 조건 도구 제외 명세 위반)는 RESOLUTION.md 에 "pre-existing, behavior-preserving 보존, 별건 위임"으로 근거가 문서화됐으며 이번 커밋 범위(additive 테스트만) 내에서는 수용 가능한 defer 이다. Critical 및 새로운 WARNING 발견 없음.

## 위험도

LOW

STATUS=success ISSUES=0
