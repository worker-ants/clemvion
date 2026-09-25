# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `RolesGuard` 가 `@WorkspaceParam` 라우트마다 멤버십 SELECT 를 매 요청 추가로 수행한다
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:154-168`(`canActivate` 의 `pathParamNames` 루프) · `:209-230`(`assertMember`)
  - 상세: 이번 변경으로 `workspaces.controller.ts` 14곳 + `auth.controller.ts` 1곳(`switchWorkspace`)이 `@Param('id', ParseUUIDPipe)` 에서 `@WorkspaceParam('id')` 로 바뀌었다. 이 데코레이터가 붙은 라우트는 가드가 `workspacesService.getMemberRole()` (→ `workspace_member` 테이블 SELECT, `where: { workspaceId, userId }`)을 **매 요청** 추가로 돈다. 일부 서비스 메서드(`leaveWorkspace`, `removeMember`, `switchWorkspace`)는 같은 멤버십을 서비스 계층에서도 재조회해 요청당 왕복 수가 2~3회로 늘어난다.
  - 다만 (1) 이 조회는 `@Unique(['workspaceId', 'userId'])` (Postgres 유니크 인덱스, `codebase/backend/src/modules/workspaces/entities/workspace-member.entity.ts:14`)로 뒷받침되는 단일 행 조회라 비용이 작고, (2) 중복 조회는 코드 주석에서 "가드 인식이 깨졌을 때의 두 번째 선"으로 명시적으로 의도된 defense-in-depth이며(`workspaces.service.ts:930-936`, `auth.service.ts:1129-1132`), (3) 워크스페이스 관리 라우트는 hot path(예: 실행 엔진 루프)가 아니라 사용자 조작 빈도가 낮다. 결함이 아니라 **트레이드오프 기록**으로 남긴다.
  - 제안: 없음(현행 유지). 다만 향후 이 가드가 hot path 라우트(예: 워크플로 실행 트리거)에도 `@WorkspaceParam` 을 적용하는 경우, 요청당 추가 SELECT 비용이 누적될 수 있으니 그 시점에 캐싱(요청 스코프 memo) 여부를 재검토할 만하다.

- **[INFO]** 가드의 `pathParamNames` 루프는 이름마다 순차 `await` 로 DB 를 호출한다 — 현재는 N=1 로 고정돼 실질적 N+1 이 아니다
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:156-163`
  - 상세: `for (const name of pathParamNames) { ... await this.assertMember(...) }` 형태라, 한 핸들러가 `@WorkspaceParam` 을 두 번 이상 쓰면 그 수만큼 DB 조회가 직렬로 늘어난다. 다만 실측(`grep -n "@WorkspaceParam"`)상 이 changeset 의 전 컨트롤러가 핸들러당 정확히 1개만 사용한다 — 데이터 볼륨에 비례해 늘어나는 고전적 N+1(결과 집합 순회) 이 아니라 "핸들러에 선언된 파라미터 개수" 에 묶인 상한이라 현재는 위험이 없다.
  - 제안: 없음. 향후 한 핸들러가 워크스페이스 경로 파라미터를 2개 이상 받는 라우트가 생기면(현재 없음) `Promise.all` 병렬화를 고려할 수 있다는 정도만 참고.

- **[INFO]** `leaveWorkspace` 에 인가 우선 순서를 위해 멤버십 조회가 하나 더 추가됐다 — 의도된 왕복 증가
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:653-655` (새로 추가된 `await this.assertMembership(workspaceId, requesterId);`)
  - 상세: 종전에는 `workspaceRepository.findOne()` 을 먼저 불러 존재/유형을 확인했는데, 그 순서면 비멤버가 응답 차이(404 vs 403 vs personal-403)로 워크스페이스의 존재·유형을 추론할 수 있었다(oracle). 이번 변경은 인가를 조회보다 먼저 둬 이 정보 누출을 막는다 — 대신 `workspace_member` SELECT 가 요청당 1회 더 든다. 트랜잭션 내부의 `pessimistic_write` 락 재조회(`:676-679`)는 그대로 유지되어 TOCTOU 방지 설계는 변하지 않았다.
  - 제안: 없음. 보안(oracle 제거)이 인덱스 조회 1회 추가 비용보다 명백히 우선한다.

- **[INFO]** SQL 인젝션·파라미터화 — 문제 없음
  - 위치: `codebase/backend/test/workspace-delete-concurrency.e2e-spec.ts:75-77,88-92`, `codebase/backend/test/workspace-path-guard.e2e-spec.ts` 전역 `db.query(...)` 호출
  - 상세: 신규/변경된 e2e raw SQL(`pg` `Client.query`)은 전부 `$1`/`$2` 플레이스홀더 + `params` 배열을 쓴다. 서비스 계층은 TypeORM `Repository.findOne/find/delete` 로 값 바인딩되므로 문자열 결합 인젝션 표면이 없다.

- **[INFO]** 트랜잭션·락·마이그레이션 — 이번 diff 는 기존 설계를 바꾸지 않는다
  - `workspaces.service.ts` 의 `deleteWorkspace`/`transferOwnership`/`leaveWorkspace` 의 `pessimistic_write` 락, 락 순서(워크스페이스→멤버십), 원자적 `DELETE ... WHERE role != 'owner'` 술어 등은 이번 changeset 에서 손대지 않은 기존 코드다(순서만 일부 재배치: `assertAdmin` ↔ `assertWorkspaceType`, 순수 스왑으로 쿼리 수 불변).
  - 이번 changeset 에 신규/변경 마이그레이션 파일이 없다(`find … migration` 대상 없음) — 스키마 변경 없음, 무중단 배포 리스크 해당 없음.

## 요약

이번 변경은 RBAC 가드(`RolesGuard`)를 경로 파라미터 기반 워크스페이스(`@WorkspaceParam`)까지 확장하는 인가 리팩터로, DB 스키마·마이그레이션·인덱스 변경은 없다. 실질적인 DB 영향은 "경로로 워크스페이스를 받는 라우트마다 멤버십 SELECT 가 요청당 1~2회 추가된다"는 것뿐이며, 이는 `workspace_member(workspace_id, user_id)` 유니크 인덱스로 뒷받침되는 단일 행 조회이고 주석·spec(`data-flow/12-workspace.md` §Rationale)에서 명시적으로 정당화된 defense-in-depth 트레이드오프다. 파라미터화 쿼리, 트랜잭션/락 설계(교착 방지 락 순서, 원자적 조건부 DELETE, TOCTOU 방지)는 기존 그대로 유지되며 이번 diff 가 훼손하지 않았다. N+1 로 볼 만한 루프(`pathParamNames` 순회)는 현재 핸들러당 파라미터 1개로 고정돼 있어 데이터 볼륨에 비례하지 않는다. Critical/Warning 급 결함은 발견되지 않았다.

## 위험도

LOW
