# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `capFormDataBytes` / `FORM_SUBMITTED_MAX_BYTES` — 테스트 전용 export 공개
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L258, L274
- 상세: 이번 커밋은 production 코드에서 `capFormDataBytes` 와 `FORM_SUBMITTED_MAX_BYTES` 를 `export` 하도록 변경했다(테스트 직접 단위 목적). 두 심볼은 이미 이전 PR(M-1 3단계)에서 도입된 것이며, 본 커밋은 이를 명시적으로 spec 파일에서 import 한 것이다. 외부 consumer 가 이 경로(`./ai-turn-executor`)로 직접 import 할 경우 추후 이동·이름 변경 시 파손 위험이 생긴다. 현재 `ai-agent.handler.ts` 의 re-export shim 이 `FORM_SUBMITTED_GUIDANCE_MESSAGE` / `FORM_SUBMITTED_MAX_BYTES` 를 기존 경로로 계속 제공하므로 기존 소비자 영향은 없다. `capFormDataBytes` 는 re-export 없이 새로 공개된 심볼이다.
- 제안: `capFormDataBytes` 를 테스트 전용으로 노출하는 경우 JSDoc 에 `@internal` 또는 주석으로 "테스트 접근 전용 — 외부 consumer 금지" 를 명시하면 의도치 않은 downstream 의존 확산을 방지할 수 있다.

### [INFO] `delete state.pendingFormToolCall` — 호출자 객체 in-place 변이 (pre-existing, 이번 커밋에서 부작용 검증 추가됨)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L1805, L1830
- 상세: `processMultiTurnMessage` 가 호출자(엔진)가 넘겨준 `state` 객체에 직접 `delete state.pendingFormToolCall` 를 수행한다. 이 in-place 변이는 pre-existing 동작(RESOLUTION.md I#9 deliberate-defer 기록됨)이며 behavior-preserving refactor 범위 밖이다. 이번 커밋에서 신규 테스트(`expect(state.pendingFormToolCall).toBeUndefined()`)가 이 부작용을 명시적으로 검증함으로써 오히려 암묵적 계약이 문서화되었다. 동시성 위험은 Node.js 단일 이벤트 루프 + turn-단위 직렬 처리로 실질적으로 없다.
- 제안: 해당 없음 (이번 커밋의 변경 범위 밖 pre-existing 동작, 테스트로 계약 고정됨).

### [INFO] `process.env.AI_RETRY_STATE_TTL_MINUTES` 직접 읽기 (pre-existing, 환경 변수 부작용)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L180 (`resolveRetryStateTtlMinutes`)
- 상세: `resolveRetryStateTtlMinutes` 가 `process.env` 를 직접 읽는다. 이는 M-1 3단계(직전 커밋)에서 이미 도입된 pre-existing 동작이며 본 커밋은 이 함수를 변경하지 않는다. 이번 커밋의 테스트 코드는 이 분기를 커버하지 않으나(기본값 경로만 사용), 본 커밋의 추가 범위가 아니다. RESOLUTION.md W#2 deliberate-defer 기록됨.
- 제안: 해당 없음 (이번 커밋의 변경 범위 밖).

### [INFO] `it.each` 리팩터 — 테스트 코드 내 시그니처 변경, 호출자 영향 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` L76–92
- 상세: 기존 단일 `it` 블록에서 `it.each` 로 전환된 것은 테스트 파일 내부 리팩터이며, production 코드 시그니처나 공개 API 에 영향을 주지 않는다. `buildMultiTurnFinalOutput` 의 시그니처는 변경되지 않았다.
- 제안: 해당 없음.

### [INFO] `formResumeState()` factory — 테스트 내 공유 객체 독립성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` L185–214
- 상세: `formResumeState()` 를 함수로 정의해 매번 새 객체를 반환하므로, `delete state.pendingFormToolCall` in-place 변이가 테스트 간 상태 누출을 일으키지 않는다. 올바른 패턴이다.
- 제안: 해당 없음.

---

## 요약

이번 커밋은 production 코드를 변경하지 않는 additive 테스트 보강이다. 부작용 관점에서 새롭게 도입된 위험은 없다. `capFormDataBytes` / `FORM_SUBMITTED_MAX_BYTES` 의 명시적 import 가 공개 심볼 표면을 소비하는 것은 기존 export 를 활용한 것이며, `capFormDataBytes` 에 `@internal` 표기가 없다는 점만 주의 사항이다. `delete state.pendingFormToolCall` in-place 변이는 pre-existing 동작으로 이번 커밋에서 테스트로 계약이 고정되어 오히려 투명성이 높아졌다. 전역 변수 도입·파일시스템 부작용·네트워크 호출·이벤트 변경은 없다.

## 위험도

NONE
