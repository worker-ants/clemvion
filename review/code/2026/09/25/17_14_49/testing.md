# 테스트(Testing) 리뷰 — review/code/2026/09/25/17_14_49 (3라운드)

## 발견사항

- **[WARNING]** 서비스 계층 "두 번째 선"(`assertAdmin`)이 비멤버와 역할-부족을 구분하지 못해 가드와 다른 거부 코드를 낸다 — 이번 PR이 새로 추가한 테스트가 그 불일치를 그대로 고정(certify)하고 있다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:981-994` (신규 테스트) / `codebase/backend/src/modules/workspaces/workspaces.service.ts:945-950`(`assertAdmin` 구현, 이 PR에서 미변경)
  - 상세: 이 PR의 핵심 계약은 `RolesGuard`·`workspaces.service.ts`·`AuthService` 세 곳이 "비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER`" 라는 같은 표를 보게 하는 것이다(가드 docstring "가드 거부의 오류 코드", `roles.guard.spec.ts`가 각 라우트마다 이를 전수 검증). 그런데 `workspaces.service.ts:950`의 `assertAdmin`은 `if (!role || !ADMIN_ROLES.has(role)) this.throwAdminRequired();` 로 **비멤버(`!role`)와 역할 부족을 같은 분기**에 두어 둘 다 `ADMIN_REQUIRED`를 던진다. 같은 파일의 `removeMember`(945줄 근방이 아니라 838-854줄)는 정확히 이 둘을 분리한다 — `!requesterRole`이면 `throwNotAMember()`(839줄), 역할 부족이면 별도로 `throwAdminRequired()`(854줄). 즉 같은 PR·같은 파일 안에서 두 "두 번째 선"이 서로 다른 불변식을 지킨다.
    이번 PR이 새로 추가한 `workspaces.service.spec.ts:981-994` 테스트가 이 불일치를 정확히 관측 가능한 형태로 만든다: `memberRepo.findOne.mockResolvedValue(null)`(비멤버)를 주입하고도 기대값을 `'NOT_A_MEMBER'`가 아니라 `'ADMIN_REQUIRED'`로 적었다. 바로 위(968-979줄)의 `leaveWorkspace` 테스트는 **같은 비멤버 fixture**로 `NOT_A_MEMBER`를 정확히 기대하는데, 대구를 이루는 `addMemberByEmail` 테스트만 다른 코드를 "정상"으로 고정한 것이다. 어느 쪽 테스트에도 이 차이를 설명하는 주석이 없다 — 이 PR의 다른 모든 divergence(초대 서비스의 소문자 `admin_required`, `AuthService`의 이중 조회 등)는 전부 의도를 명시한 주석이 붙어 있는 것과 대조된다.
    `updateMemberRole`(311줄)·`renameWorkspace`(373줄)·`updateWorkspaceSettings`(407줄)도 전부 같은 `assertAdmin`을 첫 줄에서 호출하므로 같은 결함을 공유한다 — 모두 이번 PR에서 `@Roles('admin')` + `@WorkspaceParam('id')`로 가드가 씌워진 라우트다.
    평상시엔 `RolesGuard`가 먼저 막아 `NOT_A_MEMBER`를 내므로 클라이언트가 이 불일치를 보지 못한다. 그러나 이 PR 전체의 위협 모델은 정확히 "가드 reflection이 깨지는 fail-open"(부트 캐너리 `workspace-reflection-canary.ts`)이고, 그 backstop 역할을 하는 게 바로 이 서비스 계층 두 번째 선이다. 그 선이 깨졌을 때 비멤버가 "권한 부족(ADMIN_REQUIRED)"이라는, 사실과 다른(당신은 애초에 멤버가 아니다) 코드를 받는 것은 CHANGELOG가 명시적으로 요구한 "`error.code` 로 분기하는 클라이언트는 확인할 것"이라는 계약을 서비스 계층에서 깨는 것이다.
  - 제안: `assertAdmin`도 `assertMembership`처럼 멤버십과 역할을 분리하거나(`if (!role) this.throwNotAMember(); if (!ADMIN_ROLES.has(role)) this.throwAdminRequired();`), 의도된 차이라면 `981-994` 테스트에 그 이유(가드와 다른 코드가 나는 것이 왜 괜찮은지)를 명시하는 주석을 남길 것. 최소한 `assertAdmin` 자체에 대해 "비멤버도 ADMIN_REQUIRED로 답한다"는 사실을 직접 검증하는 테스트(현재는 `viewer`만 테스트됨, 예: `renameWorkspace` 389-395줄)를 추가해 이 갈래가 의도적임을 드러낼 것.

