# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** 락 안 재조회(`m.findOne`)는 PK 단건·컬럼 최소화 조회라 비용 무시 가능
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` (`const fresh = await m.findOne(Trigger, { select: { id: true }, where: { id, workspaceId } });` 블록)
  - 상세: advisory lock(`acquireTriggerConfigLock`) 획득 뒤 행 존재를 재확인하는 쿼리가 새로 추가됐다. `id` 는 PK 이므로 인덱스 스캔 1행, `select: { id: true }` 로 컬럼도 최소화해 대량 테이블 여부와 무관하게 비용이 사실상 0에 가깝다. 트랜잭션 안에서 실행되며 advisory lock(`pg_advisory_xact_lock`)은 트랜잭션 종료(commit/rollback) 시 자동 해제되므로 커넥션 누수·락 잔존 위험이 없다. 파라미터는 TypeORM `where` 절을 통해 바인딩되어 SQL 인젝션 경로도 없다.
  - 제안: 조치 불요. 형제 경로(workflows/workspaces `pessimistic_write` 행 락)와 다른 lock 종류(advisory)임을 정확히 인지하고 그에 맞게 "잠근 뒤 재조회"를 추가한 설계가 타당하다.

- **[INFO]** `SchedulesService.remove()` 자신의 스케줄 행 삭제는 같은 클래스의 결함을 아직 갖고 있으나, 이번 diff 범위 밖이며 이미 트래커에 등재됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (신규 developer 항목, "`SchedulesService.remove()` 도 동시 삭제에서 감사 행을 두 번 남길 수 있다") / 실제 코드는 `codebase/backend/src/modules/schedules/schedules.service.ts:345` (이번 diff에는 포함되지 않음)
  - 상세: `this.scheduleRepository.remove(schedule)` 이 advisory lock도, 재조회(`!fresh`) 가드도 거치지 않고 트랜잭션 밖에서 호출된다는 것을 plan 문서가 코드를 직접 읽어 확인했다고 기록하고 있다. 동시 DELETE 두 건이 겹치면 이번 PR이 트리거에서 고친 것과 같은 형태로 `SCHEDULE_DELETED` 감사 행이 중복될 수 있다. 다만 이 파일 자체는 이번 diff의 변경 대상이 아니고(문서상 언급뿐), plan에 developer 후속 항목으로 명시적으로 등재되어 있어 범위 이탈이나 은폐가 아니다.
  - 제안: 조치 불요(이번 PR 스코프 밖, 이미 추적됨). 후속 세션에서 트리거와 같은 처방(advisory lock 도입 여부 실측 → 락 안 재조회)을 적용할 것.

- **[INFO]** 신규 e2e의 raw SQL은 모두 파라미터 바인딩을 사용
  - 위치: `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` (`SELECT pg_advisory_xact_lock(hashtext($1))`, `SELECT COUNT(*)::text AS count FROM audit_log WHERE ... resource_id = $1 ...`)
  - 상세: 두 raw 쿼리 모두 `$1` 파라미터 바인딩을 쓰고 문자열 보간이 없어 SQL 인젝션 경로가 없다. 락 전용 커넥션(`locker`)과 검증용 커넥션(`db`)을 분리해 트랜잭션을 오래 쥐는 커넥션과 짧은 조회 커넥션을 섞지 않았고, `afterAll`에서 둘 다 `.end()`로 해제하며 `finally` 블록에서 `ROLLBACK`을 항상 시도해 커넥션·락 잔존을 방지한다.
  - 제안: 조치 불요.

## 요약

이번 라운드는 이전 리뷰(`review/code/2026/09/20/22_07_23`)의 WARNING 5건에 대한 조치 커밋들(plan 정정, CHANGELOG 추가, e2e lock-key import 교체, genuine 실패 로깅 단위 테스트 추가)로 구성되며, 데이터베이스 관점에서 새로 손댄 스키마·쿼리·트랜잭션 코드는 없다. 핵심 서비스 변경(`triggers.service.ts`의 advisory lock 뒤 재조회 + `.catch`에서 `NotFoundException` 분리)은 이전 라운드에서 이미 검토되었고, 동시성 안전성·트랜잭션 경계(되돌릴 수 없는 외부 해제는 락 밖, 재조회·삭제는 락 안, advisory lock은 트랜잭션 종료 시 자동 해제, `lock_timeout` 상한으로 무한 대기를 오류로 드러냄)가 형제 경로(workflows/workspaces)와 일관되게 설계되어 있다. 신규 재조회 쿼리는 PK 단건·최소 컬럼 조회라 대량 데이터 성능에 영향이 없고, 모든 쿼리(TypeORM 및 e2e raw SQL)가 파라미터화되어 있다. `SchedulesService.remove()`의 동종 잔여 결함은 이번 diff의 코드 변경 대상이 아니며 이미 후속 항목으로 트래커에 등재되어 있어 재지적할 신규 사안이 아니다. Critical/Warning 없음.

## 위험도

NONE
