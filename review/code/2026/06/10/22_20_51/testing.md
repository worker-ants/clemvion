# 테스트(Testing) 리뷰 결과

## 발견사항

### **[INFO]** W2 fix — `FREEZE_BRANCH_CACHE` 전제 단언 추가: 적절하고 효과적
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.spec.ts` L82–84
- 상세: 이전 리뷰(22_00_04)에서 지적된 W2 가 정확히 반영됐다. `FREEZE_BRANCH_CACHE` 를 export 해 `expect(FREEZE_BRANCH_CACHE).toBe(true)` 로 테스트 전제를 명시 단언한다. Jest 가 `NODE_ENV=production` 으로 실행될 경우 이 단언이 먼저 실패해 이후 freeze 테스트 전체가 "전제 미충족"으로 인식되는 fast-fail 구조가 된다. 단, 이 단언이 실패해도 Jest는 해당 `it` 블록만 실패 처리하고 나머지 freeze 테스트는 계속 실행된다 — 만약 `FREEZE_BRANCH_CACHE === false` 인 환경에서 freeze 테스트가 잘못 통과하는 것을 완전히 막으려면 `beforeAll(() => { if (!FREEZE_BRANCH_CACHE) pending(); })` 또는 `test.skipIf` 패턴이 더 강력하다. 현재 구조도 `false positive 를 유발하는 경우 단언 실패`로 감지되므로 실용적으로는 충분하다.
- 제안: 현재 구조 유지 가능. 더 강한 격리를 원하면 `describe.skipIf(!FREEZE_BRANCH_CACHE)(...)` 패턴으로 전체 describe 를 조건부 skip 하는 방법도 있다.

### **[INFO]** W3 fix — `try/catch` 제거 후 `expect(mutator).toThrow(TypeError)` 채택: 올바른 개선
- 위치: `parallel-executor.spec.ts` L92–110
- 상세: 이전 `try/catch` + `mutationError !== null` 검사 패턴은 non-strict 환경에서 mutate 가 silent 로 무시될 때 `mutationError === null` 이 되어 테스트가 통과했다. 개선된 패턴은 async callback 이 실행되는 시점(`executor.execute` 내부)과 mutate 시도 시점을 분리해, `mutator` 를 외부에서 `expect(mutator!).toThrow(TypeError)` 로 호출한다. 이 분리는 테스트가 제어하는 타이밍에 TypeError 가 발생함을 보장하며, non-strict 환경에서 silent pass 가능성을 제거한다.
- 주의: `executor.execute` 의 callback 이 이미 완료된 후 `mutator` 를 외부에서 호출하므로, callback 실행 시점과 mutate 검증 시점이 달라진다. 이는 의도된 설계이며 올바른 패턴이다. freeze 는 `executor.execute` 종료 후에도 유지되므로 검증 타이밍 분리는 문제없다.
- 제안: 없음. 개선이 완전하다.

### **[INFO]** `top-level 키 추가 격리` 테스트 — freeze ON/OFF 무관 동작임을 주석에 명시할 것
- 위치: `parallel-executor.spec.ts` L118–136
- 상세: 두 번째 it 블록(`top-level 키 추가는 branch 간 격리되어 정상 동작한다`)은 `FREEZE_BRANCH_CACHE` 가 true 든 false 든 동일하게 동작한다 — 이는 shallow copy 격리를 검증하는 것으로 M-5 freeze 전용 테스트가 아니다. 현재 주석("top-level 키 추가는 shallow copy 덕에 격리 — freeze 대상 아님")이 의도를 설명하지만, 이 테스트 자체가 M-5 describe 블록 내에 있으므로 "freeze 가 꺼진 환경에서도 동일하게 동작하는 테스트" 임을 명시하지 않으면 이 테스트가 M-5 freeze 가드를 검증하는 것으로 오해할 수 있다.
- 제안: it 블록 제목 또는 인라인 주석에 "이 테스트는 FREEZE_BRANCH_CACHE ON/OFF 무관하게 shallow copy 격리를 검증" 을 명시 추가.

### **[INFO]** `structuredOutputCache` 에 대한 freeze 테스트 부재 — 커버리지 갭
- 위치: `parallel-executor.spec.ts` (M-5 describe 블록)
- 상세: `freezeSharedCacheValues` 는 `nodeOutputCache` 와 `structuredOutputCache` 양쪽에 적용된다(구현 참조). 그러나 M-5 테스트는 `nodeOutputCache` 에 대한 mutate 검증만 있고 `structuredOutputCache` 에 대한 동일 패턴 테스트는 없다. 두 필드 모두 같은 `freezeSharedCacheValues` 함수를 경유하므로 커버리지 관점에서 중복이 있으나, `structuredOutputCache` 의 값 구조가 다를 경우 동작 차이가 있을 수 있다.
- 제안: 필수는 아니나, `structuredOutputCache` 에도 동일한 내부 mutate → TypeError 테스트를 추가하면 두 캐시 타입 모두의 invariant 를 명시적으로 커버할 수 있다.

### **[INFO]** `deepFreeze` 의 배열 처리 — 테스트 케이스 없음
- 위치: `parallel-executor.spec.ts`, `parallel-executor.ts` L37–44
- 상세: `deepFreeze` 구현은 `Object.values(value as Record<string, unknown>)` 로 객체 속성을 순회한다. `nodeOutputCache` 값이 `{ output: { items: [{ id: 1 }] } }` 처럼 배열을 포함하는 경우, 배열 엘리먼트 내부 객체의 freeze 동작이 `Object.values` 를 통한 재귀 호출로 처리되는지에 대한 테스트가 없다. 현재 테스트 케이스는 단순 중첩 객체(`{ output: { count: 1 } }`)만 검증한다.
- 제안: 배열 값을 포함하는 cache 케이스(`nodeA: { output: { items: [{ x: 1 }] } }`)에 대한 mutate 시도 테스트를 추가하거나, 현재 배열이 cache 값으로 사용되지 않는다면 주석에 "배열 내부 객체까지 freeze 됨" 또는 "배열 케이스는 현재 사용되지 않아 테스트 생략" 을 명시할 것.

### **[INFO]** `FREEZE_BRANCH_CACHE` export 변경 — 회귀 테스트 영향 없음, 단 모듈 인터페이스 변경
- 위치: `parallel-executor.ts` L34, `parallel-executor.spec.ts` L1
- 상세: `FREEZE_BRANCH_CACHE` 가 `export const` 로 변경됐다. 이는 테스트 파일이 import 해 사용하기 위한 것으로 적절하다. 외부 코드가 이 상수를 import 해 production 코드에서 조건 분기를 만들 가능성이 생기는 부수 효과가 있으나, 이름이 의도(dev/test-only guard)를 명확히 반영하고 JSDoc 이 충분하므로 오용 위험은 낮다.
- 제안: 없음.

### **[INFO]** `chat-channel.dispatcher.spec.ts` — `toEiaEvent` → `toChatChannelEvent` rename 후 회귀 차단력 유지
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts`
- 상세: 전체 describe 블록 제목과 인라인 주석이 일관되게 갱신됐다. 테스트 케이스 구조(buttons/form/ai_conversation 등 4종, null 반환, execution.failed back-compat, ai_message presentations)가 모두 유지되어 rename 이후에도 회귀 차단력 손실이 없다. 이번 변경에서 새로운 커버리지 갭이 도입되지 않았다.
- 제안: 없음.

