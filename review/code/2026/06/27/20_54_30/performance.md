# 성능(Performance) 코드 리뷰

## 발견사항

### 파일 1: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts`

- **[WARNING]** `Math.min(...seqs)` / `Math.max(...seqs)` — 스프레드 스택 오버플로우 위험
  - 위치: 라인 155-156, 179-180
  - 상세: `Math.min(...array)` / `Math.max(...array)` 는 배열 전체를 함수 인자로 펼쳐 call stack 에 올린다. N=1000 에서는 문제없으나, 이 패턴이 N이 더 큰 테스트로 확장될 경우(또는 CI 스펙 상향 시) V8 기본 인자 한도(~65,536개) 초과로 `Maximum call stack size exceeded` 가 발생한다. 테스트 파일이므로 프로덕션 영향은 없지만, 동일 `allocateConcurrentlyAcrossInstances` 함수를 N이 큰 케이스에 재사용하는 경로에서 조용히 터질 수 있다.
  - 제안: `sorted[0]` / `sorted[sorted.length - 1]` 또는 `Array.prototype.reduce` 로 대체. 혹은 `new Set(seqs).size === N && Math.min(...seqs) === 1` 대신 정렬 후 범위 확인 패턴으로 통합.

- **[INFO]** 직렬 warm-up 루프가 측정 시간에 포함되지 않도록 설계된 점은 적절하나, warm-up 호출(20회)이 순차 `await`
  - 위치: 라인 201 (`for (let i = 0; i < WARMUP; i++) await allocA.next(executionId)`)
  - 상세: warm-up 을 순차 실행해 연결·키 초기화 outlier 를 분리하겠다는 의도는 맞다. 단, 이미 20회 동안 `exec:seq:<id>` 키에 값이 20까지 쌓인 상태에서 SAMPLES 200회를 측정하므로, 측정 시작 시 INCR 값이 21부터다. 검증 로직이 없어 기능 회귀 위험은 없으나, 이 executionId 의 누적 카운터가 220 이 되는 시점까지 Redis 쪽 key space를 점유한 채 afterAll 에서만 `quit`으로 정리된다. 테스트별 `del`이 없으므로 연속 실행 시 동일 키가 재사용되지 않도록 각 테스트가 `randomUUID()`로 격리하는 구조는 이미 올바르다.
  - 제안: 현행 설계로 충분. INFO 수준.

- **[INFO]** `allocateConcurrentlyAcrossInstances` 내 1000개 Promise를 `Promise.all` 로 한 번에 발사
  - 위치: 라인 96-101
  - 상세: 부하 테스트라는 목적에서 이 패턴은 의도된 설계(race를 최대화)이므로 성능 문제가 아니다. 다만 Node.js 이벤트 루프 관점에서 1000개 microtask를 동시에 ready 상태로 만들면 이후 동기 코드가 일시적으로 블로킹된다. 테스트 격리 환경에서는 무해하다.
  - 제안: 현행 유지. 목적에 부합하는 설계.

- **[INFO]** 레이턴시 측정에서 `[...latenciesMs].sort(...)` — 200 원소 복사 후 정렬
  - 위치: 라인 210
  - 상세: O(N log N), 원소 200개로 완전히 무해하다. 원본 배열 보존을 위한 복사는 적절.
  - 제안: 현행 유지.

### 파일 2: `docker-compose.e2e.yml`

- **[INFO]** `REDIS_HOST: redis` / `REDIS_PORT: "6379"` 환경변수 추가 — 성능 영향 없음
  - 위치: `backend-e2e-runner` 서비스 `environment` 블록 (diff +4~+5줄)
  - 상세: 환경변수 두 개를 선언적으로 추가한 것으로 컨테이너 기동 또는 런타임 성능에 영향을 주지 않는다. `?? 'redis'` 기본값과 동일 값이어서 실질적 동작 변화도 없다.
  - 제안: 현행 유지.

---

## 요약

변경 범위는 e2e 테스트 파일 1개와 docker-compose 환경변수 선언 2줄로 프로덕션 코드에 대한 성능 영향은 없다. 테스트 코드 자체에서도 대부분의 설계 선택(Promise.all fan-out, hrtime.bigint 측정, warm-up 분리, randomUUID 격리)은 부하 테스트 목적에 최적화된 패턴이다. 유일한 주의 사항은 `Math.min(...array)` / `Math.max(...array)` 스프레드 패턴으로, N=1000 에서는 무해하지만 N을 수만 이상으로 올리는 시나리오에서 스택 오버플로우를 유발할 수 있어 WARNING으로 분류한다. 현재 값 기준에서 실제 장애 위험은 없고, 대안(`sorted[0]` / `sorted[sorted.length - 1]`) 적용이 권장된다.

## 위험도

LOW
