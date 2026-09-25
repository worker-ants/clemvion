# 성능(Performance) 리뷰

## 발견사항

- **[WARNING]** 경로 워크스페이스(`@WorkspaceParam`) 라우트 16곳에서 인가 판정이 가드·서비스 두 계층에서 각각 DB 를 왕복해, 요청당 멤버십 조회가 기존 1회에서 2회로 늘었다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:172-173` (신설 `assertMember` 호출), `codebase/backend/src/modules/workspaces/workspaces.service.ts:943-949`(`assertMembership`) · `:951-957`(`assertAdmin`) — 두 헬퍼 모두 `936-941` 줄 docstring에서 "가드가 같은 조회를 먼저 한다 · 요청당 멤버십 쿼리가 한 번 더 도는 것은 의도된 중복" 이라고 명시
  - 상세: 이 PR 이전에는 `renameWorkspace`·`updateWorkspaceSettings`·`getWorkspaceSettings`·`deleteWorkspace`·`leaveWorkspace`·`addMemberByEmail`·`updateMemberRole`·`removeMember`·초대 4종(`invite`/`resend`/`listPending`/`revoke`) 라우트가 평범한 `@Param('id', ParseUUIDPipe)` 를 썼고 `@Roles()`/`@WorkspaceId()` 가 없어 `RolesGuard` 가 DB 조회 없이 단축 통과했다(`handlerConsumesWorkspaceId` false → `needsRoleCheck` false → `return true`). 서비스 계층의 `assertAdmin`/`assertMembership` 이 유일한 DB 조회였다. 이번 PR 에서 `@WorkspaceParam('id')` + (다수 라우트에) `@Roles('admin'|'owner')` 를 붙이면서 `RolesGuard.canActivate` 가 `workspaceParamNamesOf` 로 경로 파라미터를 인식해 **매 요청 `assertMember` → `getMemberRole` → `memberRepository.findOne`** 을 먼저 수행한다(`roles.guard.ts:167-174`). 이후 핸들러가 부르는 서비스 메서드가 **다시** `assertAdmin`/`assertMembership` 으로 같은 테이블을 조회한다. `grep` 확인 결과 `@WorkspaceParam` 사용처는 `workspaces.controller.ts` 15곳 + `auth.controller.ts`(`switchWorkspace`) 1곳, 총 16개 엔드포인트가 이 패턴이다. 이 중복은 보안 설계상 "가드 인식이 깨졌을 때의 두 번째 선" 이라는 의도된 defense-in-depth 트레이드오프로 문서화돼 있어 버그는 아니지만, 관리자 조작이 잦은 워크스페이스 설정·멤버·초대 엔드포인트에서 **인가만을 위한 순차 DB 왕복이 2배**가 된 것은 실측 가능한 지연 증가다(같은 커넥션 풀에서 두 번의 라운드트립 → p50/p99 응답시간에 직접 반영).
  - 제안: 의도된 트레이드오프이므로 되돌릴 필요는 없으나, (1) 부하 테스트로 이 16개 엔드포인트의 p50/p99 지연 변화를 실측해 문서(§Rationale)에 수치를 남길 것, (2) 만약 지연이 유의미하면 가드가 조회한 `role` 을 `request` 에 실어 서비스가 재사용하되, "가드와 독립적인 두 번째 선" 이 필요한 경로(`assertMembership`/`assertAdmin` 자체)는 그대로 재조회하는 절충안도 검토할 가치가 있음 — 다만 이는 위 rationale 이 명시적으로 기각한 방향이므로 재도입하려면 별도 결정이 필요.

- **[INFO]** `RolesGuard.canActivate` 가 인증된 모든 요청마다 `Reflect.getMetadata(ROUTE_ARGS_METADATA, ...)` 를 두 번(`handlerConsumesWorkspaceId` + `workspaceParamNamesOf`) 호출한다 — 이전에는 한 번이었다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:159-166`
  - 상세: 두 함수 모두 같은 `ROUTE_ARGS_METADATA` 를 같은 `(controllerClass, methodName)` 키로 읽고 `Object.values(...).filter/some(...)` 로 선형 스캔한다. 핸들러당 인자 개수가 작아 개별 비용은 미미하지만, `RolesGuard` 는 `APP_GUARD` 전역 등록이라 애플리케이션의 **모든 HTTP 요청**에 곱해진다. `ROUTE_ARGS_METADATA` 는 부팅 이후 핸들러별로 불변이므로 요청마다 다시 계산할 필요가 없는 순수 함수 결과다.
  - 제안: `WeakMap<Function, { consumesRequestContext: boolean; pathParamNames: string[] }>` 로 핸들러 단위 메모이제이션을 두면 요청당 리플렉션 호출을 0회로 줄일 수 있다. 트래픽이 크지 않다면 우선순위는 낮음(INFO) — 다만 전역 가드 특성상 "작지만 전량에 곱해지는 비용" 이라 캐싱이 저렴하고 안전한 승수 개선이다.

