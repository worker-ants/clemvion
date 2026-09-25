# 테스트(Testing) 리뷰

## 검증 메모

- 저장소는 변경하지 않았다(읽기 전용 리뷰). `git status --short` 로 확인 — untracked `review/code/...` 산출물 디렉터리 외 변경 없음.
- 실제 jest 실행으로 새/변경 테스트가 GREEN 인지 직접 확인했다(`node --experimental-vm-modules ./node_modules/jest/bin/jest.js`):
  - `roles.guard.spec.ts` · `workspace.decorator.spec.ts` · `workspace-reflection-canary.spec.ts` ·
    `workspace-param-binding.spec.ts` · `param-uuid-pipe.spec.ts` · `workspace-roles-attachment.spec.ts` ·
    `workspaces.service.spec.ts` → **231 passed**.
  - 기존 컨트롤러 유닛 테스트(`workspaces.controller.spec.ts` · `auth.controller.spec.ts` ·
    `executions.controller.spec.ts`, 이번 diff 대상이지만 스펙 파일 자체는 무변경) → **54 passed**, 회귀 없음.
- e2e 3개 파일(`workspace-path-guard.e2e-spec.ts` 신규, `workspace-rbac.e2e-spec.ts` · `workspace-delete-concurrency.e2e-spec.ts` 갱신)은 실 DB/Docker 가 필요해 이 환경에서 실행하지 않았다 — 코드 리딩으로만 검증.

## 발견사항

- **[INFO]** 경로+헤더 동시 소비 핸들러에서 "경로 값 형식 불량" 과 "역할 요구" 가 겹치는 조합이 유닛 테스트로 직접 고정되지 않았다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` — `canActivate()` 의 `pathParamNames.length > 0` 분기(전체 파일 컨텍스트 173–186행), 특히 `if (typeof raw !== 'string' || !isUuidShaped(raw)) continue;` 다음 `return this.checkRequestContext(request, userId, [])`.
  - 상세: `PathTarget.prototype.adminPathAndHeader`(`@WorkspaceId()` + `@WorkspaceParam('id')`, `@Roles('admin')`)에 대해 경로 값이 형식 불량이거나 부재인 케이스는 테스트되지 않는다. 이 경우 경로 쪽 `assertMember` 호출이 `continue` 로 건너뛰어지고, 이어서 `consumesRequestContext` 가 true 이므로 `checkRequestContext(request, userId, [])` 를 **빈 역할 배열**로 호출한다 — 즉 그 요청에 대해 `@Roles('admin')` 요구가 통째로 스킵되고 헤더 워크스페이스에 대한 멤버십만 검사된다. 현재는 `@WorkspaceParam` 내장 `ParseUUIDPipe` 가 가드 통과 후 400 을 내 안전하지만(그 사실이 `roles.guard.spec.ts` 의 "가드는 파이프보다 먼저 돈다" 스위트에서 단일 데코레이터 핸들러(`adminPath`)로만 검증됨), 경로+헤더 동시 소비 핸들러(`adminPathAndHeader`)로는 이 상호작용이 관측되지 않는다. 향후 파이프 제거·다른 트랜스포트(경로 파이프가 없는 경우) 리팩터가 있으면 이 role-bypass 가 조용히 실사용 가능해져도 이 스위트는 초록을 유지한다.
  - 제안: `roles.guard.spec.ts` 의 "가드는 파이프보다 먼저 돈다" `describe` 안에 `adminPathAndHeader` + 형식 불량/부재 경로 값 케이스를 하나 추가해, "역할 요구가 스킵되고 헤더 멤버십만 본다" 는 현재 동작을 명시적으로 고정할 것(또는 의도적 허용이라면 그 사실을 `roles.guard.ts` 주석에 한 줄 추가).

- **[INFO]** `workspace.decorator.spec.ts` 의 `workspaceParamNamesOf` 다중 파라미터 순서 검증이 `.sort()` 로 가려져 있다.
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.spec.ts` — `describe('workspaceParamNamesOf', ...)` 안 `namesOf` 헬퍼(`workspaceParamNamesOf(Routes, handler).slice().sort()`), 특히 `'twoParams'` 케이스.
  - 상세: `roles.guard.ts` 는 `pathParamNames` 를 `for...of` 로 **선언 순서대로** 순회하며 각 경로 값을 개별 `assertMember` 호출로 검사한다(`roles.guard.spec.ts` 의 "경로 워크스페이스가 여럿이면 전부 본다" 테스트가 이 순회 자체는 검증). 그런데 `workspaceParamNamesOf` 자체의 리턴 순서를 고정하는 유일한 테스트가 `.sort()` 로 순서를 지워 비교하므로, `Reflect.getMetadata` 의 `Object.values` 순회 순서가 바뀌는 리팩터(예: 키 정렬 방식 변경)가 있어도 이 단위 테스트는 여전히 초록이다. 순서 자체가 계약이 아니라면 문제 없으나, 가드 쪽 동작(“여러 경로 워크스페이스 중 처음 위반한 것에서 멈춘다”)이 실질적으로 순서에 의존하므로 최소 한 자리에서는 순서 보존을 명시적으로 기록해 둘 가치가 있다.
  - 제안: 필수는 아님 — 다만 `twoParams` 케이스 옆에 순서를 보존하는 별도 단언(`.slice()` 만, `.sort()` 없이 `['a','b']` 비교)을 한 줄 추가하면 이 암묵적 의존을 명시적으로 만든다.

## 요약

이번 PR 의 테스트 설계는 이례적으로 촘촘하다 — 새 가드 로직(`RolesGuard` 의 경로 워크스페이스 분기), 새 데코레이터(`WorkspaceParam`/`workspaceParamNamesOf`), 두 정적 repo-guard(`param-uuid-pipe-guard` 확장·신규 `workspace-param-binding-guard`), reflection 캐너리 확장까지 모두 유닛 레벨에서 대조군 fixture + vacuity floor + 실제 판별력(각 위반 형태를 따로 잡는지, AST 가 주석/문자열에 안 속는지)까지 검증한다. 서비스 계층에서 인가 검사 순서를 바꾼 두 지점(`leaveWorkspace`, `addMemberByEmail`)에 정확히 대응하는 새 회귀 테스트가 추가됐고, 다른 메서드들은 이미 순서가 맞아 손대지 않은 것도 `git diff` 로 확인했다. e2e 3개 파일은 비멤버 오라클 제거, 역할별 거부 코드, 경로 vs 헤더 판정 축 전환, 형식 불량/닐 UUID 경계, 동시성(concurrency) 케이스까지 다룬다. 직접 jest 를 돌려 새 스펙 7개(231 테스트) 가 실제로 통과함을 확인했고, 이번 diff 로 데코레이터가 바뀐 컨트롤러들의 기존 유닛 스펙(`workspaces.controller.spec.ts`·`auth.controller.spec.ts`·`executions.controller.spec.ts`)도 회귀 없이 통과했다. 발견한 두 건은 모두 INFO 수준의 미세한 커버리지 갭(경로+헤더 동시 소비 핸들러의 파이프-우회 상호작용 미고정, 다중 경로 파라미터 순서 검증이 `.sort()` 로 가려짐)으로, 현재 프로덕션 경로는 내장 `ParseUUIDPipe` 덕에 안전하며 머지를 막을 사유는 아니다.

## 위험도

LOW
