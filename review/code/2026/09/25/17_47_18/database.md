# 데이터베이스(Database) 리뷰

## 개요

이번 변경(28개 파일)은 `RolesGuard` 가 경로 파라미터로 받는 워크스페이스 ID(`@WorkspaceParam('id')`)도
인가 대상으로 검증하도록 확장하는 RBAC/인가 계층 리팩터다. 스키마·마이그레이션 변경은 없으며(마이그레이션
디렉터리에 이 changeset 이 건드린 파일 없음, `codebase/backend/src/database` 관련 커밋도 이 변경 이전
이력뿐), 엔티티(`workspace-member.entity.ts` 등)도 수정되지 않았다. 실질적인 DB 관점 변경은
① `RolesGuard` 가 경로 워크스페이스에 대해 `getMemberRole` 조회를 추가로 수행하는 것,
② `workspaces.service.ts` 의 몇몇 메서드에서 인가 검사(`assertMembership`/`assertAdmin`) 순서를
조회보다 앞으로 옮긴 것, ③ 상수(`ADMIN_ROLES`/`NOT_A_MEMBER`/`ROLE_REQUIRED`) 중복 제거뿐이다.

## 발견사항

- **[INFO]** 경로 워크스페이스 라우트에서 멤버십 조회가 요청당 1회 추가된다(의도된 중복)
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` (`assertMember`, 게이트 209~230행) · `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`removeMember` 게이트 833행 `getMemberRole` 재호출, `leaveWorkspace` 게이트 650행 `assertMembership` 선행 호출)
  - 상세: `@WorkspaceParam('id')` 로 전환된 15개 라우트는 이제 `RolesGuard.assertMember()` 에서 `workspacesService.getMemberRole()` 로 `workspace_member` 를 1회 조회한 뒤, 서비스 계층(`assertMembership`/`assertAdmin`/`getMemberRole` 재호출)에서 **같은 조건으로 한 번 더** 조회한다. 조회는 `@Unique(['workspaceId', 'userId'])` (`workspace-member.entity.ts:14`)로 보장되는 인덱스를 타므로 개별 쿼리 비용 자체는 낮고, 이 중복은 코드 주석(`roles.guard.ts` 게이트 925~931행, `workspaces.service.ts` 게이트 925~930행)에 "가드 인식이 깨졌을 때의 두 번째 선"으로 명시적으로 설계된 defense-in-depth다. 다만 이 15개 라우트 전부에서 요청당 왕복이 2배가 되므로, 이 경로들의 트래픽이 커지면(예: `GET /:id/members` 같은 조회성 라우트) 누적 지연·커넥션 풀 점유가 늘어난다는 점은 기록해 둘 값어치가 있다.
  - 제안: 현재는 의도된 트레이드오프로 문서화되어 있어 수정을 요구하지 않는다. 다만 향후 이 경로들에서 지연이 문제가 되면, 가드가 조회한 `role` 을 request 컨텍스트에 실어 서비스 계층이 재사용하는 선택지도 있다 — 단, 그 경우 "가드 실패 시 서비스가 독립적으로 막는다"는 현재의 안전 속성이 깨지므로, 하려면 별도 설계 검토가 필요하다(현재 주석이 이미 그 트레이드오프를 인지하고 독립성을 택함).

- **[INFO]** `RolesGuard.canActivate` 의 경로 파라미터 루프는 순차 `await` 이지만 현재 실사용은 handler 당 1개로 바운드됨
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:156-163` (`for (const name of pathParamNames) { ... await this.assertMember(...) }`)
  - 상세: 이론적으로 한 핸들러가 `@WorkspaceParam` 을 여러 개 받으면(예: source/target 워크스페이스) 이 루프가 순차적으로 N번 DB 왕복한다(`Promise.all` 이 아님). 저장소 전체를 grep 한 결과 현재 이 데코레이터를 쓰는 모든 핸들러는 `@WorkspaceParam('id')` 단 하나만 쓴다(`workspaces.controller.ts` 14곳·`auth.controller.ts` 1곳 전부 확인) — 즉 루프는 실질적으로 0~1회만 순회하므로 지금은 성능·N+1 문제가 아니다.
  - 제안: 향후 두 워크스페이스를 동시에 받는 라우트가 추가될 경우에만 `Promise.all` 전환을 고려하면 된다. 지금 시점에 변경을 요구하지 않는다.

- **[INFO]** e2e 테스트의 SQL 은 전부 파라미터화되어 있고 커넥션 수명 관리도 적절함
  - 위치: `codebase/backend/test/workspace-path-guard.e2e-spec.ts` (신규 파일, `beforeAll`/`afterAll` 게이트 48~100행) · `codebase/backend/test/workspace-delete-concurrency.e2e-spec.ts` (게이트 39~51행)
  - 상세: 신규/수정된 e2e 스펙 모두 `pg.Client` 를 `beforeAll` 에서 열고 `afterAll` 에서 `end()` 하며, 모든 쿼리가 `$1`/`$2` 파라미터 바인딩을 쓴다(문자열 보간 없음). `workspace-delete-concurrency.e2e-spec.ts` 는 `SELECT ... FOR UPDATE` 로 실제 행 락을 잡아 동시성 경쟁을 결정적으로 재현하는 방식이라 데이터베이스 관점에서 바람직하다.
  - 제안: 없음(우수 사례로 기록).

- **[INFO]** 인가 검사 순서를 조회보다 앞으로 이동한 것은 트랜잭션/락 구조를 바꾸지 않음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `leaveWorkspace` (게이트 644~703행), `removeMember` (게이트 812~908행)
  - 상세: `assertMembership(workspaceId, requesterId)` 를 `workspaceRepository.findOne` 보다 앞에 두는 변경(오라클 방지 목적)은 순수 인가 로직 재배치이고, 그 아래의 `manager.transaction(...)` 블록·`pessimistic_write` 락·원자적 `DELETE ... WHERE ... role = Not('owner')` 패턴은 그대로다. 새로 추가된 선행 조회는 트랜잭션 밖의 무락 SELECT 라 데드락 위험이나 락 순서(문서화된 "워크스페이스 → 멤버십" 순서, 게이트 601~602행)에 영향을 주지 않는다.
  - 제안: 없음.

## 요약

스키마·마이그레이션 변경은 없다. 핵심 변경은 인가(authorization) 계층에서 `RolesGuard` 가 경로 워크스페이스 ID에 대해 멤버십을 매 요청 조회하도록 확장한 것이며, 그 결과 일부 라우트(15개)에서 가드와 서비스 계층이 같은 `workspace_member` 조회를 의도적으로 중복 수행한다 — 조회는 기존 unique 인덱스(`workspace_id, user_id`)를 타므로 비용은 낮고, 설계 의도(가드 우회 시의 2차 방어선)가 코드 주석과 spec Rationale 에 명시돼 있다. 트랜잭션·락 순서·원자적 DELETE 패턴은 이번 diff 로 변경되지 않았고, e2e 테스트의 SQL은 전부 파라미터화되어 있으며 DB 커넥션도 적절히 해제된다. SQL 인젝션·N+1(반복 행 기반)·대량 데이터 페이지네이션 관점에서 문제되는 패턴은 발견되지 않았다. Critical/Warning 없음.

## 위험도
LOW
