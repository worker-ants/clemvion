# 데이터베이스(Database) 리뷰 — trigger-deletion-release (2라운드)

검증을 위해 저장소 파일을 수정하지 않았다(`Read`/`Grep`/`Bash` 읽기 전용 대조만 수행, `sed -i` 등 파일 변경 없음). `git status --short` 로 잔여 변경 없음 확인.

## 발견사항

- **[WARNING]** `trigger.workflow_id` 에 인덱스가 없는 채로, 이번 PR 이 그 컬럼을 조건으로 하는 첫 `trigger` 조회 두 곳을 새로 추가한다 — 워크플로 삭제마다 seq scan
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:64`(`releaseExternalForParent` 의 `this.triggerRepository.find({ where: parent })`), `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:85-88`(`lockParentAndListTriggerIds` 의 `manager.find(Trigger, { select: { id: true }, where: parent })`)
  - 상세: `codebase/backend/migrations/V002__indexes.sql` 를 직접 열어 대조한 결과 `trigger` 테이블의 인덱스는 `idx_trigger_workspace_type (workspace_id, type)` 와 `idx_trigger_workspace_endpoint (workspace_id, endpoint_path)` 뿐이다 — `workflow_id` 는 FK 컬럼인데도 인덱스가 없다(Postgres 는 FK 에 자동 인덱스를 만들지 않는다는 사실을 이 저장소는 이미 `V106__schedule_trigger_id_index.sql` 에서 `schedule.trigger_id` 에 대해 한 번 직접 겪고 고쳤다 — 같은 결함 클래스가 `trigger.workflow_id` 에도 있다). `grep -rn "where.*workflowId" codebase/backend/src/modules/**/*.ts` 로 전수 확인한 결과 `trigger` 리포지토리를 `workflowId` 로 필터링하는 코드는 이 PR 이전엔 **전혀 없었다** — `TriggerParent = { workflowId } | { workspaceId }` 도입과 함께 이번 PR 이 처음 만든 쿼리 경로다. `workspaceId` 조건은 `idx_trigger_workspace_type` 의 선두 컬럼이라 인덱스 스캔이 가능하지만, `workflowId` 조건은 지원하는 인덱스가 없어 seq scan 이다. 게다가 `lockParentAndListTriggerIds` 쪽 seq scan 은 **워크플로 부모 행에 `pessimistic_write` 락을 잡은 트랜잭션 안**에서 실행된다(아래 항목과 결합) — `trigger` 테이블이 커질수록 락 보유 시간이 그만큼 늘어난다.
  - 제안: `V106` 과 동일한 패턴으로 `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trigger_workflow_id ON trigger (workflow_id);` 마이그레이션을 추가한다(무중단 배포 안전 — `CONCURRENTLY` + 트랜잭션 밖 실행 + `IF NOT EXISTS` idempotent, `V106` 의 동봉 `.conf` 패턴 재사용).

- **[WARNING]** `WorkflowsService.remove()` / `WorkspacesService.deleteWorkspace()` 가 새로 획득하는 부모 행 `pessimistic_write` 락에 `lock_timeout` 을 걸지 않는다 — 같은 PR 이 이미 확립한 "외부 자원을 먼저 되돌릴 수 없게 해제했으면 뒤따르는 행 잠금은 무한정 기다리지 않는다"는 설계 원칙이 이 두 새 호출부에서만 빠졌다
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:68-90`(`lockParentAndListTriggerIds` — `manager.findOne(Workflow|Workspace, { lock: { mode: 'pessimistic_write' } })` 에 timeout 옵션 없음), 호출부 `codebase/backend/src/modules/workflows/workflows.service.ts:263-291`(`remove()`, 268행에서 외부 해제 후 269-278행 트랜잭션), `codebase/backend/src/modules/workspaces/workspaces.service.ts:498-551`(`deleteWorkspace()`, 513행 외부 해제 후 514-546행 트랜잭션)
  - 상세: 같은 커밋이 건드린 `codebase/backend/src/modules/triggers/triggers.service.ts:1069-1074`(`TriggersService.remove()`) 와 `codebase/backend/src/modules/schedules/schedules.service.ts:316-321`(`SchedulesService.remove()`) 는 둘 다 `acquireTriggerConfigLock(m, id, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS })` 로 `SET LOCAL lock_timeout` 을 명시한다. `trigger-config-lock.ts` 의 JSDoc 이 그 이유를 정확히 설명한다 — "위 해제(외부 자원)는 되돌릴 수 없으므로, 락을 무한정 기다리면 «외부 등록은 뜯겼는데 행은 남은» 반쯤 삭제된 상태가 굳는다"(`triggers.service.ts:1066-1068` 주석과 동일 문구). 그런데 `grep -n "lock_timeout\|SET LOCAL" workflows.service.ts workspaces.service.ts trigger-resource-releaser.service.ts trigger-resource-release.ts` 는 0건이다 — 정확히 같은 전제(268행/513행에서 `releaseExternalForParent` 로 schedule job·provider 등록을 **이미 되돌릴 수 없게** 해제한 뒤 그 트랜잭션이 부모 행을 잠근다)가 이 두 경로에도 성립하는데, 잠금 대기 상한이 없다. Postgres 의 `lock_timeout` 기본값은 0(무제한)이라, 그 워크플로/워크스페이스 행을 다른 트랜잭션이 붙잡고 있으면(동시 update·동시 삭제 재시도 등) 이 트랜잭션은 커넥션 풀에서 커넥션 하나를 쥔 채 무기한 대기하고, 그 동안 외부 자원은 이미 사라진 "반쯤 삭제" 상태가 이 PR 이 막으려던 것과 똑같이 굳는다 — 다만 이번엔 상한이 없어 재시작이 아니라 관측 자체가 어렵다(에러 로그도 안 남는다, 그냥 hang).
  - 제안: `lockParentAndListTriggerIds(manager, parent, { timeoutMs })` 에 옵션을 추가하고, `TRIGGER_DELETE_LOCK_TIMEOUT_MS` (또는 별도 상수)를 재사용해 `SET LOCAL lock_timeout` 을 워크플로/워크스페이스 락 획득 직전에 실행한다. `trigger-config-lock.ts` 의 `toLockTimeoutMs` 클램프 헬퍼를 그대로 재사용하면 별도 검증 로직 중복도 없다.

