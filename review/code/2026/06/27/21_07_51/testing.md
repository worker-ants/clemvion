# 테스트(Testing) 리뷰

## 발견사항

### **[INFO]** degraded(in-memory fallback) 경로에 대한 전용 테스트 없음
- 위치: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` 전체
- 상세: 본 e2e spec 은 `beforeAll`에서 PING 으로 실 Redis 가용성을 강제 확인한 뒤 Redis 정상 경로만 검증한다. `ExecutionSeqAllocator.next()`의 `catch` 블록(in-memory degraded 경로 — Redis 장애 시 `fallbackCounters`로 전환)은 이 파일에서 직접 커버되지 않는다. 해당 경로는 sibling unit spec(`execution-seq-allocator.service.spec.ts`)이 커버해야 하는데, unit spec 에 그 시나리오가 존재하는지는 본 diff 범위 밖이다. e2e 단에서 Redis 장애 시나리오를 재현하려면 별도 격리가 필요하므로 현재 e2e 에서 제외된 것은 설계상 타당하다. 그러나 unit spec 에도 degraded 경로 검증이 없다면 커버리지 갭이다.
- 제안: sibling unit spec(`execution-seq-allocator.service.spec.ts`)에 "Redis INCR 실패 시 in-memory fallback 으로 단조 증가 유지" 케이스가 포함되어 있는지 확인하고, 없으면 추가한다. 본 e2e spec 에서는 불요.

### **[INFO]** latency 테스트의 테스트 순서 의존성
- 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 185–222 (테스트 3)
- 상세: 테스트 3("single-instance 발급 latency < 5ms")은 주석에서 "테스트 1·2 가 먼저 실행돼 연결이 warmup 된 상태"를 명시적 전제로 기술한다. 이 테스트는 자체 WARMUP(20회) 을 수행하므로 실질적 격리는 어느 정도 확보되지만, Jest 의 테스트 순서 보장에 묵시적으로 의존하는 구조다. `--randomize` 플래그 사용 시 또는 단독 실행 시(`it.only`) 자체 WARMUP 만으로는 cold-start 에서 임계값 5ms 이내를 안정적으로 충족하지 못할 수 있다.
- 제안: 주석에 "단독 실행 시 cold-start 로 인해 median 이 5ms 에 근접할 수 있음 — CI 에서는 전체 suite 순서대로 실행됨을 보장" 내용을 추가해 의도를 문서화한다. WARMUP 횟수를 상향(예: 50)하거나 임계값을 10ms 로 완화하는 방법도 검토 가능.

### **[INFO]** `assertMonotonicUniqueness`의 gap 검증 간접성
- 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 88–101
- 상세: 현재 구현은 `Set.size == expectedCount` (중복 0) + `min == 1` + `max == expectedCount` 세 조건으로 1..N 완전 집합을 단언한다. 이 세 조건의 논리적 결합이 실제로 gap 없음을 보장하는 것은 수학적으로 참이다(자연수 범위에서 크기 N, 최솟값 1, 최댓값 N인 중복 없는 집합 = {1..N}). 따라서 기능 정확성 문제는 없다. 단, 실패 메시지가 어떤 gap 이 발생했는지를 보여주지 않아 디버깅 시 불투명하다.
- 제안: 단언 자체는 유지하되, 실패 시 진단 가독성을 위해 정렬된 배열과 기대 배열의 첫 불일치 위치를 로그로 출력하는 선택적 개선을 고려할 수 있다. 현재도 충분히 수용 가능한 수준이므로 필수 아님.

### **[INFO]** `allocateConcurrentlyAcrossInstances` 함수에 짝수 보장 외 다른 엣지 케이스 검증 없음
- 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 64–81
- 상세: `total % 2 !== 0`에 대해 `throw`로 방어하는 것은 올바르다. 그러나 `total === 0` 또는 음수 입력에 대한 방어가 없다. 이는 내부 헬퍼 함수이며 현재 호출처는 모두 상수 `ALLOC_COUNT = 1000`을 전달하므로 실용적 리스크는 없다.
- 제안: 내부 헬퍼이므로 현재 수준 허용. 문서에 "양의 짝수 정수만 지원" 명시를 추가하면 충분.

### **[INFO]** beforeAll 내 `expect` 사용 시 실패 메시지의 비명확성
- 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 115–117
- 상세: `beforeAll` 안에서 `expect(pongA).toBe('PONG')`이 실패하면 Jest 는 해당 단언 실패를 모든 테스트의 실패로 보고하되, 실패 원인이 "Redis 연결 불가" 임을 메시지에서 바로 알기 어렵다. 기능 정확성 문제는 없으나 CI 에서 "Redis not available"을 즉시 인지하기 위한 추가 컨텍스트 부재.
- 제안: `expect(pongA).toBe('PONG')` 앞에 연결 실패 시 던지는 커스텀 에러로 대체하거나 `.toBe('PONG', 'Redis A connection failed')` 식의 메시지 보강을 고려한다. 또는 현재 패턴을 유지하되 그 위에 `if (pongA !== 'PONG') throw new Error('Redis A is not available')` 를 추가할 수 있다. 필수 아님.

## 요약

이번 변경의 핵심 산출물인 `execution-seq-allocator-load.e2e-spec.ts`는 테스트 목적에 잘 부합한다. 실 Redis 연결 두 개를 분리해 분산 race 를 재현하는 접근은 INCR 원자성 검증 관점에서 충실하며, PING 으로 Redis 가용성을 사전 확인해 degraded-false-pass 를 방지하는 설계는 특히 견고하다. `releaseBoth()` 헬퍼 추출(RESOLUTION 적용 후)로 lifecycle 계약의 완결성도 확보되었다. 발견된 사항은 모두 INFO 수준이며, 주요 논점은 (1) degraded 경로가 sibling unit spec 에서 적절히 커버되는지 확인 필요, (2) 테스트 3이 테스트 순서에 묵시적으로 의존함을 주석으로 더 명확히 문서화할 것, 두 가지다. 전체적으로 테스트 품질은 양호하다.

## 위험도

NONE
