# 동시성(Concurrency) 리뷰 결과

## 발견사항

변경된 코드 4개 파일을 동시성 관점에서 검토했다.

**파일 1 (`execution-seq-allocator.service.spec.ts`)**: 변경 내용은 `as never` 를 `as unknown as RedisConnectionProvider` 로 교체한 타입 캐스트 수정 전용이다. 동시성 로직 자체에 변경 없음.

전체 파일 컨텍스트에서 동시성 관련 코드를 추가 검토했다:

- **[INFO]** 동시성 regression 테스트 (`100개 동시 next() → 1..100 유일 집합`) 는 `Promise.all` 로 JS 단일 스레드 내 태스크를 동시 발사한다. 주석에 명시된 대로 fake Redis 의 `incrImpl` 은 `get/set` 사이에 `await` 가 없어 JS 이벤트 루프에서 원자적으로 동작한다. 실 Redis `INCR` 의 원자성을 정확히 모델링한 설계다. 문제 없음.
  - 위치: 단위 테스트 `describe('동시성 regression')`, `makeRedis` 의 `incrImpl`

- **[INFO]** `fallbackCounters` (in-memory degraded 카운터) 는 JS 단일 스레드이므로 별도 동기화 없이 안전하다. Worker thread 를 사용하지 않는 NestJS 환경에서 적합한 설계다.

**파일 2 (`execution-seq-allocator-load.e2e-spec.ts`)**: 변경 내용은 `WARMUP=20` / `SAMPLES=200` 인라인 상수를 모듈 레벨 상수 `LATENCY_WARMUP_COUNT` / `LATENCY_SAMPLE_COUNT` 로 추출한 리팩터링이다. 동시성 로직 변경 없음.

전체 파일 컨텍스트에서 추가 검토:

- **[INFO]** `allocateConcurrentlyAcrossInstances` 는 두 독립 Redis 연결(서로 다른 `ioredis` 인스턴스)에 교차 발사하는 분산 race 재현 설계다. `Promise.all` 을 사용해 두 인스턴스의 `next()` 를 인터리브하며, 이는 실 Redis `INCR` 원자성 검증 목적에 적합하다. 문제 없음.

- **[INFO]** `afterAll` 에서 `Promise.all([redisA?.quit(), redisB?.quit()])` 로 두 연결을 병렬 종료한다. `?.catch(() => undefined)` 로 오류를 삼켜 테스트 종료를 보장하는 방어적 패턴이다. 문제 없음.

**파일 3 (`system-status.e2e-spec.ts`)**: 변경 내용은 `EXPECTED_QUEUE_NAMES` 배열에 `'workspace-invitations-pruner'` 항목 추가 전용이다. 동시성 관련 코드 없음.

**파일 4 (`plan/complete/trigger-review-deferred-fixes.md`)**: 문서 파일. 동시성 관련 코드 없음.

## 요약

이번 변경은 타입 캐스트 개선(`as never` → `as unknown as`), 매직 넘버 상수화, 큐 목록 동기화, plan frontmatter 보강으로 구성되며, 동시성 로직 자체에 어떠한 변경도 포함하지 않는다. 전체 파일 컨텍스트의 동시성 관련 코드(분산 race 재현 e2e, 동시성 regression 단위 테스트, degraded in-memory 카운터)는 JS 단일 스레드 특성과 Redis `INCR` 원자성을 올바르게 활용하고 있어 동시성 관점 이슈가 없다.

## 위험도

NONE
