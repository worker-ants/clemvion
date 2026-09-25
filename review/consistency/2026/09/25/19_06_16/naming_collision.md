# 신규 식별자 충돌 검토 — workspace-guard-followups (--impl-prep)

## 범위 확인

target 으로 지정된 scratch 스코프(`.../prep2-scope/spec/{2-navigation/4-integration.md, 2-navigation/9-user-profile.md, 5-system/1-auth.md, data-flow/12-workspace.md}`)는
저장소의 동일 경로 spec 파일과 **바이트 단위로 동일**함을 `diff -q` 로 확인했다 — 이번 target 은 새 spec 내용을 도입하지 않고, `--impl-prep` 이 구현 착수 전
참조용으로 기존 spec 을 그대로 번들한 것이다. 실제 변경 단위는 `plan/in-progress/workspace-guard-followups.md` 의 요구 1~5 이며, 다섯 항목 모두
`spec_impact: none` — 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV/설정키·spec 파일 경로 중 **어느 것도 새로 도입하지 않는** 동작 불변 코드 리팩터다.
아래는 그럼에도 "새 식별자" 로 해석될 여지가 있는 항목들을 코드베이스에서 직접 확인한 결과다.

## 발견사항

- **[INFO]** 요구 5의 `ADMIN_ROLES` 통합은 신규 식별자가 아니라 기존 이름 충돌의 해소
  - target 신규 식별자: 없음 — 요구 5는 `modules/integrations/integrations.service.ts:112` 의 모듈 로컬 `const ADMIN_ROLES = new Set(['owner', 'admin'])` 를 삭제하고 `common/constants/workspace-roles.ts` 의 기존 export `ADMIN_ROLES`(`workspaces.service.ts`, `workspace-invitations.service.ts` 가 이미 사용 중)로 대체하는 것
  - 기존 사용처: `codebase/backend/src/common/constants/workspace-roles.ts:27` (`export const ADMIN_ROLES: ReadonlySet<string> = ...`), 그리고 그 docstring(3~6행)이 "종전엔 가드의 숫자 서열과 두 서비스의 `ADMIN_ROLES` 집합이 각자 따로 있었다" 고 이미 이 이름 충돌 이력을 명시함
  - 상세: 동일 이름 `ADMIN_ROLES` 가 이미 두 곳(공용 상수, `integrations.service.ts` 로컬 상수)에 다른 선언으로 존재하던 상태였다(값은 `{'admin','owner'}` 로 동일하지만 선언 위치·파생 방식이 달라 drift 위험이 있었음 — 이미 `workspace-roles.ts` docstring 이 이 문제를 인지하고 있다). 요구 5는 이 기존 충돌을 **새로 만드는 게 아니라 제거**하는 방향이므로 CRITICAL/WARNING 대상이 아니다
  - 제안: 별도 조치 불요. 구현 시 `integrations.service.ts` 의 import 가 `common/constants/workspace-roles.ts` 를 가리키는지, 로컬 선언이 완전히 제거됐는지만 코드 리뷰에서 확인

- **[INFO]** 요구 1의 신규 헬퍼는 아직 이름이 정해지지 않음 — 명명 시 기존 `extract*` 계열과 구분 필요
  - target 신규 식별자: `workspace.decorator.ts` 에 추가될 "메서드명 가드 → `ROUTE_ARGS_METADATA` 조회 → 팩토리 필터" 공용 헬퍼(plan 본문에 구체적 이름 미기재)
  - 기존 사용처: 같은 파일에 이미 `extractWorkspaceId`(16행) · `extractWorkspaceParam`(87행) · `handlerConsumesWorkspaceId`(62행) · `workspaceParamNamesOf`(124행) 가 있고, 저장소 부트 캐너리 `workspace-reflection-canary.ts` 가 이 둘의 판별 결과를 함께 검증함(plan 인용)
  - 상세: 실질 충돌은 없다 — 이름이 아직 없으므로 검사 대상이 없음. 다만 구현 시 `extractWorkspace*`(파라미터 팩토리, `createParamDecorator` 에 넘기는 함수) 접두어와 겹치는 이름을 새 헬퍼에 붙이면 "팩토리 함수" 와 "메타데이터 조회 헬퍼" 라는 서로 다른 역할이 이름으로 구분되지 않아 향후 유지보수 시 혼동 소지가 있다
  - 제안: 새 헬퍼 이름은 `extract*` 접두어를 피하고(예: `routeArgFactoriesMatching` · `findRouteArgFactory` 류의 "조회/필터" 의미 접두어) `handlerConsumesWorkspaceId`/`workspaceParamNamesOf` 가 그 위에 `some`/`map` 만 얹는 얇은 래퍼임이 이름에서 드러나게 할 것을 권장(강제 아님, INFO)

- 요구 2(`FORBIDDEN_*_ROUTE` 코드 보간), 3(`throwOwnerTransferRequired` 스프레드), 4(docstring 정정) — 모두 기존 식별자(상수명·메서드명)를 그대로 두고 **값 산출 방식**만 바꾸는 변경이라 신규 식별자 충돌 관점에서 해당 없음. `auth.controller.ts:446` 의 인라인 `'대상 워크스페이스의 멤버가 아님(NOT_A_MEMBER)'` 도 이미 존재하는 문자열이며 새 이름을 만들지 않음

## 요약

이번 target 은 `spec_impact: none` 인 동작 불변 코드 리팩터 plan(`workspace-guard-followups.md`)이며, --impl-prep 번들의 spec 4개는 기존 파일과 바이트 동일해 새 spec 식별자를 전혀 도입하지 않는다. 요구 1~5 중 새 이름을 만드는 것은 요구 1(헬퍼, 미명명)뿐이고 요구 5(`ADMIN_ROLES`)는 오히려 기존에 이미 존재하던 동일-이름 이중 선언을 통합해 없애는 방향이라 CRITICAL/WARNING 소지가 없다. 신규 식별자 충돌 관점에서 이 plan 은 안전하게 착수 가능하다.

## 위험도

NONE
