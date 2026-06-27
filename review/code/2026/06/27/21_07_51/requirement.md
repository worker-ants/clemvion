# 요구사항(Requirement) 리뷰 결과

## 발견사항

### 기능 완전성

- **[INFO]** 테스트 3개가 plan 의 모든 작업 단위 체크박스를 커버한다: (1) 두 인스턴스 동시 발급 → union=1..N assert, (2) 1000 events/s 부하 + throughput 단조 유일, (3) single-instance latency < 5ms. 기능 완전성 문제 없음.

- **[INFO]** `assertMonotonicUniqueness` 는 Set 크기(중복 0), min(=1), max(=expectedCount) 세 조건으로 `1..N` 연속성을 완전히 단언한다. gap이 있더라도 min=1 + max=N + size=N 이면 빠짐이 없다는 것이 수학적으로 성립하므로 논리상 충분.

### 엣지 케이스

- **[INFO]** `allocateConcurrentlyAcrossInstances` 는 `total % 2 !== 0` 이면 즉시 throw 한다. `ALLOC_COUNT = 1000`(짝수)로 고정돼 있어 테스트 흐름에서 이 경로는 트리거되지 않는다. 방어는 올바르나 테스트 내에서만 사용되는 상수이므로 런타임 리스크 없음.

- **[INFO]** `beforeAll` 에서 `expect(pongA).toBe('PONG')` 로 Redis 가용성을 명시 확인한다. 불가용 시 allocator 가 degraded(in-memory) 로 빠져 유일성 assert 가 거짓 통과하는 경로를 구조적으로 차단하고 있다. degraded false-pass 방지 설계가 의도에 부합.

- **[INFO]** `afterAll` 에서 `?.quit().catch(() => undefined)` 로 초기화 실패 시 `redisA`/`redisB` 가 undefined 일 경우를 optional chaining 으로 방어한다. 단 TypeScript 타입 상 `let redisA: Redis` 는 undefined 를 포함하지 않으므로 `?.` 가 실효성이 없으나, beforeAll 실패 시 변수가 미할당 상태에서 afterAll 이 호출될 수 있는 런타임 상황을 `?.` 로 방어하는 것은 방어적 설계 관점에서 적절.

- **[INFO]** latency 테스트의 중앙값 계산: `sorted[Math.floor(sorted.length / 2)]`는 200 샘플에서 index 100(0-based)을 선택하므로 하위 50.5번째 값이다. 엄밀한 중앙값(99번과 100번의 평균)과 0.5 인덱스 차이가 나지만, 절댓값 목표(< 5ms)에 대해 실측 median ~0.08ms 수준에서 이 차이는 무의미. 기능 요건 충족에 영향 없음.

### TODO/FIXME

- **[INFO]** TODO, FIXME, HACK, XXX 주석 없음. 미완성 작업 시사 없음.

### 의도와 구현 간 괴리

- **[INFO]** 테스트 이름 "1000 events/s 부하에서 단조 유일 보장 + throughput 측정"은 구현과 일치한다. `throughput = (ALLOC_COUNT / elapsedMs) * 1000` 공식이 정확히 events/s 를 계산하며 `expect(throughput).toBeGreaterThanOrEqual(1000)` 으로 단언한다.

- **[INFO]** `releaseBoth` 헬퍼의 주석 "두 인스턴스가 모두 발급한 키이므로 양쪽 release 로 lifecycle 계약을 완결한다"는 실제 구현(allocA.release + allocB.release 모두 호출)과 일치. RESOLUTION.md 에서 WARNING 1(allocB.release 미호출)이 이미 수정됐음을 확인.

### 에러 시나리오

- **[INFO]** Redis 연결 실패 시 beforeAll 의 expect 가 실패하여 테스트 스위트 전체가 명시적 오류로 중단된다. allocator 가 degraded fallback으로 넘어가 유일성 assert 를 우연히 통과하는 오탐 경로가 차단됨.

- **[INFO]** `afterAll` 이 `quit().catch(() => undefined)` 로 Redis 연결 정리 실패를 swallow 한다. teardown 에서 에러를 무시하는 것은 테스트 인프라 관례상 적절(테스트 결과에 영향 없음).

### 데이터 유효성

