# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `update()` / `updateScope()` 가 compare-and-set 로 바뀌면서 왕복(round-trip)이 2회 → 3회로 늘었다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `update()` (`requireModifiable` 호출부 근처, 편집 후 리로드까지), `updateScope()` (동일 패턴)
  - 상세: 기존에는 `findOne`(읽기) → `save(entity)`(TypeORM 이 PK 로 단일 UPDATE, 사실상 쓰기 1회)로 왕복 2회였다. 이번 변경은 lost-update 방지를 위해 `requireModifiable`(읽기) → `repository.update(judgedRow, patch)`(조건부 쓰기) → `reloadOrNotFound`(다시 읽기)의 3왕복 구조로 바뀌었다. 코드 주석(`judgedRow`, `save() 는 옛 스냅샷과 비교해 동시에 바뀐 컬럼을 되돌린다`)이 근거를 명시하고 있어 **의도된 트레이드오프**이며, 관리자용 저빈도 mutate 엔드포인트라 절대적 영향은 작다. 다만 "정확성을 위해 왕복이 늘었다"는 사실 자체는 성능 관점에서 기록해 둘 가치가 있다.
  - 제안: 별도 조치 불필요(정합성이 우선). 다만 같은 트랜잭션(단일 커넥션) 안에서 읽기·쓰기·재읽기를 묶어 커넥션 왕복(round-trip) 수는 그대로여도 지연시간(latency)을 줄이는 것을 고려할 수 있다.

- **[INFO]** 콜백 커밋 트랜잭션의 `pessimistic_write` 락 보유 구간에 역할 조회(`getMemberRole`) DB 호출이 새로 들어갔다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — `assertRequesterStillAllowed()` (정의부는 `private async assertRequesterStillAllowed(...)`), 호출부는 `handleCallback()` 내부 `await this.dataSource.transaction(...)` 블록에서 `integration` 을 `pessimistic_write` 로 읽은 직후 `await this.assertRequesterStillAllowed(integration, record);` 줄
  - 상세: `integration.scope === 'organization'` 인 경우에만 `this.workspacesService.getMemberRole(record.workspaceId, record.userId)` 를 호출한다. 이 호출은 트랜잭션 매니저(`manager.getRepository(Integration)`)가 아니라 별도로 주입된 `workspacesService` 의 리포지토리를 쓰므로, **커넥션 풀에서 별도 커넥션을 하나 더 빌려 쓰는 동안 첫 번째 커넥션은 row lock 을 보유한 채 대기**한다. `getMemberRole` 자체는 `(workspaceId, userId)` 단일 인덱스 조회라 개별 비용은 낮지만, 동시에 같은 통합을 재인증하는 경쟁 트랜잭션의 대기 시간을 그만큼 늘린다. TOCTOU 방지(보안 정합성)를 위한 의도적 설계로 보이며(주석 "락을 잡은 이 시점 값으로 인가를 다시 본다"), 심각도는 낮지만 임계구간(critical section) 연장이라는 점은 명시해 둔다.
  - 제안: 현재로선 조치 불요. 높은 동시 재인증 트래픽이 실측되면 `getMemberRole` 을 트랜잭션 매니저로 같은 커넥션에서 수행하도록 바꿔 풀 점유를 1개로 유지하는 안을 검토.

