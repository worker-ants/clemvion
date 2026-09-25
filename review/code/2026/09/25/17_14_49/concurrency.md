# 동시성(Concurrency) 리뷰

## 발견사항

- **[INFO]** `RolesGuard.canActivate` 의 경로 워크스페이스 루프가 파라미터별로 DB 조회를 순차 `await` 한다
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:157-162` (`for (const name of pathParamNames) { ... await this.assertMember(raw, userId, requiredRoles); }`)
  - 상세: `workspaceParamNamesOf` 가 여러 이름을 반환할 수 있는 시그니처(`string[]`)인데, 루프 본문은 각 이름에 대해 `assertMember` (멤버십 DB 조회 1회)를 순차적으로 `await` 한다. 현재 실제 라우트는 핸들러당 `@WorkspaceParam` 을 하나만 쓰므로 오늘 시점에는 사실상 1회 반복이라 영향이 없다 — 경쟁 조건이나 정합성 문제는 아니고, 핸들러가 향후 워크스페이스 경로 파라미터를 둘 이상 받게 되면 요청 지연이 파라미터 수에 비례해 늘어난다는 잠재적 성능 이슈다.
  - 제안: 현재로선 조치 불요. 향후 다중 `@WorkspaceParam` 핸들러가 실제로 생기면 `Promise.all` 로 병렬화하거나(단, 서로 다른 워크스페이스 각각의 거부 사유를 구분해 표시해야 하면 순서 있는 처리가 오히려 필요할 수 있음) 최소한 그 설계 결정을 주석에 남길 것.

- **[INFO]** 가드의 멤버십 조회(경로 워크스페이스)는 잠금 없는 단순 SELECT — 서비스 계층의 비관적 락과 별개의 두 번째 선
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:209-230` (`assertMember`) · `codebase/backend/src/modules/workspaces/workspaces.service.ts:672-697` (`leaveWorkspace` 트랜잭션 내 `pessimistic_write`)
  - 상세: `RolesGuard` 가 경로 워크스페이스에 대해 매 요청 수행하는 멤버십 조회(`getMemberRole`)는 락이 없다. 동시 요청 두 건(예: 동시 `DELETE`)이 이 조회를 모두 통과한 뒤, 실제 원자성은 서비스 트랜잭션 내부의 `pessimistic_write` 락에서 확정된다. 이는 결함이 아니라 의도된 설계다 — `test/workspace-delete-concurrency.e2e-spec.ts` 상단 docstring(2026-09-25 갱신분)이 이 상호작용을 정확히 문서화했고("404 는 «둘 다 가드를 지난 뒤 서비스의 락에서 만난» 경우의 답이다"), 새 e2e(`workspace-path-guard.e2e-spec.ts`)도 가드 판정이 경로 워크스페이스 기준임을 회귀 테스트로 고정했다. 실제 원자성 보장(트랜잭션 · 락)은 이번 diff 에서 변경되지 않았다 — 변경된 것은 가드가 이 값을 "보는" 시점과 주석뿐이다.
  - 제안: 조치 불요 — 근거·회귀 테스트가 이미 갖춰져 있다. 후속 변경에서 가드의 조회 결과를 서비스 트랜잭션의 락 획득 없이 신뢰해 인가 결정을 내리는 방향으로 리팩터링하려는 시도가 있다면 이 문서(및 e2e)를 다시 참조할 것.

- **[INFO]** `WorkspacesService.leaveWorkspace` 에 추가된 `assertMembership` 은 잠금 없는 선검사이며, 이후 잠금 있는 재검사와 이중화됨(의도됨)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:653-655` (`await this.assertMembership(workspaceId, requesterId);`)
  - 상세: diff 는 `assertWorkspaceType` 조회보다 먼저 멤버십 검사를 추가했다. 이 호출은 락이 없으므로 이 시점과 트랜잭션 진입 사이에 멤버십이 바뀔 수 있지만, 그 경우도 트랜잭션 내부의 `pessimistic_write` 재조회(`memRepo.findOne(..., lock: { mode: 'pessimistic_write' })`)가 최종 판정을 내린다(코드·주석이 "아래 트랜잭션의 멤버십 재조회는 락을 잡은 채 sole-owner 를 판정하려는 것이라 남는다" 라고 명시). 정보 누설(존재·유형 오라클) 방지 목적의 선검사와 원자성 보장 목적의 락 재검사가 계층 분리되어 있어 경쟁 조건으로 이어지지 않는다.
  - 제안: 조치 불요.

## 요약

이번 변경분은 대부분 `RolesGuard` 의 경로 파라미터(`@WorkspaceParam`) 인가 확장, 역할 서열/거부 코드 상수화, 정적 분석 저장소 가드(`param-uuid-pipe-guard`, `workspace-param-binding-guard`) 리팩터링, 그리고 대량의 단위/e2e 테스트 추가로 구성되어 있으며 순수 동시성 프리미티브(락·트랜잭션·워커풀 등)를 새로 도입하거나 기존 락/트랜잭션 로직을 변경한 곳은 없다. 이미 존재하던 `pessimistic_write` 트랜잭션(`leaveWorkspace`·`transferOwnership`·`deleteWorkspace`)의 원자성 보장 코드는 이번 diff 에서 그대로 유지되고, 변경된 것은 그 위에 놓인 가드 계층이 언제 멤버십을 조회하느냐와 그 사실을 설명하는 주석·e2e 문서뿐이다. `workspace-delete-concurrency.e2e-spec.ts`·`workspace-path-guard.e2e-spec.ts` 두 e2e 는 가드의 잠금 없는 선조회와 서비스의 잠금 있는 최종 판정이 상호작용해 승자 200/패자 404 로 수렴함을 실측으로 고정해, 새로 열린 경쟁 조건 창이 없음을 뒷받침한다. 발견된 사항은 전부 INFO 수준(잠재적 성능 특성·설계 의도 확인)이며 실질적 결함은 없다.

## 위험도

LOW
