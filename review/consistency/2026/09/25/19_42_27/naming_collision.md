# 신규 식별자 충돌 검토

## 검토 범위 확인

- scope(`spec/`) 델타: 0개 파일 — 이 브랜치는 spec 을 바꾸지 않는다(plan `spec_impact: none`, `plan/in-progress/workspace-guard-followups.md`). 요구사항 ID·API 계약·엔티티 정의를 새로 도입하는 변경이 아니라 "동작 불변 정리 5건"이다.
- 구현 diff: 8개 파일 / 291줄 (`git diff origin/main...HEAD -- codebase`, HEAD=워크스페이스-가드-팔로업 워킹트리). 신규 파일은 0개(`git diff --diff-filter=A --name-only origin/main...HEAD -- codebase` 결과 없음) — 파일 경로 충돌 관점은 적용 대상이 없다.

## 진단 대상 신규 식별자

diff 에서 실제로 새로 도입된 식별자는 두 개뿐이다(둘 다 `codebase/backend/src/common/decorators/workspace.decorator.ts` 파일 스코프, `export` 없음):

1. `interface RouteArgEntry` — `ROUTE_ARGS_METADATA` 파라미터 항목 타입
2. `function routeArgEntriesMatching(...)` — `handlerConsumesWorkspaceId` / `workspaceParamNamesOf` 공통 골격 헬퍼

나머지는 전부 **기존 식별자의 재사용/이동**이지 신규 도입이 아니다:

- `ADMIN_ROLES` — `integrations.service.ts` 의 모듈 로컬 상수를 삭제하고 이미 존재하던 `common/constants/workspace-roles.ts` 의 동명 export 로 교체(plan 요구 5, "값 같음"). 신규 식별자가 아니라 동명이인 통합.
- `NOT_A_MEMBER`, `ROLE_REQUIRED` — `workspace-roles.ts` 에 이미 있던 상수(선행 PR #1399). 이번 diff 는 `auth.controller.ts` · `executions.controller.ts` · `workspaces.controller.ts` 에 새 import 를 추가해 하드코딩 리터럴(`NOT_A_MEMBER`, `ADMIN_REQUIRED` 등 설명 문자열)을 코드 보간으로 바꿨을 뿐, 값도 문자열도 바뀌지 않는다.
- `FORBIDDEN_MEMBER_ROUTE` / `FORBIDDEN_ADMIN_ROUTE` / `FORBIDDEN_OWNER_ROUTE` — 기존 상수, 내부 리터럴만 보간식으로 교체.

## 관점별 확인

1. **요구사항 ID 충돌** — 해당 없음. spec 변경이 전혀 없어 신규 ID 부여 자체가 없다.
2. **엔티티/타입명 충돌** — `RouteArgEntry`, `routeArgEntriesMatching` 전수 grep(`grep -rn "RouteArgEntry\|routeArgEntriesMatching" codebase/`) 결과 정의부 외 참조가 `workspace.decorator.ts` 파일 내부(및 그 안의 docstring)뿐이다. 코드베이스 전체에 동명 타입·함수 없음 — 충돌 없음. 참고로 `--impl-prep`(INFO 2, `review/consistency/2026/09/25/19_06_16`) 이 "헬퍼 이름이 `extract*` 와 겹치지 않게" 주문했는데, 실제 이름 `routeArgEntriesMatching` 은 `extractWorkspaceId` / `extractWorkspaceParam` 계열과 형태·의미 모두 구분돼 그 우려를 충족한다.
3. **API endpoint 충돌** — 신규/변경 endpoint 없음. `@ApiForbiddenResponse` 의 `description` 문자열만 리터럴→보간으로 바뀌었고 값은 동일(문자열 바이트 단위로 종전과 같음 — plan CHANGELOG 판정 근거와 일치).
4. **이벤트/메시지명 충돌** — 해당 변경 없음(webhook·queue·sse 이벤트 미접촉).
5. **환경변수·설정키 충돌** — 해당 변경 없음.
6. **파일 경로 충돌** — 신규 파일 0개. 기존 8개 파일만 수정.

## 발견사항

없음. 이번 diff 는 신규 식별자를 사실상 도입하지 않는 리팩터(헬퍼 추출·상수 위치 통합·문자열 리터럴→코드 보간)이며, 유일한 두 신규 이름(`RouteArgEntry`, `routeArgEntriesMatching`)은 파일 스코프에 갇혀 있고 코드베이스 전체에 동명 사용처가 없다. `ADMIN_ROLES` 통합은 오히려 "동명이인 상수가 두 곳에 따로 존재"하던 잠재적 충돌 상태를 하나로 해소하는 방향이라 이 관점에서는 개선이다.

## 요약

target 변경분은 spec 델타 0(순수 코드 리팩터, `spec_impact: none`)이며, 구현 diff 8파일/291줄 중 신규 파일은 없고 신규로 도입된 식별자는 파일-로컬 타입 `RouteArgEntry` 와 함수 `routeArgEntriesMatching` 뿐이다. 전수 grep 으로 코드베이스 전체에서 동명 사용처가 없음을 확인했고, 그 외 재사용된 식별자(`ADMIN_ROLES`, `NOT_A_MEMBER`, `ROLE_REQUIRED` 등)는 모두 기존 정의를 그대로 참조/통합한 것으로 새로운 의미 충돌을 만들지 않는다. API endpoint·이벤트명·환경변수·spec 파일 경로 어느 축에서도 신규 도입이 없어 충돌 표면 자체가 발생하지 않는다.

## 위험도

NONE
