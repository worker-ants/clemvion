# 성능(Performance) 리뷰 — integration-personal-owner

## 발견사항

- **[WARNING]** `update` · `remove` 엔드포인트가 같은 요청 안에서 멤버 역할(`getMemberRole`)을 두 번 조회한다
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:489` (`update()` 안의 `const role = await this.roleOf(workspaceId, user);`), `codebase/backend/src/modules/integrations/integrations.controller.ts:662` (`remove()` 안의 같은 호출). `roleOf` 정의는 같은 파일 135-140행.
  - 상세: `update`·`remove`는 `@Roles('editor')`가 붙어 있다(`integrations.controller.ts:472`, `:646`). 전역 `RolesGuard`(`codebase/backend/src/common/guards/roles.guard.ts:209-217` `assertMember`)가 컨트롤러 진입 **전에** `workspacesService.getMemberRole(workspaceId, userId)`를 이미 호출해 editor 문턱을 확인한다. 그런데 컨트롤러 본문이 그 결과를 재사용하지 않고 `roleOf(workspaceId, user)` → `IntegrationsService.resolveRole` → `workspacesService.getMemberRole`를 **동일한 (workspaceId, userId)로 다시** 호출한다(`integrations.service.ts:1852-1857`). 결과적으로 요청 하나당 `workspace_members` 조회가 두 번 실행된다. `create`·`rotate`는 이 패턴이 이번 diff 이전부터 있던 기존 설계지만(리팩터만 됨 — diff에서 `resolveRole` 호출을 `roleOf()`로 이름만 바꿈), `update`·`remove`는 이번 PR에서 **새로** 추가된 중복 조회다(직전 코드는 `role` 없이 바로 서비스만 호출했다).
  - 제안: `RolesGuard.assertMember`가 판정한 role을 `request` 객체(예: `request.workspaceRole`)에 실어 컨트롤러가 데코레이터(`@CurrentRole()` 등)로 재사용하게 하거나, 최소한 `update`/`remove` 두 경로만이라도 guard 결과를 캐싱해 중복 쿼리를 제거. 개별 쿼리 비용은 작지만(인덱스 단건 조회) 두 엔드포인트 모두 자주 호출되는 CRUD 경로라 요청당 DB 왕복이 불필요하게 2배가 된다.

- **[WARNING]** `assertRequesterStillAllowed`가 `pessimistic_write` 락을 잡은 트랜잭션 안에서 트랜잭션에 참여하지 않는 별도 리포지토리 쿼리를 실행 — 락 보유 시간 연장 + 커넥션 풀 이중 점유
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:816` (`await this.assertRequesterStillAllowed(integration, record);`, 함수 정의는 405-425행). 호출 지점은 `dataSource.transaction(async (manager) => {...})` 블록 안, `repo.findOne({ ..., lock: { mode: 'pessimistic_write' } })`(807행) 직후.
  - 상세: `assertRequesterStillAllowed`는 통합이 `organization` scope면 `this.workspacesService.getMemberRole(record.workspaceId, record.userId)`를 호출한다(412-419행). `WorkspacesService.getMemberRole`은 `this.memberRepository.findOne(...)`을 쓰는데, 이 리포지토리는 트랜잭션 콜백이 받은 `manager`가 아니라 `WorkspacesService`에 주입된 **별도 리포지토리**다 — 즉 커넥션 풀에서 **또 다른 커넥션**을 빌려 쿼리를 실행하는 동안, 원래 트랜잭션은 `integrations` 행에 대한 `FOR UPDATE` 락을 계속 쥔 채 대기한다. 동시에 같은 통합에 대한 reauthorize/rotate 요청이 몰리는 상황이면(재시도, 이중 클릭 등) 락 보유 구간이 한 번의 DB 왕복만큼 더 길어져 경합이 늘고, 순간적으로 요청당 2개의 풀 커넥션을 동시에 점유하게 되어 풀이 작을 때 대기·타임아웃 위험이 커진다.
  - 제안: organization 통합에 한정된 드문 경로라 당장 치명적이진 않지만, `getMemberRole` 조회를 락 획득 **이전**으로 옮기거나(락 잡기 전에 인가를 볼 수 있으면), 같은 `manager`를 통해 멤버십을 조회하도록 바꿔 트랜잭션 커넥션 하나로 마무리하는 편이 락 보유 시간과 커넥션 사용량 모두에 유리하다.

