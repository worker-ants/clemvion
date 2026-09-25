# 문서화(Documentation) 리뷰 — workspace-path-guard (2라운드)

## 컨텍스트

1라운드(`review/code/2026/09/25/16_03_32`)에서 `documentation` 에이전트는 위험도 **NONE** 을 보고했고, 그 라운드의
Warning 8건 중 문서 관련 3건(W3 stale 주석 · W4 역할 서열 이중화 · W5 `@ApiForbiddenResponse` 8곳 중복)은 커밋
`37ee970a2`(공유 `workspace-roles.ts` 도입 + 취소선 정정 + 상수화)로 이미 처리되어 이번 diff에 반영돼 있다.
본 2라운드는 그 커밋을 포함한 25개 파일 전체를 다시 훑었다.

## 발견사항

- **[WARNING]** `switchWorkspace` 의 `@ApiOperation.description` 이 이 라우트에 더는(사실은 애초부터) 적용되지
  않는 "X-Workspace-Id 헤더 우선" 동작을 광고한다 — 이 PR 이 세우는 "경로 워크스페이스 라우트는 헤더를 쓰지
  않는다" 불변식과 정면으로 배치된다.
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts:431` (`switchWorkspace` 의 `@ApiOperation`)
    — 문구: `'... 전환기 하위호환으로 X-Workspace-Id 헤더가 있으면 header-first 로 우선하며, 헤더가 없으면
    토큰의 활성 워크스페이스 클레임이 적용됩니다. 비멤버면 403 NOT_A_MEMBER.'`
  - 상세: 이 diff 는 `switchWorkspace` 의 파라미터 바인딩을 `@Param('id', ParseUUIDPipe)` 에서
    `@WorkspaceParam('id')` 로 바꿨다(파일 10 diff). `@WorkspaceParam` 의 판정 대상은 **경로 값 하나**뿐이고,
    `AuthService.switchWorkspace(userId, targetWorkspaceId)` → `resolveTokenWorkspaceContext(user,
    targetWorkspaceId)` 어디에도 헤더를 읽는 코드가 없다(`auth.service.ts:1032-1050`, `:1127-1140` 확인). 이
    PR 이 새로 추가한 e2e(`workspace-rbac.e2e-spec.ts` "S." 케이스, 파일 25)도 `.set('X-Workspace-Id', ...)`
    없이 오직 경로의 대상 워크스페이스로만 전환을 검증한다("헤더 없이 토큰 클레임으로 전환"). 즉 이 문장은 이
    엔드포인트의 실제 동작을 설명하지 않는다 — OpenAPI 문서(Swagger UI)를 보는 API 소비자가 "헤더로 전환 대상을
    바꿀 수 있다" 고 오해할 수 있다.
    이 문장 자체는 diff 가 건드리지 않은 기존 텍스트이지만(`git log -S` 로 확인 — 최초 도입 후 무편집), 바로 이
    diff 가 해당 라우트를 경로-only 로 확정하고 `spec/data-flow/12-workspace.md` §Rationale·CHANGELOG·다른
    컨트롤러(`workspaces.controller.ts`)의 `@ApiForbiddenResponse` 등을 전부 갱신한 지점이라, 같은 파일 안의
    이 한 문장만 갱신에서 빠진 것으로 보인다. 같은 PR 이 `workspaces.service.ts`·`workspace-rbac.e2e-spec.ts`
    에서 이미 두 차례(취소선 + "(2026-09-25 정정)") 해온 처리 패턴과 같은 자리다.
  - 제안: 헤더 관련 문장을 지우거나 "이 엔드포인트는 헤더를 보지 않고 경로 `:id` 만 본다" 로 정정. plan
    (`plan/in-progress/workspace-path-guard-impl.md`)·spec 어디에도 이 자리가 알려진 잔여 항목으로 등재돼
    있지 않아(grep 0건) 놓친 것으로 판단된다.

## 그 외 확인한 항목 (문제 없음)

- **CHANGELOG**: 이 PR 의 두 관찰 가능한 변경(거부 코드 표준화, 경로 워크스페이스 15곳 가드 판정) 모두
  `CHANGELOG.md` Unreleased 항목으로 적절히 등재돼 있고, 서술한 수치(15곳=14+1, Admin·Owner 10곳, 코드 표)가
  코드·테스트와 정확히 일치한다. `common/constants/workspace-roles.ts` 추출은 동작 불변 리팩터라
  `CHANGELOG.md` 자체 기준("동작이 그대로인 리팩터는 항목을 내지 않는다")상 항목 불필요 — 맞게 생략됨.
