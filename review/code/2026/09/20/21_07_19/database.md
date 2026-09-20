# 데이터베이스(Database) 리뷰 — dup-delete-audit

## 발견사항

- **[INFO]** `WorkspacesService.deleteWorkspace` 가 같은 트랜잭션 안에서 `Workspace` 행을 `pessimistic_write` 로 두 번 잠근다(왕복 SELECT 1회 낭비, 결함 아님)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — 1차 잠금 522-524행(`releaser.lockParentAndListTriggerIds(manager, { workspaceId })` → 내부에서 `manager.findOne(Workspace, { lock: { mode: 'pessimistic_write' } })`), 2차 잠금 536-542행(`assertWorkspaceDeletable(..., { mode: 'pessimistic_write' })`).
  - 상세: 같은 트랜잭션·같은 커넥션 안에서 동일 PK 행을 다시 `SELECT ... FOR UPDATE` 하는 것이라 PostgreSQL 은 이미 보유한 락을 그대로 인정한다 — self-deadlock 이나 대기는 없다. 이번 diff 가 도입한 구조는 아니고(이전에도 두 헬퍼가 순서대로 호출됐다) `parentPresence === 'absent'` 단락 분기가 새로 끼어든 것뿐이다. `WorkflowsService.remove()` 쪽은 잠금이 1회뿐이라 이 워크스페이스 경로만 비대칭적으로 왕복 쿼리가 하나 더 있다.
  - 제안: 조치 불요(성능 영향은 단건 PK 조회 수준). 다음에 이 헬퍼를 다시 만질 일이 생기면 `lockParentAndListTriggerIds` 가 이미 잠그며 읽은 `Workspace` 행을 `assertWorkspaceDeletable` 의 재검사에 전달해 재조회를 없애는 것을 고려할 수 있다(plan 이 이미 추적 중인 "네 자리 공용 형태" 후속 설계와 함께 정리하면 자연스럽다).

- **[INFO]** `manager.find(Trigger, { where: parent })` 의 인덱스 커버리지를 직접 확인함 — 문제 없음
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:101-104` (`lockParentAndListTriggerIds` 안 트리거 열거 쿼리, `parent` 는 `{ workflowId }` 또는 `{ workspaceId }`)
  - 상세: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql` 이 `idx_trigger_workflow_id ON trigger (workflow_id)` 를 CONCURRENTLY 로 만들어 두었고, `workspace_id` 조회는 `V002__indexes.sql` 의 `idx_trigger_workspace_type ON trigger (workspace_id, type)`(선두 컬럼 workspace_id) 로 커버된다. 이번 diff 는 이 쿼리 형태(where 절)를 바꾸지 않았고 새 쿼리도 추가하지 않았다 — 순수 참고 확인.
  - 제안: 없음.

## 관점별 점검 결과

