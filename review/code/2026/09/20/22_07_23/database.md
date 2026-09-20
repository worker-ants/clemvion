# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** 락 안 재조회로 DB 왕복이 1회 늘었으나 PK 단건 조회라 비용 무시 가능
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1090-1093` (`const fresh = await m.findOne(Trigger, { select: { id: true }, where: { id, workspaceId } });`)
  - 상세: advisory lock 획득 후 `Trigger.id`(PK, `PrimaryGeneratedColumn('uuid')`, `entities/trigger.entity.ts:33`) 단건 조회를 추가했다. 삭제는 저빈도 관리 작업이고 조회는 `select: { id: true }` 로 컬럼도 최소화했으므로 인덱스·성능 관점에서 문제 없다. 오히려 이 재조회가 없던 것이 이번에 고친 결함(advisory lock 은 줄만 세울 뿐 「행이 아직 있는가」를 스스로 확인하지 않음)의 원인이었다 — 추가는 정확성 개선이지 비용 문제가 아니다.
  - 제안: 별도 조치 불필요.

- **[INFO]** 트랜잭션·락 설계가 형제 PR(workflows/workspaces, `4a9828afe`)과 일관됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` (라인 1060-1121)
  - 상세: 되돌릴 수 없는 외부 자원 해제(`releaseExternal`)는 트랜잭션·락 **밖**에서 먼저 수행하고(`trigger-config-lock.ts` JSDoc 이 명시적으로 금지하는 "외부 호출을 락 안에" 형태를 피함), `acquireTriggerConfigLock` 획득 후 커밋된 최신 상태를 재조회해 부재 시 롤백(404, 감사·비밀 정리 skip), 존재 시 삭제 후 커밋 → 커밋 **뒤에** 비밀 정리 → 감사 기록 순서를 따른다. `.catch` 에서 `NotFoundException` 은 정상 경합으로 분리해 재던지고(거짓 「반쯤 삭제」 경보 방지), 그 외 에러만 `logger.error` 로 수동 정리 필요 로그를 남긴다. `pg_advisory_xact_lock` 은 트랜잭션 종료(커밋/롤백) 시 자동 해제되므로 락 누수 위험 없음. 대기 상한(`TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5000ms`, `SET LOCAL lock_timeout`)이 있어 무한 대기로 인한 「자원은 해제됐는데 행은 남는」 상태를 오류로 드러낸다.
  - 제안: 없음 — 설계가 견고함을 확인.

- **[INFO]** e2e 동시성 테스트의 DB 커넥션·트랜잭션 위생 양호
  - 위치: `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` (파일 전체, 특히 라인 91-119)
  - 상세: 별도 `locker` 커넥션으로 advisory lock 을 명시적으로 쥐고(BEGIN → `pg_advisory_xact_lock` → 두 DELETE 요청 발사 → 공허성 가드로 「아직 pending」 확인 → COMMIT), `finally` 에서 `ROLLBACK.catch(() => undefined)` 로 커밋 후 잔여 트랜잭션이 없어도 안전하게 정리한다. `db`/`locker` 두 `pg.Client` 는 `afterAll` 에서 `.end()` 로 반드시 해제된다. 감사 카운트 검증 쿼리(`SELECT COUNT(*) ... WHERE resource_type = $1 ... AND action = $2`)도 파라미터 바인딩을 사용해 SQL 인젝션 위험이 없다.
  - 제안: 없음.

- **[INFO]** SQL 인젝션 관점 — 변경 범위 내 모든 쿼리가 파라미터화됨
  - 위치: `triggers.service.ts:1090-1093`(TypeORM `findOne` where 절), `trigger-delete-concurrency.e2e-spec.ts:94-96, 121-125`(`$1` 바인딩)
  - 상세: 신규/변경된 쿼리 중 문자열 결합으로 사용자 입력을 SQL 에 직접 삽입하는 자리는 없다. (참고: `trigger-config-lock.ts` 의 `SET LOCAL lock_timeout = '${...}ms'` 는 문자열 보간이지만 이번 diff 에 포함되지 않은 기존 코드이고, 입력은 모듈 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)뿐이라 사용자 입력 경로가 없음 — 기존 리뷰에서 이미 다뤄진 사안.)

## 요약

이번 변경은 `TriggersService.remove()` 의 동시 DELETE 경합에서 advisory lock 획득 후 행 존재를 재확인하지 않아 감사 로그(`trigger.deleted`)가 중복 기록되던 결함을 고친다. 락 안 재조회 → 부재 시 롤백/404, 존재 시 삭제 → 커밋 후 비밀 정리 → 감사 기록이라는 순서는 직전 workflows/workspaces PR(`4a9828afe`, `ae4fbc374`)과 같은 패턴이며, 되돌릴 수 없는 외부 자원 해제를 락 밖에 두는 기존 제약도 그대로 지킨다. 추가된 재조회는 PK 단건 조회라 인덱스·성능 부담이 없고, advisory lock 은 트랜잭션 종료 시 자동 해제되어 락 누수가 없으며, 대기 상한(5s)이 무한 대기를 드러나는 오류로 바꾼다. 신규 e2e 테스트도 별도 커넥션·`finally` 정리·파라미터화 쿼리로 커넥션/트랜잭션 위생이 양호하다. 스키마 변경·마이그레이션·대량 데이터 페이지네이션 관련 코드는 이번 diff 에 없다. 데이터베이스 관점에서 지적할 결함을 찾지 못했다.

## 위험도

NONE
