# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** `cleanup-invalid-jobs.util.ts` — `CLEANUP_QUEUE_STATES` spread 매 페이지마다 반복 생성
  - 위치: `cleanup-invalid-jobs.util.ts` L68 (`[...CLEANUP_QUEUE_STATES]`)
  - 상세: `runSweep` 루프 내부에서 매 페이지 순회마다 `[...CLEANUP_QUEUE_STATES]`로 새 배열을 생성한다. 큐당 페이지 수가 수십~수백 회에 달하는 대규모 정리 시 불필요한 단기 객체를 반복 할당한다. `as const` 배열을 spread 없이 그대로 전달해도 BullMQ `getJobs` 시그니처는 `JobType[]`을 허용하므로 무방하다.
  - 제안: `queue.getJobs([...CLEANUP_QUEUE_STATES], ...)` 를 루프 밖에서 한 번만 복사하거나, `as unknown as JobType[]` 캐스트로 spread 자체를 제거한다.

- **[INFO]** `migrate-button-ids.ts` — `runMigration`: 모든 대상 노드를 단일 쿼리로 전체 메모리 적재
  - 위치: `migrate-button-ids.ts` L291-L310 (`ds.query(...)` → `rows` 배열)
  - 상세: `SELECT ... JOIN ... WHERE n.type = ANY($1)` 로 모든 워크스페이스의 버튼 노드를 한 번에 메모리로 가져온다. 워크플로/노드 수가 많은 운영 DB에서는 수만 건의 JSONB config 컬럼을 한꺼번에 적재할 수 있어 Node.js 프로세스 메모리 압박이 발생한다. 일회성 마이그레이션 스크립트이므로 현재 규모에서는 허용 범위이지만, 스케일아웃 시 문제가 될 수 있다.
  - 제안: 워크플로 단위로 배치(예: `LIMIT 500 OFFSET n`)하거나 스트리밍 커서 쿼리(PostgreSQL `DECLARE ... FETCH`)로 변경해 피크 메모리를 제한한다.

- **[INFO]** `migrate-button-ids.ts` — `pendingUpdates` 내 트랜잭션 루프에서 노드별 단건 UPDATE 직렬 실행
  - 위치: `migrate-button-ids.ts` L345-L351
  - 상세: `for (const update of pendingUpdates)` 루프 안에서 노드마다 `manager.query(UPDATE ...)` 를 하나씩 순차 실행한다. 대상 노드가 수백 건 이상이면 왕복 레이턴시가 누적되어 트랜잭션 시간이 선형으로 증가한다.
  - 제안: `unnest` + `UPDATE node SET config = v.config FROM (VALUES ...) AS v(id, config) WHERE node.id = v.id` 형태의 배치 UPDATE 로 단일 쿼리화하거나, `Promise.all` + 여러 단건 쿼리를 동시 실행(단, 트랜잭션 격리 주의)하는 방식으로 전환한다.

- **[INFO]** `background-runs.service.ts` — `verifyBackgroundRunOwnership` 의 비인덱스 full-scan 위험 (WS 가드 경로)
  - 위치: `background-runs.service.ts` L468-L476
  - 상세: `verifyBackgroundRunOwnership`은 `executionId` 필터 없이 `output_data #>> '{meta,backgroundRunId}'` 하나만으로 조회한다. 코드 주석에는 V047 부분 표현식 인덱스가 이 조회를 받친다고 명시되어 있으나, 해당 인덱스가 실제로 `background_run` backgroundRunId 값에 대해 선택성이 높은지, 그리고 `executionId`를 포함한 복합 인덱스 대비 효율이 어떤지 검증이 필요하다. WS subscribe 가드는 연결마다 호출되므로 동시 연결이 많을 때 DB 부하 집중점이 된다.
  - 제안: V047 인덱스의 실제 활용 여부를 `EXPLAIN (ANALYZE, BUFFERS)` 로 주기적으로 확인하고, 필요 시 `(output_data #>> '{meta,backgroundRunId}', execution_id)` 복합 표현식 인덱스 추가를 검토한다.

- **[INFO]** `background-runs.service.ts` — `aggregateBodyStatus` 집계 쿼리에서 상태별 `SUM(CASE ...)` 6회 반복 스캔
  - 위치: `background-runs.service.ts` L711-L733
  - 상세: 단일 `GROUP BY` 없이 같은 `parentNodeExecutionId` 범위를 6개 CASE WHEN 표현식이 순차 평가한다. PostgreSQL 실행 계획 상 단일 Seq/Index Scan으로 처리되므로 실제 왕복은 1회이나, 표현식 평가 비용은 행 수에 선형 비례한다. 본문 노드가 수천 개인 Background 실행에서는 유의미할 수 있다.
  - 제안: 현재 구조는 PostgreSQL이 단일 스캔으로 처리하므로 즉각적 변경은 불필요하다. 다만 향후 본문 노드 수가 크게 증가한다면 DB 수준의 별도 집계 테이블(materialized) 도입을 고려한다.

- **[INFO]** `cleanup-invalid-jobs.util.ts` — `results.filter(Boolean)` 에서 임시 boolean 배열 생성
  - 위치: `cleanup-invalid-jobs.util.ts` L99 (`results.filter(Boolean).length`)
  - 상세: `Promise.all`의 결과 배열 전체를 `filter(Boolean)`으로 재순회해 새 배열을 생성한 뒤 `.length`만 읽는다. invalidPage가 클수록 불필요한 배열 복사가 발생한다.
  - 제안: `results.reduce((acc, v) => acc + (v ? 1 : 0), 0)` 또는 `results.filter(Boolean).length` 대신 `results.filter(v => v).length` (동일하나 명시적), 또는 `Promise.allSettled` + 직접 카운트로 변경해 중간 배열 생성을 피한다.

---

## 요약

이번 변경의 핵심은 `cleanup-invalid-queue-jobs` 스크립트를 NestJS 외부 standalone 유틸(`cleanup-invalid-jobs.util.ts`)로 리팩토링하고, `migrate-button-ids.ts` 신규 마이그레이션 스크립트를 추가한 것이다. `background-runs.service.ts`는 코드 포맷 정렬 수준의 변경으로 로직 변경이 없다. 성능 관점에서 발견된 사항은 모두 INFO 수준이다. 핵심 로직인 `sweepInvalidJobs`는 페이지네이션으로 OOM을 방지하고 `Promise.all`로 삭제를 병렬화하는 적절한 설계를 유지한다. `background-runs.service.ts`의 DB 쿼리 병렬화(`Promise.all` 3개) 및 커서 페이지네이션도 올바르게 구현되어 있다. 다만 `migrate-button-ids.ts`의 일괄 메모리 적재와 직렬 단건 UPDATE는 대규모 DB에서 병목이 될 수 있어 향후 배치 전략 수립이 권고된다.

## 위험도

LOW
