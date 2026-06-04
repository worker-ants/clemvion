# 성능(Performance) 리뷰

## 발견사항

### [WARNING] `runExecutionFromQueue` — 매 job 마다 DB 재조회 (추가 쿼리)
- **위치**: `execution-engine.service.ts` — `runExecutionFromQueue()` 첫 번째 블록
- **상세**: `execute()` 가 이미 Execution row 를 저장(`save`)했음에도, worker 진입 시 `findOneBy({ id: executionId })` 로 row 를 재조회한다. 현재는 설계상 의도된 멱등성 확인(`status === PENDING` 재검증)이지만, 실행마다 무조건 SELECT 1회가 추가된다. 단일 인스턴스에서 default concurrency=1 이면 영향이 작지만, `EXECUTION_RUN_WORKER_CONCURRENCY` 를 높일수록 동시 SELECT 가 증가하며 DB 연결 풀에 부담이 된다.
- **제안**: 현재 설계(work-stealing + idempotency) 상 재조회는 피할 수 없고, 이는 acceptable trade-off 다. 다만 PR2 동시성 cap 구현 시 `SELECT ... FOR UPDATE SKIP LOCKED` 또는 BullMQ job data 에 status snapshot 을 실어 재조회 없이 검증하는 패턴을 검토하면 DB 부하를 줄일 수 있다.

---

### [WARNING] `execute()` → `executionRunQueue.add()` — Redis 왕복 레이턴시가 HTTP 응답 경로에 추가됨
- **위치**: `execution-engine.service.ts` — `execute()` 의 `await this.executionRunQueue.add(...)` 호출
- **상세**: 기존 fire-and-forget 패턴은 Redis 왕복 없이 즉시 반환했으나, 이제 BullMQ `queue.add()` 가 Redis ZADD/LPUSH 를 동기로 await 한다. 일반적으로 로컬 Redis 기준 0.5–2ms, 관리형 Redis(예: ElastiCache cross-AZ) 기준 1–10ms 가 추가된다. 트래픽이 집중될 때 Redis 지연이 곧 HTTP 응답 지연으로 전파된다.
- **제안**: 대부분의 워크플로 트리거 경로(webhook/schedule)에서 이 레이턴시는 수용 가능하다. 다만 SLA-sensitive 경로(REST 즉시 응답 API 등)가 있다면 Redis 연결 pool 크기와 timeout 설정을 별도로 검토할 것. 현재 코드 자체에서 바꿀 사항은 없으나 모니터링 알람(queue.add latency p99)을 추가하는 것이 권장된다.

---

### [INFO] `resolveExecutionRunWorkerConcurrency` — 모듈 로드 시 1회 평가, 런타임 변경 불가
- **위치**: `execution-run.queue.ts` — `resolveExecutionRunWorkerConcurrency()` / `execution-run.processor.ts` — `@Processor` 데코레이터 인자
- **상세**: `@Processor(EXECUTION_RUN_QUEUE, { concurrency: resolveExecutionRunWorkerConcurrency() })` 는 데코레이터 평가 시점(모듈 로드)에 `process.env` 를 읽어 concurrency 를 확정한다. 주석과 .env.example 에도 "모듈 로드 시 1회 읽음"을 명시하고 있어 이는 의도된 동작이다. 단, 기본값 1로 운영할 경우 동시에 처리되는 execution 이 1개로 제한되어 처리량 병목이 될 수 있다. 특히 BullMQ concurrency=1 은 각 worker 인스턴스에서 job 을 순차 처리하므로, `execute()` 호출 빈도가 높으면 큐 대기(waiting count)가 누적된다.
- **제안**: 운영 환경에서는 인스턴스당 CPU/메모리 여유와 실행 길이(노드 수 × 핸들러 시간)를 측정한 뒤 `EXECUTION_RUN_WORKER_CONCURRENCY` 를 조정해야 한다. PR2 에서 동시성 cap 과 함께 권장값 가이드라인을 spec 에 추가하는 것이 좋다.

---

