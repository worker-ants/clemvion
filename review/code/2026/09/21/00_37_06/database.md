# 데이터베이스(Database) 리뷰 — schedule-dup-delete (재검토, 00_37_06)

## 검토 범위

실제 DB 관련 코드 변경은 3개 파일이다.

- `codebase/backend/src/modules/schedules/schedules.service.ts` — `remove()` 삭제 판정 로직 + `throwScheduleNotFound()` 헬퍼 추출
- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — mock 계약 변경(`delete` 가 `affected` 반환) + 신규 유닛 테스트 2건
- `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts` — advisory lock 을 직접 쥐어 겹침을 재현하는 신규 e2e

나머지 파일(`CHANGELOG.md`, `plan/**`, `review/**`)은 문서·이전 라운드(`00_06_01`) 산출물이며 DB 로직 변경이 없다. 이 세션은 이전 라운드(`review/code/2026/09/21/00_06_01/database.md`)의 WARNING 조치(테스트 추가·헬퍼 추출·CHANGELOG 반영) 이후 재검토다 — 조치 커밋(`893dfeb7a`, `69889f74e`, `131296205`)은 모두 헬퍼 추출·테스트·문서 추가로, `remove()` 의 DB 쓰기 순서·트랜잭션 경계 자체는 변경하지 않았음을 실제 파일(`schedules.service.ts:308-383`)로 확인했다.

## 발견사항

- **[INFO]** CASCADE 경로의 `scheduleRepository.remove(schedule)` 는 항상 0행 no-op
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:367`
  - 상세: `triggerId` 가 있는 삭제 경로에서는 락 안 `m.delete(Trigger, triggerId)` (337행) 이 커밋되는 순간 `schedule.trigger_id → trigger` FK 의 `onDelete: 'CASCADE'` (엔티티 `schedule.entity.ts:28` 로 실측 확인)로 스케줄 행도 DB 가 함께 지운다. 따라서 트랜잭션 밖에서 실행되는 367행의 `remove(schedule)` 은 매 성공 경로마다 PK 기준 DELETE 를 한 번 더 왕복시키지만 항상 0행이다. 인접 주석(365-366행)에 "CASCADE 가 없어지면 이 줄이 유일한 삭제"라는 방어 근거가 명시돼 있고, 이번 라운드에서 성공 경로 테스트(`schedules.service.spec.ts` — `expect(scheduleRepo.remove).toHaveBeenCalledWith(schedule)`)가 새로 추가돼 이 방어 호출 자체의 실행이 뮤테이션으로 검증됐다(이전 라운드 WARNING #1 조치).
  - 제안: 조치 불요. 원한다면 CASCADE 를 유일 SoT 로 확정하고 이 줄을 제거해 불필요한 왕복 하나를 없앨 수 있으나, 현재의 방어적 이중 삭제도 타당한 트레이드오프다.

- **[INFO]** advisory lock 은 트랜잭션 범위(`pg_advisory_xact_lock`)라 `NotFoundException` throw 로도 정상 해제됨
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:324-339`
  - 상세: `m.delete(Trigger, triggerId)` 의 `affected` 가 0이면 트랜잭션 콜백 안에서 `throwScheduleNotFound()` (338행)를 호출한다. `manager.transaction()` 은 이를 잡아 ROLLBACK 후 재throw 하므로, 진 쪽 요청도 락을 정상 해제한다(xact 락은 트랜잭션 종료 시 자동 해제). `.catch` (340-355행)에서 `NotFoundException` 을 먼저 걸러내 재throw 함으로써(344행) 정상적인 동시 삭제 404 를 "반쯤 삭제된 상태" 오탐 로그(349-353행)로 잘못 분류하지 않는다. 신규 e2e(`schedule-delete-concurrency.e2e-spec.ts`)가 `pg_advisory_xact_lock` 을 직접 쥐어 겹침을 만들고 `[204, 404]` + 감사 1건을 실측으로 확인한다.
  - 제안: 조치 불요.

