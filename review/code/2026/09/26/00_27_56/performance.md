# 성능(Performance) 리뷰

## 발견사항

- **[WARNING]** `update` · `reauthorize` · `remove` 세 엔드포인트가 대상 통합의 `scope` 를 알기 전에 **무조건** `getMemberRole` 조회를 추가한다 — personal 통합(가장 흔한 케이스)에는 그 결과가 쓰이지 않는데도 매 요청 DB 왕복이 하나 더 생긴다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:489` (`update`), `:573` (`reauthorize`), `:662` (`remove`) — 모두 `const role = await this.roleOf(workspaceId, user);` 호출. `roleOf` 정의는 `:134-140`.
  - 상세: 이 3개 핸들러는 이번 diff 이전에는 role 을 조회하지 않았다(diff: `- return this.integrationsService.update(id, workspaceId, user.sub, body);` → `+ const role = await this.roleOf(...); return ...update(..., role, body)` 등, `remove`/`reauthorize` 동일 패턴). 반면 서비스 쪽 실제 인가 판정(`assertCanModify` → `codebase/backend/src/modules/integrations/integrations.service.ts:645`)은 `row.scope !== 'organization'` 이면 role 을 아예 쓰지 않는다(`integration-visibility.ts:98`). 즉 대상이 personal 이면 조회한 role 값이 버려진다. `getMemberRole` 은 `workspace_member(workspace_id, user_id)` unique 인덱스를 타는 단일 row 조회(`workspaces.service.ts` — `WorkspaceMember` entity 에 `@Unique(['workspaceId','userId'])`)라 개별 비용은 작지만, personal 이 다수인 워크스페이스에서 세 엔드포인트 트래픽 전체에 걸쳐 불필요한 라운드트립이 누적된다. 다만 `rotate` · `requestScopes` · `updateScope` · `create` 는 이 diff 이전부터 이미 같은 패턴(컨트롤러에서 미리 role 조회)을 쓰고 있었으므로, 이번 변경은 기존 스타일을 3곳에 더 넓힌 것이지 새로 만든 패턴은 아니다.
  - 제안: `rotate` 의 락 구간이 이미 보여주는 패턴(“scope 가 organization 일 때만 `getMemberRole` 호출”, `integrations.service.ts:1284-1292`)을 컨트롤러 레벨에도 적용할 수 있다면(예: `requireModifiable` 이 role-resolver 콜백을 받아 Organization 판정 시점에만 지연 호출), personal 케이스의 왕복을 없앨 수 있다. 다만 이는 API 형태 변경이 필요해 이번 PR 스코프를 넘는 리팩터로 판단되며, 지금 수준(인덱스 조회 1회)의 비용은 감내 가능하다.

- **[INFO]** `update` · `updateScope` 가 `entity.save()` 1회 왕복에서 `update()`+`reloadOrNotFound()` 2회 왕복으로 바뀌어, 요청당 DB 쿼리 수가 (조회 1 + 쓰기 1) = 2에서 (조회 1 + 쓰기 1 + 재조회 1) = 3으로 늘었다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:815-853` (`update`), `:1412-1442` (`updateScope`). 공용 헬퍼는 `:672` (`reloadOrNotFound`), `:663` (`judgedRow`).
  - 상세: 이전 코드는 `entity.scope` 등을 메모리에서 바꾼 뒤 `this.integrationRepository.save(entity)` 로 한 번에 커밋·응답을 만들었다. 새 코드는 판정 근거(`scope`)를 WHERE 절에 실은 조건부 `update()`(compare-and-set, lost-update 방지가 목적 — 주석 `:653-661` 참고)로 쓰고, DB 트리거가 채우는 `updated_at` 등을 다시 읽기 위해 별도 `reloadOrNotFound` SELECT 를 추가했다. 정확성을 위한 의도된 트레이드오프이고 추가 쿼리는 PK 인덱스 조회 1회라 절대 비용은 작지만, 성공 경로의 왕복 수가 50% 늘어난 것은 사실이다.
  - 제안: 현재로선 허용 가능한 트레이드오프로 보인다(정합성 버그 수정이 목적). 다만 향후 이 경로가 hot path 가 되면 Postgres `RETURNING` 절을 쓰는 조건부 `UPDATE ... RETURNING *` 로 재조회 왕복을 없앨 수 있다는 점만 기록해 둔다.