- **[INFO]** `deleteTriggerSecretsAfterCommit` 의 트리거별 순차 `DELETE` 루프 — 워크플로/워크스페이스 삭제에서 트리거 수만큼 `secret_store` 왕복이 생긴다
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts:54-70`(for 루프 안 `secrets.deleteByPrefix` 호출)
  - 상세: `SecretResolverService.deleteByPrefix`(`codebase/backend/src/modules/secret-store/secret-resolver.service.ts:182-200`)는 `DELETE FROM secret_store WHERE ref LIKE :prefix` 를 매 호출마다 실행한다. `WorkflowsService.remove()`/`WorkspacesService.deleteWorkspace()` 는 부모 밑 트리거 id 배열을 한 번에 얻은 뒤 `releaseSecretsAfterCommit` 을 한 번만 부르지만, 그 내부는 트리거 하나당 쿼리 하나씩 순차 실행이라 N+1 형태다. 의도적 트레이드오프로 읽힌다 — 테스트(`trigger-resource-release.spec.ts:47-64`)가 "하나가 실패해도 던지지 않고 나머지를 계속 지운다"를 명시적으로 검증하고 있어, 배치 삭제(`WHERE ref = ANY(...)` 또는 `ref LIKE ANY(...)`)로 바꾸면 트리거별 실패 격리·로그(`trigger=${triggerId}`)가 사라진다. 워크플로/워크스페이스당 트리거 수가 자연스럽게 작은 규모(사람이 구성하는 자동화 개수)라 당장 성능 문제는 아니다.
  - 제안: 현재로선 유지 가능. 다만 한 워크스페이스가 예외적으로 많은 트리거(수백 단위)를 가질 수 있는 시나리오가 생기면, 실패 목록만 별도로 수집하고 성공 케이스는 배치로 묶는 하이브리드를 고려할 만하다.

- **[INFO]** `lockParentAndListTriggerIds` 의 트리거 id 조회에 상한/페이지네이션이 없음
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:85-89`
  - 상세: `manager.find(Trigger, { select: { id: true }, where: parent })` 가 부모 밑 트리거 id 전부를 한 번에 메모리로 가져온다. "삭제할 자원 전체 목록"이 필요한 연산 특성상 페이지네이션 자체가 부적합하지만(끊어서 처리하면 그 사이 생긴 트리거를 어떻게 다룰지가 더 복잡해진다), `id` 만 select 해 메모리 사용을 줄인 점은 확인했다. 워크스페이스당 트리거 수에 애플리케이션 레벨 상한이 없다면, 극단적으로 큰 워크스페이스 삭제 시 이 배열과 후속 `releaseSecretsAfterCommit` 순차 루프(위 항목)가 같이 늘어난다.
  - 제안: 별도 조치 불필요 — 워크스페이스/워크플로당 트리거 수에 이미 상한이 있는지 확인하고 없다면 운영 관점에서만 기록해 둘 사안.

