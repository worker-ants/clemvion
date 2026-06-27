# 성능(Performance) 리뷰

## 발견사항

### 파일 1: codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts

- **[INFO]** `assertMonotonicUniqueness` — Set 생성 비용
  - 위치: 라인 130 (`expect(new Set(seqs).size).toBe(expectedCount)`)
  - 상세: 이미 단일 패스로 min/max를 구한 직후 `new Set(seqs)`를 별도로 생성한다. Set 생성은 O(N) 시간·공간이고 ALLOC_COUNT=1000 수준에서는 무시할 수 있으나, 동일 루프 안에서 중복 카운팅을 겸하면 Set 할당을 피할 수 있다.
  - 제안: min/max 루프 내에 `seen` Set을 같이 구축하거나, 역으로 Set만 만들고 min/max는 `Math.min/max`+스프레드 대신 동일 Set 순회로 구한다. 테스트 코드이고 N이 수천이므로 실질 영향은 없으나, 의도와 달리 "단일 패스" 설명이 완전하지 않다는 점은 주석 오해 가능성을 낳는다.

- **[INFO]** `allocateConcurrentlyAcrossInstances` — Promise 배열 사전 적재
  - 위치: 라인 107–112 (`const calls: Array<Promise<number>> = []; ... Promise.all(calls)`)
  - 상세: `calls` 배열에 500+500=1000개 Promise를 먼저 모두 push한 뒤 `Promise.all`로 해소한다. 이는 의도된 설계(동시성 최대화)이며 성능상 올바른 패턴이다. 다만 V8은 `Promise.all`에 수천 항목을 넣어도 microtask 큐를 직렬화하므로, N이 수만 단위로 커지면 microtask 기아(microtask starvation) 현상으로 다른 I/O 콜백이 지연될 수 있다. 현재 ALLOC_COUNT=1000에서는 문제없다.
  - 제안: 현 구현 유지. N을 크게 높이는 경우 청크(예: 100개씩) `Promise.all`로 나누는 것을 고려한다.

- **[INFO]** latency 테스트 — 직렬 루프 측정 방식
  - 위치: 라인 453–460 (WARMUP·SAMPLES 루프)
  - 상세: `for (let i = 0; i < WARMUP; i++) await allocA.next(executionId)` 와 SAMPLES 루프 모두 직렬(sequential) `await`다. 이는 latency 측정의 의도(단일 호출 레이턴시)에 맞으며 올바르다. 다만 SAMPLES=200회 직렬 실행이므로 최악의 경우(레이턴시 5ms×200=1,000ms) 해당 it 블록 혼자 최대 1초 이상 걸릴 수 있다. 60_000ms timeout은 충분히 큰 여유다.
  - 제안: 현 구현 유지.

- **[INFO]** `latenciesMs.reduce` — avg 계산
  - 위치: 라인 239
  - 상세: `latenciesMs.reduce((s, v) => s + v, 0) / latenciesMs.length`는 O(N) 단순 합산이며, N=200에서 완전히 무해하다. 로그 전용 값이므로 제거하거나 남겨도 모두 무방하다.
  - 제안: 현 구현 유지.

- **[INFO]** `const sorted = [...latenciesMs].sort(...)` — 얕은 복사 후 정렬
  - 위치: 라인 234
  - 상세: 원본 배열 보존을 위해 스프레드로 복사한 뒤 정렬한다. N=200에서는 완전히 문제없다. 복사 비용 O(N) + 정렬 O(N log N)이 현 규모에서 미미하다.
  - 제안: 현 구현 유지.

### 파일 2: docker-compose.e2e.yml

- **[INFO]** `REDIS_HOST/REDIS_PORT` 중복 선언
  - 위치: diff 추가분 (backend-e2e-runner 서비스) vs 기존 backend-e2e 서비스 (라인 641–642)
  - 상세: `backend-e2e` 서비스에 이미 `REDIS_HOST: redis` / `REDIS_PORT: "6379"`가 선언되어 있다. 이번 diff는 `backend-e2e-runner` 서비스에도 같은 값을 추가한 것이다. 두 서비스의 용도(앱 서버 vs 테스트 러너)가 달라 별도 선언이 맞으며, 중복이지만 환경변수 기본값(`?? 'redis'`)이 같으므로 기능 변화는 없다. 명시적 의존성 문서화 목적의 추가로, 성능 이슈 없음.
  - 제안: 현 구현 유지. YAML anchor(`&redis-env`)로 DRY화할 수 있으나 가독성 대 유지보수성 트레이드오프이며 선택 사항이다.

---

## 요약

이번 변경의 대상은 e2e 성능 부하 검증 테스트와 docker-compose 환경변수 선언이다. `assertMonotonicUniqueness`에서 min/max 단일 패스 직후 `new Set` 을 별도로 생성하는 사소한 이중 순회가 있으나 N=1000 수준에서 영향은 0에 가깝다. `Promise.all(1000)` 동시 발사, 직렬 latency 측정 루프, 배열 복사+정렬 모두 의도에 맞는 올바른 패턴이며 현재 규모에서 성능 문제가 없다. docker-compose 변경은 환경변수 두 줄 추가로 성능과 무관하다. 전체적으로 성능 관점에서 심각한 문제는 없으며, 발견된 항목은 모두 테스트 코드 내 극소 규모(N<=1000)에서 무시 가능한 수준이다.

## 위험도

NONE
