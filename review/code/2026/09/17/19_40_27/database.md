# 데이터베이스(Database) 리뷰 — trigger-deletion-release (3라운드)

검증을 위해 저장소 파일을 수정하지 않았다(`Read`/`Grep`/`Bash` 읽기 전용 대조만 수행). `git status --short` 로 잔여 변경 없음 확인.

## 배경

이 라운드는 2라운드 데이터베이스 리뷰(`review/code/2026/09/17/19_14_29/database.md`)가 지적한 WARNING 2건에 대한
처분(커밋 `d2184dcf2`)을 포함한 최신 diff 다. 처분 결과를 실제 코드와 대조했다.

## 확인된 사항 (2라운드 WARNING 처분 검증 — 문제 없음)

- **[검증 완료]** W2 "부모 행 잠금에 `lock_timeout` 없음"이 해소됨
  - `TriggerResourceReleaserService.lockParentAndListTriggerIds`(`codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:72-95`)가 `Workflow`/`Workspace` 행에 `pessimistic_write` 락을 잡기 **전에** `setLocalLockTimeout(manager, TRIGGER_DELETE_LOCK_TIMEOUT_MS)`(76행)를 트랜잭션의 **첫 호출**로 실행한다. `WorkflowsService.remove()`·`WorkspacesService.deleteWorkspace()` 둘 다 이 메서드를 트랜잭션의 첫 문장으로 호출해(각각 269-278행, 514-537행) 되돌릴 수 없는 외부 해제(`releaseExternalForParent`) 뒤의 무한 대기를 5초로 막는다. `trigger-resource-releaser.service.spec.ts:277,298`에 `SET LOCAL lock_timeout = '5000ms'`가 잠금 직전 호출임을 단언하는 테스트가 있다.
  - `WorkspacesService`는 `assertWorkspaceDeletable`의 잠금 순서(워크스페이스 → 멤버십)를 `transferOwnership`과 동일하게 맞춰(561-562행 JSDoc, 688-707행과 대조) 두 요청이 겹칠 때의 교착도 없앴다 — 실제 코드가 순서를 지키는 것을 직접 대조했다.

- **[변경 없음 — 확인]** W1 "`trigger.workflow_id` 인덱스 부재"는 이번 라운드에도 그대로다(의도된 등재)
  - `codebase/backend/migrations/*.sql` 전체를 grep 한 결과 `trigger` 테이블 인덱스는 여전히 `idx_trigger_workspace_type (workspace_id, type)` · `idx_trigger_workspace_endpoint (workspace_id, endpoint_path)` UNIQUE 뿐이고 `workflow_id` 인덱스는 없다. `plan/in-progress/trigger-deletion-release.md:160-161`에 "CASCADE 가 이 PR 전부터 같은 컬럼으로 스캔했다 — 복잡도 계열 불변, 잠금 대기는 W2 로 상한. 마이그레이션은 `1-data-model.md` 인덱스 표와 함께 가야 해 성능 후속으로" 라는 근거로 등재돼 있고, W2 가 고쳐진 지금은 그 seq scan 이 무한 대기가 아니라 **5초 상한 안**에서 도는 것도 확인했다. 새 결함이 아니라 이미 실측·근거·후속 경로가 있는 트래킹 항목이므로 재차 WARNING 으로 올리지 않는다.

## 발견사항 (신규, INFO)

