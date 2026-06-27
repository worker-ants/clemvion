# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] allocateConcurrentlyAcrossInstances: Promise.all 동시 발사 — Node.js 단일 스레드 한계
- 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 99~104
- 상세: 1000개의 `next()` Promise 를 for loop 에서 배열에 쌓은 후 `Promise.all` 로 동시 발사한다. Node.js 이벤트 루프는 단일 스레드이므로 "진정한 병렬"이 아닌 I/O 비동기 인터리빙이다. 그러나 이는 의도된 설계이며 테스트 목적(Redis INCR 원자성 검증)에 완전히 부합한다. Redis 서버 측에서는 각 클라이언트 연결의 INCR 명령이 단일 스레드로 직렬화되므로 이 방식이 분산 race 를 충실히 재현한다. 추가로, 1000개 Promise 를 한꺼번에 발사하면 ioredis 내부의 미연결·backpressure 상황에서 큐 누적이 발생할 수 있으나, 60초 타임아웃 내에 수렴되며 테스트 자체는 결과의 집합 속성만 검증하므로 실질적 문제는 없다.
- 제안: 현재 구현으로 충분. 대규모 배치(예: 10만 이상) 확장 시에는 청크 단위(예: 배치 크기 1000) 분할 발사를 고려할 수 있지만, 현재 N=1000 규모에서는 불필요하다.

### [INFO] releaseBoth: 동기 release 호출 — 비동기 DEL 과의 타이밍
- 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 138~141
- 상세: `releaseBoth` 는 `allocA.release()` / `allocB.release()` 를 동기로 호출한다. `release()` 내부에서 Redis `DEL` 은 fire-and-forget(`.catch` 만 달린 비동기) 이다. 테스트 격리를 위해 `finally` 블록에서 `releaseBoth` 를 호출하지만 DEL 이 완료되기 전에 다음 테스트가 시작될 수 있다. 각 테스트가 `randomUUID()` 로 고유 executionId 를 생성하므로 키 충돌은 없으나, TTL(24시간)이 붙은 test key 가 Redis 에 잔류할 수 있다. 이는 기능적 문제는 아니고 테스트 Redis 키 누적에 해당한다.
- 제안: e2e 환경에서는 허용 가능. 필요 시 `afterAll` 에서 명시적 DEL promise 를 await 해 정리할 수 있으나, 각 테스트 UUID 가 격리를 보장하므로 강제 사항은 아니다.

### [INFO] 라이브러리 pipeline 결과에서의 타입 가정 (서비스 코드)
- 위치: `execution-seq-allocator.service.ts` 라인 87~92 (변경 코드는 아니지만 테스트 대상 서비스)
- 상세: `pipeline().exec()` 결과에서 `results?.[0]?.[1]` 을 `Number()` 로 변환한다. ioredis pipeline 은 결과 배열의 각 엔트리를 `[Error | null, unknown]` 로 반환한다. INCR 의 반환값은 Redis 정수이므로 타입 캐스팅은 안전하다. 서비스 코드 자체의 동시성 구현은 Redis 원자 INCR 에 전적으로 의존하며 별도의 클라이언트측 동기화를 두지 않은 것이 올바른 설계다.
- 제안: 해당 없음. 구현 정확.

### [INFO] fallbackCounters Map 접근의 스레드 안전성
- 위치: `execution-seq-allocator.service.ts` 라인 49, 105, 109~111
- 상세: `fallbackCounters` 는 서비스 인스턴스 멤버 `Map` 이다. Node.js 단일 스레드 모델에서 동일 이벤트 루프 내 동시성은 발생하지 않으므로 별도 mutex 없이 안전하다. 테스트에서 두 별개 인스턴스(`allocA`, `allocB`)가 각자의 `fallbackCounters` 를 독립적으로 소유하므로 공유 메모리 경쟁 조건도 없다.
- 제안: 현재 구현 적절.

## 요약

변경 코드는 `ExecutionSeqAllocator` 의 분산 Redis INCR 원자성을 경험적으로 검증하는 e2e 테스트이다. 핵심 동시성 설계(Redis INCR 원자성, 두 독립 ioredis 연결을 통한 cross-instance race 재현, Promise.all 인터리빙)는 정확하고 의도에 부합한다. 비동기 패턴 사용(async/await, Promise.all, pipeline exec) 이 모두 올바르며, await 누락·이벤트 루프 블로킹·데드락·경쟁 조건은 발견되지 않았다. `releaseBoth` 의 fire-and-forget DEL 은 테스트 격리 관점의 경미한 사항이나 UUID 기반 키 격리로 기능적 영향이 없다. `docker-compose.e2e.yml` 변경은 환경변수 추가에 불과해 동시성 관련 사항이 없다.

## 위험도

NONE