- **[INFO]** `update()` / `updateScope()`가 `save()` 1회 왕복을 `.update()` + `reloadOrNotFound()` 2회 왕복으로 교체
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:843` (`update()` 안 `const saved = await this.reloadOrNotFound(id, workspaceId);`), `codebase/backend/src/modules/integrations/integrations.service.ts:1421` (`updateScope()`의 동일 패턴).
  - 상세: 이전엔 `integrationRepository.save(entity)` 한 번으로 갱신과 반환값 확보를 같이 했다. 새 코드는 `this.judgedRow(entity)` 조건부 `UPDATE`(compare-and-set, scope 변경 레이스 방지) 후 `affected` 확인, 그리고 응답용으로 `reloadOrNotFound`가 **다시 SELECT**한다 — 쓰기 경로마다 DB 왕복이 1회에서 2회로 늘었다. 주석에 있는 근거(TypeORM `save()`의 lost-update 문제 회피, `updated_at`을 DB가 정하게 함)는 타당한 트레이드오프이고 이 두 엔드포인트는 관리자성 저빈도 호출이라 실질 영향은 작다.
  - 제안: 조치 불필요 — 다만 향후 이 패턴을 고빈도 쓰기 경로에 복제할 때는 왕복 증가를 감안할 것.

- **[INFO]** `findAll` / `listIntegrations`의 가시성 필터는 SQL 레벨 처리로 잘 구현됨 (긍정 확인)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `findAll()` (`integrationVisibilityClause` `andWhere` 추가분), `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts` `listIntegrations()`.
  - 상세: 남의 personal 통합을 메모리에서 거르지 않고 `WHERE` 절(`scope <> 'personal' OR created_by = :userId`)로 걸러 페이지네이션 `total`/`limit`이 왜곡되지 않도록 했다 — N+1도, 애플리케이션 레벨 과다 로딩도 없다. `integrations` 테이블에 `created_by`·`scope` 복합 인덱스는 없지만(`idx_integration_workspace_status`만 존재) `workspace_id` 조건이 먼저 행 수를 좁히므로 워크스페이스당 통합 개수 규모에서는 실질 영향이 없을 것으로 판단(조치 불필요, 참고용 기록).

- **[INFO]** `pickPrecheckConflict` / `assertRequesterStillAllowed`의 순수 함수 부분은 문제 없음
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:351-365` (`pickPrecheckConflict`), `codebase/backend/src/modules/integrations/integration-visibility.ts` 전체.
  - 상세: `CAFE24_PRECHECK_STATUS_PRIORITY`(상수 크기 고정, 5개 내외) 순회 + `rows.find`는 매장당 통합 행 수가 작아(통상 1~3행) O(k·n) 이라도 실질 비용이 무시할 만하다. `isIntegrationVisibleTo`/`assertOrgScopeModifiable`도 순수 in-memory 비교라 DB·I/O 없음. `candidate-lookup.service.ts`의 `fillCandidates`도 pending 필드별 `Promise.all` 병렬 처리라 순차 N+1이 아니다.

## 요약

이번 변경은 personal/organization 통합 가시성·인가 판정을 도입하면서 목록 조회는 SQL 필터로 올바르게 처리했고, 쓰기 경로는 compare-and-set으로 레이스를 막는 등 정확성 위주로 설계됐다. 성능 관점에서 가장 실질적인 두 지점은 (1) `update`/`remove`에서 `RolesGuard`가 이미 조회한 워크스페이스 역할을 컨트롤러가 재사용하지 않고 다시 조회하는 신규 중복 쿼리, (2) OAuth 콜백의 `pessimistic_write` 트랜잭션 안에서 트랜잭션 밖 리포지토리로 멤버 역할을 조회해 락 보유 시간과 커넥션 점유를 늘리는 부분이다. 둘 다 개별 쿼리 자체는 가벼운 인덱스 조회라 즉각적인 장애 위험은 낮지만, 전자는 자주 호출되는 CRUD 경로에서 불필요한 DB 왕복을 상시 두 배로 만들고 후자는 동시성이 몰릴 때 락 경합·풀 고갈 위험을 키우므로 개선 여지가 있다. `update()`/`updateScope()`의 저장 후 재조회(2왕복화)는 correctness 트레이드오프로 납득 가능한 수준이다. 전반적으로 CRITICAL 급 성능 결함은 없다.

## 위험도

LOW