- **[INFO]** `IntegrationsController.remove()` / `update()` 가 통합의 scope 를 확인하기도 전에 역할(role)을 항상 선조회한다 — 지연 로딩 기회
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` — `remove()`, `update()` 핸들러의 `const role = await this.roleOf(workspaceId, user);` 줄
  - 상세: `roleOf()` → `IntegrationsService.resolveRole()` → `WorkspacesService.getMemberRole()` 는 인덱스 단일 조회라 개별 비용은 낮지만, `assertCanModify()` 로직상 이 값은 대상 통합이 `scope === 'organization'` 일 때만 쓰인다(개인 통합이면 폐기됨). 컨트롤러가 서비스 메서드를 부르기 **전에** 무조건 역할을 가져오므로, 개인(personal) 통합에 대한 update/remove 요청마다 불필요한 DB 왕복이 하나씩 추가된다. `rotate` · `requestScopes` · `updateScope` 는 이미 기존 코드에서 같은 패턴(선조회)이었고 이번 변경 범위가 아니다 — 새로 이 패턴이 추가된 것은 `update()`·`remove()` 두 곳이다.
  - 제안: 절대 비용은 작아(단일 인덱스 조회) 조치를 강제할 정도는 아니다. 다만 "즉시 필요하지 않은 리소스의 선행 로딩"에 해당하므로, 후속 최적화 시 서비스가 엔티티를 먼저 읽고 `scope === 'organization'` 일 때만 역할을 조회하도록 뒤집는 안을 고려할 수 있다(다만 이는 `requireModifiable` 의 "판정 검사를 한 곳에 모은다"는 현재 구조를 흩뜨릴 수 있어 트레이드오프가 있다).

- **[INFO]** 목록/탐색 SQL 에 추가된 `integrationVisibilityClause` OR 조건이 `workspace_id` 단일 인덱스만으로 실행 계획을 탈 가능성 — 워크스페이스당 로우 수가 작다는 전제
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `findAll()`, `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts` `listIntegrations()` — 두 곳 모두 `.andWhere(integrationVisibilityClause('i'), { [INTEGRATION_USER_PARAM]: userId })`
  - 상세: `(i.scope <> 'personal' OR i.created_by = :userId)` 는 `scope`/`created_by` 전용 인덱스가 없다. 다만 선행 `where i.workspace_id = :workspaceId` 로 이미 소규모 집합(워크스페이스당 통합 수는 일반적으로 수십~수백 건 수준)으로 좁혀진 뒤 적용되는 필터라 실질적 성능 영향은 미미하다고 판단된다. `pickPrecheckConflict`(cafe24/makeshop precheck)의 우선순위 루프는 리팩터 전과 동일한 `O(priority × rows)` 복잡도를 유지해 새 회귀는 없다.
  - 제안: 별도 조치 불요. 워크스페이스당 통합 수가 크게 늘어나는 시나리오가 생기면 `(workspace_id, scope, created_by)` 복합 인덱스를 재검토.

- **[INFO]** `CandidateLookupService.fillCandidates()` 는 여러 `pending` 필드에 대해 각각 독립된 `findAll` 쿼리를 병렬(`Promise.all`)로 실행 — 기존 동작이며 이번 diff 로 인한 회귀 아님
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts` `fillCandidates()`/`lookup()`
  - 상세: `integration-selector` 필드가 여러 개면 각각 `IntegrationsService.findAll` 을 별도로 호출한다(배치 불가 — 필드마다 `serviceType` 힌트가 다를 수 있음). 이번 변경은 `userId` 파라미터 추가뿐이라 쿼리 횟수·형태는 그대로다. 새로 도입된 문제가 아니므로 이번 diff 의 결함으로 보지 않는다.
  - 제안: 조치 불요(관찰만).

## 요약

이번 변경은 "personal 통합은 생성자만 본다 / organization 통합 변경은 Admin 이상" 인가 규칙을 여러 경로(REST 컨트롤러, precheck, OAuth 콜백, workflow-assistant 도구 후보 조회)에 일관 적용하는 보안·정합성 리팩터로, 성능에 새로 유입된 알고리즘적 회귀(N+1, O(n²), 캐시 누락 등)는 발견되지 않았다. 목록/탐색 쿼리의 가시성 필터는 인메모리가 아닌 SQL `WHERE` 절로 처리되어 페이지네이션 `total` 왜곡을 피하면서도 성능 관점에서 올바른 선택이다. 다만 정합성(lost-update 방지, TOCTOU 방지)을 우선한 결과로 `update`/`updateScope` 의 DB 왕복이 2회에서 3회로 늘었고, OAuth 콜백 커밋 트랜잭션이 row lock 을 쥔 채 별도 커넥션으로 역할 조회를 한 번 더 하며, `update`/`remove` 컨트롤러가 스코프 확인 전에 역할을 선조회하는 등 몇 군데 "필요 여부와 무관한 선행 DB 호출"이 늘었다. 모두 단건 인덱스 조회 수준이라 절대적 임팩트는 작고 의도적 트레이드오프로 보이므로 INFO 등급으로만 기록한다.

## 위험도
LOW
