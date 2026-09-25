# 유지보수성(Maintainability) 리뷰

## 발견사항

이번 변경(8개 파일, `097411779` — "경로 워크스페이스 가드 후속: reflection 골격 · 403 설명 코드 보간 · 서비스 문구")은
CRITICAL/WARNING 급 유지보수성 결함이 없다. 아래는 확인한 개선점과 사소한 관찰이다.

- **[INFO]** `routeArgEntriesMatching` 추출로 reflection 중복 제거 — 긍정적 개선
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts:64-80` (신규 헬퍼), 호출부 `:103-106`, `:153-159`
  - 상세: 종전 `handlerConsumesWorkspaceId` · `workspaceParamNamesOf` 두 함수가 "메서드명 가드 → `ROUTE_ARGS_METADATA` 조회 →
    팩토리 identity 필터" 골격을 바이트 단위로 중복 보유했다. `RouteArgEntry` 인터페이스 + `routeArgEntriesMatching` 헬퍼로
    공통 골격을 뽑아내고, 두 판별 함수는 필터 팩토리만 바꿔 호출한다. export 시그니처는 그대로 유지돼 부트 캐너리
    (`workspace-reflection-canary.ts`)의 호출 대상도 바뀌지 않는다 — 헬퍼 자체는 캐너리가 직접 검증하지 않지만, 두 판별
    함수를 통해 간접적으로 커버된다는 점을 docstring(`:59-62`)이 명시해 향후 오해를 막는다.
  - 제안: 없음 (이미 적절한 형태).

- **[INFO]** `integrations.service.ts` 로컬 `ADMIN_ROLES` 를 공유 상수로 통합 — 긍정적 개선
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:16` (import), 종전 로컬 선언 삭제 지점(구 `const ADMIN_ROLES = new Set(['owner', 'admin']);`)
  - 상세: `workspaces-roles.ts` 의 `WORKSPACE_ROLE_LEVEL` 서열에서 파생한 단일 `ADMIN_ROLES` 로 3개 지점(`workspaces.service.ts`,
    `workspace-invitations.service.ts`, `integrations.service.ts`)이 이제 같은 값을 참조한다. 동일 값이라도 이름이 같은
    로컬 상수가 여러 곳에 있으면 한쪽만 역할 서열이 바뀌었을 때 판정이 갈리는 위험이 있었는데, 이 통합으로 그 위험이
    구조적으로 제거됐다. `workspace-roles.ts` 파일 상단 docstring(`:7-8`)이 이 배경을 정확히 기록한다.
  - 제안: 없음.

- **[INFO]** Swagger 403 설명이 공유 거부 표(`.code`)를 문자열 보간으로 참조 — 문서-코드 drift 방지
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts:431,446`, `codebase/backend/src/modules/executions/executions.controller.ts:282,311`,
    `codebase/backend/src/modules/workspaces/workspaces.controller.ts:71-73,396`
  - 상세: 종전 하드코딩된 `'...(NOT_A_MEMBER)'` / `'...(ADMIN_REQUIRED)'` 문자열을 `${NOT_A_MEMBER.code}` / `${ROLE_REQUIRED.admin.code}`
    등으로 대체했다. 오류 코드 상수가 바뀌면 OpenAPI 설명이 자동으로 따라오므로, 코드와 문서가 별도로 손으로 동기화돼야
    하는 지점을 하나 줄였다. `workspaces.controller.ts` 의 `FORBIDDEN_MEMBER_ROUTE`/`FORBIDDEN_ADMIN_ROUTE`/`FORBIDDEN_OWNER_ROUTE`
    모듈 레벨 상수 3개도 라우트마다 반복되던 문구를 한곳으로 모은 기존 패턴을 유지하며 코드 보간만 추가했다 — 일관성 있음.
  - 제안: 없음.

- **[INFO]** `transferOwnership` docstring 자기 정정 — 실측 기반 정정, 근거 커밋 명시
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:711-721` (docstring), 실제 로직 `:739-775`
  - 상세: 종전 docstring 은 "두 멤버를 단일 `IN` 쿼리로 동시에 락"이라고 서술했으나, 실제 구현(`eb009f99c`부터)은 요청자 →
    대상 순 순차 `findOne` 두 번이었다. 이번 변경은 실제 코드(순차 락, 워크스페이스 행 락에 의한 직렬화로 데드락 방지)에
    맞춰 문장을 고치고, 정정 이력과 근거 커밋 해시까지 남겼다 — 다음 사람이 틀린 문서를 코드로 오인해 추적하는 비용을
    없앤다. 코드 자체는 변경되지 않았음을 diff로 확인.
  - 제안: 없음.

- **[INFO]** `throwOwnerTransferRequired` 를 스프레드 방식으로 통일
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:939-944`
  - 상세: `{ code: ROLE_REQUIRED.owner.code, message: '...' }` → `{ ...ROLE_REQUIRED.owner, message: '...' }` 로 바뀌어,
    같은 파일의 `throwNotAMember`(`:926-928`) · `throwAdminRequired`(`:931-933`) 와 같은 스프레드 관용구로 통일됐다. 서비스
    고유 문구로 `message` 를 덮어쓰는 의도는 인접 docstring(`:936-938`)이 명시한다.
  - 제안: 없음.

발견된 매직 넘버·과도한 중첩·긴 함수·순환 복잡도 상승은 없다. 변경된 함수(`transferOwnership`, `routeArgEntriesMatching`,
`throwOwnerTransferRequired` 등)는 모두 기존 길이를 유지하거나 더 짧아졌고, 새로 추가된 로직은 단일 책임을 갖는다.
테스트 변경(`workspaces.service.spec.ts:1047-1056`)도 단언을 좁히는 방향으로만 바뀌었고 사유가 인접 주석에 남아 있다.

## 요약

전체적으로 이번 변경은 이전 라운드(`/ai-review` #1399 5라운드)가 "수렴 예외"로 넘긴 잔여 정리 작업으로, 코드 동작을 바꾸지
않으면서 (1) 두 reflection 판별 함수의 중복 골격을 공통 헬퍼로 추출하고, (2) 여러 파일에 흩어져 있던 `ADMIN_ROLES` 로컬
정의를 단일 진실로 합치고, (3) Swagger 403 설명의 하드코딩 문자열을 공유 상수 보간으로 바꿔 문서-코드 drift 위험을
줄이고, (4) 실측과 어긋난 docstring 한 문장을 근거와 함께 정정했다. 네이밍은 기존 컨벤션(동사형 헬퍼명, `throw*` 접두
private 메서드, 한국어 docstring 스타일)과 일관되며, 새로 추가된 인터페이스(`RouteArgEntry`)와 함수(`routeArgEntriesMatching`)
모두 단일 책임에 부합한다. import 사용 여부도 파일별로 확인했고 미사용 import 는 없다. CRITICAL/WARNING 급 발견사항 없음.

## 위험도

NONE
