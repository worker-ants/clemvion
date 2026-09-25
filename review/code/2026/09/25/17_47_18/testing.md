# 테스트(Testing) 리뷰 — workspace-path-guard (4라운드)

## 발견사항

- **[WARNING]** `RolesGuard` 의 경로 워크스페이스 판정 — **다중 `@WorkspaceParam` + `@Roles()` 조합**이 전혀 테스트되지 않는다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` (156~168행, `pathParamNames` 루프) / `codebase/backend/src/common/guards/roles.guard.spec.ts` (`PathTarget.twoPaths`, `describe('경로 워크스페이스가 여럿이면 전부 본다 …')`)
  - 상세: `canActivate` 의 경로 분기는 `for (const name of pathParamNames) { … await this.assertMember(raw, userId, requiredRoles); }` 로, 핸들러에 `@WorkspaceParam` 이 여럿이면 **같은 `requiredRoles` 를 각 경로 워크스페이스마다 순차 적용**한다. 테스트 fixture `PathTarget.twoPaths` 는 다중 파라미터 조합을 검증하지만 `@Roles()` 가 붙어 있지 않고(`adminPath`/`ownerPath` 는 반대로 파라미터가 하나뿐), 실제로 "다중 `@WorkspaceParam` + `@Roles()`" 조합을 실행하는 테스트는 `roles.guard.spec.ts` 전체에 없다(`grep`으로 확인 — `twoPaths` 는 역할 검사 없는 케이스에만 쓰인다). 이 조합에서 "각 워크스페이스마다 개별적으로 역할을 요구"하는 현재 구현이 의도한 동작인지, 첫 번째/마지막 파라미터만 검사해야 하는지 등은 spec/코드 어디에도 단언이 없다 — 지금은 프로덕션에 이 조합을 쓰는 라우트가 없어(모두 `id` 하나) 드러나지 않을 뿐, 다음에 이런 라우트가 추가되면 회귀를 잡아줄 테스트가 없다.
  - 제안: `PathTarget` 에 `@Roles('admin') twoPathsWithRole(@WorkspaceParam('a') …, @WorkspaceParam('b') …)` 같은 fixture 를 추가해 "두 워크스페이스 모두 역할을 충족해야 통과 / 한쪽만 미달이어도 거부" 를 명시적으로 고정할 것. 최소한 이 구현 선택(각 경로 워크스페이스에 독립적으로 역할 요구를 적용)을 가드 docstring 에 적어 두지 않았다면 그 결정도 함께 남길 것.

- **[WARNING]** `addMemberByEmail` 재정렬(`assertAdmin` → `assertWorkspaceType`)의 근거 주석은 "비관리자"를 말하지만, 새 회귀 테스트는 "비멤버"만 검증한다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (259~262행, `addMemberByEmail`) / `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` (963~1000행, `describe('비멤버에게 워크스페이스 존재 · 유형을 드러내지 않는다')`)
  - 상세: 이 PR 은 `addMemberByEmail` 에서 `assertWorkspaceType` → `assertAdmin` 순서를 `assertAdmin` → `assertWorkspaceType` 로 뒤집으며 "인가가 조회보다 먼저다 — 거꾸로면 **비관리자**가 워크스페이스의 존재 · 유형을 구분한다" 라고 적었다. 그런데 새로 추가된 회귀 테스트(`it.each(workspaces)('addMemberByEmail — 워크스페이스 %s 여도 NOT_A_MEMBER …')`)는 `memberRepo.findOne.mockResolvedValue(null)` — 즉 **비멤버(role=null)** 케이스만 돈다. 주석이 명시한 "비관리자"(예: editor/viewer 같이 멤버이지만 admin 이 아닌 사용자)가 타입이 다른 워크스페이스(personal)를 대상으로 호출했을 때 `ADMIN_REQUIRED` 를 받는지(예전처럼 `WORKSPACE_TYPE_MISMATCH`/`WORKSPACE_NOT_FOUND` 가 먼저 나가지 않는지)를 검증하는 테스트가 없다. `leaveWorkspace` 쪽은 같은 클래스의 결함을 "비멤버"에 한해 정확히 고정했지만(그 함수는 비멤버만 문제였다), `addMemberByEmail` 주석이 스스로 "비관리자" 라고 넓게 주장한 이상 그 주장도 같은 강도로 고정돼야 한다. (참고: 도메인상 personal 워크스페이스는 통상 owner 1인만 멤버이므로 실제 도달 가능성은 낮을 수 있으나, 그 불변식 자체가 타입으로 강제되지 않으므로 테스트로 명시하는 편이 안전하다.)
  - 제안: `memberRepo.findOne` 이 `{ role: 'editor' }` 를 돌려주고 `workspaceRepo.findOne` 이 `type: 'personal'` 인 워크스페이스를 돌려주는 케이스를 추가해 `ADMIN_REQUIRED`(코드가 `WORKSPACE_TYPE_MISMATCH` 가 아님)를 단언할 것. 혹은 주석의 "비관리자" 를 "비멤버" 로 좁혀 실제로 검증한 범위와 일치시킬 것.

- **[INFO]** 경로 + 헤더 병용 핸들러(`@WorkspaceId` + `@WorkspaceParam`)에서 헤더가 토큰과 **같은**(재검증 불필요) 경우가 테스트되지 않는다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.spec.ts` (`describe('헤더 컨텍스트까지 소비하는 핸들러(@WorkspaceId + @WorkspaceParam)')`, `PathTarget.adminPathAndHeader`)
  - 상세: 이 describe 블록의 네 테스트는 모두 `headerWorkspaceId: VICTIM_WS, tokenWorkspaceId: TOKEN_WS` (헤더 ≠ 토큰, `membershipUnverified=true`) 조합만 쓴다. 경로 검사를 통과한 뒤 `checkRequestContext(request, userId, [])` 로 넘어갈 때 `needsRoleCheck=false` 이므로, 헤더가 토큰과 같아 `membershipUnverified=false` 인 경우 `if (!needsRoleCheck && !membershipUnverified) return true;` 로 **멤버십 재조회 없이** 통과해야 한다 — 이 분기가 경로 분기와 결합된 상태로는 테스트되지 않는다(각각 단독으로는 기존 테스트가 커버). 로직이 단순해 위험도는 낮지만, 두 분기가 합쳐지는 지점이라 회귀 시 놓치기 쉽다.
  - 제안: `headerWorkspaceId: SAME_WS, tokenWorkspaceId: SAME_WS` 조합으로 `getMemberRole` 이 헤더 워크스페이스에 대해 호출되지 않음(`not.toHaveBeenCalledWith(SAME_WS, …)` 또는 경로 워크스페이스 1회만 호출됨)을 확인하는 케이스를 추가.

## 요약

이번 4라운드 diff는 앞선 3라운드(Warning 22건)가 이미 촘촘히 처분한 상태라 전반적인 테스트 품질은 높다 — `RolesGuard`·`workspace.decorator`·신설 저장소 가드(`workspace-param-binding`) 모두 정상/거부/형식-불량/vacuity-floor·대조군 fixture를 갖췄고 e2e(`workspace-path-guard.e2e-spec.ts`)까지 3계층이 맞물린다. 다만 (1) `RolesGuard` 의 다중 `@WorkspaceParam` + `@Roles()` 결합이라는, 지금 프로덕션엔 없지만 코드 경로상 존재하는 조합이 완전히 미검증이고, (2) 이번 PR 이 직접 바꾼 `addMemberByEmail` 순서 재정렬의 주석이 주장하는 범위("비관리자")보다 실제 테스트가 검증하는 범위("비멤버")가 좁다는 점이 새로 발견됐다. 두 항목 모두 즉각적인 프로덕션 결함으로 이어지진 않지만, 보안에 민감한 인가 계층의 코드-주장 불일치이므로 회귀 테스트로 좁히는 것을 권장한다.

## 위험도

LOW
