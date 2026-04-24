## 발견사항

### [WARNING] `planPersisted` 로직에 대한 어서션 누락
- **위치**: `workflow-assistant-stream.service.spec.ts` — `persistCalls[0]`, `persistCalls[1]` 어서션
- **상세**: `planPersisted` 플래그는 같은 턴에서 plan이 중간 row에만 실리고 이후 row에는 `plan=null`이 되도록 방지하는 핵심 가드다. 그러나 두 persist 테스트에서 `.plan` 필드를 전혀 검증하지 않는다. `planPersisted ? null : planForTurn` 분기가 실제로 올바르게 동작하는지 단 하나의 어서션도 없다.
- **제안**: 첫 번째 시나리오 기준으로 `expect(persistCalls[0].plan).not.toBeNull()` 와 `expect(persistCalls[1].plan).toBeNull()` 추가

---

### [WARNING] `pendingToolCalls` 리셋 경계 미검증
- **위치**: `workflow-assistant-stream.service.ts` — stall 복구 블록 `pendingToolCalls = []`
- **상세**: stall 경계에서 `assistantText = ''; pendingToolCalls = []` 리셋이 이루어지는데, 리셋 전에 tool call이 있던 경우 중간 row에 포함되고 이후 row에는 빈 배열이어야 한다. 현재 테스트 시나리오는 stall 직전 tool call이 없는 상황만 커버한다.
- **제안**: stall 발동 전 라운드에 `explore` 등의 tool call이 있는 시나리오 추가. `persistCalls[0].toolCalls`에 해당 tool call, `persistCalls[1].toolCalls`가 비어있는지 검증

---

### [WARNING] 에러 경로에서 `consecutiveStallRounds > 0` 분기 미테스트
- **위치**: `workflow-assistant-stream.service.ts` lines ~386, ~780 — 에러 시 `persistAssistantTurn` 호출
- **상세**: stall 복구가 1회 이상 발동된 이후 에러가 발생하면 (`consecutiveStallRounds > 0`) 최종 error persist에도 `autoResumed: true` 메타가 실린다. 이 분기는 현재 테스트에서 전혀 커버되지 않는다.
- **제안**: "stall 1회 후 에러 발생" 시나리오 추가. 에러 row의 `autoResumed=true`, `autoResumeAttempt=1` 검증

---

### [WARNING] `hydrateMessage` 재수화(rehydrate) 경로 미테스트
- **위치**: `frontend/src/lib/stores/assistant-store.ts` — `hydrateMessage` 함수
- **상세**: `autoResumed=true`인 서버 응답을 `hydrateMessage`가 `autoResume` 메타로 변환하는 경로가 `assistant-store.test.ts`에서 테스트되지 않는다. SSE 실시간 경로만 테스트되어 있고, 세션 재로드(`loadSession`) 시의 divider 복원 경로는 커버 안 됨.
- **제안**: `assistant-store.test.ts`에 `hydrateMessage` 단위 테스트 추가 — `{autoResumed: true, autoResumeReason: 'stall_pending_steps', autoResumeAttempt: 1}` 입력 시 `autoResume` 메타 및 `autoResumeAttempt ?? 1` 폴백 검증

---

### [WARNING] `applyAutoResumeEvent` — `currentAssistantId` 미매칭 엣지 케이스 미테스트
- **위치**: `frontend/src/lib/stores/assistant-store.ts` — `applyAutoResumeEvent`
- **상세**: `currentAssistantId`가 `messages` 배열에 존재하지 않는 경우(race condition 또는 이미 확정된 후 이벤트 도착), 기존 메시지를 닫지 않고 새 버블만 push된다. 이 엣지 케이스가 테스트되지 않는다.
- **제안**: `messages`가 비어있거나 `currentAssistantId`가 없는 상태에서 `applyAutoResumeEvent` 호출 시 동작 검증 추가

---

### [INFO] `assistant-message.tsx` divider 렌더링 컴포넌트 테스트 부재
- **위치**: `frontend/src/components/editor/assistant-panel/assistant-message.tsx`
- **상세**: `message.autoResume` 존재 시 `role="separator"` divider가 렌더되는 조건 분기가 있으나, 이에 대한 컴포넌트 테스트(vitest + @testing-library)가 추가되지 않았다. i18n 포맷(`{{attempt}}/{{max}}`) 치환, `aria-label` 속성도 검증 불가 상태.
- **제안**: 기존 컴포넌트 테스트 파일이 있다면 `autoResume` 유/무 두 케이스 추가. 없다면 INFO 수준으로 허용 가능

---

### [INFO] `STALL_MAX_ATTEMPTS` 상수 동기화 단절 위험
- **위치**: `frontend/src/lib/stores/assistant-store.ts:59` — `const STALL_MAX_ATTEMPTS = 2`
- **상세**: 백엔드 `MAX_STALL_ROUNDS`와 동일 값을 프론트에서 복제. 주석에서 동기화 필요성을 언급하지만 이를 강제할 장치가 없다. SSE `max` 필드를 통해 실시간에는 정확한 값을 전달하지만, rehydrate 경로는 이 상수에 의존한다.
- **제안**: `hydrateMessage` 테스트에서 `max` 값이 `STALL_MAX_ATTEMPTS`와 일치하는지 명시적으로 assert하여 변경 시 테스트 실패로 인지

---

### [INFO] `persistCalls` 타입 캐스트의 타입 안전성
- **위치**: `workflow-assistant-stream.service.spec.ts` — `persistCalls` 추출 블록
- **상세**: `as Array<{...}>` 단언이 실제 타입을 검증하지 않아 `appendMessage` 시그니처가 변경되어도 컴파일 오류 없이 테스트가 통과할 수 있다.
- **제안**: 불가피한 패턴이나, 가능하다면 `Partial<WorkflowAssistantMessage>`를 명시적 타입으로 사용

---

## 요약

핵심 happy path 3가지(stall 1회 복구, stall 2회 포기, stall 없음)와 프론트엔드 store 분리 로직은 잘 테스트되어 있다. 그러나 이번 변경의 주요 불변식(invariant)인 **plan 중복 방지(`planPersisted`)**, **tool call 리셋 경계**, **에러 경로의 `consecutiveStallRounds > 0` 분기**, **rehydrate 경로**가 테스트되지 않아 해당 로직이 조용히 회귀할 위험이 있다. 특히 `planPersisted` 로직 미검증은 같은 plan이 여러 row에 중복 저장되는 버그를 놓칠 수 있어 주의가 필요하다.

## 위험도

**MEDIUM**