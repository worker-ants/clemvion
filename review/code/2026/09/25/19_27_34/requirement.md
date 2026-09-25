# 요구사항(Requirement) 리뷰 — 경로 워크스페이스 가드 후속 (동작 불변 정리)

## 개요

대상 커밋(`097411779`)은 `#1399`(경로 파라미터 워크스페이스 가드)의 `/ai-review` 5라운드가 "수렴 예외"로 넘긴
W1·W2·INFO 4/6/8 항목을 정리하는 **동작 불변(behavior-preserving) 리팩터**다. `plan/in-progress/workspace-guard-followups.md`
에 `spec_impact: none` 으로 명시돼 있고, `--impl-prep`(`review/consistency/2026/09/25/19_06_16`, BLOCK: NO)도 이미
통과했다. 8개 파일 모두 확인했으며 `git diff origin/main..HEAD --stat -- codebase/` 로 스코프 이탈이 없음을 확인했다.

## 발견사항

- **[INFO]** 요구사항·구현 모두 확인 — 동작 회귀 없음
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts` (신규 `routeArgEntriesMatching` 헬퍼, 40-80줄대)
  - 상세: `handlerConsumesWorkspaceId` · `workspaceParamNamesOf` 의 "메서드명 가드 → `ROUTE_ARGS_METADATA` 조회 → 팩토리
    필터" 골격을 `routeArgEntriesMatching` 으로 통합했다. 두 export 함수는 시그니처·이름 그대로 top-level export 로
    남아 있어 `workspace-reflection-canary.ts` 의 "판별 함수를 그대로 호출" fail-closed 불변식(`spec/5-system/1-auth.md`
    부트 캐너리 절)이 깨지지 않는다 — 실제로 `workspace-reflection-canary.ts` 를 열어 두 함수를 여전히 import·호출함을
    확인했다. `RouteArgEntry` 타입은 기존 두 인라인 타입(`{factory?}` / `{factory?, data?}`)의 상위집합이라 필터 조건도
    동일(`entry?.factory === factory`)하다. plan 의 뮤턴트 표(H1~H4)가 헬퍼 로직 자체를 RED 로 검증했고, 기존
    `workspace.decorator.spec.ts` 의 `'두 판별은 서로의 팩토리를 세지 않는다'` 케이스도 그대로 유지된다.
  - 제안: 없음 (조치 불요)

- **[INFO]** 403 설명 문자열 보간 — 바이트 단위 동일성 확인
  - 위치: `auth.controller.ts:431,446` / `executions.controller.ts:282,311` / `workspaces.controller.ts:71-73,396`
  - 상세: `NOT_A_MEMBER.code`(`'NOT_A_MEMBER'`) · `ROLE_REQUIRED.{admin,editor,owner}.code`(각 `'ADMIN_REQUIRED'` ·
    `'EDITOR_REQUIRED'` · `'OWNER_REQUIRED'`)를 `common/constants/workspace-roles.ts` 에서 직접 확인한 뒤, 보간된
    문자열이 종전 하드코딩 리터럴과 정확히 일치함을 6개 지점 모두 대조했다. OpenAPI 출력이 바뀌지 않으므로 plan 이
    "뮤턴트를 걸지 않았다"고 명시한 판단도 타당하다.
  - 제안: 없음

- **[INFO]** `ADMIN_ROLES` 통합 (integrations.service.ts) — 값·소비처 동일성 확인
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:16` (import), `:1567-1568` (`isAdmin`)
  - 상세: 로컬 `const ADMIN_ROLES = new Set(['owner', 'admin'])` 제거 후 공용 `ADMIN_ROLES`
    (`workspace-roles.ts` — `workspaceRoleLevel(role) >= workspaceRoleLevel('admin')` 필터, 결과가 `{admin, owner}`)로
    교체했다. 유일한 소비처인 `private isAdmin(role) { return !!role && ADMIN_ROLES.has(role); }` 는 문자 그대로
    동일 판정을 유지한다. 로컬 상수가 `export` 되지 않았으므로 외부 소비처도 없다(grep 확인).
  - 제안: 없음

