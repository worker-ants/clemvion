# 보안(Security) 코드 리뷰 — workspace-path-guard

## 개요

이번 변경은 `RolesGuard` 가 **경로 파라미터로 전달되는 워크스페이스 ID**(`/workspaces/:id/...`,
`/auth/workspaces/:id/switch`)를 인가 대상으로 보지 못하던 기존 결함을 구조적으로 닫는 보안 강화
PR이다. 새 `@WorkspaceParam()` 데코레이터 + `RolesGuard` 의 경로-인식 분기 + 정적 repo-guard
(`workspace-param-binding`) + 부트 캐너리 확장 + 방대한 unit/e2e 테스트로 구성되어 있다. 아래는
새로 도입되는 취약점이 있는지, 그리고 수정 자체가 주장하는 보장을 실제로 충족하는지를 검증한
결과다.

## 검증한 핵심 보안 속성 (결함이 아니라 확인 근거로 기록)

- **`isUuidShaped` 와 `ParseUUIDPipe` 의 형식 판정 규약이 정확히 일치한다.** `RolesGuard` 는 파이프보다
  먼저 실행되어 미검증 원문(`request.params[name]`)을 보고, `isUuidShaped` 가 아니면 판정 없이
  넘긴다(`codebase/backend/src/common/guards/roles.guard.ts` `assertMember` 호출 직전 분기). 이때
  `isUuidShaped` 가 `ParseUUIDPipe`(버전 미지정 `'all'`)보다 **좁으면** 가드를 건너뛴 값이 파이프는
  통과해 핸들러에 도달하는 우회가 생긴다. 실제로 `node_modules/@nestjs/common/pipes/parse-uuid.pipe.js`
  의 `uuidRegExps.all` 정규식(`/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i`)과
  `codebase/backend/src/common/utils/uuid.ts` 의 `UUID_SHAPE_PATTERN` 이 **문자 그대로 동일**함을
  확인했다 — 우회 없음.
- **비멤버 응답이 워크스페이스의 존재·유형과 무관하게 균일하다.** `workspace-path-guard.e2e-spec.ts` 가
  팀/개인/부재 워크스페이스 모두에서 `403 NOT_A_MEMBER` 로 수렴함을 검증하고,
  `workspaces.service.ts` 의 `leaveWorkspace`/`addMemberByEmail` 는 인가(멤버십)를 조회보다 **먼저**
  수행하도록 순서가 바뀌어(존재·유형 오라클 제거) 가드가 뚫려도 서비스 계층이 같은 방어선을
  유지한다.
- **`transferOwnership` 등 `@Roles('owner'/'admin')` 라우트의 역할 판정 대상이 경로 워크스페이스로
  정정됐다** — 종전에는 헤더/토큰 워크스페이스의 역할을 판정해, 자신이 owner 인 워크스페이스를
  헤더에 실으면 실제로는 자신이 owner 가 아닌 경로 워크스페이스에 대해 가드를 통과할 수 있었다(서비스
  계층이 최종적으로 막긴 했으나 가드 층이 기능하지 않았다). e2e(`workspace-path-guard.e2e-spec.ts`
  `transferOwnership 은 경로 워크스페이스로 판정한다`)가 양방향을 모두 검증한다.
- **정적 스캔 범위 확인** — `workspace-param-binding` repo-guard 의 스캔 루트는 `src/modules` 이고,
  대조군 fixture 는 `src/repo-guards/__tests__/fixtures/**` 에 있어 실제 프로덕션 판정에 섞이지 않음을
  확인했다. 프로덕션 코드 전수 grep 결과 `:workspaceId` 류 경로 파라미터를 쓰는 컨트롤러는 이번 PR이
  다루는 `workspaces.controller.ts`/`auth.controller.ts` 외에 없다.

## 발견사항

