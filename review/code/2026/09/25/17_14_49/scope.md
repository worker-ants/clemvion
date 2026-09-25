# 변경 범위(Scope) Review

## 컨텍스트 확인

- 대상: `codebase/**` 27개 파일 (base `origin/main`, 3라운드 `/ai-review` — 1·2라운드 `16_03_32`·`16_39_25` 의 Warning 16건은 이미 `RESOLUTION.md` 로 처분됨).
- 대조: `plan/in-progress/workspace-path-guard-impl.md` §구현 요구 1~8, §구현 중 결정, `plan/complete/spec-draft-workspace-path-guard.md`(+ `-followup.md`).
- 파일 목록 27개 전부를 diff·전체 컨텍스트(잘린 파일은 `Read`)로 확인했다.

## 발견사항

없음.

27개 파일 전부가 plan §구현 요구 1~8 중 하나에 직접 대응한다:

- `common/decorators/workspace.decorator.ts` · `index.ts` · `workspace-reflection-canary.ts`(+spec) · `workspace.decorator.spec.ts`: 요구 1(`@WorkspaceParam` + 캐너리 인식).
- `modules/workspaces/workspaces.controller.ts` · `modules/auth/auth.controller.ts`: 요구 2(15곳 `@WorkspaceParam` 전환 + `@Roles` 부착), 요구 8(`@ApiForbiddenResponse` 설명 갱신).
- `common/guards/roles.guard.ts`(+spec) · `common/constants/workspace-roles.ts`(+spec): 요구 3(거부 코드·본문 — 역할 서열 단일 표로 파생, 라운드1 W1/W4 처분).
- `repo-guards/__tests__/workspace-param-binding-guard.ts`(+spec+fixture) · `param-uuid-pipe-guard.ts`(+spec+fixture): 요구 4(저장소 가드 신설 + 기존 가드와의 모집단 상호작용).
- `modules/workspaces/workspaces.service.ts`(+spec) · `workspace-invitations.service.ts` · `auth.service.ts` · `executions.controller.ts`: 요구 5(인가 선행) 및 부수 dedup(`ADMIN_ROLES`·`NOT_A_MEMBER` 공유 표 — 라운드2 W2/W3 처분).
- `test/workspace-path-guard.e2e-spec.ts`(신규) · `test/workspace-rbac.e2e-spec.ts` · `test/workspace-delete-concurrency.e2e-spec.ts`: 요구 7(e2e).
- `repo-guards/__tests__/workspace-roles-attachment.spec.ts`: 15곳 표(요구 2) 고정 — plan 체크리스트에 "구현 뒤에 썼다, 뮤턴트로 따로 검증" 이라 명시.
- `common/__test-utils__/source-scan.ts` 의 `decoratorCallName` 추출: 라운드2(`16_39_25`) maintainability WARNING → `85a38d00f` 로 처분된 항목, `RESOLUTION.md` W3 로 확인.

계획에 없는 파일·모듈(frontend, 무관한 서비스, 무관한 spec 영역)은 changeset에 없다. plan 은 frontend `ERROR_KO` 등재를 명시적으로 보류했고(§구현 중 결정), 실제로 frontend 변경은 changeset 에 없다 — 서술과 실측이 일치한다.

포맷팅·주석·임포트 변경도 전부 실질 변경에 종속돼 있었다:

- import 변경(예: `auth.controller.ts` 의 `ParseUUIDPipe` 제거, 여러 파일의 `WorkspaceParam`/`NOT_A_MEMBER`/`ADMIN_ROLES`/`ForbiddenException`/`Param` 추가)은 해당 파일에서 실제로 쓰기 시작했거나 더 이상 쓰지 않는 심볼에 정확히 대응한다. drive-by 정리는 없었다.
- 주석 변경(예: `workspaces.service.ts` · `workspace-invitations.service.ts` · `workspace-delete-concurrency.e2e-spec.ts` · `workspace-rbac.e2e-spec.ts`)은 전부 가드 층의 인가 순서가 바뀐 사실을 설명하는 내용이고, 자기-반증형 정정은 취소선(`~~...~~`)으로 원문을 남기고 그 문장에만 국한했다(코드 주석이라 spec 소정정 규약 대상은 아니지만 같은 규율을 지켰다).
- `workspaces.controller.ts` 의 `FORBIDDEN_ADMIN_ROUTE` 류 상수 도입은 여러 라우트가 같은 문구를 반복하던 것을 요구 3 의 단일 표 원칙과 맞춘 것으로, 새 요구 도입이 아니라 이미 있던 리터럴의 재배치다.

새 repo-guard fixture 파일(`fixtures/workspace-param-binding/sample.controller.ts` 등)과 대조군 케이스 추가는 요구 4 의 정적 가드 자체가 요구하는 대조군(공허성 방지)이라 기능 확장이 아니다.

리뷰 중 저장소 파일은 수정하지 않았다(`git status --short` 로 확인할 필요 없이 Read/Bash 로만 조회).

## 요약

27개 파일 전부가 plan `workspace-path-guard-impl.md` §구현 요구 1~8 중 하나 이상에 직접 매핑되고, 부수적으로 보이는 dedup(`workspace-roles.ts` 로의 서열 통합, `decoratorCallName` 추출, `NOT_A_MEMBER`/`ADMIN_ROLES` 공유)도 전부 1·2라운드 `/ai-review` 가 지적한 Warning 을 그 라운드에서 처분한 흔적이며 `RESOLUTION.md` 로 대조 확인된다. 의도 이상의 변경, 무관한 리팩토링, 요청하지 않은 기능 확장, 무관한 파일 수정, 의미 없는 포맷팅, 불필요한 주석·임포트·설정 변경 어느 항목에서도 위반을 찾지 못했다.

## 위험도

NONE
