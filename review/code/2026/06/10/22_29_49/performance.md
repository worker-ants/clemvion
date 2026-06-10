# 성능(Performance) 리뷰 결과

## 발견사항

### **[WARNING]** `deepFreeze` — 첫 branch 에서 O(N·D) 재귀 비용, N+1 구조적 호출 패턴
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` — `deepFreeze`, `freezeSharedCacheValues`
- 상세: `freezeSharedCacheValues` 는 `nodeOutputCache` 와 `structuredOutputCache` 두 캐시 각각에 대해 모든 값 객체를 `deepFreeze` 재귀 순회한다. 캐시 항목 수 K, 값 객체 평균 depth D 라 하면 첫 branch 에서 O(K·D) 노드 방문이 발생한다. branch 수가 최대 16 인 경우 두 번째 branch 이후는 `Object.isFrozen` 조기 반환으로 탈출하지만, `freezeSharedCacheValues` 루프 자체(K 회 반복)는 모든 branch 에서 실행된다. 즉 총 비용은 O(K·D + (branchCount-1)·K) = O(K·(D + branchCount)) 이다. 캐시 항목이 많고 branch 수가 16 에 근접할수록 루프 오버헤드가 누적된다. dev/test 전용이라 production 영향은 없으나, 항목 수가 수백 개인 통합 테스트에서 테스트 실행 시간이 선형적으로 증가한다.
- 제안: `freezeSharedCacheValues` 내에서 값이 이미 frozen 이면 루프를 조기 탈출하는 guard 를 추가한다. 예: `for (const v of Object.values(cache)) { if (!Object.isFrozen(v)) deepFreeze(v); }` — 이미 구현된 내용과 동일하나, 루프 자체를 skip 하는 캐시-레벨 guard(`if (Object.values(cache).every(Object.isFrozen)) return cache;`)를 첫 줄에 두면 두 번째 branch 이후 루프 진입 자체를 O(1) 에 단락할 수 있다. 또는 JSDoc 에 "비용은 첫 branch 에 집중되고 이후 branch 는 K 회 isFrozen 체크만 발생" 을 명시해 미래 기여자가 의도를 인지하게 한다 (이미 주석에 일부 명시됨, 확인됨).

### **[INFO]** `continuation-bus.service.ts` — `nextSeq` 직렬 2-RTT 비용 (`INCR` + `EXPIRE`)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` — `nextSeq` 메서드
- 상세: `await client.incr(key)` 완료 후 `await client.expire(key, ttlSec)` 가 순차 실행된다. 두 명령이 동일 Redis 연결에서 항상 2 RTT 를 소비한다. `EXPIRE` 가 `INCR` 결과에 의존하지 않으므로(키 존재 여부와 무관하게 항상 실행) `MULTI/EXEC` 파이프라인으로 묶을 수 있다. 고빈도 continuation publish 시나리오에서 RTT 절반 감소 효과가 있다.
- 제안: `EXPIRE` 를 fire-and-forget(`void client.expire(...).catch(logger.warn)`)으로 전환하거나, Redis pipeline(`client.pipeline().incr(key).expire(key, ttl).exec()`)으로 단일 왕복으로 묶는다. 단 EXPIRE 실패 처리 방식(현재 catch swallow)은 동일하게 유지. 이번 변경 범위 외의 기존 코드이므로 즉각 수정 필요는 없으나 고빈도 경로 개선 후보.

### **[INFO]** `releaseLock` — Lua 스크립트 문자열을 메서드-로컬 변수로 매 호출 선언
- 위치: `continuation-bus.service.ts` — `releaseLock` 메서드
- 상세: `const script = "if redis.call('get', KEYS[1]) == ARGV[1] then ..."` 가 메서드 호출마다 로컬 스택에 선언된다. V8 엔진은 문자열 리터럴을 상수 풀에서 재사용하므로 실제 메모리 할당이 발생하지 않을 가능성이 높다. 그러나 관용적으로 `private static readonly RELEASE_LOCK_SCRIPT` 로 추출하는 것이 의도를 명확히 한다. 성능 영향은 측정 불가 수준.
- 제안: `private static readonly RELEASE_LOCK_SCRIPT = "..."` 로 추출. 이번 변경 범위 외 기존 코드, INFO 수준.

### **[INFO]** `deepFreeze` — `typeof value === 'function'` 분기 미처리로 불필요한 함수 freeze 가능
- 위치: `parallel-executor.ts` — `deepFreeze` 함수
- 상세: `typeof value !== 'object'` 분기가 `function` 타입을 거르지 않는다. 함수 타입은 `typeof === 'function'` 으로 판별되므로 이 분기에서 return 되고 `Object.freeze(함수)` 는 호출되지 않는다. 따라서 실질 문제는 없다. 단, 코드만 읽으면 함수 값이 포함된 캐시에서 freeze 가 적용될지 불명확하다. `nodeOutputCache` 값이 `JsonValue` 계약으로 한정되어 있으면 이 경로는 도달 불가이다.
- 제안: 현재 동작은 안전하다. `JsonValue` 타입 제약을 컴파일 타임에 강제하면 이 경로의 불확실성이 사라진다.

### **[INFO]** `FREEZE_BRANCH_CACHE` — 모듈 로드 시 1회 평가로 런타임 env 변경 미반영
- 위치: `parallel-executor.ts` 라인 35-36
- 상세: 모듈 최초 import 시 `process.env.NODE_ENV` 를 읽어 상수로 고정한다. Jest 에서 `process.env.NODE_ENV` 를 변경해도 이미 평가된 상수는 갱신되지 않는다. 성능 관점에서는 모듈-레벨 상수이므로 매 호출마다 env lookup 을 피하는 장점이 있다. 동작 자체는 의도된 설계.
- 제안: 현 구조 유지. 성능 측면에서 최적 패턴이다.

---

## 요약

이번 변경 세트의 성능 관련 핵심은 `parallel-executor.ts` 의 `deepFreeze` / `freezeSharedCacheValues` 도입이다. `FREEZE_BRANCH_CACHE` allowlist 로 production 은 완전히 배제되어 운영 성능에 영향이 없다. dev/test 환경에서는 `O(K·D + (branchCount-1)·K)` 비용이 발생하는데, 첫 branch 이후 `Object.isFrozen` 조기 반환으로 deep 순회를 회피하나 캐시 항목 수 K 만큼의 루프는 모든 branch 에서 실행된다는 점이 경고 수준의 주의 사항이다. 캐시-레벨 guard 를 루프 진입 전에 추가하면 두 번째 branch 이후 비용을 O(1) 로 단락할 수 있다. `continuation-bus.service.ts` 의 직렬 2-RTT(`INCR` + `EXPIRE`)와 `releaseLock` Lua 스크립트 상수는 이번 변경 범위 외 기존 코드로 즉각 수정 필요는 없다. 나머지 변경(함수명 rename, deprecated 코드 삭제)은 성능에 중립적이다.

---

## 위험도

LOW

STATUS=success ISSUES=1
