# 부작용(Side Effect) 리뷰 — review/code/2026/09/25/17_47_18 (4라운드)

## 컨텍스트

이 changeset(`codebase/**` 28개 파일)은 1~3라운드에서 이미 Critical 0 · Warning 22건이 조치된
`workspace-path-guard` 작업의 4라운드 재검토다. 본 리뷰는 그 22건 중 부작용 관점과 겹치는 항목
(1라운드 W1 — 전역 403 코드 변경 announce, W2/W7 — 가드+서비스 이중 조회 비용, 2라운드 W2 — 거부
본문 통합, W3 — `decoratorCallName` 중복, W6 — `@Roles()` 인자 타입 좁히기)이 이미 **고침/의도
주석/실측 근거**로 처분됐음을 `RESOLUTION.md` 3건에서 확인한 뒤, 그 처분을 재반박할 새 근거가
있는지와 이번 diff에 남아 있는 추가 부작용을 점검했다.

## 발견사항

- **[INFO]** `RolesGuard` 거부 응답 본문이 `@Roles()` 또는 `@WorkspaceId()`를 쓰는 **기존 라우트
  전체**(2026-08-08 실측 73건 포함, `@Roles()` 라우트까지 합치면 더 넓음)에서 `false`(Nest 기본
  `403 Forbidden`)에서 `{code, message}`를 실은 `ForbiddenException`으로 바뀐다 — 새 경로 전용이
  아니라 시스템 전역의 인터페이스 변경이다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` (`RolesGuard.assertMember`,
    `RolesGuard.checkRequestContext`)
  - 상세: 이미 1라운드 W1·2라운드 W2에서 지적·처분됨(고침 + CHANGELOG 고지 + spec Rationale
    "가드 거부의 오류 코드"). frontend 소스를 재확인한 결과 `code === 'FORBIDDEN'` 또는 이 라우트들의
    `ADMIN_REQUIRED`를 분기하는 코드는 없었다(grep 0건) — 처분이 유효함을 재확인했을 뿐 새 결함은
    아니다.
  - 제안: 조치 불필요. 외부(비-frontend) API 소비자가 있다면 CHANGELOG의 "error.code 로 분기하는
    클라이언트는 확인할 것" 문구로 이미 고지됨.

- **[INFO]** 경로 워크스페이스 라우트(`@WorkspaceParam`) 15곳은 `@Roles()` 유무와 무관하게 **매 요청
  `getMemberRole` DB 조회**가 새로 강제된다 — 종전에는 `@Param('id')`라 `handlerConsumesWorkspaceId`가
  false여서 가드 조회 자체가 없었다(서비스 계층에만 있었음).
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:154-168`(경로 게이트 기준,
    `canActivate`의 `pathParamNames.length > 0` 분기)
  - 상세: 1라운드 W2·W7에서 "PK 유니크 인덱스 조회 1회·저빈도 관리 라우트"로 이미 비용을 실측·수용함.
    새로 추가된 부담이 아니라 기존 처분의 연장선이다.
  - 제안: 조치 불필요.

- **[INFO]** `ADMIN_ROLES`(`common/constants/workspace-roles.ts`)가 종전에는 파일마다 지역
  `new Set([...])`였는데 이제 `RolesGuard`(간접, `roleLevel` 경유) · `WorkspacesService` ·
  `WorkspaceInvitationsService`가 **같은 모듈 싱글턴**을 import한다. 타입은 `ReadonlySet<string>`이지만
  `Object.freeze()`는 없다 — 런타임에 캐스트 후 `.add()/.delete()`로 뮤테이션하면 세 소비처 전부가
  동시에 오염된다(종전엔 지역 복사본이라 한 파일 오염이 다른 파일에 안 샜다).
  - 위치: `codebase/backend/src/common/constants/workspace-roles.ts` (`ADMIN_ROLES`,
    `NOT_A_MEMBER`, `ROLE_REQUIRED` 상수 선언부)
  - 상세: 이번 diff의 실제 소비 코드는 전부 `{ ...NOT_A_MEMBER }` / `{ ...ROLE_REQUIRED[...] }`
    스프레드로 던지고, `ADMIN_ROLES`는 `.has()`만 호출한다 — 현재 코드 경로에는 뮤테이션이 없다.
    잠재적 위험이며 이번 PR이 만든 새로운 결함은 아니다(같은 무-freeze 관행이 이 저장소의 다른
    공유 상수에도 이미 있다).
  - 제안: 조치 불필요(INFO). 후속으로 넓히려면 `Object.freeze()` 부여를 고려할 수 있으나 이 PR
    스코프는 아니다.

- **[INFO]** `countWorkspaceIdConsumingRoutes` → `countWorkspaceConsumingRoutes` 개명 + 반환 타입이
  `number` → `WorkspaceConsumingRouteCount`(object)로 변경됐다 — 시그니처 변경.
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`
    (`countWorkspaceConsumingRoutes` 정의부)
  - 상세: 저장소 전체에서 이 함수의 유일한 소비처는 같은 파일의 `assertWorkspaceIdReflectionWorks`와
    그 스펙 파일뿐임을 grep으로 확인했다(`codebase/` 전체에 구 이름 잔존 0건). 부트 진입점
    `main.ts:192`가 호출하는 `assertWorkspaceIdReflectionWorks`는 시그니처(`(app, logger?) => number`)가
    그대로라 외부 호출자 영향 없음.
  - 제안: 조치 불필요.

## 요약

이번 changeset의 핵심 부작용은 (1) `RolesGuard`의 거부 응답 본문이 시스템 전역에서 코드를 싣는
형태로 바뀐 것과 (2) 경로 워크스페이스 15개 라우트에 매 요청 DB 조회가 새로 추가된 것인데, 둘 다
1~3라운드에서 이미 발견·처분(고침 + 문서화 + CHANGELOG 고지 + 실측 근거)됐고 이번 재확인(grep
기반 frontend 의존성 점검 포함)에서 그 처분을 뒤집을 새 근거는 없었다. 함수 시그니처 변경
(`countWorkspaceIdConsumingRoutes` 개명)은 소비처가 파일 내부로 닫혀 있어 외부 영향이 없고, 부트
캐너리(`assertWorkspaceIdReflectionWorks`)의 공개 시그니처는 보존됐다. `ADMIN_ROLES` 등 공유 상수가
freeze 없이 여러 모듈에 싱글턴으로 노출된 점은 잠재적 저위험 관찰 사항으로 INFO에 남긴다. 새로운
Critical/Warning 급 부작용은 발견하지 못했다.

## 위험도

LOW
