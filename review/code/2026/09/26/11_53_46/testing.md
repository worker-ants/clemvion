# 테스트(Testing) 리뷰 — forbidden-desc-codes

## 검증 방법 메모
저장소 파일은 읽기만 했고 뮤테이션(코드 수정)은 수행하지 않았다 — 정적 분석과 grep 만으로 결론에 도달했다(예: `@Roles(` 호출부 전수 grep, 스펙 픽스처의 역할 문자열 전수 grep). `git status --short` 로 저장소가 깨끗함을 확인했다.

## 발견사항

- **[WARNING]** `guardRejectionCodes` 의 "서열 밖 문자열이 문턱" 방어 분기가 어떤 테스트에서도 실행되지 않는다 — `Object.hasOwn` 가드를 지워도 테스트가 안 죽는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes-guard.ts:137-139` (함수 `guardRejectionCodes`)
  - 상세: 이 분기는 `threshold` 가 `ROLE_REQUIRED` 에 없는 문자열(서열 0, 예: `'constructor'`)일 때 `rejection` 을 `undefined` 로 강제하기 위한 것이다. `Object.hasOwn` 없이 `ROLE_REQUIRED[threshold as WorkspaceRoleName]` 를 직접 인덱싱하면, `threshold === 'constructor'` 인 경우 JS 프로토타입 체인 때문에 `Object.prototype.constructor`(함수, truthy)가 반환된다 — 그러면 `if (rejection && !codes.includes(rejection.code))` 에서 `rejection.code`(`undefined`)가 `codes` 에 쌓이는 결함이 생긴다. 이 클래스의 버그는 정확히 같은 파일의 형제 상수(`workspace-roles.ts`/`workspace-roles.spec.ts`)가 `workspaceRoleLevel('constructor')` 테스트로 이미 한 번 방어해 둔 패턴인데, `guardRejectionCodes` 쪽 소비자에는 상응하는 회귀 테스트가 없다.
    실측: `forbidden-response-codes.spec.ts` 의 모든 픽스처(`ForbiddenFixtureController` · `ClassRolesFixtureController`)를 grep 한 결과 `@Roles(...)` 인자는 `'editor'` · `'admin'` · `'viewer'` · `'owner'` 뿐이다 — 서열 밖 문자열(`'constructor'`, `'superadmin'` 등)을 넣는 픽스처가 하나도 없다. `lowestRequiredRole` 단위 테스트(`workspace-roles.spec.ts`)는 "서열 밖 문자열이 문턱이 된다" 는 케이스를 이미 커버하지만, 그 반환값을 소비하는 `guardRejectionCodes` 의 `Object.hasOwn` 분기까지는 전파되지 않는다 — 계층 하나를 건너뛴 커버리지 갭이다.
  - 제안: `forbidden-response-codes.spec.ts` 의 `ForbiddenFixtureController` 에 `@Roles('editor', 'constructor')` (또는 유사한 서열 밖 문자열) 라우트를 추가하고, `guardRejectionCodes` 가 `['NOT_A_MEMBER']` 만 반환함을(역할 코드가 섞이지 않음을) 단언하는 케이스를 "가드 코드 모델" 테스트에 추가한다.

- **[INFO]** 모델 캐너리가 `@Roles()` + `@WorkspaceParam()` 을 **동시에** 쓰는 라우트 모양을 커버하지 않는다 — 그런데 그 모양이 프로덕션에서 가장 흔하다
  - 위치: `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes.spec.ts` 의 `ForbiddenFixtureController`/`ClassRolesFixtureController` 전체(약 97-184번째 정의 블록, "모델 캐너리" 절)
  - 상세: `roles.guard.ts` 의 "경로 워크스페이스" 분기(`canActivate` 의 `pathParamNames.length > 0` 처리, `codebase/backend/src/common/guards/roles.guard.ts:157-169`)는 `@WorkspaceParam()` 라우트에서 `@Roles()` 요구를 **경로 값**에 대해 판정하는, 2026-09-25 에 새로 생긴 특수 분기다. 실측(`grep -n "WorkspaceParam\|@Roles(" workspaces.controller.ts`): `workspaces.controller.ts` 안에서 `@Roles('admin'|'owner')` 와 `@WorkspaceParam('id')` 가 **같은 핸들러**에 짝지어 나오는 라우트가 다수(예: 122·151·213·260번째 줄 부근)다 — 즉 이 조합이 실제로 가장 널리 쓰이는 모양인데, 픽스처 컨트롤러들은 "`@WorkspaceParam` 만"(`pathMember`)과 "`@Roles` 만"(`editor`/`admin`/`owner`)을 각각 따로만 커버하고 두 데코레이터가 겹치는 라우트를 캐너리에 넣지 않았다.
    `guardRejectionCodes` 모델 자체는 경로/헤더를 구분하지 않고 "roles 존재 여부 + consumes 여부"만 보므로 논리적으로는 이 조합에서도 맞는 코드를 낼 것으로 보이나, 그 정합성은 **실제 `RolesGuard` 를 돌려 모델과 대조하는 캐너리**(파일 헤더가 "모델이 실제 가드와 같은가" 절에서 명시적으로 강조하는 목적)로 검증되어야 문서의 의도(“못 보는 것” 없이 실제 가드와 일치)가 지켜진다. 지금은 정확히 그 가장 흔한 조합이 캐너리 밖에 있다.
  - 제안: `ForbiddenFixtureController` 에 `@Roles('owner') @WorkspaceParam('id')` 를 함께 쓰는 라우트를 추가해 캐너리(`codesFromGuard`)가 이 조합에서도 모델과 일치함을 확인한다. Critical 은 아니다 — `scanForbiddenResponseCodes` 가 실제 컨트롤러 전수(157곳, `workspaces.controller.ts` 포함)를 이미 스캔해 설명 텍스트 레벨의 회귀는 잡아내고 있고, 이번 PR 도 그 전수 스캔을 초록으로 통과했다. 다만 "가드 코드가 실제 가드와 같은 코드를 내는지"를 검증하는 캐너리 자체의 커버리지 갭이라 별도로 남긴다.

- **[INFO]** `lowestRequiredRole` 의 명시된 사전조건(비어 있지 않은 배열)이 실패 모드로 테스트되어 있지 않다
  - 위치: `codebase/backend/src/common/constants/workspace-roles.ts` 함수 `lowestRequiredRole` (JSDoc: "`requiredRoles` 는 비어 있지 않아야 한다")
  - 상세: `Array.prototype.reduce` 를 초기값 없이 호출하므로 빈 배열이 들어오면 `TypeError: Reduce of empty array with no initial value` 를 던진다. 현재 두 호출부(`roles.guard.ts:220-222`, `forbidden-response-codes-guard.ts:134-135`) 모두 `length > 0` 을 먼저 확인한 뒤에만 호출해 사전조건을 지키고 있어 실제 위험은 낮다. 다만 이 실패 모드 자체를 고정하는 테스트가 없어, 향후 새 호출부가 그 체크 없이 이 함수를 부르면 원인이 불분명한 런타임 에러로만 드러난다.
  - 제안: 필수는 아니나, `workspace-roles.spec.ts` 에 `expect(() => lowestRequiredRole([])).toThrow()` 한 줄을 추가해 사전조건 위반의 실패 모양을 문서화해두면 다음 호출자에게 더 명확한 신호가 된다.

## 요약
새로 추가된 두 스펙 파일(`workspace-roles.spec.ts` 의 `lowestRequiredRole` 케이스, `forbidden-descriptions.spec.ts`)은 경계값(서열 밖 문자열, viewer=멤버십 동치)까지 정확히 짚고 있고, 핵심 산출물인 `forbidden-response-codes.spec.ts` 는 (1) 실제 컨트롤러 157곳 전수 스캔으로 회귀를 막는 낮은 층, (2) 판정 함수 자체를 4가지 위반 모양으로 정밀하게 가르는 대조군, (3) 모델(`guardRejectionCodes`)이 실제 `RolesGuard.canActivate` 와 같은 코드를 내는지 실기(real guard)를 구동해 대조하는 캐너리까지 3중 구조로 설계되어 있어 이 규모의 변경(컨트롤러 24곳 반복 치환) 치고 테스트 설계 품질이 높다. 다만 그 캐너리가 커버하는 라우트 모양 목록에 (a) `ROLE_REQUIRED` 에 없는 서열 밖 문자열이 `@Roles()` 에 섞이는 경우, (b) `@Roles()` 와 `@WorkspaceParam()` 이 한 핸들러에 동시에 걸리는 경우(정작 `workspaces.controller.ts` 에서 가장 흔한 모양) 두 가지가 빠져 있어, 이 두 지점에서 모델과 실제 가드가 갈리는 회귀는 지금 이 테스트 스위트로는 잡히지 않는다.

## 위험도
LOW
