# 요구사항(Requirement) 리뷰

## 발견사항

- **[WARNING]** `removeMember` 에 대해 "가드 층은 이 라우트를 막지 못한다" 는 주석이 이번 PR 의 자기 변경으로 이미 틀려졌는데 갱신되지 않음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:826-828` (`removeMember` 본문 상단 인라인 주석) 및 `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1745-1748`
  - 상세: 두 주석은 문자 그대로 `— @Roles() 가 없고 handlerConsumesWorkspaceId 가 false(@WorkspaceId() 가 아니라 @Param('id'))라 RolesGuard 가 단축 통과시킨다. 서비스가 첫 방어선이다.` 라고 적는다. 그런데 이번 PR 이 정확히 `workspaces.controller.ts` 의 `removeMember` 핸들러 파라미터를 `@Param('id', new ParseUUIDPipe())` → `@WorkspaceParam('id')` 로 옮겼다(파일 10 diff, `async removeMember(... @WorkspaceParam('id') workspaceId: string ...)`). `RolesGuard.canActivate` 는 이제 `@Roles()` 유무와 무관하게 `workspaceParamNamesOf(controllerClass, handler).length > 0` 분기를 먼저 타 `assertMember(raw, userId, [])` 를 호출한다 — 즉 비멤버는 서비스에 닿기 전에 가드가 `403 NOT_A_MEMBER` 로 막는다. 주석이 근거로 드는 `@Param('id')` 라는 코드 형태 자체가 이 PR 로 더는 존재하지 않고, "가드가 못 막는다 / 서비스가 첫 방어선" 이라는 결론도 더는 참이 아니다.
    같은 PR 이 정확히 같은 논리를 `test/workspace-rbac.e2e-spec.ts:663-673` 에서는 취소선(`~~...~~`) 처리하고 `> (2026-09-25) 이제 가드가 경로 워크스페이스도 본다 ... 서비스의 인가 선행(두 번째 선)은 workspaces.service.spec.ts 가 고정한다` 로 정정해 두었다 — 세 곳 중 한 곳만 고치고 나머지 두 곳(서비스 본문·서비스 유닛테스트 docstring)을 놓친 형태다.
  - 제안: `workspaces.service.ts:826-828` 과 `workspaces.service.spec.ts:1745-1748` 을 `workspace-rbac.e2e-spec.ts` 와 같은 방식으로 정정한다 — "가드가 이제 이 라우트도 본다(`@WorkspaceParam`), 이 서비스 검사는 가드가 조용히 빠질 때의 두 번째 선이다" 로. 기능적 결함은 아니다(가드가 실제로 올바르게 막고 있음을 e2e·유닛 모두 확인) — 순수 주석/의도 서술 갱신 누락.

- **[INFO]** `@WorkspaceParam(name)` 에 빈 문자열을 넘기면 `workspaceParamNamesOf` 가 그 빈 이름을 유효한 등록으로 세어, 해당 파라미터의 형식 검증이 항상 스킵되고(경로에 `''` 세그먼트가 존재할 수 없어 `raw` 는 항상 `undefined`) `@Roles()` 요구가 있어도 우회된다.
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts` — `workspaceParamNamesOf` (`.filter((data): data is string => typeof data === 'string')` 부분, `WorkspaceParam` 정의부 인근)
  - 상세: 실제 우회로 이어지지는 않는다 — 경로에 매칭되는 값이 없으면 `raw` 가 `undefined` 가 되어 `assertMember` 호출이 스킵되지만, 뒤따르는 `ParseUUIDPipe`(빈 문자열 인자를 못 받아 핸들러 파라미터 자체가 `undefined` 로 바인딩되지 않고 파이프가 `undefined` 를 검증 시도) 가 거의 확실히 400 을 낸다. 다만 `WorkspaceParam('')` 은 타입 시그니처(`name: string`) 만으로는 컴파일 타임에 막히지 않는 오용 가능 지점이다. 현재 프로덕션 코드에 그런 호출은 없다(15곳 전수 확인, 전부 비어있지 않은 이름).
  - 제안: 필수 조치 아님 — 참고용 INFO. 원한다면 `WorkspaceParam` 에 `if (!name) throw`(개발 타임 방어) 추가 검토 가능.

- **[INFO]** spec fidelity 대조 — 불일치 없음
  - 위치: `spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다" · "가드 거부의 오류 코드" · "URL slug = FE 라우팅 SoT" · "`X-Workspace-Id` 헤더 vs `:id` 경로 파라미터"
  - 상세: line-level 로 대조했다 — 15곳 목록(`workspaces.controller.ts` 14 · `auth.controller.ts` 전환 1), Admin 8/Owner 2/무역할 5 의 역할 분배, 에러 코드 표(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`), "가드는 파이프보다 먼저 돈다 — `isUuidShaped` 형식 검사 → nil UUID 는 403, 형식 파손은 400", "비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER`" 규칙 (나) 채택 근거, 부트 캐너리의 두 개수 분리 로그, 저장소 가드 `workspace-param-binding` 신설과 그 한계(`id` 등 규칙 밖 이름은 못 봄) 모두 코드·테스트·CHANGELOG·spec 넷이 정확히 같은 수치·규칙으로 일치한다. `plan/in-progress/workspace-path-guard-impl.md` 의 뮤턴트 표(17개)·구현 중 결정도 실제 코드와 부합한다. CRITICAL 급 spec-code 불일치는 발견하지 못했다.

## 요약

이 PR 은 경로 파라미터로 워크스페이스를 받는 15개 라우트에 `@WorkspaceParam`/`RolesGuard` 인가를 도입하고 가드 거부에 오류 코드를 부여하는 잘 설계된 변경이다. `isUuidShaped` vs `ParseUUIDPipe` 의 의도된 비대칭(nil UUID → 403, 형식 파손 → 400), 헤더·경로 병용 핸들러의 역할/멤버십 분리, `workspace-param-binding`·`param-uuid-pipe` 저장소 가드의 모집단 갱신, 부트 캐너리의 두 팩토리 분리 카운트 등 핵심 로직을 뮤턴트 17종·e2e·유닛 스위트로 폭넓게 교차 검증했고, spec(`12-workspace.md`)·plan·CHANGELOG 가 서로 line-level 로 정확히 들어맞는다. 유일하게 발견된 흠은 기능적 결함이 아니라, `removeMember` 가 이번 PR 로 실제로는 가드의 보호를 받게 됐는데도 그 사실을 반영하지 않은 오래된 주석 2곳(`workspaces.service.ts`·`workspaces.service.spec.ts`)이다 — 같은 논리를 다루는 세 번째 위치(`workspace-rbac.e2e-spec.ts`)는 취소선으로 정확히 정정해 두었기 때문에 나머지 두 곳의 누락이 뚜렷하게 대비된다. 실제 런타임 동작(가드가 `removeMember` 비멤버를 403 `NOT_A_MEMBER` 로 막는 것)은 올바르고 e2e 로 확인됐다.

## 위험도

LOW