- **[INFO]** `transferOwnership` docstring 자기-반증형 정정 — 실측 근거 확인됨
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`transferOwnership` JSDoc, 710-721줄대)
  - 상세: "두 멤버를 단일 `IN` 쿼리로 동시에 락" 이라는 종전 문장을 "그 뒤 요청자 → 대상 순으로 한 행씩
    `pessimistic_write`" 로 정정했다. `git show eb009f99c -- '**/workspaces.service.ts'` 로 그 문장을 처음 넣은
    커밋 자체가 이미 `memRepo.findOne` 을 순차 두 번 호출했음(단일 `IN` 쿼리가 아니었음)을 확인했다 — 정정이 정확하다.
    실제 구현(`transferOwnership` 본문, workspace 행 락 → requester 멤버 락 → target 멤버 락 순차)도 문서와 일치한다.
    이는 코드/코드-주석 간 자기 정정이며 `spec/` 문서를 건드리지 않으므로 CLAUDE.md 의 "자기-반증형 소정정" 규칙과도
    무관하다(그 규칙은 spec 문서 대상).
  - 제안: 없음

- **[INFO]** `throwOwnerTransferRequired` 리팩터 — 응답 바디 동일성 확인
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:939-943`
  - 상세: `{ code: ROLE_REQUIRED.owner.code, message: '...' }` → `{ ...ROLE_REQUIRED.owner, message: '...' }` 로 변경.
    `ROLE_REQUIRED.owner = { code: 'OWNER_REQUIRED', message: 'Owner 권한이 필요합니다.' }` 이므로 스프레드 후
    `message` 를 서비스 고유 문구로 덮어써도 최종 객체(`{code: 'OWNER_REQUIRED', message: 'owner 이양은...'}`)는
    이전과 동일하다. `workspaces.service.spec.ts` 의 새 단언(`code` + `message` 동시 검증)도 이 값과 정확히 일치한다.
  - 제안: 없음

- **[INFO]** TODO/FIXME/HACK/XXX 미검출
  - 위치: 변경된 8개 파일 전체 diff
  - 상세: `git diff origin/main..HEAD -- <8 files> | grep -in "TODO|FIXME|HACK|XXX"` 결과 0건.
  - 제안: 없음

- **[INFO]** spec fidelity — `spec/data-flow/12-workspace.md` 와 일치
  - 위치: `spec/data-flow/12-workspace.md` §"경로 파라미터 워크스페이스도 가드가 본다(2026-09-25)", §"가드 거부의
    오류 코드(2026-09-25)"
  - 상세: 두 절 모두 이번 커밋이 참조하는 사실(경로 워크스페이스는 `RolesGuard` 가 판정, 비멤버는 요구 역할과
    무관하게 `NOT_A_MEMBER`)과 line-level 로 일치한다. 이번 커밋 자체는 그 절이 이미 규정한 동작을 문자열/구조
    수준에서 재정리한 것이라 spec 본문과 새로운 괴리를 만들지 않는다.
  - 제안: 없음

## 요약

리뷰한 8개 파일은 이전 라운드 리뷰(#1399 5라운드 `/ai-review`, `--impl-prep`)가 지목한 항목들을 정리한 순수
리팩터로, 응답 코드·OpenAPI 문자열·판정 로직이 모두 바이트/의미 단위로 이전과 동일함을 직접 대조해 확인했다.
`workspace-reflection-canary.ts` 가 기대하는 두 export 함수의 identity·시그니처가 보존됐고, `ADMIN_ROLES` 통합과
`throwOwnerTransferRequired` 스프레드도 실제 유일 소비처와 대조해 동작 불변임을 검증했다. `transferOwnership`
docstring 정정은 `eb009f99c` 커밋 diff로 직접 반증(실제로 그 커밋부터 순차 `findOne` 두 번이었음)을 확인해
타당하다. TODO/FIXME 등 미완성 표식 없음, spec(`spec/data-flow/12-workspace.md`)과의 괴리 없음. Critical/Warning
없음 — 전부 INFO(사실 확인)로만 구성된다.

## 위험도

NONE
