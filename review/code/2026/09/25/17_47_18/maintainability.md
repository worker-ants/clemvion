# 유지보수성(Maintainability) 리뷰 — review/code/2026/09/25/17_47_18 (4라운드)

4라운드(전수 `--route=all`). 1~3라운드에서 지적된 Warning 22건은 각 라운드 `RESOLUTION.md` 로 이미 처분됨 —
역할 서열 단일화(`workspace-roles.ts`), 거부 코드·메시지 상수 공유(`NOT_A_MEMBER`/`ROLE_REQUIRED`),
`decoratorCallName` 통합(`source-scan.ts`), `@Roles` 타입 좁히기, 서비스 계층 비멤버 판정을
`NOT_A_MEMBER`로 분리(3라운드 W1, `dc60b1af8`) 등을 코드에서 직접 재확인했다. 아래는 그 처분을
전제로, 이번 라운드에서 남아 있거나 새로 관측한 항목만 다룬다.

## 발견사항

- **[INFO]** `handlerConsumesWorkspaceId` / `workspaceParamNamesOf` 가 메타데이터 조회 보일러플레이트를 여전히 복제 (1라운드 INFO 재확인 — 미조치)
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts:62`~`82` (`handlerConsumesWorkspaceId`) 와 `:124`~`140`(`workspaceParamNamesOf`)
  - 상세: 두 함수 모두 "`methodName = handler.name` → 없으면 빈 값 반환 → `Reflect.getMetadata(ROUTE_ARGS_METADATA, controllerClass, methodName)` → 없으면 빈 값 반환" 앞부분 5줄이 글자 그대로 같고, 팩토리 identity 비교 대상만 다르다. 1라운드(`review/code/2026/09/25/16_03_32`)에서 이미 INFO로 지적됐고 이후 라운드에서 손대지 않은 채 그대로 남아 있다. 지금은 두 함수가 같은 파일에 있어 한눈에 대칭이 보이지만, 세 번째 컨텍스트 소스(예: 쿼리 파라미터 워크스페이스)가 추가되면 같은 5줄이 세 번째로 복제된다.
  - 제안: 우선순위는 여전히 낮다 — 두 함수 docstring이 "같은 reflection이다"라고 관계를 이미 명시하고 있어 즉시 조치 불요. 세 번째 팩토리가 생기는 시점에 `routeArgsMetadataFor(controllerClass, handler): Record<string, {factory?: unknown; data?: unknown}> | undefined` 같은 private 헬퍼로 추출할 것.

- **[INFO]** `RolesGuard.canActivate()`의 경로 워크스페이스 분기가 헤더/토큰 분기와 비대칭적으로 인라인화 (3라운드 INFO 재확인 — 미조치)
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:156`~`167` (`canActivate` 내부, `pathParamNames.length > 0` 블록)
  - 상세: 헤더·토큰 컨텍스트 검증은 `checkRequestContext`(사설 메서드, :180)로 추출됐는데 경로 파라미터 루프는 `canActivate` 본문에 그대로 남아 있다. 뮤테이션 테스트로 잘 덮여 있어 정확성 문제는 아니며, 3라운드에서도 "지금 당장 필수는 아님"으로 낮췄던 항목이다. 코드 형태가 바뀌지 않았으므로 판정도 동일하게 유지한다.
  - 제안: 여전히 즉시 조치 불요. 셋째 컨텍스트가 생기는 시점에 `checkPathWorkspace(...)`로 대칭 추출을 고려.

- **[INFO]** `assertMember`라는 이름이 실제 책임(멤버십 **+ 역할 계층 판정**)을 온전히 드러내지 않음 (2라운드 INFO 재확인 — 미조치)
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:209`~`230`
  - 상세: docstring은 "멤버십과 역할 계층을 판정하고, 거부면 코드를 실어 던진다"고 정확히 설명하지만 이름만 보면 멤버십 존재 확인 전용으로 오해하기 쉽다. 2라운드에서 지적된 뒤 코드 형태는 바뀌지 않았다.
  - 제안: `assertMembershipAndRole` 개명 또는 현행 유지 — 어느 쪽이든 지금 리뷰 라운드가 막을 정도는 아니다.

- **[INFO]** `WorkspacesController`의 `@ApiForbiddenResponse` 설명 문자열과 `RolesGuard`/`workspace-roles.ts`의 실제 런타임 메시지가 표현이 다름
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` 상단 `FORBIDDEN_MEMBER_ROUTE`/`FORBIDDEN_ADMIN_ROUTE`/`FORBIDDEN_OWNER_ROUTE` 선언부(`const FORBIDDEN_MEMBER_ROUTE = '워크스페이스 멤버가 아님(NOT_A_MEMBER)';` 등)
  - 상세: 이 상수들은 Swagger 문서용 설명이고, 실제 `ForbiddenException` 본문 메시지(`workspace-roles.ts`의 `NOT_A_MEMBER.message = '워크스페이스 멤버가 아닙니다.'` 등)와는 문구가 다르다. 코드 자체가 요구하는 계약은 "코드가 같다"이지 "문서 설명 문장이 런타임 메시지와 동일해야 한다"가 아니므로 결함은 아니다. 다만 라우트마다 상수를 공유하도록 정리한 이번 리팩터의 취지(코드 변경 시 한 곳만 고치면 되게)를 감안하면, 이 세 상수를 만들 때 `workspace-roles.ts`의 코드 값(`NOT_A_MEMBER.code` 등)을 문자열 안에 인라인하는 대신 참조했다면 코드 명이 바뀔 때 이 파일도 같이 컴파일 오류로 잡혔을 것이다.
  - 제안: 지금 문자열 3건 정도라 실익은 작다. 우선순위 낮음 — 조치 불요, 참고만.

## 요약

4라운드(전수 재검토) 기준, 이번 diff는 유지보수성 관점에서 양호한 상태를 유지하고 있다. 3라운드의
Warning(서비스 계층 `assertAdmin`이 비멤버에게 `ADMIN_REQUIRED`를 내던 규칙 위반)은 `assertMembership`/`assertAdmin`을
`throwNotAMember()` → `throwAdminRequired()` 순서의 두 단계로 명확히 분리하는 방식으로 깔끔하게
해소되었고(`workspaces.service.ts:932`~`949`), 이는 기존 형제 함수 `removeMember`(:831~849)와 같은 모양이라
저장소 관례와도 일관된다. `@WorkspaceId()` 소비 판별의 지연 계산(`consumesRequestContext` 클로저,
:151~152)과 `decoratorCallName` 직접 단위 테스트 추가도 이전 라운드 지적을 정확히 반영했다. 이번
라운드에서 새로 발견한 이슈는 없으며, 남은 항목은 전부 1~3라운드에서 이미 INFO로 낮춰 처리 불요로
판정된 것들이 코드 형태 변경 없이 그대로 남아 있음을 재확인한 것뿐이다(반복 재지적이 정당화되려면
새 근거가 필요하다는 원칙에 따라, 이번에도 판정을 그대로 유지하고 강도를 올리지 않았다). 기능적
결함이나 실질적인 복잡도 초과, 새로운 중복은 관측되지 않았다.

## 위험도

LOW
