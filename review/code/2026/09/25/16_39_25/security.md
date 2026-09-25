# 보안(Security) 리뷰 — workspace-path-guard (2라운드)

## 개요

이 changeset 은 `RolesGuard` 가 경로 파라미터(`@WorkspaceParam`)로 전달되는 워크스페이스 ID를
인가 대상으로 인식하지 못하던 기존 CRITICAL 급 결함(경로 워크스페이스가 헤더·토큰 워크스페이스로
오판정됨 — 예: `transferOwnership`)을 구조적으로 닫는 **보안 강화 PR** 이다. 1라운드
(`review/code/2026/09/25/16_03_32`)에서 이미 security=NONE·INFO 2건으로 판정됐고, 그때 지적된
정적 가드 한계(INFO)는 문서화된 채로 유지되고 있다. 이번 2라운드에서 동일 changeset(25개 파일)을
독립적으로 재검토했다.

## 검증한 핵심 로직

- `codebase/backend/src/common/guards/roles.guard.ts` — `canActivate`: 경로 워크스페이스
  (`workspaceParamNamesOf`)와 헤더/토큰 워크스페이스(`handlerConsumesWorkspaceId`)를 분리해
  각각 멤버십 + 역할 계층을 판정한다. 경로 값은 `isUuidShaped` 형식 검사를 통과해야만 조회하고,
  실패하면 판정 없이 넘겨 `@WorkspaceParam` 내장 `ParseUUIDPipe`가 400을 낸다 — 가드는 파이프
  이전에 실행되므로(Nest 표준 파이프라인: Guard → Pipe → Handler) 형식 불량 값이 핸들러까지
  흐르지 않는다. 이 순서 의존은 명시적으로 문서화·테스트(`roles.guard.spec.ts`
  "가드는 파이프보다 먼저 돈다")됐다.
- `codebase/backend/src/common/decorators/workspace.decorator.ts` — `WorkspaceParam`이
  `ParseUUIDPipe`를 내장해 호출부가 빠뜨릴 수 없게 강제하고, `workspaceParamNamesOf`는
  `Object.hasOwn` 방식이 아니라 factory identity 비교라 프로토타입 오염 등에 영향받지 않는다.
- `codebase/backend/src/common/constants/workspace-roles.ts` — 역할 서열 단일 SoT.
  `workspaceRoleLevel('constructor')`처럼 프로토타입 체인 키를 `Object.hasOwn`으로 차단하는
  테스트가 있어 프로토타입 오염류 우회를 배제한다.
- `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 거부 코드가 워크스페이스의
  존재·유형을 노출하지 않는다 — `workspace-path-guard.e2e-spec.ts`가 팀·개인·부재 워크스페이스
  전부 동일한 `403 NOT_A_MEMBER`임을 실측하고, `workspaces.service.spec.ts`도 서비스 계층
  (가드가 깨졌을 때의 2차 방어선)에서 같은 오라클 차단을 별도로 고정한다.
- 정적 CI 가드 `workspace-param-binding`(신규)이 "워크스페이스 ID를 평범한 `@Param`으로 받는"
  패턴을 fail-closed(허용목록 없음)로 차단하고, 실측 대비 실제 컨트롤러 15곳이 전부
  `@WorkspaceParam`으로 전환됐음을 `workspace-roles-attachment.spec.ts`가 reflection으로
  고정한다(`grep` 확인 결과 `workspaces.controller.ts`의 `:id` 경로 파라미터 14곳 전부
  `@WorkspaceParam('id')`, `memberId`/`invitationId`는 워크스페이스가 아니므로 여전히
  평범한 `@Param` — 규칙과 일치).
- `authService.switchWorkspace`(서비스 계층)도 가드와 독립적으로 멤버십을 재검증해 방어-종심
  (defense-in-depth)이 실제로 두 계층에 있음을 확인(`auth.service.ts:1032` 부근).

## 발견사항

- **[INFO]** 정적 가드 `workspace-param-binding`의 판정은 이름 휴리스틱(`workspaceId` 또는
  `*WorkspaceId`로 끝나는 식별자/경로 이름)에만 의존한다. 향후 누군가 워크스페이스 ID를
  `@Param('id') id: string`처럼 규칙 밖 이름으로 바인딩하면 이 CI 가드는 놓친다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts` 함수
    `isWorkspaceIdName`
  - 상세: 문서 자체가 이 한계를 명시("이름이 규칙 밖(`id` 등)이면 못 본다")하고 있고, 1라운드
    리뷰에서도 이미 INFO로 지적·확인된 항목이라 새로운 결함은 아니다. 실질적 인가 판정은
    `RolesGuard`(런타임)가 하므로 이 CI 가드가 놓쳐도 즉시 취약점이 되는 것은 아니지만, "새 경로
    라우트가 생겨도 CI가 잡아준다"는 안전망 자체에는 사각지대가 남는다.
  - 제안: 조치 불요(이미 1라운드에서 수용된 알려진 한계). 후속으로 경로 패턴 기반(`Controller`의
    `@Get(':id/...')` 등에서 `:id`가 워크스페이스 리소스 계층 하위인지) 보강을 고려할 수 있으나
    현재 스코프의 필수 조건은 아니다.
- **[INFO]** `RolesGuard.assertMember`의 `ROLE_REQUIRED[threshold] ?? NOT_A_MEMBER` 폴백은
  `threshold`가 `viewer|editor|admin|owner` 밖의 문자열일 때만 닿는다(`@Roles()`는 코드베이스
  전체가 하드코딩된 리터럴이라 현재는 도달 불가). 인가 판정 자체는 여전히 거부(fail-closed)라
  보안 결함은 아니며, 다만 실제로 닿으면 원인(역할 오타)이 `NOT_A_MEMBER`로 잘못 표시된다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` `assertMember` 마지막 줄
  - 제안: 조치 불요 — 방어적 기본값이 안전한 방향(거부)이라 우선순위 낮음.

새로 도입된 취약점(인젝션, 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보
노출 등)은 발견하지 못했다. 오히려 이 changeset은 기존에 존재하던 실질적 cross-tenant 인가
우회 결함 클래스(경로 워크스페이스가 가드를 우회해 헤더/토큰 워크스페이스로 오판정되던 문제)를
닫는다.

## 요약

이번 changeset은 새로운 보안 취약점을 도입하지 않았고, 기존에 실재하던 CRITICAL 급 인가 결함
(경로 파라미터로 전달되는 워크스페이스 ID를 `RolesGuard`가 검증하지 못해 `@Roles('owner')`가
붙은 `transferOwnership` 등이 헤더/토큰 워크스페이스로 오판정되던 문제)을 구조적으로 닫는
보안 강화 변경이다. 가드는 파이프보다 먼저 실행된다는 NestJS 파이프라인 순서에 의존하는 지점이
있으나 이는 `@WorkspaceParam`이 `ParseUUIDPipe`를 강제 내장하는 설계와 결합해 안전하며, 단위
테스트·CI 정적 가드(fail-closed, 허용목록 없음)·e2e(존재/유형 오라클 차단 포함)가 삼중으로
뒷받침한다. 서비스 계층의 기존 인가 검사도 제거되지 않고 "가드 인식이 깨졌을 때의 2차 방어선"으로
의도적으로 유지된다. 1라운드에서 지적된 INFO 2건(정적 가드의 이름 휴리스틱 한계 등)은 이미
문서화된 채로 남아 있으며 이번 재검토에서도 새로운 CRITICAL/WARNING 급 보안 이슈는 확인되지
않았다.

## 위험도

NONE
