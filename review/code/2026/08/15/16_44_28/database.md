STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# Database Review — `finalizeStalledExhausted` 트랜잭션화 (라운드 `16_44_28`)

## 대상 재확인

`git diff origin/main` 으로 실 diff 를 직접 대조했다. DB 에 영향 있는 코드 변경은 다음 3개 파일뿐이다.

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted`(함수 시작 `:3345`)의 Execution UPDATE + NodeExecution cascade UPDATE 를 `this.dataSource.transaction(async (manager) => {...})` 로 단일 트랜잭션화. 이전엔 두 UPDATE 가 각각 `this.executionRepository`/`this.nodeExecutionRepository` 를 통해 개별 autocommit 되어, 첫 UPDATE 커밋 후 둘째가 실패(DB 오류·크래시)하면 자식 `NodeExecution` 이 영구 `RUNNING` 으로 잔류할 수 있었다(부분 커밋). 같은 2-테이블 쓰기를 하는 자매 `cancelParkedExecution`(`:1023`)·`markWebChatIdleTimeout`(`:1152`)은 이미 `dataSource.transaction` 으로 원자화돼 있었고, 이 함수만 열려 있었다. 이번 diff 로 세 함수가 동형 패턴(트랜잭션 안에서 `manager.createQueryBuilder()` 2회, 커밋 이후 `finalizeRehydrationCleanup`+emit)이 됐다.
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `installStalledTx` 헬퍼(자매 `installCancelTx` 와 동형) 도입 + 4건의 회귀 테스트: (a) 두 UPDATE 가 같은 트랜잭션 `manager` 를 타는지, (b) 트랜잭션 밖 repository 를 쓰면 즉시 throw 하는 무장, (c) `id=:id`/`execution_id=:executionId`/`status=:running` WHERE·andWhere 가드 값 단언, (d) 트랜잭션 콜백 중간 실패(`nodeQb.execute` reject) 시 예외가 그대로 전파되고 종결 이벤트가 발행되지 않는지. `affected=0`(이미 terminal) no-op 테스트의 단언도 더 이상 쓰지 않는 `mockNodeExecutionRepo.createQueryBuilder` 미호출(리팩터링 후 자동으로 항상 참이 됐을 뻔한 단언)에서 `managerCqb` 호출 횟수 + `nodeQb.execute` 미호출로 교체됐다.
- `spec/5-system/4-execution-engine.md` — §7.1 본문 + Rationale "dead-letter 마감의 원자성" 문단 추가. 코드와 서술 일치, 신규 DB 설계 결정 없음.

마이그레이션 파일 변경 없음(`git diff origin/main --stat` 에 migration 경로 없음). 나머지 diff(`CHANGELOG.md`, `plan/**`, `review/**`)는 process 문서로 DB 코드 변경이 아니다.

## 점검 관점별 확인

1. **인덱스**: `Execution` UPDATE 는 `WHERE id = :id AND status = :running` — `id` 는 PK. `NodeExecution` UPDATE 는 `WHERE execution_id = :executionId AND status = :running` — 기존 `V095__node_execution_exec_status_active_index.sql` 의 partial composite index(`(execution_id, status) WHERE status IN ('waiting_for_input','running')`)가 이 쿼리 형태를 정확히 커버한다. 신규 마이그레이션 불필요.
2. **N+1**: 단일 `executionId` 처리, 반복문 없음. 해당 없음.
3. **트랜잭션**: 이번 diff 의 핵심이자 정확한 수정이다. 두 UPDATE 를 `dataSource.transaction()` 으로 묶어 부분 커밋 결함을 닫았다. 트랜잭션 콜백 내부에서 `manager.createQueryBuilder()` 만 사용(`this.executionRepository`/`this.nodeExecutionRepository` 직접 접근 없음)해 트랜잭션 밖으로 새는 경로를 차단했고, 신규 테스트가 이 계약을 throw 무장으로 잠갔다. `affected=0`(이미 terminal) 조기 return 은 트랜잭션 내부에서 두 번째 UPDATE 를 건너뛰어 불필요한 쓰기를 방지한다. 커밋 이후로 옮겨진 `finalizeRehydrationCleanup`+`emitExecution` 은 미커밋 상태에 대해 emit 하는 문제를 없앤다. 함수 레벨 `try/catch` 가 의도적으로 없어(JSDoc 에 명시) 트랜잭션 실패가 그대로 propagate 되고, 유일 호출부(`execution-run.processor.ts` `onFailed`)의 `.catch()` 가 흡수한다 — 이 계약도 신규 테스트("트랜잭션 중간 실패는 삼키지 않고 던진다 + 종결 이벤트도 안 나간다")로 고정됐다.
4. **마이그레이션 안전성**: 스키마 변경 없음(신규 컬럼·인덱스·테이블 없음). N/A.
5. **스키마 설계**: 스키마 변경 없음. N/A.
6. **커넥션 관리**: `DataSource.transaction()` 콜백 패턴을 사용해 TypeORM 이 커넥션 획득/해제·커밋/롤백을 관리한다. 명시적 커넥션 릭 위험 없음.
7. **SQL 인젝션**: 두 UPDATE 모두 `:id`/`:running`/`:executionId` 파라미터 바인딩만 사용(`setParameter`/`where(...,{})`). 문자열 결합 없음. 안전.
8. **대량 데이터**: 단건 `executionId` 대상 조건부 UPDATE, 배치/전체 스캔 없음. 페이지네이션 해당 없음.

## 이전 라운드(`16_04_38`/`16_19_26`/`16_31_53`) 대비 델타

- `16_04_38` 라운드가 지적한 WARNING("트랜잭션 콜백 중간 실패 경로를 잠그는 테스트가 없다")이 이번 diff 의 신규 테스트로 해소됐다 — mock 레벨에서 `nodeQb.execute` reject 시 예외 propagate + emit 미호출을 확인한다.
- `installStalledTx` 헬퍼 재사용 누락(WARNING, maintainability 관점) 도 첫 테스트가 헬퍼를 호출하도록 교체돼 해소됐다.
- 프로덕션 쿼리 로직(WHERE 절·트랜잭션 경계·인덱스 대상) 자체는 `16_04_38` 도입 이후 바뀌지 않았다 — 신규 DB 위험 없음.

## 발견사항

없음.

참고(신규 지적 아님, 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` W1(`16_19_57`)에 등재됨): `finalizeStalledExhausted` 트랜잭션의 **실 DB 부분 커밋/롤백 검증**은 여전히 mock 레벨(같은 트랜잭션 manager 를 탄다는 전제까지만 검증)에 머물러 있다. mock 은 롤백을 시뮬레이션하지 못한다는 한계를 테스트 주석이 스스로 명시하며, 이 갭은 정본 트래커에 이미 등재되어 있으므로 이번 diff 에 대한 추가 조치 요구는 아니다.

## 요약

DB 정합성 관점에서 이 변경은 순수한 개선이다. `finalizeStalledExhausted` 만 유일하게 트랜잭션 밖에서 2-테이블 쓰기를 하던 갭(부분 커밋 시 자식 `NodeExecution` 영구 `RUNNING` 잔류)을, 이미 원자적이던 두 자매 함수와 동형 패턴(`dataSource.transaction` + `manager.createQueryBuilder`, 커밋 후 best-effort 부수효과)으로 닫았다. 인덱스는 기존 partial composite index 가 정확히 커버하고, 파라미터 바인딩·락 순서·커넥션 관리 모두 기존 관례를 그대로 따른다. 이전 라운드에서 지적된 testing/maintainability WARNING(중간 실패 테스트 부재, 헬퍼 미재사용)도 이번 diff 에서 해소를 확인했다. 마이그레이션·스키마 변경은 없다.

## 위험도
NONE
