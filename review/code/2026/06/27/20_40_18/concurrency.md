# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] fallbackCounters Map 의 비원자적 read-modify-write (degraded 경로)

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-seq-load-verify-6f5ebc/codebase/backend/src/modules/websocket/execution-seq-allocator.service.ts` 라인 109-111
- 상세: `next()` 의 catch 블록에서 `fallbackCounters.get()` → `+1` → `set()` 이 비원자적이다. Node.js 이벤트 루프는 단일 스레드이므로 `await` 없는 동기 순서에서는 인터리빙이 발생하지 않는다. 그러나 `next()` 함수 자체는 `async` 이며 `await client.pipeline()...exec()` 이 실패해 catch 로 떨어지는 경로에서도, catch 블록 내부는 동기 실행이므로 실제 경쟁 조건은 없다. 단, 복합 연산의 논리적 원자성이 코드만 보면 불명확해 유지보수 위험이 존재한다.
- 제안: 기능상 문제 없음(INFO 수준). 주석으로 "catch 블록은 동기 실행이므로 Map r-m-w 가 단일 tick 내 직렬화된다"를 명시하면 가독성이 향상된다.

### [INFO] 테스트에서 allocB.release() 호출 누락

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-seq-load-verify-6f5ebc/codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` 라인 155, 189
- 상세: 첫 번째·두 번째 테스트의 `finally` 블록에서 `allocA.release(executionId)` 는 호출하나 `allocB.release(executionId)` 는 호출하지 않는다. `release()` 는 `fallbackCounters` 에서 키를 삭제하고 Redis 키를 best-effort DEL 한다. 테스트는 매 케이스마다 `randomUUID()` 로 독립된 executionId 를 사용하므로 테스트 간 오염은 없다. 다만 `afterAll` 에서 Redis 연결을 quit 하므로 Redis 측 키는 TTL(24시간)이 경과해야 회수된다. e2e 환경에서 ephemeral Redis 컨테이너를 사용하므로 실질적 누수는 없지만, 정합성 차원에서 allocB.release() 도 호출하는 것이 바람직하다.
- 제안: `finally` 블록을 `allocA.release(executionId); allocB.release(executionId);` 로 보완하거나, `afterAll` 에서 공통 cleanup 처리.

### [INFO] Promise.all 1000-fan-out 과 이벤트 루프

- 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 141-146, 165-171
- 상세: 루프 내에서 `next()` 를 즉시 push 하여 1000 개의 Promise 를 동시에 생성한다. Node.js 이벤트 루프 단일 스레드에서 ioredis 는 내부적으로 커맨드를 큐잉하고 TCP write 를 일괄 처리하므로, 실제로는 pipeline 형태로 Redis 에 전달된다. 이는 의도된 동시성 극대화 패턴이며 이벤트 루프 블로킹을 유발하지 않는다. 단, 매우 큰 N(예: 10만+)으로 확장 시 JS 힙 메모리 압박이 발생할 수 있다. 현재 N=1000 수준에서는 안전하다.
- 제안: 현재 규모(N=1000)에서는 문제 없음. 향후 N 증가 시 batched Promise.all 패턴으로 전환 고려.

### [INFO] Math.min/Math.max spread 연산자 스택 안전성

- 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 329-330
- 상세: `Math.min(...seqs)` / `Math.max(...seqs)` 는 배열을 spread 인수로 전달한다. N=1000 에서는 함수 인수 개수 제한(일반적으로 수만 개)에 걸리지 않으므로 안전하다. 다만 N 이 크게 증가하면 `RangeError: Maximum call stack size exceeded` 위험이 있다.
- 제안: N=1000 규모에서 안전. 미래 확장성을 위해 `seqs.reduce((a, b) => Math.min(a, b))` 패턴 고려 가능.

## 요약

변경 코드는 `ExecutionSeqAllocator` 의 Redis INCR 원자성을 두 개의 독립 ioredis 연결로 경험적으로 검증하는 e2e 테스트와 docker-compose 환경 변수 추가로 구성된다. 핵심 원자성 보장은 Redis 서버 단일 스레드의 INCR 직렬화에 의존하며, 이는 테스트 설계상 명확히 문서화되어 있다. Node.js 단일 스레드 이벤트 루프 모델하에서 동시성 결함은 없다. `allocB.release()` 누락은 e2e 환경(ephemeral Redis)에서 실질적 영향이 없으나 정합성 차원의 개선 사항이다. 전반적으로 동시성 설계는 견고하며 위험 요소는 INFO 수준에 그친다.

## 위험도

LOW
