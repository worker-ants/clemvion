# 데이터베이스(Database) 리뷰 결과

## 발견사항

### [WARNING] reconcileTerminalRevocations 루프 내 N+1 쿼리 패턴
- **위치**: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `reconcileTerminalRevocations()` 메서드 (추가된 라인 313–322)
- **상세**: 1차 쿼리로 최대 500건의 `executionId` row 를 가져온 뒤, `for...of` 루프 내에서 execution 별로 `revokeAllForExecution(executionId)` 를 호출한다. 해당 메서드 내부에서 다시 `find({ where: { executionId } })` (SELECT) + 각 jti 별 Redis SET + `delete({ executionId })` (DELETE) 가 순차 실행된다. 결과적으로 배치 500건 기준 최대 500회 SELECT + 500회 DELETE 가 개별 호출되는 N+1 구조다.
- **제안**: reconcile sweep 특성상 초당 실행 빈도가 낮고(분 1회), 배치 500 이내이므로 즉각적인 DB 과부하는 낮다. 단, 잔존 토큰이 대량 누적된 복구 시나리오에서 단일 sweep 실행 시간이 길어질 수 있다. 개선 방향: `executionId` 목록을 `IN` 절로 묶어 `executionTokenRepository.find({ where: { executionId: In(ids) } })` 한 번에 일괄 조회 후 Redis multi/pipeline + `DELETE ... WHERE executionId IN (...)` 로 처리하면 쿼리 횟수를 O(1)로 줄일 수 있다. 당장 운영 위험은 낮으나 스케일 증가 시 개선 권장.

### [WARNING] execution_token.executionId 인덱스 및 execution.status 복합 인덱스 확인 필요
- **위치**: `reconcileTerminalRevocations()` — QueryBuilder 구간 (추가 라인 297–310)
- **상세**: 쿼리는 `execution_token` (`et`) 테이블에서 `et.execution` 을 `INNER JOIN` 하고 `e.status IN ('completed','failed','cancelled')` 조건 + `DISTINCT et.executionId` 를 조회한다. 이 쿼리가 효율적으로 동작하려면 (1) `execution` 테이블의 `status` 컬럼 인덱스, (2) `execution_token` 테이블의 `executionId` 컬럼 인덱스(FK 인덱스)가 필요하다. 또한 `revokeAllForExecution` 내부의 `find({ where: { executionId } })` 도 같은 FK 인덱스를 사용한다. diff 에 마이그레이션 변경이 없으므로 기존 엔티티 정의에서 인덱스가 이미 선언됐는지 확인이 필요하다.
- **제안**: `execution_token` 엔티티에 `@Index('idx_execution_token_executionId', ['executionId'])` 가 없다면 추가 마이그레이션 권장. `execution.status` 가 자주 필터링되는 컬럼이므로 마찬가지로 `@Index` 확인. 인덱스 추가 마이그레이션은 PostgreSQL 기준 `CREATE INDEX CONCURRENTLY` 로 무중단 적용 가능.

### [INFO] DELETE 는 트랜잭션 없이 fail-open 개별 실행
- **위치**: `revokeAllForExecution()` (기존 코드지만 reconcile sweep 경로로 새로 호출됨)
- **상세**: jti 별 Redis SET 성공 후 `executionTokenRepository.delete({ executionId })` 를 별도 트랜잭션 없이 실행한다. Redis SET 이 성공했으나 DB DELETE 가 실패하면 해당 jti 는 Redis blacklist 에는 등록됐으나 `execution_token` row 는 잔존하게 된다. 이후 reconcile sweep 에서 해당 row 를 다시 발견하고 재시도하면 Redis SET 은 idempotent(SET + EX 재실행 무해), DB DELETE 재시도도 affected=0 으로 무해하다. 설계 주석("revokeAllForExecution 이 idempotent")이 이 케이스를 커버한다.
- **제안**: 현재 아키텍처에서 at-least-once + idempotent 보장이 성립하므로 위험도는 낮다. 현 설계 수용 가능, 문서화 상태 양호.

### [INFO] batchLimit=500 단일 페이지 — 다음 tick 까지 잔존 가능성
- **위치**: `reconcileTerminalRevocations(batchLimit = 500)` (추가 라인 292)
- **상세**: 1회 sweep 에서 최대 500 개의 `executionId` 만 처리한다. 잔존 토큰이 500건을 초과하는 경우 나머지는 다음 1분 tick 에서 처리된다. at-least-once 보장은 유지되나 대량 누적 복구 시나리오에서 완전 처리까지 여러 tick 이 소요될 수 있다.
- **제안**: 현재 요건(분 단위 sweep, 단명 토큰 1h TTL)에서 수용 가능한 설계다. 누적 급증 시나리오 대응이 필요하다면 sweep 반복 루프(`while (rows.length === batchLimit)`) 또는 batchLimit 증가를 고려할 수 있다.

## 요약

이번 변경의 핵심 DB 관련 코드는 `InteractionTokenService.reconcileTerminalRevocations()` 신규 메서드로, `execution_token` 테이블을 `execution.status` 로 INNER JOIN 하여 터미널 상태 실행의 잔존 토큰을 분 단위 BullMQ sweep 으로 회수하는 구조다. 전반적으로 TypeORM QueryBuilder 파라미터 바인딩(`:...terminal`)을 사용하여 SQL 인젝션 위험은 없고, 배치 제한(500)으로 대용량 단발 과부하를 방지하며, idempotent 재처리 설계로 Redis/DB 장애 후 안전 재시도가 가능하다. 마이그레이션 변경이 없으므로 스키마 안전성 문제는 없다. 주요 개선 포인트는 루프 내 N+1 쿼리(분 1회 sweep 이라 즉각 위험은 낮음)와 관련 인덱스 존재 여부 확인이다. 두 항목 모두 운영 즉각 위험이 낮아 WARNING 수준으로 평가한다.

## 위험도

LOW
