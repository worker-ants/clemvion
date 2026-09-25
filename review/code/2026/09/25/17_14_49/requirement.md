# 요구사항(Requirement) 리뷰 — workspace-path-guard (2026-09-25 17:14:49, 3라운드)

## 범위

`codebase/**` 27개 파일. 핵심 변경: `@WorkspaceParam('<name>')` 경로 파라미터 데코레이터 신설,
`RolesGuard` 가 경로 워크스페이스(15곳: `workspaces.controller.ts` 14 · `auth.controller.ts` 전환 1)의
멤버십·역할을 판정하도록 확장, 가드 거부에 코드(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/
`OWNER_REQUIRED`) 부여, 저장소 정적 가드 `workspace-param-binding` 신설, 부트 캐너리·`param-uuid-pipe`
가드의 `@WorkspaceParam` 인식 확장.

관련 spec: `spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다" ·
"가드 거부의 오류 코드" · "URL slug = FE 라우팅 SoT" · "`X-Workspace-Id` 헤더 vs `:id` 경로 파라미터",
`spec/conventions/error-codes.md` §3 (`admin_required` 행). 둘 다 2026-09-25 자로 이번 PR과 같은 시점에
갱신되어 있고, 코드와 line-level로 대조한 결과 아래처럼 정합했다.

## 교차검증 방법

1. `RolesGuard.canActivate`/`assertMember`/`checkRequestContext`의 모든 분기를 손으로 추적해 각
   테스트(단위 `roles.guard.spec.ts`, 통합 `workspace-roles-attachment.spec.ts`, e2e
   `workspace-path-guard.e2e-spec.ts`/`workspace-rbac.e2e-spec.ts`/`workspace-delete-concurrency.e2e-spec.ts`)와
   대조.
2. plan(`plan/in-progress/workspace-path-guard-impl.md`)의 뮤턴트 표(M1~M17, 전부 RED/KILLED)가 내가
   손으로 찾은 분기(경로 판별 유무, 형식 검사, `@Roles` 무시, 병용 핸들러 헤더 검사, 문턱 계산, 비멤버
   규칙, 다중 경로 이름, 정적 가드 이름 규칙)와 정확히 대응하는지 확인 — 대응함.
3. `workspaces.controller.ts`·`auth.controller.ts`의 15개 라우트 전수가 spec이 명시한 "Admin 8·Owner
   2·멤버만 4·전환 1" 분배와 실제 `@Roles()` 부착(`workspace-roles-attachment.spec.ts` 의
   `describe.each` 표)이 일치하는지 대조 — 일치함(admin 8, owner 2, null 5).
4. `CHANGELOG.md`의 두 Unreleased 항목이 실제 코드 변경(거부 코드 전역화, 15곳 경로 가드화, 정적 가드
   신설)과 정확히 대응하는지 확인 — 대응함.
5. `spec/conventions/error-codes.md` §3의 `admin_required` 행이 "2026-09-25 이후 HTTP로 나가지 않는다"고
   갱신돼 있고, 실제 `workspace-invitations.service.ts`의 `assertAdmin`이 여전히 소문자 코드를 내부
   두 번째 방어선으로 유지하는 것과 일치하는지 확인 — 일치함.
6. 정적 가드(`workspace-param-binding-guard.ts`, `param-uuid-pipe-guard.ts`)의 AST 판정 로직을 fixture
   테스트 기대값과 하나씩 대조(구조분해 바인딩 `boundNames`, `isWorkspaceIdName` 접미 규칙, `@WorkspaceParam`
   파이프 내장 처리) — 전부 일치.

## 발견사항

- **[INFO]** 경로 파라미터가 여럿(`@WorkspaceParam` 2개 이상)이면서 동시에 `@Roles()`가 붙은 라우트의
  동작은 코드상 동일한 `requiredRoles`를 각 경로 워크스페이스에 독립적으로 적용하지만(각자 멤버십+역할
  임계값 검사), 이 조합은 현재 실제 15개 라우트 어디에도 없고(`workspace-roles-attachment.spec.ts`가 15곳
  전부 `workspaceParamNamesOf(...) === ['id']` 단일 이름임을 고정) 단위 테스트의 `twoPaths` fixture도
  `@Roles()` 없는 형태만 검증한다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` (`canActivate` 내 `for (const name of pathParamNames)` 루프, 전체 파일 컨텍스트 156~163행)
  - 상세: 미래에 다중 경로 워크스페이스 + `@Roles()` 조합 라우트가 생기면 "각 워크스페이스에 대해
    동일 임계값을 독립 요구"라는 현재 동작이 의도인지 문서화된 바가 없다(`spec/data-flow/12-workspace.md`도
    단일 경로 워크스페이스 문장만 서술). 실제 결함은 아니며, 회귀도 아니다 — 오늘 도달 경로가 없다.
  - 제안: 실제로 이런 라우트가 생기기 전까지는 조치 불필요. 생긴다면 그때 spec Rationale에 "다중 경로
    워크스페이스 + `@Roles()`" 절을 추가하고 전용 단위 테스트를 붙일 것.