1. **인덱스** — 위 확인대로 문제 없음. 새 쿼리 패턴 없음.
2. **N+1** — `lockParentAndListTriggerIds` 는 부모 1건 조회 + 트리거 1건 목록 조회, 고정 2쿼리다. 반복문 안에서 개별 쿼리를 실행하지 않는다. 워크플로/워크스페이스 삭제 시 자식 `Trigger` 행 삭제는 FK `ON DELETE CASCADE`(DB 레벨, `V001__initial_schema.sql:145-146`)로 처리되어 ORM 이 트리거를 개별로 순회해 지우지 않는다. 이번 diff 로 쿼리 횟수 변화 없음(버려지던 `findOne` 결과를 반환하도록 바꾼 것뿐).
3. **트랜잭션** — 이 PR 의 핵심. 종전엔 `lockParentAndListTriggerIds` 가 `pessimistic_write` 로 부모 행을 잠그고도 그 존재 여부(`findOne` 결과)를 버려, 동시 DELETE 두 건이 잠금 없는 선조회를 모두 통과하면 먼저 커밋한 쪽이 지운 뒤에도 두 번째가 `manager.remove()`(0행 삭제도 예외 없음)를 그대로 실행해 `workflow.deleted` 감사 행을 중복 기록했다. 수정은 그 존재 여부를 `LockedParentTriggers.parentPresence`(`'present'|'absent'`)로 호출자에게 돌려주고, 두 삭제 경로 모두 `absent` 면 트랜잭션 콜백 안에서 `NotFoundException` 을 던진다 — `manager.transaction()` 콜백이 예외를 던지면 TypeORM 이 자동 ROLLBACK 하므로 감사 기록·비밀 정리 호출 전부가 원자적으로 건너뛰어진다(직접 코드 추적으로 확인: `workflows.service.ts:280-287`, `workspaces.service.ts:530-547`). `.catch()` 에서 `NotFoundException` 만 별도로 재던지고 그 외 실패에만 error 로그를 남기는 분기도 트랜잭션 원자성과는 무관한 로그 신호 품질 개선이며, 두 경로가 이제 대칭이다(직전 라운드 WARNING 이었던 워크스페이스 쪽 비대칭이 이번 diff 로 이미 닫혀 있음을 확인했다 — `if (locked.parentPresence === 'absent') throw new NotFoundException({code:'WORKSPACE_NOT_FOUND', ...})` 가 `assertWorkspaceDeletable` 재검사보다 먼저 실행됨). `SET LOCAL lock_timeout`(`trigger-config-lock.ts:63-70`)이 트랜잭션 범위로만 적용되어 커넥션 풀에 설정이 새지 않는 것도 기존 그대로 유지된다.
4. **마이그레이션 안전성** — 이번 diff 에 스키마 변경(마이그레이션 파일)이 없다. 해당 없음.
5. **스키마 설계** — 테이블 구조 변경 없음. 애플리케이션 레벨 반환 계약만 `string[]` → `{ parentPresence, triggerIds }` 로 바뀌어 "부재"와 "0개"를 이름 있는 값으로 분리했다 — truthiness 오판을 막는 합리적 설계.
6. **커넥션 관리** — `manager` 는 `dataSource.transaction()`/`repository.manager.transaction()` 스코프 밖에서 별도로 얻거나 유지되지 않는다. 신규 e2e(`workflow-delete-concurrency.e2e-spec.ts`, `workspace-delete-concurrency.e2e-spec.ts`)는 `locker`/`db` 두 `pg.Client` 를 `beforeAll`에서 열고 `afterAll`에서 `end()` 로 닫으며, 본문은 `try/finally` 로 `ROLLBACK`(실패해도 `.catch(() => undefined)` 로 흡수)과 `pending` 프라미스 드레인을 모두 수행해 락·커넥션이 새는 경로가 없다.
7. **SQL 인젝션** — 애플리케이션 코드의 신규/변경 쿼리는 전부 TypeORM `findOne`/`find`(파라미터 바인딩)다. e2e 의 원시 SQL(`SELECT id FROM workflow WHERE id = $1 FOR UPDATE`, `SELECT COUNT(*)::text ... WHERE resource_id = $1 ...`, `SELECT (SELECT COUNT(*) FROM workspace WHERE id = $1) + ...`)도 전부 `$1` 플레이스홀더로 파라미터화되어 있고 문자열 결합으로 사용자 입력을 삽입하는 자리가 없다.
8. **대량 데이터** — 이번 변경은 PK/FK 기준 단건·소수건 조회이며 목록 페이지네이션이나 대용량 스캔과 무관하다. 해당 없음.

## 뮤테이션 검증

가설 확인을 위한 코드 뮤테이션은 수행하지 않았다(정적 추적 + 마이그레이션/인덱스 파일 대조만으로 결론 도달). 저장소 파일은 `Read`/`grep` 만 수행했고 수정하지 않았다 — `git status --short` 로 별도 변경 없음 확인.

## 요약

이 diff 의 핵심은 `TriggerResourceReleasePort.lockParentAndListTriggerIds` 가 `pessimistic_write` 로 잠그며 읽은 부모 행의 존재 여부를 더 이상 버리지 않고 호출자에게 돌려주는 것이며, 두 삭제 경로(`WorkflowsService.remove`, `WorkspacesService.deleteWorkspace`) 모두 그 값이 `'absent'` 면 트랜잭션 콜백 안에서 즉시 `NotFoundException` 을 던져 자동 ROLLBACK 시킴으로써 "동시 DELETE 두 건 중 진 쪽이 감사 행을 중복 기록하는" TOCTOU/lost-update 성격의 결함을 원자적으로 닫는다. 두 경로 모두 대칭적으로 수정되어 있음을 직접 코드로 확인했다(직전 라운드에서 지적됐던 워크스페이스 쪽 403 오판정·거짓 로그 비대칭은 이번 diff 에 이미 반영돼 있다). 쿼리는 PK/이미 인덱스가 있는 FK 컬럼(`idx_trigger_workflow_id`, `idx_trigger_workspace_type`) 기준이라 인덱스 누락이 없고, N+1·마이그레이션·커넥션 누수·SQL 인젝션 우려도 없다. 유일한 참고 사항은 워크스페이스 삭제 경로가 같은 트랜잭션 안에서 `Workspace` 행을 두 번(`lockParentAndListTriggerIds` + `assertWorkspaceDeletable` 재검사) 잠가 왕복 쿼리 하나가 더 있다는 점인데, 같은 트랜잭션 내 재잠금이라 데드락·정합성 문제는 없고 성능 영향도 미미해 비차단 INFO 로만 기록한다. Critical/Warning 급 데이터베이스 결함은 없다.

## 위험도

LOW