- **[INFO]** `triggerId` 없는 방어 분기의 판정 대상 전환은 정확하고, 이번 라운드에서 실행 검증이 채워졌다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:368-376`
  - 상세: 이 분기는 CASCADE 가 개입하지 않으므로 `scheduleRepository.delete({ id, workspaceId })` 자체의 `affected` 로 "누가 지웠는가"를 가른다 — 단일 원자적 DELETE 문이 DB 레벨에서 정확히 판정하므로 앱 레벨 락이 없어도 이중 감사가 나지 않는다. 이전 라운드 WARNING #2(이 분기의 0-affected→404 경로가 happy-path 테스트로만 커버되어 실행 검증되지 않음)가 이번 라운드에서 신규 대조 테스트(`schedules.service.spec.ts` — `scheduleRepo.delete.mockResolvedValueOnce({ affected: 0, raw: [] })` → 404 단언)로 조치됐다.
  - 제안: 조치 불요.

- **[INFO]** `throwScheduleNotFound()` 헬퍼 추출(리팩토링)은 DB 쓰기 순서·트랜잭션 경계에 영향 없음
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:151-156` (헬퍼 정의), 호출부 141·338·375행
  - 상세: 이전 라운드 WARNING #3(`NotFoundException` 리터럴 3중 복제) 조치로 추출된 순수 리팩토링이며, `throw` 시점·트랜잭션 롤백 경로·advisory lock 해제 시점은 그대로다. 동작 변화 없음을 코드 대조로 확인했다.
  - 제안: 조치 불요.

## 관점별 확인

1. **인덱스**: 신규 쿼리 없음(기존 PK/FK 기준 `delete`/`findOne`). 인덱스 영향 없음.
2. **N+1**: 반복문 내 개별 쿼리 없음. `remove()` 는 단건 삭제 흐름이다.
3. **트랜잭션**: 핵심 변경 지점 — advisory lock 을 트랜잭션 안에서 잡고, `m.delete(Trigger, triggerId)` 의 `affected` 를 판별자로 삼아 진 쪽을 즉시 롤백+404 시킨다. 판정 기준을 스케줄 행이 아니라 트리거 행의 `affected` 로 잡은 근거(CASCADE 로 인해 스케줄 행 수로는 이긴 쪽도 0행이 되어 오판정된다)가 코드 주석·plan 문서·e2e 삼자에서 일관되고, 엔티티 실측(`onDelete: 'CASCADE'`)과도 부합한다. 적절하다.
4. **마이그레이션 안전성**: 스키마 변경 없음 — diff 에 migration 파일 없음, 엔티티 CASCADE 설정은 기존 값 그대로 인용. 해당 없음.
5. **스키마 설계**: `schedule.trigger_id` FK `ON DELETE CASCADE` 라는 기존 설계를 전제로 애플리케이션 판정 로직을 정합화한 것 — 새로운 정규화/비정규화 이슈 없음.
6. **커넥션 관리**: `this.triggerRepository.manager.transaction(...)` 로 풀에서 받은 연결을 TypeORM 이 자동 관리·해제. e2e 의 `db`/`locker` pg `Client` 도 `beforeAll`/`afterAll` 에서 명시적으로 connect/end 하여 누수 없음(`schedule-delete-concurrency.e2e-spec.ts:35-59`).
7. **SQL 인젝션**: `m.delete(Trigger, triggerId)`, `scheduleRepository.delete({ id, workspaceId })` 모두 TypeORM 파라미터화 API. e2e 의 raw SQL(`pg_advisory_xact_lock(hashtext($1))`, `SELECT ... WHERE id = $1` 등, `schedule-delete-concurrency.e2e-spec.ts:78-79, 97-99, 123-126, 131-133`)도 전부 `$1` 플레이스홀더로 파라미터화됨. 인젝션 위험 없음.
8. **대량 데이터**: 단건 PK 기준 삭제/조회만 존재. 페이지네이션·대용량 스캔과 무관.

## 요약

이번 재검토 대상은 이전 라운드(`00_06_01`)에서 이미 LOW 로 평가된 DB 로직에 대해, 그 라운드의 WARNING 조치(테스트 2건 추가·`NotFoundException` 헬퍼 추출·CHANGELOG 반영)만 얹은 것이다. 실측 결과 `remove()` 의 트랜잭션 경계·advisory lock 획득/해제 시점·판별자 선택(FK CASCADE 때문에 트리거 행의 `affected` 를 판별자로 삼은 것)·파라미터화 쿼리·커넥션 해제는 조치 전후로 동일하며 모두 안전하다. 새로 추가된 유닛 테스트·e2e 테스트는 이 계약을 실행 레벨에서 고정할 뿐 DB 쓰기 자체를 바꾸지 않았다. 스키마 변경(마이그레이션)은 없다. 새로 발견된 문제는 없으며, 기록해 둘 사항은 모두 INFO 수준이다.

## 위험도

LOW
