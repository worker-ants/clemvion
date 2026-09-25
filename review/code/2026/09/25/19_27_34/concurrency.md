# 동시성(Concurrency) 리뷰

## 발견사항

이번 변경 8개 파일 중 실행 로직에 실질적인 변경이 있는 것은 2곳뿐이다.

1. `codebase/backend/src/common/decorators/workspace.decorator.ts` — `handlerConsumesWorkspaceId` ·
   `workspaceParamNamesOf` 두 판별 함수가 쓰던 `Reflect.getMetadata(ROUTE_ARGS_METADATA, ...)` 조회
   골격을 `routeArgEntriesMatching()` 으로 추출.
2. `codebase/backend/src/modules/integrations/integrations.service.ts` — 로컬
   `const ADMIN_ROLES = new Set(['owner', 'admin'])` 를 제거하고 `common/constants/workspace-roles.ts`
   가 export 하는 공유 `ADMIN_ROLES: ReadonlySet<string>` 을 import.

나머지 파일(`auth.controller.ts` · `executions.controller.ts` · `workspaces.controller.ts` ·
`workspaces.service.ts` 의 diff 부분 · `workspaces.service.spec.ts`)은 Swagger `description` 문자열에
공유 상수(`NOT_A_MEMBER.code` · `ROLE_REQUIRED.*.code`)를 보간하거나, `transferOwnership` 위의 docstring을
정정하는 순수 문서/문자열 변경이며 런타임 분기·락·await 흐름은 바뀌지 않았다.

- **[INFO]** `routeArgEntriesMatching` 은 요청마다 독립적으로 `Reflect.getMetadata` 를 읽기만 하고
  아무 상태도 쓰지 않는 순수 함수다(메모이제이션·캐시 없음). 동시 요청 간 공유 가변 상태가 없어
  경쟁 조건 표면이 늘지 않는다.
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts` — `routeArgEntriesMatching` 함수
    (전체 파일 컨텍스트 게이트 64~80행)
  - 상세: 두 판별 함수(`handlerConsumesWorkspaceId`, `workspaceParamNamesOf`)가 이 헬퍼를 공유하게
    됐지만, 헬퍼가 참조하는 것은 Nest 부트 시점에 한 번 등록되는 `ROUTE_ARGS_METADATA` (불변)뿐이다.
  - 제안: 없음(현재 형태로 안전).

- **[INFO]** `ADMIN_ROLES` 를 `integrations.service.ts` 로컬 상수에서 `workspace-roles.ts` 의 공유
  `ReadonlySet` 으로 교체한 것은 참조 자체를 공유하지만, 그 Set 은 모듈 로드 시 1회 계산되는 불변
  파생값(`ADMIN_ROLES: ReadonlySet<string>`, `.has()` 만 사용)이라 다중 요청이 동시에 읽어도 문제가
  없다. 두 서비스 모두 이 상수를 쓰기(`.add`/`.delete`)에 사용하지 않는다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:16` (import) /
    `codebase/backend/src/common/constants/workspace-roles.ts:28` (`export const ADMIN_ROLES`)
  - 상세: `grep` 으로 저장소 전체의 `ADMIN_ROLES` 참조를 확인한 결과 읽기(`.has(role)`, `In([...ADMIN_ROLES])`)
    뿐이다(`workspaces.service.ts:4969,5681,5791`).
  - 제안: 없음.

- **[INFO]** `workspaces.service.ts` 의 `transferOwnership` docstring 정정(“두 멤버를 단일 `IN` 쿼리로
  동시에 락” → “요청자 → 대상 순으로 한 행씩 순차 `pessimistic_write`”)은 실제 코드(순차 `findOne` 두 번,
  변경 없음)와 이제 일치한다. 검증: 워크스페이스 행 락이 먼저 걸리므로 같은 워크스페이스에 대한 동시
  `transferOwnership` 호출들은 그 락에서 완전히 직렬화되고, 그 뒤에 걸리는 멤버 행 락 순서(요청자→대상
  고정, A→B/B→A 무관)는 이미 한 트랜잭션만 활성인 상태에서 실행되므로 두 트랜잭션이 동시에 서로 다른
  순서로 멤버 행을 기다리는 ABBA 데드락 조건이 성립하지 않는다. 같은 파일의 다른 트랜잭션들
  (`deleteWorkspace`/`assertWorkspaceDeletable`)도 “워크스페이스 → 멤버십” 순서를 명시적으로 지켜(주석:
  “잠금 순서는 워크스페이스 → 멤버십이다 — `transferOwnership` 과 같게 둬야 둘이 겹칠 때 교착(`40P01`)이
  나지 않는다”), 파일 전역에서 락 순서가 일관된다. `leaveWorkspace` 는 워크스페이스 행을 락하지 않고
  멤버 행만 락해 이 순서와 충돌할 그래프가 없다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `transferOwnership` 메서드
    docstring 및 본문(전체 파일 컨텍스트 게이트 705~797행), 대조 대상 `assertWorkspaceDeletable`
    docstring(게이트 594~603행)
  - 상세: 이 diff 는 코드가 아니라 “예전에 틀리게 적었던 주석”을 실측된 구현에 맞춰 고친 것뿐이라
    동작 변화는 없다. 정정 후 문장이 주장하는 데드락 부재 근거를 직접 추적해 반증되지 않음을 확인했다.
  - 제안: 없음 — 현재 정정은 정확하다. 다만 향후 워크스페이스/멤버 행을 잠그는 새 트랜잭션을 추가할 때는
    이 파일이 이미 확립한 “워크스페이스 → 멤버십” 순서를 반드시 따라야 한다(그 반대 순서로 잠그는 코드가
    하나라도 생기면 `transferOwnership`/`deleteWorkspace` 와 40P01 데드락 가능).

- **[INFO]** `removeMember` 의 “단일 원자적 `DELETE ... WHERE role != 'owner'`”로 동시 `transferOwnership`
  의 owner 승격과 경합을 가르는 설계(READ COMMITTED 의 EvalPlanQual 재평가에 의존)는 이번 diff 의 대상이
  아니며(주석·코드 모두 미변경), 이미 이전 리뷰에서 검증된 것으로 보인다. 이번 파일 diff 범위에 포함되지
  않으므로 별도 지적 없음.

## 요약

이번 변경은 워크스페이스 역할/거부 코드 상수를 단일 SoT(`workspace-roles.ts`)로 모으고, 두 곳의 reflection
판별 함수를 공통 헬퍼로 묶고, `transferOwnership` 의 오래된 락 전략 주석을 실제 구현(순차 `pessimistic_write`
두 번, 워크스페이스 행 락이 먼저 걸려 동시 이양을 직렬화)에 맞게 정정한 것이 전부다. 새로 추가된 공유 상태는
모두 모듈 로드 시 계산되는 불변 값(`ReadonlySet`, `Readonly<Record<...>>`)이고 async/await 흐름, 락 획득
순서, 트랜잭션 경계는 하나도 바뀌지 않았다. 데드락·경쟁조건·원자성 관점에서 새로 도입된 위험은 없고,
docstring 정정 자체도 실제 구현과 대조해 정확함을 확인했다.

## 위험도
NONE
