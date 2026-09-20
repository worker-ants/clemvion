# 데이터베이스(Database) 리뷰 — schedule-dup-delete (3차 재검토, 00_56_52)

## 검토 범위

이번 세션은 두 차례의 사전 리뷰(`00_06_01`, `00_37_06`)와 그 조치 커밋들(`893dfeb7a`·`69889f74e`·
`131296205`·`2879e88c7`)을 모두 반영한 최종 상태에 대한 재검토다. 실제 DB 로직이 있는 파일은 여전히 3개:

- `codebase/backend/src/modules/schedules/schedules.service.ts` — `remove()` 삭제 판정 로직
- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — mock 계약(`delete` → `affected`) + 유닛 테스트 4건
- `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts` — advisory lock 을 직접 쥐어 겹침을 재현하는 e2e

나머지(`CHANGELOG.md`, `plan/**`, `review/**`)는 문서·이전 라운드 산출물이며 DB 코드 변경이 없다.

가장 최근 커밋(`2879e88c7`)에서 실제로 DB 판정 로직 자체가 한 번 더 바뀌었다 — `if (!affected)` (truthy
검사) → `if (affected === 0)` (명시 비교) 로 트리거 삭제·방어 분기 두 판정 모두 전환됐다. 이 변경을
직접 실측했다(아래).

## 발견사항

- **[INFO]** `affected` 판정을 truthiness 에서 `=== 0` 명시 비교로 전환한 것은 올바른 방향
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:342`(트리거 삭제 판정), `:380`(방어 분기 판정)
  - 상세: node-postgres 드라이버는 `DELETE` 문에 대해 항상 `rowCount` 를 정수로 보고하므로 이 코드 경로에서 `affected` 가 `null`/`undefined` 가 될 가능성은 낮지만, 같은 락 서브시스템의 자매 함수 `rewriteTriggerConfigLocked` 가 이미 "모른다(`null`/`undefined`)를 없다(`0`)로 읽으면 정상 쓰기를 실패로 뒤집는다"는 근거로 `=== 0` 비교를 정했다(주석 337-340행 인용 확인). 두 판정 지점을 그 선례에 맞춘 것은 방어적으로 타당하고, 커밋 메시지에 적힌 뮤테이션 결과(판정 자체를 지우면 1건만 RED, 51건 GREEN)가 이 전환이 판정을 무르게 하지 않았음을 뒷받침한다.
  - 제안: 조치 불요.

- **[INFO]** CASCADE 경로의 `scheduleRepository.remove(schedule)` (371행)는 여전히 항상 0행 no-op
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:369-371`
  - 상세: `triggerId` 가 있는 경로는 락 안 `m.delete(Trigger, triggerId)` 가 커밋되는 순간 `schedule.trigger_id → trigger` FK 의 `onDelete: 'CASCADE'` (엔티티 `schedule.entity.ts:28-29` 로 직접 확인)로 스케줄 행도 DB 가 함께 지운다. 따라서 트랜잭션 밖에서 실행되는 371행의 `remove(schedule)` 은 매 성공 경로마다 PK 기준 DELETE 왕복을 하나 더 발생시키지만 항상 0행이다. 이전 라운드에서 이 방어 호출 자체의 실행이 성공 경로 테스트(`expect(scheduleRepo.remove).toHaveBeenCalledWith(schedule)`)로 고정됐음을 `schedules.service.spec.ts` 에서 확인했다. 정합성 결함은 아니며, 주석에 "CASCADE 가 없어지면 이 줄이 유일한 삭제"라는 방어 근거가 명시돼 있다.
  - 제안: 조치 불요 — 원한다면 CASCADE 를 유일 SoT 로 확정하고 이 줄을 제거해 불필요한 왕복 하나를 없앨 수 있으나 현재의 방어적 이중 삭제도 타당한 트레이드오프다.

- **[INFO]** advisory lock 은 트랜잭션 범위(`pg_advisory_xact_lock`)이므로 판정 실패 시 던지는 `NotFoundException` 으로도 정상 해제됨을 재확인
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:324-359`
  - 상세: `m.delete(Trigger, triggerId)` 의 `affected === 0` 이면 트랜잭션 콜백 안에서 `throwScheduleNotFound()` 를 호출한다. `manager.transaction()` 은 이를 잡아 ROLLBACK 후 재throw 하므로 진 쪽 요청도 락을 정상 해제한다. `.catch` (344-359행)에서 `NotFoundException` 을 먼저 걸러 재throw 함으로써(348행) 정상적인 동시 삭제 404 가 "반쯤 삭제된 상태" 오탐 로그로 잘못 분류되지 않는다. e2e(`schedule-delete-concurrency.e2e-spec.ts`)가 `pg_advisory_xact_lock` 을 직접 쥐어 겹침을 만들고 락 해제 뒤 `[204, 404]` + 감사 1건을 실측으로 확인한다(94-135행) — 겹침이 실제로 만들어졌는지를 락을 놓기 *전에* `Promise.race` 로 공허성 가드까지 두고 있다(103-111행), 방법론이 탄탄하다.
  - 제안: 조치 불요.

- **[INFO]** `triggerId` 없는 방어 분기의 판정 대상 전환(스케줄 행 자체의 `affected`)은 정확하고 실행 검증도 채워져 있다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:372-381`
  - 상세: 이 분기는 CASCADE 가 개입하지 않으므로 `scheduleRepository.delete({ id, workspaceId })` 자체가 반환하는 `affected` 로 "누가 지웠는가"를 가른다 — 단일 원자적 DELETE 문이 DB 레벨에서 행을 정확히 판정하므로 앱 레벨 락이 없어도 이중 감사가 나지 않는다(Postgres 는 동시 DELETE 를 행 단위로 직렬화하고, 진 쪽의 WHERE 절은 이미 지워진 행과 매치되지 않아 자연히 `rowCount=0` 이 된다). `schedules.service.spec.ts` 의 0-affected 대조 테스트(사용자 정의 "삭제 — triggerId 없는 분기에서 scheduleRepo.delete 가 0행이면 404" 케이스)로 실행 검증됨을 확인했다.
  - 제안: 조치 불요.