## 확인된 사항 (문제 없음 — 근거만 기록)

- **트랜잭션 경계**: `TriggersService.remove()`·`SchedulesService.remove()`·`WorkflowsService.remove()`·`WorkspacesService.deleteWorkspace()` 넷 모두 "외부 해제(트랜잭션 밖, 실패 시 삭제 중단) → 행 삭제(트랜잭션 안) → 커밋 → 비밀 삭제(트랜잭션 밖, 실패해도 로그만)" 순서를 지킨다. 커밋 실패 시 외부 해제를 되돌릴 수 없다는 사실을 전부 error 로그로 명시한다.
- **SQL 인젝션**: 모든 신규 쿼리가 TypeORM repository/`where` 객체 또는 파라미터 바인딩(`createQueryBuilder().where('ref LIKE :prefix', {...})`)을 쓴다. `deleteByPrefix` 는 LIKE 메타문자(`%`,`_`,`\`)를 입력에서 거부해(`secret-resolver.service.ts:188-193`) prefix 확장 공격을 막는다 — 이 검증은 이번 PR 대상이 아니라 기존 코드지만 새 호출부(`triggerSecretPrefix` 로 조립된 UUID 기반 prefix)도 그 가드를 그대로 통과해 안전하다.
- **마이그레이션**: 이번 PR 은 스키마 변경이 없다(`find codebase/backend/migrations -newer` 대조, 신규 `.sql` 파일 0건) — 무중단 배포 리스크 해당 없음. 단 위 WARNING#1 이 새 마이그레이션 필요성을 지적한다.
- **동시 삽입 차단**: `lockParentAndListTriggerIds` 의 "부모 행을 `FOR UPDATE` 로 잠그면 그 부모를 참조하는 트리거 INSERT 가 FK 의 `FOR KEY SHARE` 요구와 충돌해 대기한다"는 JSDoc 주장은 PostgreSQL 의 실제 FK 잠금 동작과 일치한다.
- **워크스페이스 이중 잠금**: 트랜잭션 안에서 `assertWorkspaceDeletable`(잠금) 뒤 `lockParentAndListTriggerIds` 가 같은 워크스페이스 행을 다시 `FOR UPDATE` 잠그는 것은 같은 트랜잭션 내 재잠금이라 no-op — 데드락·오류 없음(1라운드 RESOLUTION #20 과 동일 결론 재확인).

## 요약

트랜잭션 경계·커밋 순서(외부 해제 → 행 삭제 → 커밋 → 비밀 정리)와 SQL 파라미터화는 네 삭제 경로 전부 일관되게 잘 지켜졌고 스키마 변경도 없어 마이그레이션 리스크는 없다. 다만 이번 PR 이 `trigger` 테이블에 `workflow_id` 조건 조회를 처음 도입하면서 그 컬럼에 인덱스가 없다는 기존 갭(이 저장소가 `schedule.trigger_id` 에서 이미 한 번 겪은 것과 같은 클래스)을 그대로 밟아 워크플로 삭제마다 seq scan 을 만들고, 그 seq scan 이 하필 부모 행 락을 쥔 트랜잭션 안에서 돈다. 더 중요하게는, 이 PR 자신이 `TriggersService.remove()`/`SchedulesService.remove()` 에서 확립한 "외부 자원을 되돌릴 수 없게 먼저 해제했으면 뒤따르는 행 잠금은 무한 대기하지 않는다"는 원칙이 새로 추가된 `WorkflowsService.remove()`/`WorkspacesService.deleteWorkspace()` 의 부모 행 잠금에는 적용되지 않아, 동시성 창에서 정확히 그 원칙이 막으려던 "반쯤 삭제된 상태의 무기한 hang" 이 재발할 수 있다. 둘 다 차단 사유는 아니지만 이 PR 의 핵심 설계 원칙을 두 신규 호출부에 일관 적용하지 않은 것이라 다음 라운드에서 처리를 권한다.

## 위험도

MEDIUM