- **[WARNING]** 공유 유틸리티로 승격된 `decoratorCallName`에 직접 단위 테스트가 없다 — 비-호출 데코레이터(`null` 반환) 분기가 저장소 전체에서 한 번도 실행되지 않는다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:140-146` (diff 게이트 기준)
  - 상세: 이 함수는 `param-uuid-pipe-guard.ts`와 `workspace-param-binding-guard.ts`가 "글자 그대로 복제"하던 것을 이번 PR에서 공용 모듈로 옮긴 것이다(자체 docstring이 그렇게 적는다: "쓰는 가드들이 같은 한계를 적어 둔다"). 그런데 옮겨간 자리인 `source-scan.spec.ts`에는 `decoratorCallName`만을 겨눈 테스트가 없다 — 같은 파일의 자매 함수들(`countCalls`·`stripLiterals`·`enclosingScopeName`·`toPosixPath`)은 전부 "이 헬퍼가 여러 가드의 판정 기반이라 간접 커버리지만 두면 안 된다"는 명시적 근거로 직접 단위 테스트를 갖고 있다(예: 294-340줄 `stripLiterals` 설명, 375-391줄 `enclosingScopeName` 설명 — 둘 다 과거 리뷰에서 "간접 커버리지뿐이면 비대칭이 다시 생긴다" 로 지적된 선례). `decoratorCallName`만 그 관례에서 빠졌다.
    실질적 공백: 이 함수의 `null` 분기(`ts.isCallExpression(expr) ? ... : null` — 괄호 없는 `@Foo` 형태)는 두 소비 가드의 fixture(`param-uuid-pipe/sample.controller.ts`, `workspace-param-binding/sample.controller.ts`) 어디에도 괄호 없는 데코레이터가 없어 간접적으로도 실행되지 않는다. 향후 이 함수가 세 번째 가드에 재사용될 때 이 분기가 조용히 틀려도(예: `null` 대신 빈 문자열을 반환하도록 리팩터해도) 아무 테스트도 잡지 못한다.
  - 제안: `source-scan.spec.ts`에 `decoratorCallName`을 직접 겨눈 `describe` 블록을 추가하고, 최소 세 갈래(호출형 `@Foo(...)` → `'Foo'`, 비호출형 `@Foo` → `null`, 다른 이름의 호출 `@Bar(...)` → `'Bar'`)를 양성/음성으로 고정할 것.

- **[INFO]** `getWorkspaceSettings`의 인라인 `FORBIDDEN` 코드가 이번 PR이 통일한 `NOT_A_MEMBER` 표에서 빠진 채 남아 있고, 그 상태를 기존 회귀 테스트가 그대로 고정한다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:481-487` (미변경) / `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:621-627`(미변경, `code: 'FORBIDDEN'` 단언)
  - 상세: 이 PR은 `workspaces.controller.ts`의 `getSettings` 라우트에 `@WorkspaceParam('id')`를 씌우고 `@ApiForbiddenResponse` 설명을 `FORBIDDEN_MEMBER_ROUTE`(="워크스페이스 멤버가 아님(NOT_A_MEMBER)")로 바꿨다(`workspaces.controller.ts` 관련 diff, `getSettings` 블록). 그런데 그 라우트가 실제로 위임하는 `getWorkspaceSettings` 서비스 메서드는 자체 인라인 검사로 `{ code: 'FORBIDDEN', message: '워크스페이스 멤버만 조회할 수 있습니다.' }`를 던진다 — `NOT_A_MEMBER` 상수도, `assertMembership`도 쓰지 않는 독자 코드다. 평상시엔 가드가 먼저 막아 `NOT_A_MEMBER`가 나가므로 Swagger 설명과 실제 응답이 일치하지만, 가드가 깨졌을 때의 backstop은 문서와 다른 코드(`FORBIDDEN`)를 낸다. 621-627줄의 기존 유닛 테스트는 이 낡은 계약(`FORBIDDEN`)을 여전히 "정답"으로 고정하고 있어, 이번 PR이 다른 형제 메서드(`leaveWorkspace`)에 적용한 통일 작업이 `getWorkspaceSettings`엔 미적용임을 감지하지 못한다.
  - 제안: 이 PR의 스코프는 아니었을 수 있으나, 같은 트래커(§리뷰 처분 이력에 이미 있는 "기존 `@ApiForbiddenResponse` ~120곳" 후속처럼)에 `getWorkspaceSettings`의 인라인 코드 통일을 등재하거나, 최소한 이 비일치를 아는 상태로 남긴다는 의도 주석을 코드에 남길 것.

