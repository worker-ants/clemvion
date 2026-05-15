### 발견사항

- **[INFO]** JSONB expression 인덱스 의존 — 실제 인덱스 존재 여부는 마이그레이션 파일로 확인 필요
  - 위치: `backend/src/modules/executions/background-runs/background-runs.service.ts` — `verifyBackgroundRunOwnership`, `findBackgroundNodeExecution` (각각 line 75, 613)
  - 상세: 코드 주석에 "V047 부분 expression 인덱스 (`output_data #>> '{meta,backgroundRunId}'`) 가 단건 조회를 받친다"고 명시되어 있다. 파라미터화된 쿼리로 안전하게 바인딩되고 있어 SQL 인젝션 위험은 없다. 다만 해당 expression 인덱스(`CREATE INDEX ... ON node_execution ((output_data #>> '{meta,backgroundRunId}'))`)가 실제 마이그레이션에 존재하는지는 이번 변경 범위에서 확인되지 않는다. 인덱스가 누락된 경우 `node_execution` 전체 스캔이 발생한다.
  - 제안: V047 마이그레이션 파일에 해당 인덱스 DDL이 포함되어 있는지 확인한다. 누락 시 `CREATE INDEX CONCURRENTLY`로 추가한다.

- **[INFO]** `verifyBackgroundRunOwnership`의 executionId 필터 부재 — 의도적 설계이나 문서화 권장
  - 위치: `background-runs.service.ts` line 471–480
  - 상세: 주석에 의도가 명확히 설명되어 있다(WS subscribe 시점에 executionId 미보유, UUID v4 충돌 확률 무시 수준). DB 관점에서 `backgroundRunId`로만 `node_execution` 전체를 스캔하므로 expression 인덱스가 없으면 성능 문제가 크다. 인덱스가 있다면 단건 lookup으로 충분히 빠르다.
  - 제안: V047 인덱스가 이 쿼리 경로도 커버하는지 인덱스 predicate 확인. 커버하지 않는다면 partial index(`WHERE output_data #>> '{meta,backgroundRunId}' IS NOT NULL`) 추가 검토.

- **[INFO]** BullMQ 큐 sweep 시 `active` 상태 미포함 — 의도적 누락
  - 위치: `cleanup-invalid-jobs.util.ts` line 1387–1392 (`CLEANUP_QUEUE_STATES`)
  - 상세: `['waiting', 'delayed', 'failed', 'paused']`만 스캔하고 `active`(현재 처리 중)는 제외한다. 이는 처리 중인 job을 건드리지 않으려는 의도로 보이며 DB 정합성 측면에서 안전하다. 다만 `active` 상태로 stuck된 손상 job은 이번 스크립트로 정리되지 않는다.
  - 제안: 운영 절차 문서에 "active 상태 손상 job은 별도 처리 필요"를 명시하거나, `--include-active` 플래그를 향후 추가할 때 주의사항으로 기록한다.

- **[INFO]** `pauseDuringSweep` TOCTOU 완화 범위 — 큐 단위 순차 pause/resume
  - 위치: `cleanup-invalid-jobs.util.ts` line 1447–1456, `cleanup-invalid-queue-jobs.ts` line 1756–1765
  - 상세: 스크립트는 큐를 순차(`for...of`)로 처리하며 큐별로 pause → sweep → resume을 수행한다. 두 큐를 동시에 pause하지 않으므로 첫 번째 큐 sweep 중 두 번째 큐에는 worker가 계속 동작한다. 이는 큐 간 독립성이 보장된 경우에만 안전하다. 또한 `queue.close()`가 `finally`에서 호출되지만 sweep 도중 프로세스가 강제 종료되면 pause 상태로 남을 수 있다.
  - 제안: 운영 절차에 스크립트 비정상 종료 시 `queue.resume()`을 수동으로 실행하는 복구 단계를 추가한다.

### 요약

이번 변경의 핵심은 BullMQ 큐 손상 job 정리 스크립트를 `backend/scripts/`(루트 수준)에서 `backend/src/scripts/`로 이동하고, 핵심 로직을 `cleanup-invalid-jobs.util.ts`로 분리해 테스트 가능성을 높인 리팩토링이다. `BackgroundRunsService`의 변경은 코드 포맷팅과 임포트 정리에 국한된다. DB 관점에서 JSONB expression 인덱스(V047)에 대한 의존이 핵심이며, 코드 상에서 파라미터화된 쿼리를 일관되게 사용하고 있어 SQL 인젝션 위험은 없다. 페이지네이션(PAGE_SIZE=1000)과 cursor 기반 페이지네이션도 적절히 구현되어 있다. 주요 리스크는 V047 expression 인덱스의 실제 존재 여부와, `pauseDuringSweep` 비정상 종료 시 큐가 pause 상태로 잔류할 가능성이나 모두 LOW 수준이다.

### 위험도
LOW
