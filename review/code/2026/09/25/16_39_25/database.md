# Database Review — workspace-path-guard (2026/09/25 16_39_25, round 2)

## 발견사항

- **[INFO]** 경로 워크스페이스 가드 도입으로 관리형 라우트(≈15개, `workspaces.controller.ts` · `auth.controller.ts` `switchWorkspace`)마다 `workspace_member` 조회가 **가드(`RolesGuard.assertMember`) + 서비스(`assertMembership`/`assertAdmin`)** 두 번 도는 패턴이 확정됐다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` (`assertMember`, 대략 220번대 — `private async assertMember` 정의부) / `codebase/backend/src/modules/workspaces/workspaces.service.ts:943`(`assertMembership`), `:951`(`assertAdmin`), `:651`(`leaveWorkspace` 내 신규 `assertMembership` 호출)
  - 상세: `WorkspaceMember` 는 `@Unique(['workspaceId', 'userId'])`(`codebase/backend/src/modules/workspaces/entities/workspace-member.entity.ts:14`)로 인덱싱되어 있어 각 조회는 PK/유니크 인덱스 단건 조회다. 이 이중 조회는 라운드 1 리뷰(`review/code/2026/09/25/16_03_32`) W2 에서 이미 지적되었고, "가드 인식이 깨졌을 때의 두 번째 선"이라는 의도된 defense-in-depth로 문서화·수용됐다(커밋 `37ee970a2`). 이번 라운드의 신규 변경(`leaveWorkspace`에 `assertMembership` 선-호출 추가)도 같은 패턴을 한 자리 더 늘렸을 뿐, 인덱스가 없는 스캔이나 N+1 루프는 아니다.
  - 제안: 조치 불요(이미 근거·비용이 문서화됨). 다만 이 라우트들이 고빈도 경로(예: 목록 조회형 hot path)로 확장될 경우 가드가 읽은 role 을 서비스로 전달해 조회를 합치는 리팩터를 재검토할 가치는 있다 — 그 경우 "독립성 상실" 트레이드오프를 spec Rationale에 다시 근거 명시할 것.

- **[INFO]** `RolesGuard.canActivate` 의 경로 파라미터 루프(`for (const name of pathParamNames) { ... await this.assertMember(raw, userId, requiredRoles); }`)는 순차 `await` 라, 한 핸들러가 `@WorkspaceParam` 을 둘 이상 쓰게 되면 직렬 N+1 형태로 확장된다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:167-179`
  - 상세: 현재 전수 확인 결과(`grep -rn "@WorkspaceParam"`) 모든 핸들러가 `:id` 하나만 소비해 실질적으로 N=1이다. `workspace-param-binding-guard`(저장소 가드)가 새 `@Param` 워크스페이스 바인딩을 CI에서 막지만, `@WorkspaceParam` 을 한 핸들러에 여러 개 붙이는 것 자체는 막지 않는다.
  - 제안: 조치 불요(현재 벡터 없음). 향후 한 라우트가 워크스페이스를 2개 이상 경로로 받는 설계가 생기면 `Promise.all` 로 병렬화하거나 `IN` 배치 조회로 바꾸는 것을 고려.

- **[INFO]** 스키마 변경·마이그레이션 없음. `role` 컬럼(`workspace_member.role`, `varchar(20)`)은 여전히 DB 레벨 CHECK 제약 없이 애플리케이션 상수(`WORKSPACE_ROLE_LEVEL`)로만 유효값이 통제된다. 이번 변경은 그 상수를 가드·서비스 두 곳에 흩어져 있던 것에서 `common/constants/workspace-roles.ts` 단일 소스로 합쳐 drift 위험을 오히려 줄였다 — 새 스키마 리스크는 아니다.

- **[INFO]** e2e 테스트(`workspace-delete-concurrency.e2e-spec.ts`, `workspace-path-guard.e2e-spec.ts`)의 원시 SQL은 전부 `$1`/`$2` 파라미터 바인딩(`pg` 드라이버)을 사용해 SQL 인젝션 벡터가 없다. `db`/`locker` 커넥션은 `beforeAll`에서 열고 `afterAll`에서 명시적으로 `end()` 하여 커넥션 풀 누수 없음.

- **[INFO]** 트랜잭션·락 순서(`transferOwnership`: 워크스페이스 → 멤버십, `deleteWorkspace`: 동일 순서로 정렬해 교착 방지, `leaveWorkspace`: `pessimistic_write` 하에서 sole-owner 재판정)는 이번 diff로 인가 호출 순서만 앞으로 당겨졌을 뿐 락 전략·범위는 그대로다. 새로 추가된 `assertMembership`/`assertAdmin` 선-호출은 트랜잭션 **밖**에서 무락으로 수행되며, 결정은 여전히 트랜잭션 내부의 잠금 재검사가 최종적으로 내린다 — TOCTOU 안전성 회귀 없음.

## 요약

이번 diff는 워크스페이스 RBAC를 경로 파라미터(`@WorkspaceParam`)까지 확장하는 인가 계층 변경이며, 스키마·마이그레이션 변경은 없다. 새로 추가되는 DB 왕복은 전부 `workspace_member(workspace_id, user_id)` 유니크 인덱스를 타는 단건 조회이고, 가드·서비스 이중 검사로 인한 쿼리 중복은 라운드 1에서 이미 검토·수용된 의도된 defense-in-depth다. 트랜잭션 경계·락 순서·페이지네이션·SQL 인젝션 방어는 기존 안전성을 그대로 유지한다. 실질적인 새 결함은 발견되지 않았고, 남은 항목은 모두 INFO 수준의 장기 관찰 포인트다.

## 위험도

LOW