## 관점별 확인

1. **인덱스**: 신규 쿼리 없음 — 모두 기존 PK(`id`)/FK(`trigger_id`) 기준 `delete`/`findOne`. 인덱스 영향 없음.
2. **N+1 쿼리**: 반복문 내 개별 쿼리 없음. `remove()` 는 단건 삭제 흐름이며 각 단계가 정확히 한 번씩만 실행된다.
3. **트랜잭션**: 핵심 변경 지점. advisory lock 을 트랜잭션 안에서 잡고 `m.delete(Trigger, triggerId)` 의 `affected === 0` 을 판별자로 삼아 진 쪽을 즉시 롤백+404 처리한다. 판정 기준을 스케줄 행이 아니라 트리거 행의 `affected` 로 잡은 근거(FK CASCADE 때문에 스케줄 행 수로는 이긴 쪽도 0행이 되어 오판정된다)가 코드 주석·plan 문서·e2e 삼자에서 일관되고 엔티티 실측(`onDelete: 'CASCADE'`)과 부합한다. 감사 기록(`recordAudit`)이 트랜잭션 밖·커밋 이후에 일어나는 것은 이 저장소의 기존 관례(`create()`/`update()`)와 동일한 트레이드오프이며 이번 diff 가 새로 도입한 것이 아니다.
4. **마이그레이션 안전성**: 스키마 변경 없음 — diff 에 migration 파일 없음, `schedule.entity.ts` 는 이번 diff 대상 파일 목록에도 없다(`git log` 로 최근 수정 커밋이 이 PR 이 아님을 확인). `onDelete: 'CASCADE'` 는 기존 값을 그대로 인용한다. 해당 없음.
5. **스키마 설계**: `schedule.trigger_id` FK `ON DELETE CASCADE` 라는 기존 설계를 전제로 애플리케이션 판정 로직을 정합화한 것 — 새로운 정규화/비정규화 이슈 없음.
6. **커넥션 관리**: `this.triggerRepository.manager.transaction(...)` 로 풀에서 받은 연결을 TypeORM 이 자동 관리·해제한다. e2e 의 `db`/`locker` pg `Client` 도 `beforeAll`/`afterAll` 에서 명시적 connect/end 로 관리되며(35-59행), `finally` 블록에서 `ROLLBACK` 을 시도(실패해도 무시)해 락커 커넥션이 트랜잭션을 문 채로 남지 않도록 한다. 누수 없음.
7. **SQL 인젝션**: `m.delete(Trigger, triggerId)`, `scheduleRepository.delete({ id, workspaceId })` 모두 TypeORM 파라미터화 API. e2e 의 raw SQL(`pg_advisory_xact_lock(hashtext($1))`, `SELECT trigger_id FROM schedule WHERE id = $1`, `SELECT COUNT(*)... WHERE resource_id = $1` 등)도 전부 `$1` 플레이스홀더로 파라미터화됨. 인젝션 위험 없음.
8. **대량 데이터**: 단건 PK 기준 삭제/조회만 존재. 페이지네이션·대용량 스캔과 무관.

## 뮤테이션/저장소 변경 여부

이번 리뷰는 `Read`/`Bash`(grep, git show, git diff)로만 진행했다. 저장소 파일을 수정하지 않았으며 `git status --short` 로 확인한 결과 이 세션이 남긴 잔여 변경은 없다(기존 untracked 산출물 디렉터리 `review/code/2026/09/21/00_56_52/` 자체 제외).

## 요약

세 번째 재검토 대상은 이전 두 라운드에서 이미 LOW 로 평가된 DB 로직에, 마지막 조치 커밋(`2879e88c7`)이 판정 비교를 truthiness 에서 `affected === 0` 명시 비교로 한 번 더 정교화한 상태다. 이 전환은 같은 락 서브시스템의 기존 관례(`rewriteTriggerConfigLocked`)와 정합하며 뮤테이션 실측(판정 제거 시 1건만 RED)으로 판정력도 확인됐다. `remove()` 의 트랜잭션 경계·advisory lock 획득/해제 시점(롤백 포함)·판별자 선택(FK CASCADE 로 인한 트리거 vs 스케줄 행 구분)·파라미터화 쿼리·커넥션 해제 모두 안전하다. 스키마 변경(마이그레이션)은 없다. 새로 발견된 문제는 없으며, 기록해 둘 사항은 모두 INFO 수준(CASCADE 이후 no-op 방어 호출 등 기존에 이미 확인된 사항 포함)이다.

## 위험도

LOW
