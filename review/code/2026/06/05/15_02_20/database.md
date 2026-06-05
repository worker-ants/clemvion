# 데이터베이스(Database) 리뷰 결과

## 발견사항

### 1. **[WARNING]** `cancelParkedExecution` — UPDATE 에 인덱스 미확인 가능성
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `cancelParkedExecution` 메서드
- 상세: `createQueryBuilder().update(Execution).set(...).where('id = :id', ...).andWhere('status = :waiting', ...)` 쿼리는 `id` PK 조회 후 `status` 조건을 추가로 필터링한다. `id`(PK)로 먼저 단일 행을 특정하므로 실질 성능 위험은 낮다. 다만 `status` 컬럼에 단독 인덱스 또는 복합 인덱스(`id, status`)가 없는 경우, `andWhere('status = :waiting')` 절은 PK lookup 후 row-level 조건 검사로 처리되어 인덱스 활용 없이 동작한다. 이는 단일 행이므로 실제 성능 문제는 없지만, `status` 단독으로 조회하는 다른 쿼리(e.g., `WAITING_FOR_INPUT` 상태 일괄 조회 등)에 인덱스가 없으면 Full Scan이 발생할 수 있다.
- 제안: `execution.status` 컬럼에 인덱스 존재 여부를 마이그레이션에서 확인. 이미 인덱스가 있다면 무시. 없다면 `CREATE INDEX CONCURRENTLY`로 추가 검토.

### 2. **[INFO]** `cancelParkedExecution` — 트랜잭션 미사용, 이벤트 emit 실패 시 정합성 gap
- 위치: `execution-engine.service.ts` — `cancelParkedExecution`
- 상세: UPDATE DB 커밋 성공 후 `this.eventEmitter.emitExecution(...)` 호출 실패 시 CANCELLED 상태는 DB에 반영됐으나 WebSocket 이벤트는 미발행된 채로 남는다. 코드는 emit 실패를 warn 로그로만 처리하고 있으며, 이는 의도적 설계(DB 반영이 더 중요)임을 주석에서 확인할 수 있다. DB 트랜잭션 범위 밖에서 side-effect(이벤트 emit)를 수행하는 패턴은 이벤트 누락 risk를 내포하지만, 애플리케이션 레벨 재시도·폴링 UI가 있다면 수용 가능하다.
- 제안: 허용 설계로 보이나, emit 실패 시 클라이언트가 상태를 polling으로 최종 확인할 수 있는지 문서화 또는 주석 보강 권장.

### 3. **[INFO]** `cancelParkedExecution` — `affected` 필드 TypeORM 드라이버 의존성
- 위치: `execution-engine.service.ts` — `result.affected ?? 0` 조건
- 상세: TypeORM `UpdateResult.affected`는 PostgreSQL 드라이버에서 정상 반환되나, 일부 드라이버/설정에서 `undefined` 또는 `null`을 반환할 수 있다. `?? 0` 처리로 방어하고 있어 기본적으로 안전하다. 단, `affected`가 `0`인 경우(이미 terminal 또는 RUNNING으로 전환됨)를 정상 멱등 케이스로 처리하는 로직은 올바르다.
- 제안: 현재 구현 적절. 별도 조치 불필요.

### 4. **[INFO]** e2e 테스트 — 직접 DB 쿼리 파라미터화 확인
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts`
- 상세: `db.query('SELECT ... FROM execution WHERE id = $1', [executionId])` 및 `node_execution WHERE execution_id = $1 AND node_id = $2` 형태로 파라미터화된 쿼리를 올바르게 사용하고 있다. SQL 인젝션 위험 없음.
- 제안: 해당 없음.

### 5. **[INFO]** e2e 테스트 — `afterAll`에서 커넥션 정리 적절
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts`
- 상세: `afterAll`에서 `await db.end()`를 호출해 pg 커넥션을 명시적으로 해제하고 있다. `if (db)` 가드로 미초기화 시 예외를 방지한다. 커넥션 관리 적절.
- 제안: 해당 없음.

---

## 요약

이번 변경의 핵심 DB 코드는 `cancelParkedExecution` 메서드로, `WAITING_FOR_INPUT` 상태의 `execution` 행을 `CANCELLED`로 직접 UPDATE한다. PK(`id`) 조건으로 단일 행을 특정한 후 `status` 조건을 andWhere로 추가하는 멱등 패턴은 설계상 올바르다. `affected > 0` 가드로 중복 emit를 방지하고 있으며, emit 실패를 warn 수준으로 격리한 것도 적절하다. UPDATE 이후 이벤트 emit까지의 흐름이 단일 트랜잭션 밖에 있어 이벤트 누락 가능성이 이론상 존재하지만, DB 상태가 정합적으로 마킹되므로 클라이언트 폴링으로 복구 가능한 수준이다. e2e 테스트의 직접 DB 쿼리는 파라미터화가 올바르게 적용되어 SQL 인젝션 위험이 없다. 전체적으로 DB 관련 위험도는 낮다.

---

## 위험도

LOW
