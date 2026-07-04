# 데이터베이스(Database) 리뷰 — orphan pending backstop

## 발견사항

- **[WARNING]** 신규 스캔 쿼리 `(status, queued_at)` 조합을 커버하는 인덱스 부재
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `recoverOrphanPendingExecutions()` — `this.executionRepository.find({ where: { status: PENDING, queuedAt: LessThan(staleThreshold) }, select: { id: true } })`
  - 상세: 기존 인덱스는 `idx_execution_status (status)` 단일 컬럼(`V002__indexes.sql`)과 이번 PR 계열의 `idx_execution_workflow_status (workflow_id, status)`(`V105__execution_workflow_status_index.sql`, admission COUNT hot-path 전용)뿐이다. `(status, queued_at)` 복합 인덱스는 어디에도 없다. 실행 계획은 `idx_execution_status` 로 `status='pending'` 부분을 인덱스 스캔한 뒤 `queued_at` 조건은 heap/bitmap 단계에서 필터링하게 된다. `pending` row 자체가 (정상 상태에서) 극소수 — 대부분 즉시 admitted 되거나 수 초~수 분 내 종결되므로 이 쿼리의 실질 비용은 낮다. 다만 pending 적체가 비정상적으로 늘어나는 장애 시나리오(예: admission 자체가 막히는 사고)에서는 `idx_execution_status` 만으로도 `status='pending'` 자체가 이미 selective 하므로 순수 인덱스 스캔 비용은 여전히 작다 — CRITICAL 로 보진 않으나, 명시적으로 커버하는 인덱스가 없다는 점은 사실이다.
  - 제안: 현재 규모(부팅 1회 + on-demand 테스트훅, `pending` row 절대량이 항상 적음)에서는 필수는 아니라고 판단되나, `idx_execution_status`가 `status` 단일 컬럼이라 `pending` 카디널리티가 커지는 장애 시나리오를 대비해 `(status, queued_at)` 부분 인덱스(`WHERE status = 'pending'`)를 검토할 수 있다. 다만 이는 PR2b 의 V105 처럼 hot-path(매 admission 마다 실행)가 아니라 boot-only/베스트에포트 backstop이므로 우선순위는 낮다(INFO에 가까운 WARNING).

- **[INFO]** per-row `markQueueWaitTimeout` 호출 — N+1 형태지만 정당화됨
  - 위치: `recoverOrphanPendingExecutions()` 의 `for (const { id } of orphans) { await this.markQueueWaitTimeout(id); }`
  - 상세: `find()`로 대상 id 목록을 한 번에 가져온 뒤 개별 UPDATE 를 순차 실행하는 구조로, 형태상 N+1 UPDATE 패턴이다. 그러나 (1) 대상 집합은 "이미 queue-wait 한도를 초과한 orphan pending" 이라는 극저빈도 엣지 케이스로 설계 문서(plan)에도 "낮은 확률 엣지·best-effort"로 명시돼 있고, (2) 트리거가 boot 1회 + e2e 테스트훅 on-demand 뿐이라 hot-path 가 아니며, (3) `markQueueWaitTimeout` 이 기존 재사용 메서드로 각 row 마다 조건부 UPDATE + 이벤트 emit(`EXECUTION_CANCELLED`) + routing 해제까지 수행해야 하므로 벌크 UPDATE 로 대체 시 이벤트 emit 로직을 별도로 다시 구현해야 하는 트레이드오프가 있다. 현 규모에서는 순차 처리가 합리적 선택으로 보인다.
  - 제안: 변경 불필요. 다만 향후 orphan 누적 규모가 커질 가능성이 확인되면 벌크 조건부 UPDATE(`RETURNING id`) + 배치 이벤트 emit 으로 전환을 고려.

- **[INFO]** `find()` 에 명시적 LIMIT/페이지네이션 없음
  - 위치: 동일 `recoverOrphanPendingExecutions()`
  - 상세: 이론상 orphan pending 이 대량으로 누적되면(예: 큰 장애로 다수 job 이 유실) 스캔 결과가 무제한으로 커질 수 있고, 뒤이은 순차 per-row UPDATE 루프가 보관 lock(전역 recovery lock, TTL 60초) 시간 내에 끝나지 않을 수 있다. 다만 정상 운영에서는 pending 적체가 발생하지 않도록 admission cap·5분 queue-wait timeout 이 이미 상한을 두고 있어 실질 위험은 낮다.
  - 제안: 필수는 아니나, 방어적으로 `take: N`(예: 500) 상한을 추가하고 다음 스캔에서 잔여를 이어 처리하는 방식을 고려할 수 있음(경미).