- **[INFO]** `makeProvider` 어댑터는 `getClient()` 가 항상 live ioredis 인스턴스를 반환한다. `ExecutionSeqAllocator.getClient()` 는 `this.redisConn.getClient()` 를 호출하므로 provider 계약이 충족된다. `as never` 타입 캐스트에 인라인 주석으로 의도가 명시돼 있어 타입 안전성 우회의 근거가 기록됨.

### 비즈니스 로직

- **[INFO]** plan 의 작업 단위 (1) 분산 race assert, (2) 1000 events/s 부하 측정, (3) latency < 5ms 가 세 `it` 블록에 각각 대응한다. 비즈니스 요건과 구현 간 1:1 매핑 확인.

- **[INFO]** 검증 방식의 설계 결정(2-container harness 대신 real-Redis integration test)은 plan 에 근거와 함께 명시됐으며, Redis 입장에서 "별도 ioredis 연결 = 별도 클라이언트"라는 전제가 코드 주석과 plan 에 모두 기술됨. 검증 대상(INCR 원자성)과 검증 수단(독립 ioredis 연결 2개) 간 동치 논리가 충분히 설명됨.

### 반환값

- **[INFO]** 모든 `it` 블록은 `async` 함수로 명시적으로 Promise 를 반환하거나 `finally` 블록에서 동기적으로 cleanup 을 수행한다. `releaseBoth` 는 반환값 없는 void 함수로 의도에 맞음. `allocateConcurrentlyAcrossInstances` 는 `Promise.all(calls)` 를 반환해 호출자가 결과를 받아 assert 할 수 있음.

### 관련 spec 본문 일치 여부 (spec fidelity)

- **[INFO]** 코드 주석은 `spec/5-system/14-external-interaction-api.md §R7`, `spec/5-system/6-websocket-protocol.md §2.2 (seq envelope)` 를 참조한다.
  - EIA spec §R7 "구현 전제": "execution 별 atomic INCR (Redis `INCR exec:seq:<id>`) 로 발급되는 seq counter"가 구현 소스(`execution-seq-allocator.service.ts` 의 `exec:seq:<id>` INCR pipeline)와 일치.
  - 본 테스트가 검증하는 "분산 monotonic 보장 = Redis INCR 원자성"은 §R7 의 구현 전제를 경험적으로 확인하는 목적이며, spec 이 직접 e2e 부하 테스트를 요구하는 항목은 없다. 테스트가 spec 을 위반하는 요소는 발견되지 않음.
  - WS §2.2 의 `seq` 필드 구조(`seq` + `timestamp` 평면 병합 envelope)는 본 테스트가 직접 검증하는 범위가 아니며, `ExecutionSeqAllocator.next()` 의 반환값(단조 증가 정수)이 해당 필드에 매핑됨을 unit spec 이 커버하고 있음.

- **[INFO]** spec 에 명시된 성능 기준은 없다(§R7 에 throughput/latency 숫자 없음). plan 의 수용 기준("1000 events/s", "< 5ms")은 plan 문서 내 결정 사항이며, 이것이 spec 에 반영돼 있지 않은 것은 [SPEC-DRIFT]가 아니라 plan-level 기준으로 의도된 상태다. spec 반영 필요 여부는 product owner 결정 사항. 현재 코드는 plan 기준을 충실히 구현.

- **[INFO]** docker-compose.e2e.yml 변경(REDIS_HOST/REDIS_PORT 를 `backend-e2e-runner` 환경변수에 추가)은 spec 에 대응하는 항목이 없으나 인프라 설정 변경으로 spec-fidelity 대상이 아님. 기존 `backend-e2e` 서비스에 이미 있는 환경변수와 값이 동일하여 일관성 확인.

---

## 요약

변경은 plan의 모든 필수 작업 단위를 충실히 구현한 e2e 검증 테스트와 docker-compose 인프라 보조 변경으로 구성된다. 세 테스트(분산 race assert, throughput 측정, latency 마이크로벤치)가 plan 요건에 1:1 대응하고, RESOLUTION.md 에서 이전 리뷰의 WARNING(allocB.release 미호출)이 `releaseBoth` 헬퍼 도입으로 이미 수정됐음이 확인된다. spec §R7 의 "Redis INCR 원자성으로 분산 monotonic 보장"을 경험적으로 검증하는 목적과 구현이 일치하며, spec 위반·기능 누락·에러 경로 미처리는 발견되지 않았다. 추가 INFO 사항은 모두 참고 수준이며 차단 항목 없음.

## 위험도

NONE
