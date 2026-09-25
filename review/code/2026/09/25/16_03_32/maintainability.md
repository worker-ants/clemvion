# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `@ApiForbiddenResponse` 설명 문자열이 8곳에 글자 그대로 중복
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:130, 161, 331, 362, 417, 457, 506, 551`
  - 상세: `'워크스페이스 멤버가 아님(NOT_A_MEMBER) 또는 Admin 이상 권한 필요(ADMIN_REQUIRED)'` 라는 동일한
    문자열이 `update` · `updateSettings` · `addMember` · `updateMember` · `listInvitations` ·
    `createInvitation` · `resendInvitation` · `revokeInvitation` 8개 핸들러의 `@ApiForbiddenResponse`
    에 그대로 반복된다. 종전에는 각 핸들러가 서로 다른 요약 문구("권한 부족 (Admin+)" 등)를 썼는데, 이번
    변경이 문구를 통일하면서 중복을 만들었다. `RolesGuard` 의 거부 메시지가 다시 바뀌면(이번 PR 이 실제로
    그런 경우다 — `roles.guard.ts` 의 `NOT_A_MEMBER`/`ROLE_REQUIRED` 문구가 소스) 8곳을 손으로 동기화해야
    하고, 하나라도 놓치면 Swagger 문서와 실제 응답이 갈린다.
  - 제안: `const FORBIDDEN_MEMBER_OR_ADMIN = '...'` 같은 모듈 상수(또는 공용 swagger 헬퍼)로 추출해 8곳이
    같은 값을 참조하게 한다. `remove`/`transferOwnership` 의 `OWNER_REQUIRED` 계열 문구도 동일 패턴이라
    함께 정리할 수 있다.

- **[INFO]** `@ApiForbiddenResponse` 설명 한 줄에 서로 다른 계층(가드·서비스)의 에러코드를 임시 구두점으로 나열
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:277-280`(`reRun`), `:307-310`(`getChain`)
  - 상세: `'워크스페이스 멤버가 아님(NOT_A_MEMBER) · editor 이상 권한 필요(EDITOR_REQUIRED) — RolesGuard /
    타인 실행이고 Owner·Admin 아님(RERUN_PERMISSION_DENIED, RR-PL-06) — 서비스'` 처럼 `·`·`—`·`/` 를
    섞어 두 계층(가드/서비스)의 서로 다른 실패 사유를 한 문자열에 눌러 담았다. 정보 자체는 정확하지만
    구분자가 임의적이라 Swagger UI 에서 읽는 사람이 파싱하기 어렵다.
  - 제안: 문서 텍스트라 위험도는 낮지만, 계층별로 줄바꿈하거나 `description` 을 배열/템플릿으로 조립하는
    편이 다음에 항목을 추가·수정할 때 더 안전하다.

- **[INFO]** `handlerConsumesWorkspaceId` / `workspaceParamNamesOf` 가 메타데이터 조회 보일러플레이트를 그대로 복제
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts:62-81`, `:124-140`
  - 상세: 두 함수 모두 "`methodName = handler.name` → 없으면 빈 값 반환 → `Reflect.getMetadata(ROUTE_ARGS_METADATA, ...)` → 없으면 빈 값 반환" 을 각자 다시 쓴다. 팩토리 identity 비교 대상만 다를 뿐 앞부분 5줄이 완전히 같다. 지금은 둘 다 파일 안에 있어 눈에 보이지만, 세 번째 팩토리(예: 미래의 다른 컨텍스트 소스)가 추가되면 같은 코드가 세 번 복제된다.
  - 제안: `routeArgsMetadataFor(controllerClass, handler)` 같은 private 헬퍼로 공통 부분만 추출하면 `ROUTE_ARGS_METADATA` 조회 방식이 바뀔 때 한 곳만 고치면 된다. 다만 이 파일의 docstring 이 "같은 reflection 이다" 라고 이미 명시적으로 관계를 설명하고 있어 우선순위는 낮다.

- **[INFO]** `decoratorCallName` 헬퍼가 새 가드 파일에 그대로 재복제됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts:48-54` (신규) vs 기존 `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:66-72`
  - 상세: 4줄짜리 `decoratorCallName` 함수(데코레이터 호출 이름 추출)가 두 가드 파일에 글자 그대로 동일하게 존재한다. `toPosixRelative` 는 이미 공용 `source-scan.ts` 에서 import 하면서, 이 헬퍼만 각 가드가 따로 갖는다.
  - 제안: 이 저장소는 형제 가드 간 의도적 미러링(`review/code` 이력의 cafe24/makeshop 사례처럼 "가드 독립성" 을 위해 중복을 허용하는 관례)이 있으므로 강하게 요구하지는 않지만, 이 함수처럼 도메인 지식이 전혀 없는 순수 AST 유틸은 `source-scan.ts` 로 옮겨도 가드 간 독립성을 해치지 않는다. 다음에 세 번째 가드가 필요해지면 옮기는 것을 고려할 만하다.

- **[INFO]** JSDoc 한 줄이 문단 내 다른 줄 대비 유난히 김 (줄바꿈 누락)
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:126` (167자 — 같은 문단의 다른 줄은 71~110자)
  - 상세: `* 워크스페이스와 무관한 전역 API(예: system-status). handlerConsumesWorkspaceId · workspaceParamNamesOf 로 실제 소비 여부를 reflection 확인한다. 이 예외가 없으면 FE apiClient 가 습관적으로 모든 요청에 붙이는` 한 줄이 나머지 줄보다 훨씬 길게 이어져 있다. prettier 가 주석 본문을 재배치하지 않는 설정이라 생긴 것으로 보이나, 같은 블록 안에서 줄 길이가 들쭉날쭉해 가독성이 떨어진다.
  - 제안: 다음에 이 문단을 편집할 때 한 번만 재배치하면 된다. 기능에 영향 없는 순수 스타일 이슈.

## 요약

이번 변경은 보안에 민감한 인가 로직(`RolesGuard`, `WorkspaceParam`)을 다루면서도 유지보수성 관점에서 전반적으로 높은 완성도를 보인다. `canActivate` 를 `checkRequestContext`/`assertMember` 사설 메서드로 분리해 순환 복잡도를 낮춘 점, 새 리포지토리 가드(`workspace-param-binding-guard.ts`)가 기존 `param-uuid-pipe-guard.ts` 와 동일한 구조(위반/스캔 카운트 분리, AST 기반 판정, 대조군 fixture)를 정확히 재사용한 점, 테스트 파일에서 `expectForbidden`/`expectRoleOutcome`/`pathContext` 같은 헬퍼로 반복되는 단언 패턴을 잘 추출한 점은 모두 이 저장소의 기존 컨벤션과 일관된다. 다만 `workspaces.controller.ts` 에 새로 도입된 `@ApiForbiddenResponse` 설명 문자열이 8곳에 완전히 동일하게 하드코딩되어 있어(WARNING), 가드 메시지가 다시 바뀌면 이번처럼 여러 곳을 손으로 동기화해야 하는 위험이 남는다. 그 외 지적은 전부 INFO 수준의 사소한 중복·스타일 이슈로, 병합을 막을 사안은 아니다.

## 위험도

LOW
