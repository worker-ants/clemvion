# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** 락 안 재조회는 PK 단건 조회 + 컬럼 최소화라 성능·인덱스 부담 없음 (재확인)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` (게이트 1090-1094, `const fresh = await m.findOne(Trigger, { select: { id: true }, where: { id, workspaceId } });`)
  - 상세: `id` 는 `Trigger` 의 PK(`entities/trigger.entity.ts` `@PrimaryGeneratedColumn('uuid')`)이고 `select: { id: true }` 로 반환 컬럼도 최소화했다. advisory lock 획득 뒤 이 재조회 1회가 추가된 것이 이번 diff 의 유일한 신규 DB 왕복이며, 삭제는 저빈도 관리 작업이라 비용 문제가 아니다. 이 지점은 이전 라운드(`review/code/2026/09/20/22_07_23/database.md`)에서 이미 NONE 으로 결론난 동일 코드이고, 이번 라운드(23_04_17) diff 는 이 프로덕션 코드 자체를 변경하지 않았다 — 변경은 그 지점을 검증하는 테스트·문서뿐이다.
  - 제안: 조치 불필요.

- **[INFO]** 트랜잭션 경계 — advisory lock 획득·재조회·삭제가 한 트랜잭션 안에 있어 정합성 유지 (재확인)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` (게이트 1076-1109 부근, `this.triggerRepository.manager.transaction(async (m) => {...})` 블록)
  - 상세: `acquireTriggerConfigLock`(`pg_advisory_xact_lock`) → 재조회(`fresh`) → `m.remove(trigger)` 가 같은 `m.transaction` 콜백 안에서 순서대로 실행되므로, 락 취득과 행 존재 확인·삭제 사이에 다른 트랜잭션이 끼어들 수 없다. `fresh` 가 없으면 `throwTriggerNotFound()` 가 콜백 안에서 동기적으로 throw 되어 TypeORM 이 롤백을 수행하고 advisory lock(xact 스코프)도 함께 해제된다 — 락 누수·부분 커밋 위험 없음. 되돌릴 수 없는 외부 자원 해제(`releaseExternal`)는 트랜잭션 밖에서 먼저 끝내고, 비밀 정리(`releaseSecretsAfterCommit`)·감사 기록(`recordAudit`)은 트랜잭션이 성공적으로 반환된 뒤에만 실행되어 순서가 올바르다.
  - 제안: 조치 불필요.

- **[INFO]** 이번 라운드의 신규 unit 테스트가 인가 스코프(`workspaceId`)를 실제 쿼리 옵션으로 검증 — DB 격리 관점의 긍정적 강화
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (게이트 4053-4055, `expect(freshFindOptions.at(-1)).toMatchObject({ where: { id: 'trig-l', workspaceId: 'ws-1' } });`)
  - 상세: 이전 라운드까지는 락 안 재조회 mock(`freshFindOne`)이 반환값만 대역했고, 호출 시 넘겨진 `where` 절 자체는 검증하지 않았다 — `workspaceId` 를 빠뜨린 회귀(다른 워크스페이스의 동일 `id` 행을 「있다」로 오판해 인가가 새는 경우)가 있어도 GREEN 이었을 것이다. 이번 라운드는 `freshFindOptions` 배열로 실제 호출 인자를 캡처해 `where: { id, workspaceId }` 를 단언한다 — 테넌트 격리를 지키는 쿼리 형태 자체를 회귀 테스트로 고정한 것으로, DB 관점에서 바람직한 강화다.
  - 제안: 조치 불필요.

- **[INFO]** e2e 테스트의 advisory lock key 를 리터럴 복제에서 프로덕션 helper import 로 교체 — 테스트-프로덕션 lock key drift 위험 제거
  - 위치: `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` (게이트 8, `import { triggerConfigLockKey } from '../src/modules/triggers/trigger-config-lock';`, 사용처 게이트 93-95)
  - 상세: 이전 라운드(`review/code/2026/09/20/22_07_23/maintainability.md` WARNING)에서 e2e 테스트가 `trigger-config:<id>` 포맷을 문자열로 재구현해 소스와 두 곳에 같은 지식을 수동 동기화해야 하는 상태였다. 이번 라운드는 `triggerConfigLockKey` 를 직접 import 해 단일 진실원을 재사용한다 — advisory lock key 포맷이 바뀌어도 테스트가 자동으로 따라가고, e2e 가 실제 프로덕션 코드가 잡는 것과 **같은 lock**을 쥐는지가 코드 레벨로 보장된다. DB 동시성 테스트의 신뢰도를 높이는 수정.
  - 제안: 조치 불필요.

- **[INFO]** e2e 신규 DB client 두 개 모두 `afterAll`/`finally` 로 명시적 해제 (재확인)
  - 위치: `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` (게이트 38-62, 91-118)
  - 상세: `db`, `locker` 두 `pg.Client` 는 `afterAll` 에서 `.end()` 로 반드시 닫힌다. `locker` 트랜잭션은 `finally` 블록에서 `ROLLBACK.catch(() => undefined)` 로 커밋 후 잔여 트랜잭션이 없는 정상 케이스까지 안전하게 처리한다. `pending` promise 도 `.catch(() => undefined)` 로 unhandled rejection 을 방지한다. 감사 카운트 조회(`SELECT COUNT(*)::text ... WHERE resource_type = $1 ... AND resource_id = $2 AND action = $3` 형태)도 파라미터 바인딩만 쓴다.
  - 제안: 조치 불필요.

- **[INFO]** 스코프 밖 — `SchedulesService.remove()` 의 같은 결함은 이번 diff 대상이 아니며 이미 트래커에 등재됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`(게이트 4773-4783 신규 항목), `plan/in-progress/trigger-dup-delete.md`(게이트 20-28 정정문)
  - 상세: `SchedulesService.remove()` 가 `scheduleRepository.remove(schedule)`(`schedules.service.ts:345`)를 락·재조회 밖·트랜잭션 밖에서 호출해 같은 클래스의 동시 DELETE 중복 감사 위험을 갖고 있다는 사실을 이 PR 이 스스로 밝히고 developer 후속 항목으로 등재했다. 코드 수정은 없고 DB 쿼리 변경도 없으므로 이번 라운드의 신규 결함은 아니다 — 이미 추적 중임을 확인만 한다.
  - 제안: 조치 불필요(추적 중). 후속 PR 에서 트리거와 같은 형태(advisory lock 필요 여부부터 실측)로 처리될 예정.