- **[INFO]** `workspace-delete-concurrency.e2e-spec.ts`에 추가된 docstring 단락("이긴 쪽이 커밋한 뒤에
  도착한 요청은 가드가 403 NOT_A_MEMBER로 막는다")은 이번 PR이 실제로 만드는 새로운 부수 효과에 대한
  타당한 추론이지만, 그 시나리오(레이스가 아니라 순수하게 커밋 이후 도착하는 단독 요청)를 직접 검증하는
  테스트는 이 diff에 없다.
  - 위치: `codebase/backend/test/workspace-delete-concurrency.e2e-spec.ts` (전체 파일 컨텍스트 24~28행)
  - 상세: 실제 테스트(`두 DELETE 가 겹치면...`)는 여전히 `[200, 404]`만 검증하고 있어 서술과 테스트
    범위가 정확히 일치하지 않는다. 코드 추적상 서술 자체는 맞다(가드의 `getMemberRole`이 `workspace`
    테이블 락과 무관한 `workspace_member` SELECT라 레이스 중엔 양쪽 다 멤버로 읽히고, 커밋 후 진짜
    지연 요청은 가드 단계에서 `NOT_A_MEMBER`로 막힌다).
  - 제안: 정보성 설명이라 차단 사유는 아님. 필요하면 후속 커밋에서 "커밋 후 지연 요청은 403" 케이스를
    별도 `it`으로 고정할 수 있다(선택 사항).

발견된 CRITICAL/WARNING 없음. 이전 2라운드(`16_03_32`, `16_39_25`)가 처리한 Warning 16건에 대한 재지적
거리도 없음.

## 세부 검증 근거 (요약)

- `RolesGuard.assertMember`의 "비멤버는 요구 역할과 무관하게 NOT_A_MEMBER, 멤버는 요구 역할 중 가장 낮은
  임계값" 규칙은 `spec/data-flow/12-workspace.md` §"가드 거부의 오류 코드" 표·문단과 line-level로 일치.
- `WorkspaceParam` 데코레이터의 `ParseUUIDPipe` 내장, 가드가 파이프보다 먼저 돌아 `isUuidShaped`만
  본다는 서술은 `roles.guard.ts` 213~230행 구현(`typeof raw !== 'string' || !isUuidShaped(raw)) continue`)과
  일치하고, e2e(`형식이 아닌 경로 값은 400, 형식은 맞는 nil UUID 는 403`)로도 고정됨.
- `workspace-param-binding-guard.ts`의 `isWorkspaceIdName`(정확히 `workspaceId` 이거나 `WorkspaceId`로
  끝남) 판정과 `boundNames`(구조분해 바인딩까지 추적)가 fixture의 4가지 위반 형태(`plainId`·`suffixed`·
  `routeNamed`·`destructured`)와 정확히 매칭되고, 대체재(`bound`)·헤더 컨텍스트(`headerContext`)·비-워크
  스페이스 이름(`otherId`)·복수형(`plural`)·비데코레이터(`undecorated`)는 정확히 제외됨.
- `workspaces.controller.ts`의 15개 라우트 역할 분배(Admin 8/Owner 2/멤버-only 4/전환 1)가 spec 문장
  ("Owner/Admin 요구 8곳은 `@Roles('admin')`, Owner 요구 2곳은 `@Roles('owner')`, 멤버면 되는 곳은
  `@Roles()` 없이")과 실제 diff의 데코레이터 부착 위치 전수가 일치.
- CHANGELOG 두 항목이 코드 변경(거부 코드 전역 적용 범위, 15곳 경로 가드화, 정적 가드 신설)을 빠짐없이
  반영.

## 요약

이번 diff는 `@WorkspaceParam` 경로 파라미터 인가를 `RolesGuard`에 새로 편입시키고 거부 코드를
전역화하는 변경으로, 핵심 로직(`RolesGuard.canActivate`/`assertMember`/`checkRequestContext`)의 모든
분기가 plan의 뮤턴트 표(M1~M17 전부 KILLED)와 실제 테스트(단위·통합·e2e)로 뒷받침되며, 관련 spec
(`spec/data-flow/12-workspace.md` §Rationale 두 절, `spec/conventions/error-codes.md` §3)과 line-level로
정합한다. 15개 경로 라우트의 역할 요구 분배, 정적 가드(`workspace-param-binding`)의 AST 판정, 부트
캐너리의 이중 카운트 로직, CHANGELOG 항목 모두 서로 및 spec과 어긋나지 않았다. 발견한 두 건은 모두
INFO(현재 도달 불가능한 조합에 대한 문서화 공백, 서술 대비 테스트 범위 미세 차이)로, 코드 fix나 spec
반영을 요구하지 않는다. TODO/FIXME/HACK/XXX 주석 없음. 요구사항 충족·spec fidelity 관점에서 이번 라운드는
수렴 상태로 판단된다.

## 위험도

NONE
