# 요구사항(Requirement) Review — workspace-path-guard (5라운드)

## 검증 방법

프롬프트의 unified diff·전체 컨텍스트를 읽고, 프롬프트 크기 제한으로 생략된 파일은 `Read` 로 직접 열어
확인했다. 추가로 저장소를 **뮤테이션하지 않는 범위**에서:

- `spec/data-flow/12-workspace.md` §Rationale "멤버십 검증은 가드 1곳에서" · "경로 파라미터 워크스페이스도
  가드가 본다" · "가드 거부의 오류 코드" 를 원문 그대로 읽어 코드와 line-level 대조.
- `spec/conventions/error-codes.md` §3 을 읽어 `workspace-invitations.service.ts` 의 소문자
  `admin_required` 잔존이 문서화된 의도인지 확인.
- `node --experimental-vm-modules jest` 로 변경된 스펙 전부 실행: `roles.guard.spec.ts` ·
  `workspace.decorator.spec.ts` · `workspace-reflection-canary.spec.ts` · `workspace-roles.spec.ts` ·
  `source-scan.spec.ts` · `param-uuid-pipe.spec.ts` · `workspace-param-binding.spec.ts` ·
  `workspace-roles-attachment.spec.ts` · `workspaces.service.spec.ts` · `auth.service.spec.ts` ·
  `auth.controller.spec.ts` · `workspace-invitations.service.spec.ts` · `workspaces.controller.spec.ts` ·
  `executions.controller.spec.ts` → **9+5 스위트, 295+151건 전부 PASS**.
- `npx nest build` (타입체크 ratchet 포함) → **EXIT 0**.
- `grep -c '@WorkspaceParam(' workspaces.controller.ts` + `auth.controller.ts` → **14 + 1 = 15**,
  spec·plan·CHANGELOG 가 주장하는 숫자와 정확히 일치. `grep "@Param('id'"` 잔존 0건(전환 완료 확인).
- 변경 30개 파일 전체에서 `TODO|FIXME|HACK|XXX` grep → **0건**.
- 읽기 전용 명령만 실행했고(`jest`, `nest build`, `grep`, `Read`), 저장소 파일은 쓰지 않았다. 종료 시
  `git status --short` 로 재확인 — untracked 는 이 리뷰 세션의 산출 디렉터리(`review/code/.../18_19_47/`)뿐,
  코드 트리에 잔여물 없음.

## 발견사항

이번 라운드에서 새로운 Critical/Warning 은 찾지 못했다. 4라운드 동안 처분된 30건의 Warning 을 다시 열
근거도 찾지 못했다 — `NOT_A_MEMBER`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`/`EDITOR_REQUIRED` 코드 분리,
`assertMember`/`checkRequestContext`/`assertMembership`/`assertAdmin` 의 인가-선행 순서, 경로 다중
파라미터 처리, 가드-파이프 순서(형식 불량 skip vs nil UUID 조회), `workspace-param-binding`/
`param-uuid-pipe` 가드의 모집단 정합성, 부트 캐너리의 두 팩토리 분리 집계까지 모두 spec 본문·구현이
line-level 로 일치하며 뮤테이션 테이블(M1~M17·R1~R5·S1~S4·T1~T4)이 각 분기를 실제로 가른다.

- **[INFO]** `codebase/backend/src/modules/workspaces/workspaces.controller.ts` 의 `removeMember` 는
  `@Roles()` 를 붙이지 않아 가드는 멤버십만 본다(타인 제거의 Admin 요구는 서비스 `assertAdmin` 이 두 번째
  선으로 판정). 이는 spec 표("멤버 4곳: `getSettings`·`leave`·`listMembers`·`removeMember`")와
  `workspace-roles-attachment.spec.ts` 의 `[WorkspacesController, 'removeMember', null]` 고정 테스트에
  정확히 부합하는 **의도된 설계**다 — 결함이 아니라 근거를 확인한 기록으로 남긴다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (`removeMember` 핸들러, diff 라인 396 부근) · 근거: `spec/data-flow/12-workspace.md` "경로 파라미터 워크스페이스도 가드가 본다" 절 ("Owner/Admin 요구 8곳 …, 멤버면 되는 곳은 `@Roles()` 없이").
- **[INFO]** `workspace-invitations.service.ts::assertAdmin` 은 여전히 비멤버·역할 미달을 구분하지 않고
  소문자 `admin_required` 단일 코드를 던진다(반면 `workspaces.service.ts::assertAdmin` 은 이번 PR 에서
  `NOT_A_MEMBER`/`ADMIN_REQUIRED` 로 분리됐다). 이 코드는 HTTP 경로에서 더는 도달하지 않는다(초대 라우트가
  이제 `@Roles('admin')` 로 가드가 먼저 막는다)는 것을 코드 주석과 `spec/conventions/error-codes.md §3`
  등재 문구("2026-09-25 이후 `admin_required` 는 HTTP 로 나가지 않는다")가 명시적으로 확인해 준다 — 불일치가
  아니라 문서화된 dead-second-line 이다.
  - 위치: `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` (`assertAdmin`, diff 라인 539 부근) · spec: `spec/conventions/error-codes.md` §3 표 `admin_required` 행.

## 요약

경로 파라미터로 워크스페이스를 받는 15개 라우트(`workspaces.controller.ts` 14 · `auth.controller.ts`
전환 1)를 `@WorkspaceParam`/`RolesGuard` 로 흡수하고, 가드 거부에 `NOT_A_MEMBER`/`EDITOR_REQUIRED`/
`ADMIN_REQUIRED`/`OWNER_REQUIRED` 코드를 부여하며, 역할 서열·거부 본문을 `common/constants/
workspace-roles.ts` 한 표로 통합한 변경이다. spec(`data-flow/12-workspace.md`)의 요구사항 ID·행위
명세·표·Rationale 이 코드의 함수 시그니처·에러 코드·기본값·검증 순서와 line-level 로 일치하며,
비멤버 우선 판정("나" 규칙)·존재/유형 오라클 제거(leaveWorkspace·addMemberByEmail·transferOwnership
3곳 전부)·가드-파이프 순서(형식 불량 skip → 400, nil UUID 조회 → 403)·저장소 가드의 모집단 보존
(136 유지) 등 세부 요구가 전부 구현·테스트로 커버된다. 새로 실행한 9개 unit/9개 통합 스펙 스위트
(446 테스트)와 `nest build` 타입체크가 모두 통과했고, TODO/FIXME 류 미완성 표식은 없다. 4라운드에서
처분된 30건의 Warning 을 재론할 근거를 찾지 못했으며, 이번 라운드에서 발견한 두 항목은 모두 spec·테스트로
뒷받침되는 의도된 설계(INFO)다.

## 위험도

NONE