- **[정보 확인 — 문제 없음]** `queued_at IS NULL` 배제 정확성
  - 상세: TypeORM `LessThan(threshold)` 는 SQL `queued_at < $1` 로 컴파일되며, SQL 3-value 논리상 `NULL < $1` 은 `UNKNOWN` 이므로 자연히 매치되지 않는다. 코드 주석(`queued_at IS NULL(레거시 pre-V104 row)은 LessThan 이 자연 제외한다`)이 정확하다. V104 마이그레이션이 `DEFAULT NOW()`로 채워 신규 row 는 NULL 이 발생하지 않고, 레거시 row 는 이미 running/종결 상태라 admission 대상이 아니므로 의도한 대로 안전하게 배제된다.

- **[정보 확인 — 문제 없음]** 마이그레이션 불필요 확인
  - 상세: 이번 변경은 신규 스키마 변경이 없다(V104/V105는 이전 PR2b 에서 이미 적용됨). `recoverOrphanPendingExecutions` 는 기존 컬럼(`status`, `queued_at`)과 기존 메서드(`markQueueWaitTimeout`)만 재사용하므로 무중단 배포 관점에서 추가 위험이 없다.

- **[정보 확인 — 문제 없음]** SQL 인젝션 / 파라미터화
  - 상세: `find()` 의 `where` 절과 `markQueueWaitTimeout` 의 QueryBuilder(`.where('id = :id', {...}).andWhere('status = :pending', {...})`) 모두 TypeORM 의 파라미터 바인딩을 사용해 문자열 결합이 없다. e2e 테스트의 `db.query('... VALUES ($1, $2, NOW() - $3::interval)', [...])` 역시 pg 파라미터화 쿼리로 안전하다.

- **[정보 확인 — 문제 없음]** 트랜잭션/동시성
  - 상세: `recoverOrphanPendingExecutions` 자체는 명시적 트랜잭션이 없으나, 대상 UPDATE(`markQueueWaitTimeout`)가 `WHERE status='pending'` 조건부 단일-행 UPDATE 라 admission(`admitExecutionOrDefer`)의 조건부 UPDATE 와 race 가 나더라도 한쪽만 `affected>0` 을 얻는 멱등 구조다. 전체 스캔은 `recoverStuckExecutions` 의 분산 lock(`RECOVERY_LOCK_KEY`, TTL 60초) 안에서 실행돼 여러 인스턴스의 동시 스캔도 배제된다. 설계상 타당하다.

## 요약

이번 변경(orphan pending backstop)은 신규 스키마·마이그레이션이 없고, 기존 `queued_at`(V104) 컬럼과 기존 `markQueueWaitTimeout` 조건부 UPDATE 메서드를 재사용하는 boot-only/베스트에포트 백스톱이다. 핵심 이슈는 신규 스캔 쿼리 `WHERE status='pending' AND queued_at < threshold` 가 `(status, queued_at)` 복합 인덱스로 명시적으로 커버되지 않는다는 점이지만(이전 PR2b 의 V105 는 `(workflow_id, status)` 로 admission hot-path 전용), pending row 자체가 정상 운영에서 항상 소수이고 트리거 빈도가 부팅 1회 수준이라 실질적 성능 위험은 낮다. per-row UPDATE 루프는 형태상 N+1이지만 대상 집합이 극소수·저빈도 엣지케이스이고 이벤트 emit 로직 재사용이 필요해 현재 구조가 합리적이다. `queued_at IS NULL` 배제 논리, SQL 파라미터화, 락/멱등성 설계는 모두 정확하다. 종합적으로 리스크는 낮은 수준이며 인덱스 관련 사항은 개선 검토 대상으로만 남긴다.

## 위험도
LOW

STATUS: SUCCESS
