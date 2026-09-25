# 데이터베이스(Database) 리뷰

## 발견사항

- **[WARNING]** OAuth 콜백의 `pessimistic_write` 락 보유 중 별도 서비스가 커넥션 풀에서 두 번째 커넥션을 요청 — 동시성 하에서 풀 고갈/데드락 가능성
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:405-425`(`assertRequesterStillAllowed` 정의, 특히 414-418 의 `this.workspacesService.getMemberRole(...)` 호출), 호출부 `codebase/backend/src/modules/integrations/integration-oauth.service.ts:807`(`lock: { mode: 'pessimistic_write' }`)·`:816`(`await this.assertRequesterStillAllowed(integration, record);`) — 모두 `handleCallback`(631행부터) 안의 `this.dataSource.transaction(async (manager) => {...})` 블록(797행) 내부.
  - 상세: `handleCallback` 은 `manager.getRepository(Integration)` 으로 대상 행에 `pessimistic_write` 행 락을 잡은 채(807행) 트랜잭션을 유지한다. 그 안에서 새로 추가된 `assertRequesterStillAllowed` 가 `integration.scope === 'organization'` 이면 `this.workspacesService.getMemberRole(...)` 을 호출하는데(414-418행), 이 호출은 `WorkspacesService` 에 주입된 별도 `Repository`(`this.memberRepository.findOne`, `codebase/backend/src/modules/workspaces/workspaces.service.ts:116-119`)를 쓴다 — 즉 트랜잭션의 `manager` 가 아니라 **같은 DataSource 풀에서 새 커넥션을 하나 더** 얻어 실행된다. 결과적으로 이 요청은 (a) 트랜잭션이 점유한 커넥션 하나 + (b) `getMemberRole` 이 잠깐 점유하는 커넥션 하나, 총 둘을 같은 풀에서 동시에 요구한다. 동시에 여러 organization-scope 재인증/`request-scopes` 콜백이 몰리면(풀 크기 ≤ 동시 요청 수) 모든 커넥션이 "트랜잭션 보유 + 두 번째 커넥션 대기" 상태로 맞물려 풀 전체가 고갈되는 고전적 connection-pool 데드락 패턴이 될 수 있다 — 이 경우 해당 플로우뿐 아니라 같은 풀을 쓰는 애플리케이션 전체 쿼리가 함께 멈춘다. 발생 빈도는 낮지만(사용자가 브라우저로 OAuth 콜백을 동시에 여러 건 완료해야 함), 이번 diff 가 새로 만든 경로다(이전에는 이 지점에서 다른 서비스로의 DB 호출이 없었다).
  - 제안: 멤버십 조회를 트랜잭션의 `manager` 로 실행하도록 바꾼다 — 예를 들어 `manager.getRepository(WorkspaceMember).findOne(...)` 을 직접 쓰거나, `WorkspacesService.getMemberRole` 이 선택적으로 `EntityManager`/`QueryRunner` 를 받아 그 매니저로 쿼리하도록 오버로드를 추가한다. 그러면 같은 트랜잭션(같은 커넥션) 안에서 해결되어 풀에서 두 번째 커넥션을 요구하지 않는다.

- **[INFO]** compare-and-set(`update`/`delete` + `judgedRow`) 이후의 재조회가 트랜잭션으로 묶여 있지 않아, 매우 좁은 창에서 응답/감사 로그가 어긋날 수 있음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `update()`(`this.integrationRepository.update(this.judgedRow(entity), { name: body.name })` 이후 `reloadOrNotFound`, gate 834-852), `updateScope()`(gate 1416-1430), `reauthorize()` 의 조건부 리셋 분기(gate 1462-1469).
  - 상세: `UPDATE ... WHERE id AND workspace_id AND scope`(원자적 CAS) 자체는 lost-update 를 막는 좋은 설계다. 다만 `affected === 1` 확인 뒤 응답용으로 다시 `reloadOrNotFound` 로 SELECT 하는데, 이 SELECT 는 원래의 UPDATE 와 하나의 트랜잭션으로 묶여 있지 않다. UPDATE 성공 직후 다른 요청이 그 행을 삭제하면(예: 동시 `remove`), `reloadOrNotFound` 가 404 를 던져 방금 성공한 변경에 대해 클라이언트는 실패 응답을 받고, 이미 `auditLogsService.record(...)` 호출 이전이라 감사 로그도 남지 않는다(업데이트 자체는 DB 에 반영된 채로). 데이터 정합성 붕괴는 아니지만(감사 로그 유실 + 오도하는 404) 트랜잭션 경계를 UPDATE+재조회+감사기록까지 넓히면 없앨 수 있는 창이다.
  - 제안: 급하지 않음. 후속으로 여유가 있으면 `update` → `RETURNING *`(QueryBuilder `.update().set().where().returning('*')`) 로 재조회 왕복을 없애거나, UPDATE+감사로그를 한 트랜잭션으로 묶는 것을 고려.

- **[INFO]** 신설 가시성 필터(`created_by`/`scope`)에 전용 인덱스 없음 — 현재 규모에서는 문제 없어 보임
  - 위치: `codebase/backend/src/modules/integrations/integration-visibility.ts:37-39`(`integrationVisibilityClause`), 사용처 `codebase/backend/src/modules/integrations/integrations.service.ts:509-513`(`findAll`)·`codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:170-175`.
  - 상세: `findAll` 은 `i.workspace_id = :workspaceId AND (i.scope <> 'personal' OR i.created_by = :userId)` 로 필터한다. 기존 인덱스는 `idx_integration_workspace_status(workspace_id, status)` 뿐이라 planner 는 `workspace_id` 선두 컬럼만 인덱스로 좁히고 `scope`/`created_by` 조건은 그 결과 집합에서 필터링한다. 워크스페이스당 통합 행 수가 일반적으로 적어(수십~수백 단위) 현재로선 성능 문제로 보이지 않는다.
  - 제안: 지금 조치 불필요. 특정 워크스페이스의 통합 행 수가 수천 단위로 커지는 사례가 생기면 `(workspace_id, created_by)` 복합 인덱스 추가를 검토.

- **양호 사례** (참고, 조치 불필요): `integrationVisibilityClause` 는 `alias` 를 호출부 상수 문자열(`'i'`)로만 받고 실제 값(`userId`)은 `:integrationUserId` 파라미터 바인딩으로 전달 — SQL 인젝션 벡터 없음. `judgedRow` 기반 `update`/`delete` 는 엔티티 `save()` 의 lost-update(스냅샷 비교로 옛 값을 되돌리는) 위험을 피하고, 판정 근거 컬럼(`scope`)을 WHERE 절에 실어 판정-쓰기 사이 TOCTOU 를 락 없이 원자적 SQL 한 문장으로 막는다 — `remove()` 의 원자적 `DELETE` 선례와 같은 방식으로 일관적이다. e2e(`test/integration-personal-owner.e2e-spec.ts`)의 raw SQL 도 `$1`/`$2` 파라미터 바인딩을 쓴다. 이번 diff 에 스키마/마이그레이션 변경은 없다.

## 요약

이번 변경은 스키마·마이그레이션 수정 없이, 통합(Integration)의 personal/organization 가시성 판정을 애플리케이션 계층(순수 함수 `integration-visibility.ts`)과 SQL 계층(`integrationVisibilityClause`)에 동시에 심는 리팩터링이다. SQL 은 전부 파라미터 바인딩을 쓰고, 쓰기 경로는 `save()` 대신 판정 근거 컬럼을 조건에 포함한 원자적 `update`/`delete` 로 옮겨 lost-update·TOCTOU 를 견고하게 막는 등 전반적으로 트랜잭션/동시성 설계 수준이 높다. 다만 새로 추가된 OAuth 콜백의 커밋-직전 재판정(`assertRequesterStillAllowed`)이 `pessimistic_write` 락을 쥔 트랜잭션 내부에서 별도 서비스(`WorkspacesService`)를 통해 같은 커넥션 풀의 두 번째 커넥션을 요구하는 패턴은, 발생 빈도는 낮아도 동시 부하 시 커넥션 풀 고갈/데드락으로 번질 수 있는 구조적 리스크라 수정을 권한다. 그 외 항목은 참고용 INFO 수준이다.

## 위험도

MEDIUM