- **[INFO]** `SecretResolverService.deleteByPrefix` 의 안전 근거 주석이 "호출부 하나뿐"이라고 말하지만 이번 PR 로 그 전제가 깨졌다
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:172-173`(`deleteByPrefix` JSDoc, "현재 프로덕션 호출부는 `triggers.service.ts` 한 곳뿐이고 `secret://triggers/{uuid}/` 라 메타문자가 들어갈 수 없다")
  - 상세: `grep -rln "deleteByPrefix" codebase/backend/src`로 대조한 결과, 실제 `.deleteByPrefix(...)` 호출은 `trigger-resource-release.ts:62`(`deleteTriggerSecretsAfterCommit`) 한 곳으로 수렴했지만, 그 함수는 이제 `TriggersService.remove`·`SchedulesService.remove`·`WorkflowsService.remove`(경유: `TriggerResourceReleaserService.releaseSecretsAfterCommit`)·`WorkspacesService.deleteWorkspace`(동일 경로)·`ChatChannelBinderService`의 `undoAbsentTriggerWrite` 보상 경로까지 다섯 자리에서 호출된다. 주석이 말하는 "안전은 호출부 목록이 그대로일 때만 참"이라는 스스로의 경고가 이제 그대로 발동한 상태다. 실질 위험은 낮다 — 모든 새 호출부가 넘기는 `resourceId`(`triggerId`)는 여전히 `Trigger` 엔티티의 UUID 컬럼 값이라 LIKE 메타문자(`% _ \`)를 담을 수 없고, `deleteByPrefix` 자체도 그 문자들을 거부하는 방어(178-183행)를 유지한다. 다만 `secret-ref.ts`의 `resourceId` 타입은 "UUID v4 또는 다른 spec 의 ID"로 문서화돼 있어(주석 7행) 향후 비-UUID id 를 쓰는 리소스 타입이 `buildSecretRefPrefix`를 재사용하면, `buildSecretRef`의 정규식(`([^/]+)`)은 `_` 같은 문자를 허용하므로 접두 생성 자체는 성공하고 `deleteByPrefix` 호출 시점에야 던져 실패한다(그리고 그 실패는 `deleteTriggerSecretsAfterCommit`이 삼켜 error 로그만 남긴다).
  - 제안: 차단 사유는 아님. 이번 PR 로 호출부가 다섯 곳으로 늘었다는 사실만 주석에 반영하거나("현재 실제로 넘어오는 resourceId 는 모두 트리거 UUID"로 문구 교체), `secret-ref.ts`의 `buildSecretRefPrefix`에 `resourceId`가 LIKE 메타문자를 담지 않는지 빌드 시점에 한 번 더 검증해 실패를 접두 생성 시점으로 앞당기는 것도 고려할 만하다.

## 확인된 사항 (문제 없음 — 근거만 기록, 이번 라운드 재확인)

- **트랜잭션 경계·순서**: `TriggersService.remove()`(1049-1096행)·`SchedulesService.remove()`(300-352행)·`WorkflowsService.remove()`(263-291행)·`WorkspacesService.deleteWorkspace()`(498-552행) 넷 모두 "외부 해제(트랜잭션 밖, 실패 시 삭제 중단) → 부모/트리거 행 잠금+삭제(트랜잭션 안, 이제 `lock_timeout` 상한 있음) → 커밋 → 비밀 삭제(트랜잭션 밖, 실패해도 로그만)" 순서를 일관되게 지킨다. 커밋 실패 시 외부 해제를 되돌릴 수 없다는 사실을 전부 error 로그로 명시한다.
- **SQL 인젝션**: 모든 신규 쿼리가 TypeORM repository/`where` 객체 또는 파라미터 바인딩(`createQueryBuilder().where('ref LIKE :prefix', {...})`)을 쓴다. `setLocalLockTimeout`(`trigger-config-lock.ts:63-70`)은 파라미터 바인딩이 안 되는 `SET LOCAL` 자리라 문자열 보간이 남아 있지만, `toLockTimeoutMs`가 `Number.isFinite` 검증 후 `Math.trunc`+clamp 로 값의 형태를 스스로 보장해(45-55행) 호출부(`TRIGGER_DELETE_LOCK_TIMEOUT_MS` 상수만 실측 2곳)가 임의 계산식을 넘겨도 안전하다.
- **마이그레이션 안전성**: 이번 PR 은 스키마 변경이 없다(`git diff origin/main...HEAD -- codebase/backend/migrations/` 결과 없음) — 무중단 배포 리스크 해당 없음.
- **동시 삽입 차단**: `lockParentAndListTriggerIds`의 "부모 행을 `pessimistic_write`로 잠그면 그 부모를 참조하는 트리거 INSERT 가 FK 의 `FOR KEY SHARE` 요구와 충돌해 대기한다"는 JSDoc 주장은 PostgreSQL 의 실제 FK 잠금 동작과 일치한다.
- **N+1**: `deleteTriggerSecretsAfterCommit`(트리거별 순차 `deleteByPrefix`)·`removeScheduleJobsOrRestore`(스케줄별 순차 BullMQ 호출)·`teardownChatChannel` 순차 호출은 여전히 N+1 형태이지만, 실패 격리(트리거/스케줄 단위 로그)·provider 과부하 방지가 목적인 의도된 트레이드오프로 2라운드에서 이미 확인·등재됐고 이번 라운드에 새로 나빠진 곳은 없다. `releaseExternalMany`의 schedule 조회는 여전히 `In(scheduleTriggerIds)` 배치 단일 쿼리(146행)를 유지한다.
- **커넥션 관리**: 모든 트랜잭션이 `manager.transaction(async (m) => {...})` 콜백 안에서 완결되고 별도 커넥션을 수동으로 열고 닫는 코드가 없다 — 커넥션 누수 경로 없음.

## 요약

2라운드에서 지적한 WARNING 2건 중 W2(부모 행 잠금의 무한 대기)는 `lockParentAndListTriggerIds`에 `SET LOCAL lock_timeout` 5초 상한을 트랜잭션 첫 호출로 배선해 실제 코드·테스트로 해소가 확인됐고, W1(`trigger.workflow_id` 인덱스 부재)은 이번 PR 이전부터 있던 갭이자 이미 실측·근거와 함께 성능 후속으로 등재돼 있어 새로 지적할 사유가 없다. 이번 라운드에서 새로 발견한 것은 `SecretResolverService.deleteByPrefix`의 "호출부 하나뿐"이라는 안전 근거 주석이 이 PR 로 다섯 호출부로 늘어나며 문구상 stale 해졌다는 INFO 하나뿐이며, 실질 안전(모든 resourceId 가 UUID)은 여전히 유지된다. 트랜잭션 경계·순서·SQL 파라미터화·마이그레이션 부재 확인 등 핵심 데이터베이스 관점은 전부 이전 라운드 판정과 일치해 차단 사유가 없다.

## 위험도

LOW
