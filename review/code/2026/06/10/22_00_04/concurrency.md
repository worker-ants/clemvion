# 동시성(Concurrency) 리뷰 결과

## 발견사항

### **[INFO]** parallel-executor.ts — deepFreeze 재귀 호출 스택 한계 (배열 처리 누락)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` — `deepFreeze` 함수
- 상세: `deepFreeze` 내부에서 `Object.values(value as Record<string, unknown>)` 로 순회하는데, `value` 가 배열(`Array`)인 경우도 `typeof value === 'object'` 에 해당하므로 진입은 하지만 `Object.values` 가 인덱스 키(숫자)로 요소를 열거한다. 동작 자체는 올바르지만(배열 요소를 동결), `Object.isFrozen` 체크로 무한 재귀는 방지된다. 치명적 문제는 아니며 실제 `nodeOutputCache` 의 값 형태(직렬화 가능 output envelope)에서 순환 참조가 없다는 코드 주석 전제가 유지되는 한 안전하다. 다만 배열 내부 중첩 객체까지 frozen 처리되므로 의도한 범위보다 넓게 동결될 수 있음을 인지해야 한다.
- 제안: 기능상 문제는 없으므로 즉각 수정 필요 없음. 그러나 `deepFreeze` 주석에 "배열 포함 재귀 동결" 을 명시하면 명확성이 높아진다.

### **[INFO]** parallel-executor.ts — `FREEZE_BRANCH_CACHE` 모듈 로드 시점 고정
- 위치: `parallel-executor.ts` — `const FREEZE_BRANCH_CACHE = process.env.NODE_ENV !== 'production';`
- 상세: 모듈 최초 로드 시 `process.env.NODE_ENV` 를 읽어 상수로 고정한다. jest 환경에서 `jest.resetModules()` 없이 환경 변수를 변경해도 이 값은 갱신되지 않는다. 현재 테스트 구성상 문제가 없으나, 향후 동일 프로세스에서 NODE_ENV 를 바꿔 가며 테스트하는 시나리오가 추가되면 기대 동작과 어긋날 수 있다.
- 제안: 현재 테스트 패턴(beforeEach 에서 executor 재생성)에서는 영향 없음. 설계상 의도된 모듈-레벨 고정이므로 변경 불필요.

### **[INFO]** continuation-bus.service.ts — `nextSeq` INCR + EXPIRE 비원자성
- 위치: `continuation-bus.service.ts` — `nextSeq` 메서드 (`client.incr` → `client.expire` 순차 호출)
- 상세: Redis INCR 성공 후 EXPIRE 가 실패하면 TTL 없는 키가 잔류할 수 있다. 코드 주석에서 "다음 publish 가 TTL 을 다시 시도하므로 누수는 일시적" 이라고 의도를 명시하고 있으며, EXPIRE 실패는 이미 성공한 INCR 결과를 무효화하지 않는다(seq 단조성 보존). INCR 과 EXPIRE 를 MULTI/EXEC 또는 Lua 스크립트로 원자화하면 완전히 제거할 수 있으나, 현재 설계는 그 트레이드오프를 명시적으로 수용한 것으로 보인다.
- 제안: 현재 동작은 설계 의도 범위 내. 장기적으로 Lua 스크립트 원자화를 고려할 수 있으나 즉각 수정 불필요.

### **[INFO]** continuation-bus.service.ts — `on()` 메서드 완전 제거 (dead code 정리)
- 위치: `continuation-bus.service.ts` (diff: `on()` 메서드 17줄 삭제)
- 상세: Phase 1의 Redis pub/sub 인 메모리 listener 등록 경로가 완전 제거됐다. 이제 BullMQ Worker 단일 경로로 일원화되어 in-process pub/sub 의 경쟁 조건 가능성이 구조적으로 제거됐다. 긍정적 변화.
- 제안: 해당 없음 — 동시성 위험 감소.

### **[INFO]** parallel-executor.ts — AbortController 이벤트 리스너 누수 가능성 미미
- 위치: `parallel-executor.ts` — `upstreamSignal.addEventListener('abort', onUpstreamAbort, { once: true })`
- 상세: `errorPolicy !== 'cancel-others-on-fail'` 인 경우 `cancelController` 가 null 이므로 이 분기 자체에 진입하지 않는다. `cancel-others-on-fail` 케이스에서는 `cancelController.signal` 에 `{ once: true }` 리스너를 달아 `upstreamSignal` 의 listener 를 제거하도록 구성했다. 정상 분기(모든 브랜치 성공)에서도 `cancelController.abort()` 가 호출되지 않으므로 `upstreamSignal` 의 리스너가 잔류할 수 있다. 다만 `execute()` 완료 시 GC 가 `cancelController` 를 해제하고 `upstreamSignal` 의 약한 참조 패턴상 실질 누수 위험은 낮다.
- 제안: 정상 완료 후에도 `upstreamSignal.removeEventListener('abort', onUpstreamAbort)` 를 명시적으로 호출하는 `finally` 블록을 추가하면 완전히 안전해진다. 현재 구현에서 실질 문제 발생 가능성은 낮음.

---

## 요약

이번 변경의 동시성 관련 핵심은 두 가지다. 첫째, `parallel-executor.ts` 에 dev/test 한정 `deepFreeze` 가드(`M-5`)가 추가됐는데, 구현이 설계 의도대로 branch clone 직후 한 지점에만 적용되고 production 에는 무영향이며 순환 참조 방어까지 갖춰 동시성 안전성을 올바르게 강화한다. 둘째, `continuation-bus.service.ts` 의 `on()` no-op stub 과 `execution-engine.service.ts` 의 `registerContinuationHandlers` 가 완전 제거됨으로써 in-memory pub/sub 이중 경로의 잠재적 경쟁 조건이 구조적으로 소멸됐다. 나머지 변경(함수 rename, plan/review 문서 갱신)은 동시성과 무관하다. `nextSeq` INCR+EXPIRE 비원자성과 AbortController 리스너 미정리는 설계상 인지된 트레이드오프이거나 실질 위험이 낮아 즉각 수정이 필요한 수준은 아니다.

---

## 위험도

LOW

STATUS=success ISSUES=0
