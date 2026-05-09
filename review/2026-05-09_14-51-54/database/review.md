### 발견사항

- **[INFO]** `recoverStuckExecutions` 의 복합 인덱스 부재 가능성
  - 위치: `execution-engine.service.ts` — `recoverStuckExecutions()` 내 QueryBuilder
  - 상세: `WHERE status = :status AND started_at < :threshold` 조건이 서버 재기동 때마다 실행된다. `executions` 테이블이 대형화될수록 `(status, started_at)` 복합 인덱스가 없으면 full-table scan 이 발생할 수 있다. 이 변경 자체가 쿼리를 도입한 것은 아니지만, `onApplicationBootstrap` 으로 이동하면서 매 부팅 시 확실히 실행되는 경로가 됐다.
  - 제안: `Execution` 엔티티에 `@Index(['status', 'startedAt'])` 또는 마이그레이션에서 `CREATE INDEX ... ON executions(status, started_at)` 추가 여부를 확인한다.

- **[INFO]** 복구된 row 의 `durationMs` 가 NULL 로 유지됨
  - 위치: `execution-engine.service.ts` — `.set({ status, error, finishedAt })` 블록
  - 상세: bulk UPDATE 에서 `durationMs` 를 의도적으로 NULL 로 남긴다고 주석에 명시되어 있다. 집계 쿼리(`AVG(duration_ms)`, 실행 시간 통계)에서 이 row 들이 제외되거나 왜곡을 일으킬 수 있다.
  - 제안: 분석·모니터링 레이어에서 `durationMs IS NULL AND status = 'failed'` row 를 별도 처리하거나, `finishedAt - startedAt` 를 서브쿼리로 계산해 채워넣는 것을 검토한다.

- **[INFO]** 트랜잭션·SQL 인젝션 — 이상 없음
  - 위치: `recoverStuckExecutions` QueryBuilder
  - 상세: 단일 atomic UPDATE 문이며 파라미터는 `:status`, `:threshold` 바인딩 처리돼 있다. 변경 내용이 쿼리 자체를 수정하지 않으므로 정합성·보안 위험 신규 증가 없음.

---

### 요약

이번 diff 의 데이터베이스 관련 변경은 `recoverStuckExecutions()` 의 **호출 시점**을 `onModuleInit` → `onApplicationBootstrap` 으로 이동한 것 뿐이며, 쿼리 로직 자체는 손대지 않았다. 기존부터 `(status, started_at)` 인덱스 부재 가능성과 복구 row 의 `durationMs = NULL` 처리 문제가 잠재하고 있지만, 이 PR 이 새로 도입한 위험은 없다. 본 변경으로 매 부팅 시 해당 쿼리가 보다 안정적으로 실행되므로, 인덱스 점검을 병행하면 충분하다.

### 위험도
**LOW**