- **spec Rationale 참조**: 코드·테스트 전반에서 반복 인용하는 `spec/data-flow/12-workspace.md` §"경로
  파라미터 워크스페이스도 가드가 본다" · §"가드 거부의 오류 코드" 두 섹션 모두 실재하며, 인용 문구와 일치한다.
  같은 spec 문서는 자신의 과거 서술("`:id` 는 인가 판정의 입력이 아니다")까지 인용 표기로 정정해 두어(452행
  부근) 자기모순을 남기지 않는다.
- **`error-codes.md` §3**: `admin_required` 가 "이제 HTTP 로 나가지 않는다" 는 정정이 spec 레지스트리에도
  반영돼 있어 `workspace-invitations.service.ts` 의 신규 docstring 과 SoT 가 일치한다.
- **JSDoc/독스트링**: `workspace-roles.ts`, `workspace.decorator.ts` 의 `WorkspaceParam`/`workspaceParamNamesOf`,
  `roles.guard.ts` 클래스 docstring(신규 "경로 워크스페이스"·"거부 코드" 섹션), 저장소 가드 두 종
  (`workspace-param-binding-guard.ts`/`.spec.ts`, `param-uuid-pipe-guard.ts` 확장) 전부 "왜 필요한가 · 무엇을
  판정하는가 · 알려진 한계 · 이웃 가드와의 경계"를 갖춘 이 저장소의 상위권 문서화 수준을 유지한다.
  fixture 파일(`sample.controller.ts` 둘)의 각 메서드에도 판정 의도를 설명하는 주석이 붙어 있다.
- **주석 정확성(오래된 주석) — 이미 고쳐짐**: `workspaces.service.ts`(`removeMember` 상단)와
  `workspaces.service.spec.ts` 의 "가드 층은 이 라우트를 막지 못한다" 라는 종전 서술이 `@WorkspaceParam` 전환으로
  거짓이 됐는데, 둘 다 취소선 + "(2026-09-25 정정)" 형식으로 올바르게 갱신돼 있다(1라운드 W3 처분 확인).
- **예제/사용법**: 신규 데코레이터 `WorkspaceParam` 은 자체 스펙(`workspace.decorator.spec.ts`)과 두 곳의 대조군
  fixture 컨트롤러에 실제 사용 예가 있어 별도 사용 가이드 문서 없이도 사용법이 코드로 드러난다.
- **API 문서(Swagger)**: 이번 diff 가 건드린 라우트 전부(`workspaces.controller.ts` 14곳,
  `executions.controller.ts` 2곳, `auth.controller.ts` 1곳)에서 `@ApiForbiddenResponse` 설명이 새 거부 코드를
  반영하도록 갱신됐다. diff 밖 나머지 ~120곳의 미갱신은 1라운드에서 이미 별도 트래커
  (`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 실측과 함께 등재된 것으로 확인했다 — 재지적
  대상 아님. `transferOwnership` 의 200 광고/201 실응답 불일치도 같은 트래커에 등재돼 있다.

## 요약

문서화 수준은 이 저장소의 상위권이다 — 신설/변경 함수·클래스마다 "왜"를 설명하는 JSDoc, spec Rationale과의
상호 참조, CHANGELOG 항목, 그리고 이번 PR 자신이 낡게 만든 주석 2곳을 정확히 찾아 취소선으로 정정한 이력까지
확인된다. 유일한 실질 지적은 `auth.controller.ts` `switchWorkspace` 의 `@ApiOperation.description` 한 문장이
이 PR 이 확정한 "경로 라우트는 헤더를 보지 않는다" 불변식과 어긋나는 헤더 우선 동작을 여전히 광고한다는
점이다 — diff 밖의 기존 텍스트이지만, 같은 파일의 같은 메서드를 이 PR 이 정확히 그 성질 쪽으로 바꿔 놓았고
plan/spec 어디에도 잔여 항목으로 등재되지 않아 놓친 것으로 판단된다.

## 위험도

LOW
