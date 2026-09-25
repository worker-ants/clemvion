# 유지보수성(Maintainability) Review

2라운드 리뷰. 1라운드(`review/code/2026/09/25/16_03_32`)의 Warning 8건은 `RESOLUTION.md` 에서 이미 처분됨(역할 서열 단일화 `workspace-roles.ts`, 403 설명 문자열 상수화 등) — 아래는 그 처분을 전제로 이번 diff(25개 파일)에서 새로 관측한 항목만 다룬다.

## 발견사항

- **[WARNING]** 가드 거부 코드·메시지 리터럴 테이블이 `RolesGuard` 와 `WorkspacesService` 에 각각 독립 존재 — 이번 PR 이 막 고친 것과 같은 종류의 중복
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:32-50` (`NOT_A_MEMBER`, `ROLE_REQUIRED` 상수) vs `codebase/backend/src/modules/workspaces/workspaces.service.ts:678-679`, `921-926`, `928-934`(`throwNotAMember`/`throwAdminRequired` 및 인라인 throw)
  - 상세: `roles.guard.ts` 의 새 `NOT_A_MEMBER = { code: 'NOT_A_MEMBER', message: '워크스페이스 멤버가 아닙니다.' }` 와 `ROLE_REQUIRED` 의 `Admin 이상의 권한이 필요합니다.`/`Owner 권한이 필요합니다.` 는 `workspaces.service.ts` 가 이미 리터럴로 갖고 있던 같은 문자열을 그대로 다시 타이핑한 것이다. 코드 자신의 docstring 이 "메시지는 서비스 계층과 같은 한국어다(`workspaces.service.ts` 의 `throwAdminRequired`)"라고 **명시적으로 결합을 인정**하면서도 공유 소스는 두지 않았다. e2e(`workspace-path-guard.e2e-spec.ts:286`)가 `res.body.error.message` 를 리터럴로 재확인하는 것도 같은 문자열의 세 번째 사본이다. 이 PR 은 정확히 같은 문제(역할 서열이 가드·두 서비스에 따로 있던 것, RESOLUTION W4)를 `common/constants/workspace-roles.ts` 로 해결했는데, 메시지·코드 테이블에는 같은 처방을 적용하지 않았다 — 한쪽 문구가 바뀌면 다른 쪽은 컴파일도 테스트도 못 잡고 조용히 갈라진다(둘은 "가드 인식이 깨졌을 때의 두 번째 선"이라는 이유로 *논리*는 의도적으로 독립시켰지만, 그것이 *문자열*까지 독립이어야 할 이유는 아니다).
  - 제안: `workspace-roles.ts` 옆에 `WORKSPACE_FORBIDDEN` 류의 code+message 상수 테이블을 두고 `roles.guard.ts` 와 `workspaces.service.ts` 양쪽이 그 값을 참조하게 한다. 판정 로직(멤버십 재조회 여부)은 여전히 두 곳에서 독립적으로 수행하되, "같은 실패는 같은 문구"라는 지금의 문서화된 불변식만 코드 레벨로 승격하면 된다.

- **[WARNING]** `decoratorCallName` 헬퍼가 두 repo-guard 파일에 동일하게 복제됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:65-72` 와 `codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts:47-54` (신규 파일)
  - 상세: 두 함수는 시그니처·구현이 글자 그대로 동일하다(`ts.isCallExpression(expr) ? expr.expression.getText(sf) : null`). 이 PR 이 새로 추가한 `workspace-param-binding-guard.ts` 는 형제 가드 `param-uuid-pipe-guard.ts` 를 명시적으로 참조하며 만들어졌음에도(`@WorkspaceParam` 인식 로직 등 여러 주석이 그쪽을 인용) 이 작은 유틸은 재사용하지 않고 다시 썼다. 이 저장소는 이미 두 가드가 공유하는 스캔 유틸 모듈(`common/__test-utils__/source-scan.ts` — `toPosixRelative`·`collectTsFiles`)을 갖고 있어, 같은 자리에 얹기 쉬운 구조다. AST 기반 repo-guard 가 늘어나는 추세(이번 PR 이 벌써 3번째)라 지금 추출하지 않으면 다음 가드가 세 번째 사본을 만들 가능성이 높다.
  - 제안: `decoratorCallName` 을 `common/__test-utils__/source-scan.ts` 로 옮기고 두 가드가 import 하도록 정리.

- **[INFO]** `assertMember` 라는 이름이 실제 책임(멤버십 **+ 역할 계층 판정**)을 온전히 드러내지 않음
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:220-237`
  - 상세: 함수의 docstring 은 "멤버십과 역할 계층을 판정하고, 거부면 코드를 실어 던진다"고 정확히 설명하지만, 이름 `assertMember` 만 보면 멤버십 존재 여부만 확인하는 함수로 오해하기 쉽다(실제로는 `requiredRoles` 를 받아 임계값 비교까지 한다). `checkRequestContext`(같은 파일, :191)도 내부에서 이 함수를 "역할까지 포함한" 의미로 호출한다.
  - 제안: `assertMembershipAndRole` 등으로 개명하거나, 최소한 호출부 주석에 "이름과 달리 역할까지 본다"를 한 번 더 못박아 두면 다음 리더가 docstring 을 건너뛰어도 오해하지 않는다.

- **[INFO]** `canActivate()` 의 경로-워크스페이스 분기가 여러 개별 파라미터를 순차 `await` 루프로 처리
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:165-179`
  - 상세: `pathParamNames` 가 둘 이상이면(`twoParams`/`twoPaths` 테스트 케이스처럼) `for...of` 안에서 `await this.assertMember(...)` 를 순차 실행한다. 로직 자체는 명확하고 테스트로 고정돼 있어 정확성 문제는 아니지만, 파라미터 수가 늘수록 요청 지연이 선형으로 늘어나는 모양이 코드 형태로 드러나지 않는다(주석에 "왜 순차인가"가 없다). 지금은 실사용 라우트가 전부 경로 워크스페이스 1개뿐이라 실질 영향은 없다.
  - 제안: 필요해지면 `Promise.all` 전환을 고려하되, 지금은 "순차인 이유(또는 순차여도 무방한 이유)" 한 줄만 주석으로 남겨도 다음 사람이 재론하지 않는다.

## 요약

이번 diff 는 보안 계층(`RolesGuard`)에 상당한 신규 분기(경로 워크스페이스 인가)를 추가하면서도 `canActivate` → `checkRequestContext` → `assertMember` 로 책임을 잘 쪼갰고, 각 분기·예외 자리마다 "왜"를 설명하는 docstring 이 붙어 있어 가독성 자체는 높다. 1라운드에서 지적된 역할 서열 중복은 `workspace-roles.ts` 로 깔끔히 해소됐다. 다만 그 DRY 처방이 메시지·코드 테이블까지 확장되지 않아 `roles.guard.ts` 와 `workspaces.service.ts` 사이에 새로운 리터럴 중복이 생겼고(문서로는 결합을 인정하면서 코드로는 분리), 신규 repo-guard 파일이 기존 형제 가드의 작은 유틸을 재사용하지 않고 복제했다. 둘 다 지금 당장 기능을 해치지는 않지만, 이 저장소가 스스로 세운 "단일 표에서 파생" 원칙을 절반만 적용한 모양이라 다음 변경에서 드리프트 위험이 남는다.

## 위험도

LOW
