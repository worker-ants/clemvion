# 데이터베이스(Database) 리뷰

## 범위 요약

이번 변경은 워크스페이스 경로 파라미터(`:id`) 인가를 `RolesGuard` 로 이관하는 RBAC 리팩터(`@WorkspaceParam`
도입 + `workspaces.service.ts` 인가-선행 재정렬)가 중심이며, 스키마·마이그레이션 변경은 없다. DB 관점에서
직접 영향이 있는 파일은 `codebase/backend/src/common/guards/roles.guard.ts`,
`codebase/backend/src/modules/workspaces/workspaces.service.ts`,
`codebase/backend/src/modules/workspaces/workspaces.controller.ts`,
`codebase/backend/src/modules/auth/auth.service.ts`, 관련 e2e 스펙 2건이다.

## 발견사항

- **[INFO]** `RolesGuard.canActivate` 의 경로 파라미터 루프가 순차 `await` — 다중 `@WorkspaceParam` 이면 미래에 N+1 이 될 수 있다
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:156-163` (`for (const name of pathParamNames) { ... await this.assertMember(...) }`)
  - 상세: `workspaceParamNamesOf(...)` 가 반환하는 이름마다 `assertMember`(내부에서 `getMemberRole` DB 조회)를 순차적으로 기다린다. 현재 저장소 전수 검색(`grep -rn "@WorkspaceParam("`)으로 확인한 바, 모든 핸들러가 `@WorkspaceParam('id')` 를 **정확히 1개**만 바인딩하므로 오늘 시점에는 실제 N+1 이 발생하지 않는다. 다만 향후 한 핸들러가 워크스페이스 경로 파라미터를 2개 이상(예: source/target workspace) 받게 되면 이 루프가 순차 왕복으로 늘어난다.
  - 제안: 현재는 조치 불필요. 다중 파라미터 지원이 실제로 필요해지면 `Promise.all` 로 병렬화하거나, 저장소 가드(`workspace-param-binding`류)에 "핸들러당 `@WorkspaceParam` 은 최대 1개" 불변식을 명시적으로 추가해 이 가정을 코드로 고정하는 편이 안전하다.

- **[INFO]** 인가-선행 재정렬로 멤버십 조회가 요청당 1회 추가되지만, 유니크 인덱스로 뒷받침되어 성능 영향은 미미
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`leaveWorkspace` 650행 부근 `assertMembership` 선호출, `transferOwnership` 725행 부근 `getMemberRole` 선호출, `removeMember` 837행 부근)
  - 상세: `WorkspaceMember` 엔티티가 `@Unique(['workspaceId', 'userId'])` 를 갖고 있어(`codebase/backend/src/modules/workspaces/entities/workspace-member.entity.ts:14`) `getMemberRole` 의 `findOne({ where: { workspaceId, userId } })` 는 인덱스 단일 행 조회다. 트랜잭션 밖 무락 선조회 + 트랜잭션 안 `pessimistic_write` 재조회는 코드 주석에서 "가드 인식이 깨졌을 때의 두 번째 선" 및 "TOCTOU 방지" 목적으로 명시적으로 의도됐다고 밝히고 있어 설계상 트레이드오프로 타당하다. 인덱스 누락·풀스캔 위험 없음.
  - 제안: 조치 불필요. 향후 `workspace_member` 테이블이 매우 커지더라도 이 조회는 유니크 인덱스 히트라 스케일 우려가 낮다.

- **[INFO]** (이번 diff 범위 밖, 참고용) `transferOwnership` 독스트링이 실제 락 구현과 다르다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:711-715` (`git blame` 확인 결과 2026-05-04 커밋(`eb009f99c8`)부터 존재 — 이번 라운드가 건드린 줄이 아니다)
  - 상세: 주석은 "두 멤버를 단일 `IN` 쿼리로 동시에 락. id 정렬과 무관하게 같은 시점에 둘 다 락이 걸리므로 A→B/B→A 동시 이양 시 데드락이 발생하지 않는다" 고 적혀 있으나, 실제 구현(750-769행)은 `requesterMembership`, `targetMembership` 을 **두 번의 개별 `findOne(...).lock` 호출**로 순차 락한다(단일 `IN` 쿼리 아님). 기능적으로는 문제가 없다 — 트랜잭션이 먼저 `workspace` 행을 `pessimistic_write` 로 락하므로(733-736행) 동시 이양 요청은 그 워크스페이스 락에서 완전히 직렬화되어, 멤버 락 순서 차이로 인한 데드락 시나리오 자체가 발생하지 않는다. 다만 주석이 서술하는 메커니즘(단일 IN 쿼리에 의한 동시 락)은 코드와 불일치해 다음 사람이 오해할 수 있다.
  - 제안: 이번 PR 의 수정 대상은 아니므로 즉시 조치는 불필요. 후속 정리 커밋에서 주석을 "workspace 행 락이 두 트랜잭션을 완전히 직렬화하므로 멤버 락 순서는 데드락과 무관하다" 로 정정하는 것을 권장.

## SQL 인젝션 / 파라미터화

전 구간 TypeORM `find`/`findOne`/`save` 의 객체 `where` 절만 사용하고 문자열 결합 쿼리는 없다. 신규/수정 e2e
스펙(`workspace-delete-concurrency.e2e-spec.ts`, `workspace-path-guard.e2e-spec.ts`, `workspace-rbac.e2e-spec.ts`)의
raw SQL(`pg` `Client.query`)도 전부 `$1`/`$2` 플레이스홀더를 사용해 파라미터화되어 있다. 인젝션 위험 없음.

## 마이그레이션 / 스키마

이번 변경에 포함된 마이그레이션 파일이나 엔티티 스키마 변경은 없다 (`grep` 결과 0건). 무중단 배포 관점에서
분석할 대상이 없다.

## 커넥션 관리

새/수정된 e2e 스펙은 `beforeAll` 에서 `pg.Client` 를 연결하고 `afterAll` 에서 `end()` 하는 기존 패턴을
그대로 따른다. `workspace-delete-concurrency.e2e-spec.ts` 는 레이스 재현을 위해 락 보유용 `locker` 커넥션을
별도로 열고 동일하게 `afterAll` 에서 해제한다. 누수 없음.

## 요약

스키마·마이그레이션 변경은 없고, RBAC 재정렬로 추가된 멤버십 조회는 모두 `(workspaceId, userId)` 유니크
인덱스 위에서 수행되는 단일 행 조회라 성능·인덱스 관점의 실질적 위험은 없다. SQL 은 전 구간 파라미터화되어
인젝션 우려가 없고, 트랜잭션·락 순서(workspace → membership)도 데드락 회피 목적으로 일관되게 유지된다.
발견된 사항은 모두 INFO 수준 — (1) `RolesGuard` 의 경로 파라미터 루프가 이론상 미래에 N+1 이 될 수 있으나
현재는 핸들러당 파라미터 1개로 고정돼 있어 실질 위험 없음, (2) `transferOwnership` 독스트링이 실제 락
구현(단일 IN 쿼리가 아니라 순차 2회 락)과 어긋나지만 이는 이번 diff 이전(2026-05-04)부터 있던 것이고
기능적 결함은 아니다. 조치를 막는 CRITICAL/WARNING 은 없다.

## 위험도

LOW
