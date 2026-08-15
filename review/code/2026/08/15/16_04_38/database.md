STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# Database Review — `finalizeStalledExhausted` 트랜잭션화

## 발견사항

- **[INFO]** `finalizeStalledExhausted` 는 DB 오류를 내부에서 흡수하지 않고 호출자로 전파한다 — 자매 함수(`cancelParkedExecution`, `markWebChatIdleTimeout`)는 트랜잭션 전체를 `try/catch` 로 감싸 "DB 오류는 내부 흡수(best-effort)"를 명시하지만, 이 함수는 `try/catch` 없이 `this.dataSource.transaction(...)` 이 throw 하면 그대로 밖으로 던진다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3334` (`async finalizeStalledExhausted`, 게이트 3334)
  - 상세: 실제로는 문제가 되지 않는다 — 유일한 호출부인 `execution-run.processor.ts` 의 `onFailed`(BullMQ `@OnWorkerEvent('failed')`, non-async void 핸들러)가 `void this.engine.finalizeStalledExhausted(executionId).catch((err_) => this.logger.error(...))` 로 이미 예외를 잡아 로깅한다. 즉 두 자매의 "함수 내부 흡수"와 이 함수의 "호출부 흡수"는 동일한 최종 효과(비-throw, 로그만 남김)를 낸다.
  - 제안: 기능 결함은 아니므로 수정 불필요. 다만 자매 3개의 에러 처리 위치가 갈리므로(2개는 함수 내부, 1개는 호출부), 추후 이 계열을 다시 손댈 때 "왜 여기만 다른가"를 헷갈리지 않도록 함수 docstring 에 "호출부(`onFailed`)가 catch 하므로 함수 내부에서 흡수하지 않는다" 한 줄을 남겨두면 좋다.

## 점검 관점별 확인

1. **인덱스**: `Execution` UPDATE 는 `WHERE id = :id AND status = :running` — `id` 가 PK 라 인덱스 문제 없음. `NodeExecution` UPDATE 는 `WHERE execution_id = :executionId AND status = :running` — `node-execution.entity.ts` 에 `@Index(['executionId', 'status'])` 선언 + Flyway `V095__node_execution_exec_status_active_index.sql` 의 partial index(`WHERE status IN ('waiting_for_input','running')`)가 이 쿼리 형태를 정확히 커버한다. 신규 마이그레이션 불필요, 누락 없음.
2. **N+1**: 단일 `executionId` 에 대한 처리이며 반복문 없음. N+1 해당 없음.
3. **트랜잭션**: 이 PR 의 핵심 — 종전엔 Execution UPDATE 와 NodeExecution cascade UPDATE 가 각각 autocommit 이라, 첫 UPDATE 커밋 후 둘째가 실패하면 자식 `NodeExecution` 이 영구 `RUNNING` 으로 잔류할 수 있었다. `this.dataSource.transaction(async (manager) => {...})` 로 두 쓰기를 원자화했고, 트랜잭션 내부에서 `manager.createQueryBuilder()` 만 사용(리포지토리 직접 접근 없음)해 트랜잭션 밖 접근 가능성을 차단했다. 락 순서(Execution → NodeExecution)도 이미 원자적이던 두 자매(`cancelParkedExecution`, `markWebChatIdleTimeout`)와 동일해 데드락 위험을 늘리지 않는다. 부수효과(로그·`finalizeRehydrationCleanup`·이벤트 emit)는 커밋 이후로 옮겨져, 커밋되지 않은 상태에 대해 emit 하는 문제도 없다. affected=0(이미 terminal) 조기 return 은 트랜잭션 내에서 두 번째 UPDATE 를 건너뛰어 불필요한 쓰기를 방지한다. 견고함.
4. **마이그레이션 안전성**: 스키마 변경 없음(신규 컬럼·인덱스·테이블 없음). N/A.
5. **스키마 설계**: 스키마 변경 없음. N/A.
6. **커넥션 관리**: `DataSource.transaction()` 콜백 패턴을 사용해 TypeORM 이 커넥션 획득/해제·커밋/롤백을 관리한다. 명시적 커넥션 릭 위험 없음.
7. **SQL 인젝션**: 두 UPDATE 모두 `:id` / `:running` / `:executionId` 파라미터 바인딩만 사용(`setParameter`/`where(...,{})` 패턴). 문자열 결합 없음. 안전.
8. **대량 데이터**: 단건 `executionId` 대상 조건부 UPDATE 이며 배치/전체 스캔 없음. 페이지네이션 해당 없음.

테스트(`execution-engine.service.spec.ts`)는 `installStalledTx` 헬퍼로 (a) 두 UPDATE 가 같은 트랜잭션 `manager` 를 통해 실행되는지, (b) 트랜잭션 밖 리포지토리가 호출되면 즉시 throw 하도록 무장해 회귀를 잡는지, (c) affected=0 인 no-op 케이스에서 두 번째 UPDATE 가 실행되지 않는지를 검증한다. mock 은 실제 롤백을 시뮬레이션할 수 없다는 한계를 주석으로 정직하게 명시했고("두 UPDATE 가 같은 트랜잭션 manager 를 탄다는 것까지"), 실제 원자성(부분 커밋 방지) 검증은 별도 실 DB e2e 트랙으로 위임한다는 방향도 합리적이다. 기존에 항상-참이 될 뻔했던 단언(`mockNodeExecutionRepo.createQueryBuilder` 미호출 — 리팩터링 후 그 mock 자체를 안 쓰게 되어 자동으로 항상 참이 됨)을 `managerCqb` 호출 횟수 + `nodeQb.execute` 미호출 단언으로 교체한 것도 정당하다.

## 요약

DB 정합성 관점에서 이 변경은 순수한 개선이다. `finalizeStalledExhausted` 만 유일하게 트랜잭션 밖에서 2-테이블 쓰기를 하던 갭(부분 커밋 시 자식 `NodeExecution` 영구 `RUNNING` 잔류)을, 이미 원자적이던 두 자매 함수와 동형 패턴(`dataSource.transaction` + `manager.createQueryBuilder`, 커밋 후 best-effort 부수효과)으로 닫았다. 인덱스는 기존 partial composite index 가 정확히 커버하고, 파라미터 바인딩·락 순서·커넥션 관리 모두 기존 관례를 그대로 따른다. 유일한 관찰 사항(에러 처리 위치가 자매와 다름)은 호출부에서 이미 등가로 처리되므로 기능적 위험이 없는 INFO 다.

## 위험도
LOW