### [INFO] `input` 데이터가 Redis job payload 와 DB `inputData` 에 이중 저장됨
- **위치**: `execution-engine.service.ts` — `execute()`, `execution-run.queue.ts` — `ExecutionRunJob.input`
- **상세**: `execute()` 는 `executionRepository.save(execution)` 로 `inputData` 를 DB 에 기록하고, 동시에 `{ executionId, input }` 을 BullMQ job payload 에 실어 Redis 에도 저장한다. 즉 input 데이터가 DB + Redis 에 이중 보존된다. 대부분의 경우 input 이 작아 문제가 없지만, large webhook body 나 파일 메타데이터가 input 에 포함될 경우 Redis 메모리 사용량이 예상 외로 커질 수 있다.
- **제안**: `removeOnComplete: true` 이므로 정상 완료 job 은 즉시 제거되어 Redis 상주 시간이 짧다. 다만 concurrency=1 이고 처리 속도가 느린 경우 대기 중 job 이 쌓일 수 있다. input 이 대용량이 될 가능성이 있다면, job payload 에서 `input` 을 제거하고 worker 가 `row.inputData` 만 사용하도록 리팩터링하면 Redis 메모리를 절약할 수 있다. 현재 코드 주석에도 `row.inputData 와 동일하나, raw input 의 정확한 의미를 보존하기 위해 함께 실어` 라고 명시되어 있으므로, 이 트레이드오프는 인지되어 있는 상태다.

---

### [INFO] `removeOnFail: false` — 실패 job 이 Redis 에 무기한 보존됨
- **위치**: `execution-run.queue.ts` — `EXECUTION_RUN_QUEUE_DEFAULT_OPTS`
- **상세**: 실패 job 을 관측 목적으로 `removeOnFail: false` 로 설정했다. attempts=1 이므로 모든 setup-단계 throw 가 failed set 에 영구 누적된다. 크래시 빈도가 낮으면 문제없지만, 일시적 DB 장애나 배포 중 대규모 실패가 발생하면 Redis `failed` sorted set 이 급격히 커진다.
- **제안**: BullMQ 의 `removeOnFail: { count: N }` 옵션(최근 N개만 보존)을 사용하면 관측성과 메모리 효율을 균형 있게 가져갈 수 있다. 예: `removeOnFail: { count: 1000 }`. PR4 DLQ/관측성 정리 단계에서 함께 검토 권장.

---

### [INFO] `@Processor` 데코레이터의 `maxStalledCount: 0` — stalled 감지 비용 없음 (의도된 최적화)
- **위치**: `execution-run.processor.ts`
- **상세**: `maxStalledCount: 0` 으로 BullMQ 의 stalled job 재배달 로직이 비활성화된다. 이는 비멱등 이중 실행 방지를 위한 의도된 결정이다. 부수 효과로, BullMQ 가 stalled job 을 감지하기 위해 주기적으로 수행하는 lock 갱신 오버헤드가 줄어든다. 성능 관점에서는 오히려 이득이다.
- **제안**: 현재 설계 유지. PR3/PR4 에서 멱등 rehydration 도입 시 `maxStalledCount` 를 높일 예정이므로, 그 시점에 stalled 감지 주기(`stalledInterval`) 와 함께 성능 영향을 재검토할 것.

---

## 요약

이번 변경의 핵심은 fire-and-forget in-process `runExecution` 호출을 BullMQ 영속 큐(`execution-run`)로 대체해 work-stealing 분산을 가능하게 하는 것이다. 성능 관점에서 가장 주목할 점은 두 가지다. (1) `execute()` 가 Redis `queue.add()` 를 `await` 하므로 HTTP 응답 경로에 Redis 왕복 레이턴시가 추가된다. 이는 설계상 불가피하며, 관리형 Redis cross-AZ 환경에서는 모니터링이 필요하다. (2) `runExecutionFromQueue` 가 매 job 마다 DB `findOneBy` 를 수행하므로, concurrency 를 높일수록 동시 SELECT 가 증가한다. 두 이슈 모두 현재 default(concurrency=1, 단일 인스턴스)에서는 영향이 작고, 코드 자체는 불필요한 메모리 할당·중복 계산·블로킹 I/O 없이 간결하게 설계되어 있다. `removeOnFail: false` 의 Redis 메모리 누적 가능성은 PR4 에서 함께 정리하길 권장한다.

## 위험도

LOW