WARNING/CRITICAL 없음.

## 요약

이번 라운드(23_04_17)는 `TriggersService.remove()` 프로덕션 코드 자체(락 획득 후 재조회 → 없으면 404)는 변경하지 않으며, 그 코드는 이전 라운드(`review/code/2026/09/20/22_07_23/database.md`)에서 이미 DB 관점 위험도 NONE 으로 결론났다 — PK 단건 조회, 컬럼 최소화(`select: { id: true }`), 트랜잭션 안에서 락·재조회·삭제가 원자적으로 묶이고, advisory lock 은 트랜잭션 종료 시 자동 해제되어 락 누수가 없다. 이번 라운드가 새로 더한 것은 (1) 락 안 재조회가 실제로 `workspaceId` 로 스코프됨을 단언하는 unit 테스트(테넌트 격리 회귀 방지), (2) e2e 의 advisory lock key 리터럴을 프로덕션 `triggerConfigLockKey` import 로 교체(테스트-프로덕션 lock key drift 제거), (3) CHANGELOG·plan 문서 갱신뿐이다. 모두 기존에 검증된 DB 설계를 더 견고하게 만드는 변경이며 새로운 쿼리·트랜잭션·마이그레이션·커넥션 관리 결함은 도입되지 않았다. `SchedulesService.remove()` 의 같은 클래스 결함은 이번 diff 범위 밖으로, 이미 트래커에 후속 항목으로 정확히 등재돼 있다. 리포지토리 파일은 읽기만 했으며 뮤테이션·되돌리기는 수행하지 않았다(`git status --short` 로 확인, 변경 없음).

## 위험도

NONE
