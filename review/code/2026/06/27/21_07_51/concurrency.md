# 동시성(Concurrency) 리뷰 결과

## 발견사항

- **[INFO]** `Promise.all` 기반 동시 발사 — async/await 패턴 적합
  - 위치: `allocateConcurrentlyAcrossInstances`, 라인 111–115
  - 상세: `calls` 배열에 모든 Promise 를 쌓은 뒤 `Promise.all` 로 단일 await. Node.js 단일 스레드 이벤트 루프에서 1000 개 Promise 를 동시에 inflight 시키는 올바른 패턴이다. ioredis 는 내부적으로 command pipeline 을 사용해 소켓 레벨 다중화를 수행하므로, 이 방식이 race 를 최대화하는 데 적합하다.
  - 제안: 없음 (의도된 설계).

- **[INFO]** `beforeAll` expect 실패 시 후속 테스트 변수 초기화 미완료
  - 위치: `beforeAll` 블록, 라인 145–159
  - 상세: `expect(pongA).toBe('PONG')` 실패 시 Jest 는 `beforeAll` 자체를 실패 처리하고 describe 내 모든 테스트를 skip 한다. `allocA` / `allocB` 는 미초기화 상태이지만, skip 된 테스트 바디는 실행되지 않으므로 런타임 NPE 발생 경로는 없다. `afterAll` 의 `redisA?.quit()` optional chaining 이 이 시나리오를 올바르게 처리한다.
  - 제안: 현 구현으로 충분. 문서상 설명과 코드가 일치한다.

- **[INFO]** 테스트 3 (latency) 의 warmup 루프는 직렬 await
  - 위치: 라인 228 (`for (let i = 0; i < WARMUP; i++) await allocA.next(executionId)`)
  - 상세: warmup 과 sample 측정 모두 직렬 await 로 처리한다. 이는 의도된 설계다 — latency 테스트는 단일 호출 왕복 시간을 측정하는 것이 목적이므로 직렬 순차 호출이 올바르다. 병렬화하면 throughput 측정이 되어 목적에 어긋난다.
  - 제안: 없음.

- **[INFO]** `releaseBoth` 는 동기 함수이며 `release()` 반환값을 무시
  - 위치: 라인 169–172
  - 상세: `allocA.release` 와 `allocB.release` 가 Promise 를 반환하는 비동기 함수라면 await 없이 호출하는 경우 해제가 완료되지 않은 채 다음 코드로 진행될 수 있다. 그러나 이는 `finally` 블록 내 cleanup 이므로, 테스트 결과 정확성에는 영향이 없다 (release 는 Redis 키 TTL 또는 메모리 정리 역할이고, 테스트 assertions 는 이미 완료된 상태). 만약 `release` 가 Redis DEL 등 비동기 I/O 를 수행한다면, 연속 테스트 실행 시 키가 완전히 지워지기 전에 다음 테스트의 `randomUUID()` 기반 executionId 가 새 키 공간을 사용하므로 실질적 충돌 가능성은 0 이다.
  - 제안: `release()` 의 반환 타입을 확인해 비동기라면 `async releaseBoth` + `await Promise.all([allocA.release(...), allocB.release(...)])` 로 변경하면 명시성이 높아진다. 그러나 각 테스트가 UUID 기반의 독립 executionId 를 사용하므로 테스트 정확성에는 영향 없음.

- **[INFO]** 테스트 간 shared `allocA` / `allocB` 인스턴스 재사용
  - 위치: describe 스코프 변수, 라인 140–143
  - 상세: 세 개 테스트가 같은 `allocA` / `allocB` 를 재사용한다. Jest 는 기본적으로 describe 내 테스트를 직렬로 실행하므로 동시성 문제는 없다. 단, `--runInBand` 없는 병렬 worker 환경에서도 describe 내부 테스트는 직렬 실행이 보장된다 (Jest 스펙). executionId 를 각 테스트가 독립적으로 `randomUUID()` 생성하므로 키 충돌도 없다.
  - 제안: 없음.

- **[INFO]** `assertMonotonicUniqueness` 의 `Set` 생성 원자성
  - 위치: 라인 133
  - 상세: `new Set(seqs)` 는 단일 스레드 Node.js 에서 원자적으로 실행되므로 `Promise.all` 완료 후 동기 호출 시 경쟁 조건 없음. seqs 배열은 불변 스냅샷으로 전달된다.
  - 제안: 없음.

## 요약

본 변경은 `ExecutionSeqAllocator` 의 분산 INCR 원자성을 실 Redis + 두 개의 독립 ioredis 연결로 검증하는 e2e 부하 테스트 파일과, 해당 테스트가 필요로 하는 Docker 환경변수 추가로 구성된다. 동시성 설계 관점에서 핵심 패턴인 `Promise.all` 기반 1000 개 INCR 동시 발사는 올바르며, Node.js 이벤트 루프를 차단하지 않는다. `beforeAll` / `afterAll` 의 연결 초기화·정리는 optional chaining 과 catch-ignore 로 안전하게 처리된다. `releaseBoth` 가 동기 함수로 되어 있어 `release()` 가 비동기일 경우 명시성이 떨어지는 관찰이 있으나 각 테스트가 UUID 기반 독립 키를 사용하므로 실질적 영향은 없다. 전반적으로 동시성 패턴이 의도된 설계와 일치하며, 발견된 모든 항목은 INFO 수준이다.

## 위험도

NONE
