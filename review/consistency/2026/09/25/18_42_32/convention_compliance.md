# 정식 규약 준수 검토 — workspace-path-guard (impl-done, diff-base `origin/main`)

## 검토 범위 및 방법

- 모드: `--impl-done`. HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/workspace-path-guard`)를
  "현재 구현" SoT 로 삼아 `git diff origin/main...HEAD` (30개 코드 파일 / 3473줄, 전체는 196파일 — plan/review
  산출물 포함)를 절대경로·`git -C`로 직접 확인했다. 프롬프트 번들은 컨텍스트 예산으로 `2-api-convention.md` ·
  `3-error-handling.md` · `13-replay-rerun.md` · `conventions/error-codes.md` · `conventions/swagger.md` ·
  `data-flow/12-workspace.md` 본문과 `git diff` 자체가 절단되어 있어, 이 여섯 문서는 저장소에서 직접 `Read`/`git diff`
  로 재확인했다(번들 부재를 "내용 없음"으로 취급하지 않았다).
- 이 PR 은 이미 `/ai-review` 5라운드(16:03→18:19) + `/consistency-check --spec` 7라운드(14:19→18:35)를 거쳐
  Critical 0 으로 수렴한 상태다. 본 라운드는 그 산출물이 아니라 **최종 diff 전체**를 정식 규약(`spec/conventions/**`)
  관점에서 독립적으로 재검증한 결과다.

## 규약 대조 상세

1. **명명 규약**
   - 신규 에러 코드 `NOT_A_MEMBER` · `EDITOR_REQUIRED` · `ADMIN_REQUIRED` · `OWNER_REQUIRED`
     (`common/constants/workspace-roles.ts`)는 전부 `error-codes.md` §1 `UPPER_SNAKE_CASE` 를 지킨다.
   - 신규 데코레이터 `WorkspaceParam`/`workspaceParamNamesOf`는 기존 `WorkspaceId`/`handlerConsumesWorkspaceId` 명명
     패턴(동사형 `extract*` 팩토리 + `*Of`/`handlerConsumes*` 조회 함수)을 그대로 따른다.
   - 신규 repo-guard 테스트 3종(`workspace-param-binding-guard.ts` + `.spec.ts` + `fixtures/workspace-param-binding/**`)은
     기존 `param-uuid-pipe-guard.ts` + `.spec.ts` + `fixtures/param-uuid-pipe/**` 트리플 패턴과 동일 구조다.
   - `spec/5-system/1-auth.md` frontmatter `code:` 목록에 신규 테스트 경로가 정확히 등재되어 있다
     (`spec-impl-evidence.md` 요구와 일치).
2. **출력 포맷 규약(에러 코드·응답)**
   - `RolesGuard` 가 코드 없는 403(전역 필터 기본값 `FORBIDDEN`)을 코드 있는 403 으로 바꾼 변경은
     `spec/5-system/2-api-convention.md` §"code 의 상태코드별 기본값" 각주로 함께 갱신됐고, 실제 catalog
     (`spec/5-system/3-error-handling.md` §1.2)에도 `EDITOR_REQUIRED`/`OWNER_REQUIRED` 행이 신설·`ADMIN_REQUIRED`/
     `NOT_A_MEMBER` 설명이 갱신됐다 — 코드↔catalog↔실제 발행 지점(`roles.guard.ts`)이 3중 일치한다.
   - 초대 모듈의 `admin_required`(lowercase) historical-artifact 행에서 `forbidden` 을 제거한 근거("발행처
     0건")를 코드로 직접 확인했다 — `codebase/backend/src/modules/workspaces` 전체에 `code: 'forbidden'`
     리터럴이 없다. 등재 제거가 `error-codes.md` §3 신설 원칙("발행된 적 없는 코드는 표에 오지 않는다")과
     정합한다.
   - `swagger.md` 체크리스트 항목("`@Roles(...)` 가 붙었거나 `@WorkspaceId()` 를 소비하는 엔드포인트는
     `@ApiForbiddenResponse` 도 추가")이 `@WorkspaceParam(...)` 축까지 확장됐고, `workspaces.controller.ts` ·
     `auth.controller.ts` 의 `@WorkspaceParam` 라우트 15곳 전부에 갱신된 `@ApiForbiddenResponse` 설명(코드 명시)이
     실제로 붙어 있음을 grep 으로 확인했다(누락 0).
3. **문서 구조 규약**
   - `plan/in-progress/workspace-path-guard-impl.md` frontmatter 는 `worktree: workspace-path-guard`(실제 워크트리
     명과 일치) · `spec_impact`(실재 경로 9개 리스트, bare `none`/빈 배열 아님)를 갖춰 Gate C 요건을 충족한다.
   - `spec/data-flow/12-workspace.md` 신설 절("경로 파라미터 워크스페이스도 가드가 본다" · "가드 거부의 오류
     코드")은 기존 Rationale 절 옆에 날짜 헤더(`(2026-09-25)`)를 붙이는 이 문서의 기존 관행을 그대로 따르고,
     "기각된 대안"·"근거" 하위 섹션 패턴도 유지한다.
4. **API 문서 규약(Swagger)**
   - `param-uuid-pipe-guard.ts` 가 `@WorkspaceParam` 을 모집단에 편입(파이프 축 구조적 충족, 문서 축만 검사)하도록
     갱신되어, 경로 워크스페이스 15곳이 UUID 계약 정적 가드의 사각지대로 빠지지 않는다 — 실제로 15곳 모두
     `@ApiParam({ name: 'id', format: 'uuid' })` 가 유지되어 있음을 확인했다(`workspaces.controller.ts` 14 ·
     `auth.controller.ts` 1, 누락 0).
   - `WorkspaceRole`(`add-member.dto.ts`)의 `WORKSPACE_ROLES` 배열이 `satisfies readonly WorkspaceRoleName[]` 로
     신설 서열 타입에 묶여, DTO enum 과 가드 서열이 한 원천에서 파생하도록 강제한다.
5. **금지 항목**
   - "opt-in 마커 재도입 금지"(1-auth.md 부트 캐너리 Rationale (b))와 신규 `@WorkspaceParam` 의 관계를
     `data-flow/12-workspace.md` 가 명시적으로 구분·해명한다(마커가 아니라 "값 바인딩 자체"라는 논증) — 과거
     기각된 패턴의 재도입이 아님을 spec 스스로 논증하고 있어 재검토 결과 문제없음.
   - "평범한 `@Param` 으로 워크스페이스 ID 를 받지 않는다"는 이번에 신설된 금지 항목이 저장소 가드
     (`workspace-param-binding`)로 즉시 강제되어, 문서상 선언에 그치지 않고 CI 로 뒷받침된다.

## 발견사항

### [INFO] 컨텍스트 예산 절단이 6개 규약 문서 원문을 가렸다
- target 위치: 프롬프트 번들 전체(`## 구현 변경 사항` diff 및 `2-api-convention.md`/`3-error-handling.md`/
  `13-replay-rerun.md`/`conventions/error-codes.md`/`conventions/swagger.md`/`data-flow/12-workspace.md`)
- 위반 규약: 해당 없음 — 검증 절차상 제약의 명시
- 상세: 번들 자체는 해당 6개 파일과 diff 본문을 "컨텍스트 예산 초과"로 생략했다. 이 라운드에서는 절대경로
  `Read`/`git -C ... diff` 로 전부 직접 열어 우회했으나, 다음 라운드가 이 사실을 놓치면 "번들에 없으니 문제
  없다"는 거짓 결론으로 이어질 수 있다.
- 제안: 조치 불요(이번 라운드는 직접 확인으로 커버). 향후 동일 스코프 재검토 시 절단 목록을 먼저 대조할 것.

### [INFO] `FORBIDDEN_MEMBER_ROUTE` 계열 상수의 재사용 범위가 컨트롤러 로컬
- target 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` 상단
  (`FORBIDDEN_MEMBER_ROUTE`/`FORBIDDEN_ADMIN_ROUTE`/`FORBIDDEN_OWNER_ROUTE`)
- 위반 규약: 없음 — 형식 일관성 제안
- 상세: 이 세 상수는 `auth.controller.ts`(전환 라우트)·`executions.controller.ts`(rerun)에서 유사한 문구를
  각자 인라인 문자열로 반복한다(`'대상 워크스페이스의 멤버가 아님(NOT_A_MEMBER)'` 류). 기능상 불일치는
  없으나(코드·의미 모두 일치), 컨트롤러 3곳이 같은 문구를 각자 하드코딩하고 있어 코드명이 바뀌면 세 자리를
  손으로 동기화해야 한다.
- 제안: 조치 불요(현재 문구는 서로 정합). 향후 `@Roles()` 거부 문구가 또 바뀌면 공용 상수 모듈
  (예: `common/decorators` 또는 `common/constants/workspace-roles.ts`)로 승격을 고려.

CRITICAL/WARNING 없음.

## 요약

이번 PR(경로 파라미터 워크스페이스 인가 가드화 + 가드 거부 오류 코드 부여)은 `spec/conventions/error-codes.md`
의 `UPPER_SNAKE_CASE`·안정성·historical-artifact 등재 규율, `spec/conventions/swagger.md` 의 `@ApiForbiddenResponse`·
`@ApiParam({format:'uuid'})` 체크리스트, CLAUDE.md 의 plan frontmatter·spec 문서 구조 관행을 모두 코드·spec·정적
가드 3중으로 일치시켰다. 신규 데코레이터(`WorkspaceParam`)·상수(`workspace-roles.ts`)·repo-guard 트리플은 기존
명명·구조 패턴을 그대로 계승하며, `forbidden`(lowercase) 코드 제거 등 레지스트리 정정도 실측(발행처 0건)으로
뒷받침된다. 독립 재검토에서 새로운 CRITICAL/WARNING 을 발견하지 못했다.

## 위험도

NONE
