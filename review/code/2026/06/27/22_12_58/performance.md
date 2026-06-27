### 발견사항

**[INFO]** `assertMonotonicUniqueness` 에서 Set 생성 비용 (중복 검사)
- 위치: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` 라인 224
- 상세: `new Set(seqs).size` 는 O(N) 할당으로 1000개 요소 배열 복사본을 힙에 생성한다. 바로 위에서 이미 `for...of` 루프로 배열을 순회하고 있으므로 두 번 순회하는 셈이다. 테스트 규모(N=1000)에서는 무시할 수준이나 구조적 중복이다.
- 제안: 기존 루프에서 Set 을 동시에 채우거나 (`const seen = new Set<number>()`; loop 안에서 `seen.add(s)`), 또는 현 구조 유지 (N=1000 기준 영향 없음).

**[INFO]** 직렬 warmup 루프로 인한 latency 테스트 시작 지연
- 위치: 라인 324 (`for (let i = 0; i < WARMUP; i++) await allocA.next(executionId)`)
- 상세: WARMUP=20 회를 순차 `await` 로 실행한다. 각 호출이 Redis round-trip 을 수반하므로 도커 내부 네트워크 기준 ~20 × latency 의 직렬 지연이 발생한다. latency 측정 자체는 이후에 시작되므로 측정값 왜곡은 없지만, 테스트 전체 실행 시간에 영향을 준다.
- 제안: `Promise.all(Array.from({length: WARMUP}, () => allocA.next(executionId)))` 로 병렬화 가능. 단, warmup 의 목적이 "키 초기화 outlier 제외"이므로 순서 의존이 없다면 병렬화해도 동일한 효과. 현재 WARMUP=20 으로 영향이 미미해 변경 필요도는 낮다.

**[INFO]** `[...latenciesMs].sort(...)` 사본 정렬
- 위치: 라인 333
- 상세: 200개 요소 배열을 spread 로 복사한 뒤 정렬한다. O(N log N) 이며 N=200 에서 비용은 무시할 수준이다. 원본 보존이 필요하지 않다면 in-place 정렬로 할당을 절약할 수 있으나, 테스트 코드에서 가독성 우선의 합리적 선택이다.

**[INFO]** `docker-compose.e2e.yml` YAML anchor — 성능 영향 없음
- 위치: `docker-compose.e2e.yml` `x-redis-env: &redis-env` 블록
- 상세: DRY 리팩터링으로 런타임 성능에 영향을 주지 않는다. compose 파싱 단계의 anchor 확장은 CPU 비용이 무시할 수준이다.

### 요약

이번 변경은 순수 코드 품질(가독성·타입 안전성·DRY) 리팩터링이며 알고리즘·자료구조·I/O 경로를 바꾸지 않는다. `P95_PERCENTILE` 상수화와 `makeProvider` 반환 타입 명시는 컴파일 타임 비용만 변화시키고 런타임에는 영향이 없다. `assertMonotonicUniqueness` 에서 Set 생성이 배열 순회와 이중으로 일어나는 구조적 중복이 있지만 N=1000 규모에서는 무의미하다. Warmup 루프의 직렬 await 패턴은 병렬화 여지가 있으나 warmup 횟수(20)가 적어 실질 영향은 없다. 성능 관점에서 조치가 필요한 결함은 발견되지 않았다.

### 위험도

NONE