- **[INFO]** 여러 `@WorkspaceParam` 경로값 + `@Roles()` 조합의 상호작용이 미검증(우선순위 낮음 — 실제 프로덕션 라우트에 없는 조합).
  - 위치: `codebase/backend/src/common/guards/roles.guard.spec.ts:125-127`(`PathTarget.twoPaths`, `@Roles` 없음), `:644-676`(`adminPath`/`ownerPath`, 경로값 1개)
  - 상세: `assertMember`는 `pathParamNames`를 순회하며 **같은 `requiredRoles`를 각 경로값에 동일 적용**한다(`roles.guard.ts` `for (const name of pathParamNames) { ... await this.assertMember(raw, userId, requiredRoles); }`). 다중 경로값 테스트(`twoPaths`)는 역할 없는 라우트로만 존재하고, 역할 임계값 테스트(`adminPath`/`ownerPath`)는 경로값이 하나뿐인 라우트로만 존재한다 — "경로값이 여럿이고 그중 하나만 역할 미달"인 조합은 어느 테스트에도 없다. 실제 저장소엔 이런 라우트가 없어(모두 단일 `:id`) 위험은 낮지만, 이 가드는 구조적으로 이 조합을 지원하도록 짜여 있으므로 다음에 그런 라우트가 생기면 이 조합이 첫 실전 사용이 된다.
  - 제안: 낮은 우선순위 — 실제 라우트가 생기기 전까지는 보류해도 무방하나, `twoPaths`류 fixture에 `@Roles`를 추가한 변형을 하나 두면 향후 회귀를 미리 방지할 수 있다.

## 요약

이번 3라운드 diff의 테스트 스위트는 전반적으로 매우 촘촘하다 — `RolesGuard`의 경로/헤더 혼합 분기, 형식 불량 UUID, 다중 경로 파라미터의 순서 민감성(뮤테이션 KILLED 확인), 부트 캐너리의 이중 카운트, 저장소 정적 가드(`param-uuid-pipe`, `workspace-param-binding`)의 대조군 fixture까지 앞선 두 라운드에서 지적된 갭이 대부분 메워졌다. 다만 이번 라운드에서 실제 코드를 직접 대조해 발견한 것은, 이 PR이 스스로 세운 "비멤버는 요구 역할과 무관하게 NOT_A_MEMBER" 불변식을 서비스 계층 `assertAdmin`이 지키지 못하고, 그 사실을 새로 추가된 테스트가 되레 "정답"으로 고정해 버렸다는 점이다 — 같은 파일의 `removeMember`가 올바르게 분리한 것과 대조된다. 이는 가드가 정상 동작하는 한 드러나지 않지만, 이 PR 전체가 대비하려는 바로 그 실패 모드(가드 reflection 파손)에서 서비스의 backstop이 문서·가드와 다른 오류 코드를 내게 만든다. 이 외에 공유 유틸 `decoratorCallName`의 직접 테스트 부재, `getWorkspaceSettings`의 낡은 `FORBIDDEN` 코드를 고정한 회귀 테스트는 상대적으로 경미하다.

## 위험도

MEDIUM