- **[INFO]** (긍정적 발견) 트랜잭션·행 락 안에서의 재판정이 커넥션 풀에서 두 번째 커넥션을 빌리지 않도록 같은 `manager` 를 재사용한다.
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:422-427` (`assertRequesterStillAllowed` → `workspacesService.getMemberRole(..., manager)`), `codebase/backend/src/modules/integrations/integrations.service.ts:1284-1291` (`rotate` 락 구간), `codebase/backend/src/modules/workspaces/workspaces.service.ts:116-127` (`getMemberRole` 이 `manager?` 를 받아 `manager.getRepository(WorkspaceMember)` 사용).
  - 상세: 커넥션 풀이 작을 때 락을 쥔 채로 새 커넥션을 요청하면 데드락/풀 고갈 위험이 있는데, 이 구현은 그 위험을 피했다. 별도 조치 불필요 — 참고용으로만 기록.

- **[INFO]** `findAll`/`listIntegrations`(explore-tools) 의 신규 `andWhere(integrationVisibilityClause('i'), ...)` 는 `(scope <> 'personal' OR created_by = :userId)` 형태의 OR 조건이라, `workspace_id` 단일/복합 인덱스(`idx_integration_workspace_status`, `(workspaceId, status)`) 로 좁혀진 뒤 필터로 적용된다. `(workspace_id, scope)`/`(workspace_id, created_by)` 전용 인덱스는 없다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:507-513` (`findAll`), `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:169-175` (`listIntegrations`). 정의는 `codebase/backend/src/modules/integrations/integration-visibility.ts:37-39`.
  - 상세: 워크스페이스당 통합 개수는 통상 수십~수백 건 수준으로 작아 즉각적인 문제는 아니다. `workspace_id` 필터로 이미 행 수가 좁혀진 뒤 OR 필터가 적용되므로 순차 스캔 비용이 크지 않다.
  - 제안: 당장 조치 불필요. 워크스페이스당 통합 수가 크게 늘어나는 방향으로 제품이 변하면 `(workspace_id, scope, created_by)` 커버링 인덱스를 재검토.

- **[INFO]** `pickPrecheckConflict` 는 고정 길이 `CAFE24_PRECHECK_STATUS_PRIORITY` 배열(≈7개)을 순회하며 매번 `rows.find(...)` 를 호출해 `O(priority.length × rows.length)` 이지만, `rows` 는 같은 워크스페이스·같은 mall/shop 식별자의 행이라 사실상 소수(보통 1건)로 유계다. 복잡도상 문제 없음.
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:357-371`.

- **[INFO]** `candidate-lookup.service.ts` 의 `fillCandidates` 는 `userId` 스레딩 추가에도 여전히 `Promise.all(pending.map(...))` 로 병렬 조회를 유지한다(순차 `await` 로 바뀌지 않음) — N+1 회귀 없음.
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts:57-69`.

## 요약

이번 변경은 "남의 personal 통합 은닉 + Organization 통합 변경은 Admin 이상" 인가 판정을 여러 경로에 일관되게 적용하는 보안/정합성 PR이며, 성능에 미치는 영향은 대체로 작고 의도된 트레이드오프다. 가장 눈에 띄는 항목은 `update`/`reauthorize`/`remove` 세 엔드포인트에 컨트롤러 레벨에서 무조건적인 `getMemberRole` 조회가 추가되어 personal 통합(다수 케이스)에서도 쓰이지 않는 role 을 매번 가져온다는 점과, `update`/`updateScope` 가 lost-update 방지를 위해 `save()` 1회 왕복에서 `update()+재조회` 2회 왕복으로 바뀌었다는 점이다. 두 항목 모두 추가 쿼리가 인덱스 조회 1건 수준이라 절대 비용은 낮고, 후자는 정합성 버그(락 없는 조건부 쓰기에서의 lost update)를 막기 위한 의도된 설계다. 반면 트랜잭션 락 구간에서 커넥션을 재사용하는 점, `Promise.all` 을 유지한 병렬 후보 조회, 작은 상수 크기의 우선순위 배열 순회 등은 긍정적이거나 문제 없는 패턴이다. 알고리즘 복잡도·메모리·블로킹 I/O·캐싱 측면에서 새로 도입된 중대한 리스크는 없다.

## 위험도
LOW
