# 데이터베이스(Database) 리뷰

## 발견사항

### INFO: reconcileTerminalRevocations — N+1 쿼리 패턴 (설계적 상쇄 존재)
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `reconcileTerminalRevocations()` (라인 1258–1294)
- 상세: `createQueryBuilder` 로 배치 조회 후, execution 별로 `revokeAllForExecution`을 호출하며 각각 `find({ where: { executionId } })` + `delete({ executionId })` 쿼리가 발생한다. batchLimit 기본 500 기준 최악 500건×2쿼리 = 1000회 왕복 가능성이 있다. 단, 코드는 `RECONCILE_CONCURRENCY=20` 으로 청크 병렬화(Promise.allSettled)를 적용해 직렬 N+1을 상당 부분 완화했고, 이 설계는 주석에도 명시되어 있다.
- 제안: 현재 설계는 at-least-once 보강 sweep 이라 분 단위 주기 실행이며 실제 잔존 건수가 많을 경우는 예외적 상황이다. 실운영에서 배치 크기가 크게 유지된다면 `executionId IN (...)` 방식의 일괄 `find`로 전환하여 쿼리 수를 O(청크수)로 줄이는 것을 장기 개선 항목으로 고려할 수 있다. 단, 현재 구조는 `revokeAllForExecution`이 idempotent·fail-open 이어서 부분 실패 격리가 필요한 점에서 per-execution 개별 호출이 설계 근거를 갖추고 있다.

### INFO: revokeAllForExecution — executionId 인덱스 존재 여부 미확인
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `revokeAllForExecution()` (라인 1198–1229)
- 상세: `find({ where: { executionId } })` 후 동일 조건으로 `delete({ executionId })`를 별도로 수행한다. `execution_token` 테이블의 `executionId` 컬럼에 인덱스가 있다고 가정하면 두 쿼리 모두 인덱스 탐색이 가능하나, 이 diff 에서 엔티티/마이그레이션 파일이 포함되지 않아 인덱스 유무를 직접 확인할 수 없다.
- 제안: `ExecutionToken` 엔티티 정의에서 `executionId` 컬럼에 `@Index()` 가 선언되어 있는지 확인 필요. 해당 컬럼은 `find`, `delete`, `createQueryBuilder .innerJoin` 모두에서 조건으로 사용되므로 인덱스 누락 시 테이블 풀스캔 위험이 있다.

### INFO: reconcileTerminalRevocations QueryBuilder — execution.status 인덱스 존재 여부 미확인
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `reconcileTerminalRevocations()` (라인 1258–1267)
- 상세: `execution_token` 테이블에서 `execution` 을 `innerJoin` 하며 `e.status IN (:...terminal)` 조건을 적용한다. `execution.status` 컬럼에 인덱스가 없으면 배치 크기가 클수록 execution 테이블 풀스캔이 발생할 수 있다.
- 제안: `execution.status` 인덱스 존재 여부를 마이그레이션/엔티티 정의에서 확인. terminal 상태는 전체 execution 의 다수를 차지할 수 있어 선택도(selectivity)가 낮다면 복합 인덱스(status + id) 또는 partial index 검토.

### INFO: 트랜잭션 미사용 — Redis SET + DB DELETE 분리 (의도적 설계)
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `revokeAllForExecution()` + `reconcileTerminalRevocations()`
- 상세: Redis blacklist SET 과 DB DELETE 가 단일 트랜잭션으로 묶이지 않는다. Redis SET 성공 후 DB DELETE 실패(또는 역방향)가 발생하면 상태 불일치가 생긴다. 단, `execution_token` row 가 잔존해도 다음 reconcile tick 에서 재처리(idempotent)되므로 at-least-once 보장이 유지된다. Redis fail-open 정책도 명시적으로 코드에 기술되어 있다.
- 제안: 현재 설계는 의도적 fail-open이며 spec 에 근거를 두고 있으므로 차단 이슈는 아니다. eventual consistency 모델이 허용 가능함은 기존 주석에 일부 기술되어 있다.

## 요약

데이터베이스 관련 변경의 핵심은 `interaction-token.service.ts` 의 `reconcileTerminalRevocations` / `revokeAllForExecution` 메서드다. N+1 쿼리 형태가 존재하나 RECONCILE_CONCURRENCY=20 청크 병렬화로 설계적으로 완화되어 있고, sweep 빈도와 예외적 잔존 건수를 감안하면 실운영 위험은 낮다. 트랜잭션 비사용은 의도적 fail-open 설계이며 idempotent 재처리 루프로 보완된다. 주된 미확인 위험은 `execution_token.executionId` 및 `execution.status` 인덱스 존재 여부이며, 이 diff 에 스키마/마이그레이션 파일이 포함되지 않아 직접 확인이 필요하다. 나머지 변경(모듈 import 리팩터링, Swagger 데코레이터 교체, BullMQ 큐 상수 분리, 테스트 추가)은 DB와 직접 관련 없다.

## 위험도

LOW
