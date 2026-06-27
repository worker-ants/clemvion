# 성능(Performance) 리뷰

## 발견사항

### INFO: 타입 캐스팅 방식 변경 (`as never` → `as unknown as`) — 런타임 영향 없음
- 위치: `execution-seq-allocator.service.spec.ts` 전체 diff (4곳 동일 패턴)
- 상세: `as never` 를 `as unknown as RedisConnectionProvider` 로 교체했다. 이는 순수 컴파일타임 타입 검사 변경이며, 트랜스파일 후 JS 런타임에는 캐스팅 코드가 남지 않는다. 성능 영향은 0이다.
- 제안: 없음.

### INFO: 매직 넘버 상수화 (`LATENCY_WARMUP_COUNT`, `LATENCY_SAMPLE_COUNT`) — 런타임 영향 없음
- 위치: `execution-seq-allocator-load.e2e-spec.ts` diff (상수 선언 + 두 사용처 치환)
- 상세: 인라인 리터럴 `20`·`200` 을 모듈 스코프 `const` 로 올린 변경이다. V8 은 이를 동일하게 인라인 최적화하므로 성능 변화는 없다. 가독성·유지보수성 개선에 해당한다.
- 제안: 없음.

### INFO: e2e `assertMonotonicUniqueness` — `new Set(seqs)` 단일 선형 패스 설계 확인
- 위치: `execution-seq-allocator-load.e2e-spec.ts` L628–641 (변경 없는 컨텍스트 코드)
- 상세: diff 외 기존 코드이지만 성능 점검 맥락에서 확인했다. `new Set(seqs)` 는 O(N), min/max 산출도 단일 for-of 루프 O(N) 으로 구현되어 있다. 표본 수 1,000 기준 V8 스택 인자 한도(~65,536) 이하이므로 `Math.min/max(...seqs)` 스프레드도 안전하나, 코드가 이미 명시적 루프를 쓰고 있어 문제없다.
- 제안: 없음.

### INFO: latency 측정 루프 내 `push` 호출 — 사전 할당 부재 (무해)
- 위치: `execution-seq-allocator-load.e2e-spec.ts` L741–744
- 상세: `const latenciesMs: number[] = []` 후 `LATENCY_SAMPLE_COUNT(200)` 회 `push` 한다. 사전 `new Array(200)` 으로 capacity 예약하면 재할당 0회가 보장되나, 200개 규모에서 차이는 나노초 미만이며 측정 루프 자체가 Redis 왕복(수 ms) 지배적이다.
- 제안: 현행 유지. 표본 수가 수만 단위로 증가하면 `Array.from({ length: LATENCY_SAMPLE_COUNT })` 사전 할당을 고려할 수 있다.

### INFO: `system-status.e2e-spec.ts` — 큐 이름 배열 순차 선형 탐색 패턴 (소규모, 무해)
- 위치: `system-status.e2e-spec.ts` L906–907 (변경 없는 컨텍스트; 큐 항목 1건 추가가 트리거)
- 상세: `data.queues.map((q) => q.name).sort()` 와 `[...EXPECTED_QUEUE_NAMES].sort()` 를 비교한다. 큐 수가 16개로 고정·소규모여서 O(N log N) 정렬 비용은 무의미하다. 큐가 수백 개로 늘어나면 `Set` 비교로 전환을 고려할 수 있다.
- 제안: 현행 유지.

## 요약

이번 변경은 TypeScript 타입 캐스팅 안전성 개선(`as never` → `as unknown as RedisConnectionProvider`) 및 e2e 테스트 매직 넘버 상수화, 그리고 큐 목록 1건 추가(`workspace-invitations-pruner`)로 구성된다. 세 변경 모두 런타임 알고리즘·자료구조·I/O 경로를 건드리지 않으며, 성능 관점에서 새롭게 도입된 병목·N+1 패턴·메모리 누수 위험은 없다. 기존 코드에서 지적할 수 있는 작은 최적화 여지(배열 사전 할당, Set 비교)는 현 규모에서 실질적 영향이 없어 무시 가능하다.

## 위험도

NONE
