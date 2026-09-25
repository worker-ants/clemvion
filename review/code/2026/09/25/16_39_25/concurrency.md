# 동시성(Concurrency) 리뷰

## 스코프 확인

이번 changeset(25개 파일)의 실질 변경은 인가(authorization) 계층 — `@WorkspaceParam` 신규 데코레이터, `RolesGuard` 의 경로 워크스페이스 판정, 역할 서열 공유 상수화 — 이다. 잠금·트랜잭션·원자적 연산이 있는 `workspaces.service.ts` 의 상태 변경 메서드(`deleteWorkspace` · `leaveWorkspace` · `transferOwnership` · `removeMember`)도 diff 에 포함돼 있어 "동시성과 무관" 은 아니다. 다만 그 메서드들의 **잠금 전략 자체는 이번 diff 로 바뀌지 않았다** — 바뀐 것은 인가 판정이 가드로 한 겹 앞당겨진 것과 주석·상수 정리다.

## 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 INFO 수준 관찰이다.

- **[INFO]** `RolesGuard.canActivate` 의 경로 파라미터 루프가 순차 `await` 다 — `@WorkspaceParam` 이 여러 개인 핸들러가 생기면 그 수만큼 DB 왕복이 직렬화된다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` — diff 게이트 167~174 (`for (const name of pathParamNames) { ...; await this.assertMember(raw, userId, requiredRoles); }`)
  - 상세: 현재 저장소에는 핸들러당 `@WorkspaceParam` 이 최대 1개뿐이라(2라운드 changeset 전체에서 `@WorkspaceParam('id')` 단일 사용) 실질적 지연은 없다. 경합이나 오답을 유발하는 진짜 레이스는 아니고, 각 반복이 독립적인 `assertMember` 호출이라 상태를 공유하지도 않는다.
  - 제안: 조치 불요. 다중 `@WorkspaceParam` 라우트가 실제로 생기면 `Promise.all` 병렬화를 검토(1라운드 리뷰 `review/code/2026/09/25/16_03_32` INFO 2 와 동일 관찰 — 재조치 대상 아님).

- **[INFO]** 가드(경로 워크스페이스 멤버십 조회) + 서비스(`assertMembership`/`assertAdmin`/`assertWorkspaceDeletable`)가 같은 `(workspaceId, userId)` 멤버십을 요청당 최대 2~3회 재조회한다 — 두 계층 사이에 이론적으로 아주 좁은 창이 있다(가드가 멤버십을 확인한 직후 다른 트랜잭션이 role 을 바꾸면 서비스의 재조회가 다른 답을 낼 수 있다).
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` `assertMember`(전체 파일 컨텍스트 게이트 220~237) / `codebase/backend/src/modules/workspaces/workspaces.service.ts` `assertMembership`·`assertAdmin`(게이트 943~957)
  - 상세: 이는 새로 생긴 레이스가 아니라 이번 PR 이 **의도적으로 유지**한 defense-in-depth 패턴이다 — `workspaces.service.ts` 게이트 936~942 의 docstring 이 "가드가 읽은 role 을 넘겨받으면 그 선이 가드에 기대 독립성을 잃는다" 고 명시하고, 실제 **권위 있는 결정**(상태를 바꾸는 지점)은 이 무락 재조회가 아니라 `deleteWorkspace`/`leaveWorkspace`/`transferOwnership`/`removeMember` 안의 `pessimistic_write` 락 또는 단일 원자적 `DELETE ... WHERE ... role <> 'owner'` 다. 1라운드 리뷰(`16_03_32`)의 performance/side_effect WARNING 2 로 이미 지적·처분됐고(`37ee970a2`), 이번 diff 는 그 처분(docstring 추가)을 반영한 상태다 — 동시성 관점에서도 재지적할 새로운 결함은 없다.
  - 제안: 조치 불요(이미 문서화·처분됨).

- **[INFO]** `leaveWorkspace` 에 새로 추가된 `await this.assertMembership(workspaceId, requesterId)` (무락 조회)는 `workspace.type` 확인보다 앞서 인가를 두기 위한 것으로, sole-owner 판정에 쓰이는 **잠금 있는** 재조회(트랜잭션 내부 `pessimistic_write`, 전체 파일 게이트 668~698)를 대체하지 않는다 — 최종 결정은 여전히 락 안에서 난다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` 게이트 645~698 (`leaveWorkspace`)
  - 상세: 새 무락 체크와 락 있는 재체크 사이에 사용자가 강등/제거될 수 있지만, 그 경우 락 안의 `if (!membership) throw NOT_A_MEMBER` 가 최종 답을 낸다 — TOCTOU 는 열리지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `deleteWorkspace`/`transferOwnership` 의 잠금 순서(워크스페이스 → 멤버십, `transferOwnership` 은 두 멤버를 단일 `IN` 쿼리로 동시 락)와 `removeMember` 의 단일 원자적 `DELETE ... WHERE role <> 'owner'`(EvalPlanQual 재평가 근거)는 이번 diff 로 **변경되지 않았다** — 데드락 회피 근거와 원자성 근거 모두 기존 그대로 유지된다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` 게이트 605~639(`assertWorkspaceDeletable` docstring "잠금 순서는 워크스페이스 → 멤버십"), 723~792(`transferOwnership`), 885~904(`removeMember` 원자적 DELETE)
  - 상세: `workspace-delete-concurrency.e2e-spec.ts` 의 갱신은 **결과 코드**(404 vs 이전 403)에 대한 주석 정정일 뿐, 락 획득 순서나 테스트 자체의 동시성 시나리오(`raceUnderHeldLock` 로 워크스페이스 행 락을 쥔 채 두 DELETE 를 경합)는 그대로다.
  - 제안: 조치 불요.

## 요약

이번 changeset 은 인가(authorization) 판정을 `RolesGuard` 로 앞당기는 리팩터링이며, 상태를 변경하는 서비스 메서드(`deleteWorkspace`·`leaveWorkspace`·`transferOwnership`·`removeMember`)의 기존 잠금 전략(`pessimistic_write` 순서 고정, 단일 원자적 조건부 `DELETE`, TOCTOU 방지 트랜잭션)은 그대로 보존된다. 가드-서비스 간 멤버십 중복 조회는 1라운드 리뷰에서 이미 지적·처분(docstring 명시)된 의도된 defense-in-depth 이고, 새로 도입된 무락 사전 체크(`leaveWorkspace` 의 `assertMembership`, `addMemberByEmail` 의 순서 재배열)는 모두 락 있는 최종 판정 이전의 조기 반환일 뿐이라 새로운 경쟁 조건·데드락·원자성 훼손을 만들지 않는다. `RolesGuard` 자체는 요청마다 지역 변수만 쓰는 무상태 싱글턴이라 스레드 안전성 문제도 없다. CRITICAL/WARNING 없음.

## 위험도

NONE