### **[INFO]** `continuation-bus.service.spec.ts` — `on()` no-op 테스트 제거: 올바른 방향
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.spec.ts`
- 상세: `on()` no-op 을 검증하던 describe 블록이 메서드 삭제와 함께 제거됐다. 남은 테스트(publish, lock, seq)는 현재 계약(observable behavior)을 검증하므로 결합도 관점에서 개선됐다. 다만 `on()` 제거 후 내부에서 다른 경로로 continuation 이벤트가 silent drop 될 수 있는 시나리오에 대한 별도 통합 테스트 커버 여부를 확인해야 한다(e2e 179/179 통과로 커버됨이 RESOLUTION 에 확인돼 있어 실질 위험은 없음).
- 제안: 없음.

### **[INFO]** `execution-engine.service.spec.ts` — `registerContinuationHandlers` 호출 제거 후 `applyContinuation` 커버리지 확인
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- 상세: `registerContinuationHandlers()` 직접 호출 2곳이 제거됐다. 이 메서드가 no-op 이었으므로 제거 자체는 테스트 의미에 영향이 없다. 그러나 continuation resume 시나리오(`applyContinuation`, `applyCancellation`)에 대한 단위 테스트가 남아 있는지 별도 확인이 권장된다.
- 제안: `execution-engine.service.spec.ts` 에 `applyContinuation` / `applyCancellation` 직접 호출 테스트가 충분히 존재하는지 확인.

## 요약

이번 변경의 테스트 관점 핵심은 `parallel-executor.spec.ts` M-5 describe 블록 개선이다. 이전 리뷰(22_00_04)에서 지적된 두 가지 WARNING — (W2) `FREEZE_BRANCH_CACHE` 전제 단언 미보장, (W3) `try/catch` 구조의 silent-pass 위험 — 이 모두 올바르게 해소됐다. `FREEZE_BRANCH_CACHE` 를 export 해 `expect(...).toBe(true)` 전제 단언을 추가한 것과 `try/catch` 를 `expect(mutator!).toThrow(TypeError)` 패턴으로 교체한 것은 테스트 신뢰도를 실질적으로 높인다. 남은 INFO 수준 사항으로는 (1) `structuredOutputCache` 에 대한 동일 패턴 테스트 미작성, (2) 배열 내부 freeze 동작에 대한 엣지 케이스 테스트 부재, (3) `top-level 키 추가 격리` 테스트가 freeze ON/OFF 무관임을 명시하지 않는 점이 있다. 그러나 이것들은 현재 코드의 실제 사용 패턴 및 spec invariant 범위에서 위험도가 낮다. `toEiaEvent` rename, dead code 제거에 따른 테스트 정리도 회귀 차단력을 손상시키지 않고 완전하게 처리됐으며, e2e 179/179 통과로 continuation 흐름 커버도 확인됐다.

## 위험도

LOW

STATUS=success ISSUES=0
