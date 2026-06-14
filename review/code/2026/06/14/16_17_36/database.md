# 데이터베이스(Database) 리뷰 결과

## 발견사항

### [INFO] 인덱스 — 기존 인덱스로 커버됨
- 위치: `interaction-token.service.ts` — `reconcileTerminalRevocations()` QueryBuilder
- 상세: sweep 쿼리는 `execution_token` 테이블을 드라이빙 테이블로 사용하고 `et.execution` 관계를 INNER JOIN 한다. 이전 리뷰(15_59_50 RESOLUTION W4)에서 `idx_execution_token_execution_id`(V060)가 존재함이 확인되었고 `execution` 은 PK join 이므로 full table scan 우려 없음. `execution.status` 컬럼 인덱스는 JOIN 대상 필터가 아닌 driving 테이블 측 WHERE 이므로 커버 인덱스 적용 여지가 있으나, sweep 대상 row 가 소수(live 경로가 대부분 처리)인 운영 패턴상 실질 영향은 낮다.
- 제안: 없음 (현 규모 허용).

### [INFO] N+1 쿼리 — 병렬화로 완화됨
- 위치: `interaction-token.service.ts` L181–L195 (`for` 루프 + `Promise.allSettled`)
- 상세: `rows`(최대 `safeLimit`=1000건) 단위로 `revokeAllForExecution`(내부 find+delete)을 호출하는 N+1 패턴이 여전히 존재하지만, 이번 변경에서 `RECONCILE_CONCURRENCY=20` bounded-concurrency 병렬화로 완화했다. per-execution 행 수는 live 경로에서 대부분 처리되어 sweep 시점에는 0~소수이므로 총 쿼리 수 상한은 `safeLimit * 2`(find+delete) 지만 실운영 부하는 낮다.
- 제안: 없음 (이전 리뷰 W3 부분 fix 로 인정됨. 추가 최적화가 필요하다면 executionId 배열을 한 번에 처리하는 bulk find+bulk delete 로 재구현 가능하나 현 규모에선 불요).

### [INFO] 트랜잭션 — 의도적 미사용
- 위치: `interaction-token.service.ts` — `revokeAllForExecution` 내부 find → delete 시퀀스
- 상세: per-execution revoke 는 idempotent·fail-open 설계이므로 find와 delete 사이에 트랜잭션 없이도 정합성 요건을 충족한다. 동일 executionId 를 두 인스턴스가 동시 처리해도 중복 revoke 는 허용(멱등)이며 Redis SET 도 overwrite-safe 이다. `@Processor({ concurrency: 1 })` 로 인스턴스 내 중복 실행을 제한하고 BullMQ 단일 repeatable entry 로 전역 1회를 보장하는 계층적 방어 설계와 일관적이다.
- 제안: 없음.

### [INFO] batchLimit clamp — DB 과부하 방어
- 위치: `interaction-token.service.ts` L147–L150 (`safeLimit` 계산)
- 상세: `Math.min(Math.max(1, Math.floor(batchLimit)), RECONCILE_BATCH_MAX=1000)` clamp 로 `.limit(safeLimit)` 에 전달되는 값이 [1, 1000] 범위로 제한된다. 이번 변경에서 도입된 방어 코드로 DB에 과도한 row 를 한 번에 읽어들이는 위험을 제거했다.
- 제안: 없음.

### [INFO] 마이그레이션 안전성 — 스키마 변경 없음
- 위치: 전체 diff
- 상세: 이번 변경은 기존 `execution_token` 엔티티와 `execution` 엔티티의 스키마를 그대로 사용한다. DDL 변경(컬럼 추가·삭제·인덱스 생성)이 없으므로 마이그레이션 잠금(lock) 또는 데이터 손실 위험이 없다.
- 제안: 없음.

### [INFO] 커넥션 관리 — TypeORM 커넥션 풀 위임
- 위치: `interaction-token.service.ts` — `createQueryBuilder`, `find`, `delete` 호출
- 상세: TypeORM Repository 및 QueryBuilder 패턴을 사용하므로 커넥션 획득·해제는 TypeORM 커넥션 풀이 담당한다. 명시적 `connection.release()` 가 필요한 raw 커넥션 패턴을 사용하지 않으므로 커넥션 누수 위험 없음.
- 제안: 없음.

### [INFO] SQL 인젝션 — 파라미터화 쿼리 사용
- 위치: `interaction-token.service.ts` L161 `.where('e.status IN (:...terminal)', { terminal: TERMINAL_STATUSES })`
- 상세: TypeORM 명명 파라미터(`:...terminal`) 를 사용하므로 SQL 인젝션 위험 없음.
- 제안: 없음.

## 요약

이번 변경의 DB 관련 코드는 `reconcileTerminalRevocations()` 내 QueryBuilder sweep 쿼리 리팩터링이 전부다. 기존 인덱스(`idx_execution_token_execution_id`, V060)로 커버됨이 확인되었고, N+1 패턴은 `Promise.allSettled` bounded-concurrency(20)로 완화했으며, batchLimit clamp([1,1000])로 DB 과부하 방어를 추가했다. 스키마 변경이 없어 마이그레이션 잠금·데이터 손실 위험도 없다. 모든 발견사항은 INFO 수준이며, 이전 리뷰(15_59_50)의 DB 관련 WARNING(W3·W4)이 이번 변경에서 적절히 처리되었다.

## 위험도

LOW
