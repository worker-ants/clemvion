# 동시성(Concurrency) 리뷰

## 발견사항

- **[WARNING]** `sweepInvalidJobs` 의 `pauseDuringSweep` TOCTOU 완화가 단일 큐 단위로만 적용됨
  - 위치: `backend/src/scripts/cleanup-invalid-queue-jobs.ts` `main()` 함수 (for 루프), `cleanup-invalid-jobs.util.ts` `sweepInvalidJobs`
  - 상세: `sweepInvalidJobs` 는 큐 하나씩 순차 처리하며 각 큐에 대해 `pause → sweep → resume` 사이클을 돈다. 두 번째 큐(`GRAPH_EXTRACTION_QUEUE`)를 처리하기 위해 첫 번째 큐가 `resume` 된 뒤 두 번째 큐가 `pause` 되기까지 순간적인 gap 이 존재한다. 두 큐를 동시에 pause 하지 않으면 첫 번째 큐가 resume 되는 시점에 아직 처리 중인 두 번째 큐와 Redis 쪽 워커가 경쟁 조건을 형성할 수 있다. 실무에서는 두 큐의 워커가 분리돼 있어 실제 영향은 제한적이지만, 설계 의도상 "sweep 동안 처리 중단"이 큐별로 분리된다는 점을 문서에 명시해야 한다.
  - 제안: `main()` 에서 두 큐 모두 `pause` → 두 큐 모두 `sweep` → 두 큐 모두 `resume` 하는 흐름을 옵션으로 제공하거나, 현재 동작(큐별 독립 pause/resume) 이 의도적임을 주석으로 명시한다.

- **[INFO]** `runSweep` 의 페이지네이션 중 `remove()` 후 오프셋 보정 없음
  - 위치: `cleanup-invalid-jobs.util.ts` `runSweep()` while 루프 (라인 1470-1507)
  - 상세: `apply=true` 일 때 페이지를 읽은 뒤 해당 페이지 내 무효 job 을 `Promise.all` 로 제거한다. BullMQ 의 `getJobs` 는 Redis sorted-set 의 인덱스(offset/count) 기반으로 동작하므로, 같은 페이지에서 job 을 제거하면 다음 페이지의 실제 시작 인덱스가 제거된 수만큼 당겨진다. 그 결과 `start += CLEANUP_PAGE_SIZE` 로 넘길 때 건너뛰어지는 job 이 생길 수 있다(false-negative). 단, 이 스크립트는 1회성 정리용이고 재실행이 가능하므로 운영 안전성은 낮다.
  - 제안: `apply=true` 시 제거된 job 수만큼 `start` 오프셋을 보정(`start += PAGE_SIZE - removedCount`)하거나, 또는 BullMQ 의 `getJobs` 를 항상 `start=0` 부터 재조회해 인덱스 이동 효과를 피하는 방식으로 변경한다. 재실행이 쉬운 운영 절차를 문서화하면 위험도는 낮게 유지된다.

- **[INFO]** `Promise.all` 로 병렬 remove 시 Redis 연결 포화 가능성
  - 위치: `cleanup-invalid-jobs.util.ts` `runSweep()` (라인 1490-1502)
  - 상세: 한 페이지(최대 1,000건)의 무효 job 에 대해 `Promise.all` 로 동시에 `remove()` 를 호출한다. 이는 최대 1,000개의 Redis 명령을 동시에 발행할 수 있어 ioredis 연결 큐를 일시적으로 포화시키고 운영 Redis 의 latency spike 를 유발할 수 있다. 이 스크립트는 AppModule 을 띄우지 않으므로 별도 커넥션을 사용하지만, 동일 Redis 인스턴스를 공유하면 운영 워커에 영향을 준다.
  - 제안: `p-limit`(이미 `package.json` 에 의존성 포함) 등으로 동시 remove 수를 제한(예: concurrency=20)한다. 또는 BullMQ 의 bulk remove API(`Queue.remove` with ids array) 가 있다면 활용한다.

- **[INFO]** `background-runs.service.ts` 의 `Promise.all` 병렬 DB 조회는 정상
  - 위치: `background-runs.service.ts` 라인 504
  - 상세: `fetchBodyPage`, `aggregateBodyStatus`, `fetchNotifications` 세 쿼리를 `Promise.all` 로 병렬화한다. 각 쿼리가 독립적이고 TypeORM Repository 는 커넥션 풀을 통해 관리되므로 경쟁 조건·데드락 우려 없음. 의도적 최적화(W-17)로 올바르게 구현되었다.
  - 제안: 해당 없음.

## 요약

이번 변경의 핵심 파일인 `cleanup-invalid-jobs.util.ts` 와 `cleanup-invalid-queue-jobs.ts` 는 BullMQ 큐를 직접 조작하는 단일 프로세스 스크립트로, NestJS 워커와 동시에 실행될 수 있는 구조다. `pauseDuringSweep` 옵션으로 TOCTOU 완화를 제공하고 `finally` 블록으로 `resume` 보장이 구현된 점은 적절하다. 다만 다중 큐를 순차 처리할 때 큐 간 pause gap, `apply=true` 시 페이지네이션 오프셋 드리프트(false-negative 가능성), 대량 병렬 remove 시 Redis 부하 등 세 가지 동시성 관련 주의 사항이 있다. `background-runs.service.ts` 의 변경은 코드 포맷팅과 미사용 import 제거에 국한되어 동시성 측면에서 문제없다. 전반적으로 CRITICAL 이슈는 없으며, 위 INFO/WARNING 항목은 재실행 가능한 운영 스크립트라는 특성상 실제 장애로 이어질 가능성은 낮지만 `p-limit` 도입 및 주석 보강을 권장한다.

## 위험도

LOW
