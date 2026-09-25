# 유지보수성(Maintainability) 리뷰 — 2026/09/25 18_19_47 (5라운드)

## 컨텍스트

이 changeset(`codebase/**` 30개 파일)은 경로 워크스페이스(`@WorkspaceParam`)를 `RolesGuard`
인가 대상에 포함시키고, 역할 서열·거부 코드를 `common/constants/workspace-roles.ts` 한 표로
합치는 작업이다. 이미 1~4라운드에서 유지보수성 관련 Warning(예: `decoratorCallName` 중복,
`ADMIN_ROLES`/`ROLE_HIERARCHY` 중복 정의, 인덱스드 액세스 타입)을 처분한 뒤라, 이번 라운드에서는
새 중복·과도한 복잡도·네이밍 문제를 찾는 데 집중했다.

## 발견사항

- **[INFO]** `RolesGuard.canActivate`가 세 관심사(미인증 단축·경로 파라미터 인가·헤더/토큰 컨텍스트
  인가 디스패치)를 한 메서드 안에서 처리해 분기가 조밀하다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:133` (`canActivate`, ~45줄)
  - 상세: `if(!userId)`, `pathParamNames.length > 0` 분기 안의 `for` 루프 + 형식 검사, 그리고
    `!needsRoleCheck && !consumesRequestContext()` 단축 통과까지 한 함수에 몰려 있다. 이후 로직은
    `checkRequestContext`(`:180`)·`assertMember`(`:209`)로 이미 잘 추출되어 있어 이 파일의 기존
    분해 패턴과 대칭을 이루려면 경로 파라미터 루프도 별도 private 메서드(예:
    `authorizePathParams`)로 뽑아내는 편이 `canActivate`의 분기 수를 줄이고 읽는 사람이 "이 함수가
    지금 어떤 라우트 유형을 다루는지"를 한눈에 보기 쉽게 한다.
  - 제안: 경로 파라미터 처리 블록(147~168행)을 `checkRequestContext`와 같은 층위의 private 메서드로
    분리. 동작 변경 없이 가독성만 개선하는 리팩터라 이번 라운드에서 급히 처리할 필요는 없다.

- **[INFO]** `throwOwnerTransferRequired`가 이웃 메서드들과 다른 객체 구성 방식을 쓴다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:933-938`
    (`throwOwnerTransferRequired`)
  - 상세: 같은 파일의 `throwNotAMember`(`:920-922`)와 `throwAdminRequired`(`:925-927`)는 모두
    `throw new ForbiddenException({ ...NOT_A_MEMBER })` / `{ ...ROLE_REQUIRED.admin }` 처럼 공유
    상수를 스프레드하는 한 가지 패턴을 쓰는데, `throwOwnerTransferRequired`만
    `code: ROLE_REQUIRED.owner.code`로 필드를 직접 꺼내 재조립한다. 결과는 동일하지만(메시지만
    다르므로) 세 헬퍼가 나란히 있는 자리에서 패턴이 갈리면 다음에 네 번째 헬퍼를 추가하는 사람이
    어느 쪽을 따라야 할지 애매해진다.
  - 제안: `{ ...ROLE_REQUIRED.owner, message: 'owner 이양은 현재 owner 만 수행할 수 있습니다.' }`로
    맞추면 세 헬퍼가 "표에서 code를 가져오고 필요하면 message만 오버라이드한다"는 하나의 패턴으로
    읽힌다.

- **[INFO]** 테스트 헬퍼 `buildGuard`의 `memberRole` 매개변수가 두 가지 서로 다른 의미(모든
  워크스페이스에 동일한 역할 vs 워크스페이스별 역할 맵)를 `typeof` 분기로 구분한다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.spec.ts:187`
    (`function buildGuard(memberRole: string | null | Record<string, string | null>)`)
  - 상세: 경로 워크스페이스 테스트가 늘면서 "어느 워크스페이스로 조회했는지"를 관측할 필요가
    생겨 합리적인 확장이고, 상단 docstring이 의도를 잘 설명한다. 다만 하나의 함수가 인자 타입에
    따라 동작을 바꾸는 형태라, 향후 세 번째 케이스(예: 콜백 기반 mock)가 필요해지면 분기가 더
    늘어날 수 있다.
  - 제안: 지금 당장 바꿀 필요는 없음(테스트 지원 코드이고 의도가 문서화돼 있음) — 세 번째 변형이
    필요해지는 시점에는 `buildGuard`/`buildGuardPerWorkspace` 두 헬퍼로 분리하는 편이 나을 수 있다.

## 긍정적으로 확인한 점 (참고용, 조치 불필요)

- `decoratorCallName`이 `source-scan.ts`로 이동해 `param-uuid-pipe-guard.ts`의 중복 정의가
  제거됐고, `workspace-param-binding-guard.ts`가 같은 헬퍼를 재사용한다 — 3~4라운드 Warning의
  정상 처분.
- `ADMIN_ROLES` · `NOT_A_MEMBER` · `ROLE_REQUIRED` · `WORKSPACE_ROLE_LEVEL`이
  `common/constants/workspace-roles.ts` 한 곳으로 모여 `RolesGuard` · `WorkspacesService` ·
  `WorkspaceInvitationsService` · `add-member.dto.ts` · frontend `role-gate.tsx`가 같은 표를
  참조한다(다만 frontend는 별도 상수 사본 유지 — 계층 간 경계상 불가피).
  `workspace-roles.spec.ts`가 DTO ↔ 서열 양방향 drift를 막는다.
  `workspaces.controller.ts`의 `FORBIDDEN_MEMBER_ROUTE`/`FORBIDDEN_ADMIN_ROUTE`/
  `FORBIDDEN_OWNER_ROUTE` 상수화도 같은 방향의 중복 제거.
- `workspace-param-binding-guard.ts`(신규)가 `param-uuid-pipe-guard.ts`와 동일한 구조 관례
  (violation + scanned count를 같은 루프에서 산출, vacuity floor, AST 기반 판정, 대조군 fixture)를
  일관되게 따른다 — 새 가드를 추가하는 다음 사람에게 명확한 템플릿이 된다.
- 각 파일의 rationale 주석이 매우 상세하지만 전부 `spec/data-flow/12-workspace.md` §Rationale의
  구체 절 제목을 인용해 SoT를 코드가 아니라 spec에 두므로, 코드-스펙 간 설명 중복이 drift 위험으로
  이어지지 않는다.

## 요약

이번 changeset은 경로 워크스페이스 인가라는 cross-cutting 변경을 가드·서비스·컨트롤러·DTO·
frontend·저장소 가드·e2e 전반에 일관된 네이밍(`WorkspaceParam`/`workspaceParamNamesOf`)과 단일
진실 상수 표(`workspace-roles.ts`)로 통일감 있게 반영했다. 이전 라운드에서 지적된 중복(데코레이터
이름 판별 함수, 역할 서열 이중 정의)이 실제로 제거됐고, 새로 추가된 저장소 가드(`workspace-param-binding-guard.ts`)도 기존 가드의 구조 관례를 그대로 따른다. 남은 항목은 모두 INFO 수준의 미세한
스타일 다듬기(`canActivate`의 경로 파라미터 분기를 별도 메서드로 뽑는 대칭성, 예외 헬퍼 하나의
객체 구성 방식 통일, 테스트 헬퍼 하나의 오버로드형 시그니처)로, 병합을 막을 이유가 되지 않는다.

## 위험도

LOW