- **[INFO]** 경로 워크스페이스 검증 루프가 순차 `await` 다 — 현재는 N=1 이라 무해하지만 여러 개의 `@WorkspaceParam` 을 쓰는 핸들러가 생기면 그대로 N배 지연이 된다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:167-174` (`for (const name of pathParamNames) { ... await this.assertMember(raw, userId, requiredRoles); }`)
  - 상세: 저장소 전체에서 핸들러당 `@WorkspaceParam` 사용은 항상 1개뿐이라(예: `id`) 실질적으로 이 루프는 0~1회 반복이다. 그러나 코드 형태 자체는 "여러 경로 워크스페이스 파라미터" 를 지원하도록 열려 있어, 향후 핸들러가 두 개 이상의 `@WorkspaceParam` 을 받으면 `assertMember` 호출이 순차적으로 DB 를 왕복하게 된다.
  - 제안: 현재는 조치 불필요. 다만 새 핸들러 작성 규약에 "핸들러당 `@WorkspaceParam` 은 1개" 불변식을 명시하거나, 향후 실제로 여러 개가 필요해지면 `Promise.all` 로 병렬화할 것.

- **[NONE]** `workspace-reflection-canary.ts`(`assertWorkspaceIdReflectionWorks`/`countWorkspaceConsumingRoutes`)와 `repo-guards/__tests__/param-uuid-pipe-guard.ts`(`scanUuidParams`)의 순회는 각각 부팅 1회, CI 정적분석 1회 실행이며 컨트롤러/파일 수에 선형이라 문제 없음.
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`(`countWorkspaceConsumingRoutes`), `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`(`scanUuidParams`)

- **[NONE]** `RolesGuard.assertMember` 의 `requiredRoles.reduce((lowest, required) => ...)` 최소값 계산과 `workspace-roles.ts` 의 `workspaceRoleLevel`(해시 조회) 은 O(요구 역할 수)·O(1) 로 무시할 수준. `isUuidShaped` 정규식도 고정 길이 클래스만 사용해 ReDoS 여지가 없음.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:232-236`, `codebase/backend/src/common/constants/workspace-roles.ts`, `codebase/backend/src/common/utils/uuid.ts`

## 요약

이번 변경의 핵심 성능 임팩트는 워크스페이스 관리/멤버/초대 계열 엔드포인트 16곳에서 인가를 위한 DB 조회가 가드·서비스 이중 검증 구조로 바뀌며 요청당 1회에서 2회로 늘어난 것이다. 이는 저장소가 명시적으로 문서화한 defense-in-depth 트레이드오프(가드 리플렉션이 깨졌을 때의 독립적 두 번째 선)라 설계 결함은 아니지만, 관리자 조작이 잦은 이 경로들의 지연에 실측 가능한 영향을 준다 — 부하 실측과 수치화된 근거를 §Rationale 에 남길 것을 권한다. `RolesGuard` 의 리플렉션 호출이 요청당 1회에서 2회로 늘어난 점도 전역 가드 특성상 전량에 곱해지지만 개별 비용이 작아 우선순위는 낮다. 신설된 정적 분석기(부팅 캐너리·repo-guard)는 실행 빈도와 규모가 작아 문제 없다. 전반적으로 CRITICAL 급 성능 결함은 없으며, 발견된 이슈는 의도된 트레이드오프의 비용을 정량화하고 필요 시 캐싱으로 상쇄하는 수준의 개선 여지다.

## 위험도

LOW