- **[INFO]** `workspace-param-binding` 정적 가드는 **이름 휴리스틱**(`workspaceId` 또는 `*WorkspaceId`)
  으로만 위반을 잡는다 — `@Param('id') id: string` 처럼 식별자와 경로 이름이 모두 `id` 인 워크스페이스
  바인딩(이번 PR 수정 전 실제 15곳이 이 모양이었다)이 변수명을 `id` 로 남겨 두면 이 가드가 놓친다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts` 의
    `isWorkspaceIdName` 함수, 및 그 한계를 스스로 명시한 JSDoc(“이름이 규칙 밖(`id` 등)이면 못 본다”).
  - 상세: 이번 PR은 실제로 변수명을 `workspaceId`/`targetWorkspaceId` 로 남겨 가드가 정상 작동함을
    fixture 로 확인했고, 한계 자체도 코드/spec에 이미 공개적으로 문서화되어 있어 은폐된 결함은
    아니다. 다만 향후 회귀 방지 관점에서 **런타임 가드(`RolesGuard`/`workspaceParamNamesOf`)가
    실질적 방어선**이고, 이 정적 가드는 “관례를 지키지 않은 새 `@Param` 바인딩”을 잡는 보조 수단에
    불과하다는 점은 리뷰어·후속 작업자가 인지해야 한다.
  - 제안: 현재로선 조치 불요(문서화된 한계, defense-in-depth 계층 중 하나일 뿐). 이름 규칙을 강제하는
    lint 규칙이나 “컨트롤러 라우트 경로가 `/workspaces/:id` 패턴이면 강제로 `@WorkspaceParam`” 같은
    경로-패턴 기반 보강은 후속 개선으로 고려 가능.

- **[INFO]** `workspaces.service.ts::removeMember()` 상단 docstring(변경되지 않은 기존 텍스트, 이번
  diff 범위 밖)이 “`@Roles()` 가 없고 `handlerConsumesWorkspaceId` 가 false(`@WorkspaceId()` 가 아니라
  `@Param('id')`)라 `RolesGuard` 가 단축 통과시킨다”라고 서술하는데, 이는 **이번 PR 이전 상태**를 설명한
  것이다. 컨트롤러의 `removeMember` 는 이번 PR에서 `@WorkspaceParam('id')` 로 전환되었으므로, 현재는
  `pathParamNames.length > 0` 분기에 걸려 `RolesGuard` 가 (역할까지는 아니어도) **멤버십은 실제로
  검증**한다. 즉 “가드 층은 이 라우트를 막지 못한다”는 문장이 더 이상 정확하지 않다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember` 메서드
    docstring 도입부(“**인가를 대상 조회보다 먼저 한다.**” 문단).
  - 상세: 실제 동작에는 영향 없음(서비스 계층이 여전히 자체적으로 admin 권한을 재검증하므로 보안
    회귀는 아니다) — 다만 "가드가 이 라우트를 못 막는다"는 오래된 서술이 향후 감사자에게 현재의
    방어 계층 구성을 오도할 수 있다.
  - 제안: 이 docstring을 `@WorkspaceParam` 전환 이후의 현재 상태(가드가 멤버십은 보되, 역할은
    `@Roles()` 부재로 서비스가 계속 담당)로 갱신할 것. 사실 정정 성격이라 별도 세션에서 가볍게
    처리 가능.

이 외에 인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩 시크릿, 인증 우회, 안전하지 않은 암호화, 민감정보
노출 에러 처리, 알려진 취약 의존성 사용 등은 발견되지 않았다. `RolesGuard`/`WorkspaceParam` 로직은
guard-before-pipe 순서, `isUuidShaped`/`ParseUUIDPipe` 형식 일치, 균일한 403 응답(enumeration 방지),
멤버십·역할 판정 대상(경로 vs 헤더/토큰)의 명확한 분리가 unit(`roles.guard.spec.ts`,
`workspace.decorator.spec.ts`)·e2e(`workspace-path-guard.e2e-spec.ts`,
`workspace-rbac.e2e-spec.ts`, `workspace-delete-concurrency.e2e-spec.ts`)·정적 가드
(`workspace-param-binding-guard.ts`, `workspace-roles-attachment.spec.ts`) 네 층에서 교차 검증되어
있다.

## 요약

이 변경은 새 취약점을 도입하지 않았고, 오히려 `RolesGuard` 가 경로 기반 워크스페이스 인가를 놓치던
기존 CRITICAL 급 결함(특히 `transferOwnership` 의 역할 판정이 헤더/토큰 워크스페이스를 보던 문제와,
`workspaces.controller.ts` 14곳이 평범한 `@Param` 이라 가드가 아예 보지 못하던 문제)을 구조적으로
닫는다. `isUuidShaped`/`ParseUUIDPipe` 형식 판정 일치, 균일한 비멤버 응답, 서비스 계층의 인가-우선
순서 재정렬까지 보안 품질이 전반적으로 향상되었다. 남은 지적 사항은 모두 INFO 수준의 문서 정합성·
정적 가드의 알려진 한계이며, 착취 가능한 결함은 아니다.

## 위험도

NONE
