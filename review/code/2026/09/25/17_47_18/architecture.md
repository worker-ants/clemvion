# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** DTO 계층의 역할 목록(`WORKSPACE_ROLES`)이 이번 PR 이 만든 단일 진실(`WORKSPACE_ROLE_LEVEL`)에서 파생되지 않고 독립 리터럴로 남아, SSOT 원칙이 부분적으로만 적용됐다.
  - 위치: `codebase/backend/src/common/constants/workspace-roles.ts:1-14`(신규 파일, 서열 정의) / `codebase/backend/src/modules/workspaces/dto/add-member.dto.ts:4`(기존 파일, 이번 diff 밖) / `codebase/backend/src/common/constants/workspace-roles.spec.ts:17-21`(교차검증 테스트)
  - 상세: `workspace-roles.ts` 파일 헤더(게이트 4-7)는 "종전엔 가드의 숫자 서열(`ROLE_HIERARCHY`)과 두 서비스의 `ADMIN_ROLES` 집합이 각자 따로 있었다"는 중복을 없애는 것이 이번 변경의 목적이라고 명시한다. 그런데 `AddMemberDto`/`UpdateMemberRoleDto`가 `@IsEnum` 검증에 쓰는 `WORKSPACE_ROLES`(`add-member.dto.ts:4`, `['owner','admin','editor','viewer']` 리터럴)는 여전히 `WORKSPACE_ROLE_LEVEL`과 별개로 선언돼 있다. 두 목록이 같은 집합인지는 이번 PR 이 추가한 `workspace-roles.spec.ts`의 런타임 테스트(`Object.keys(WORKSPACE_ROLE_LEVEL).sort()` vs `[...WORKSPACE_ROLES].sort()`)로만 보증되고, 타입 수준에서 강제되지 않는다 — 역할을 한쪽에만 추가·삭제해도 컴파일은 통과하고 그 스펙이 돌 때까지 드러나지 않는다. `workspace-roles.ts`는 의존성이 없는 leaf 모듈(common/constants)이라 `modules/workspaces/dto/add-member.dto.ts`(modules 층)가 그 키에서 `WORKSPACE_ROLES`를 파생시켜도 역방향 의존이나 순환 참조가 생기지 않는다 — 구조적으로 막을 수 있는 종류의 drift 를 테스트 하나에 맡겨 둔 상태다. (실패 방향 자체는 fail-safe다: DTO 에만 있고 서열에 없는 역할은 `workspaceRoleLevel`이 0을 돌려줘 그 역할의 멤버는 어떤 `@Roles()` 요구도 통과하지 못하는 쪽으로 새지만, "왜 이 역할만 항상 거부되는가"를 디버깅해야 하는 혼란은 남는다.)
  - 제안: `add-member.dto.ts`의 `WORKSPACE_ROLES`를 `Object.keys(WORKSPACE_ROLE_LEVEL) as WorkspaceRoleName[]`처럼 `workspace-roles.ts`에서 파생시켜 "서열 하나에서 파생한다"는 이번 PR 의 원칙을 DTO 계층까지 완결한다. 범위상 이번 PR 에서 건드리기 부담스럽다면 최소한 두 파일 상단에 상호 참조 주석을 남겨, 다음 사람이 한쪽만 고치는 일을 줄인다.

- **[INFO]** `RolesGuard.canActivate`가 경로 파라미터 컨텍스트와 헤더/토큰 컨텍스트를 서로 다른 두 실행 경로로 분기하고, 각 경로가 멤버십·역할 판정을 별도로 수행한다 — 지금은 감당할 만하지만 세 번째 워크스페이스 컨텍스트 소스가 생기면 조합이 늘어난다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:154-177`(`canActivate` 중 경로/헤더 분기)
  - 상세: 154-168 은 `workspaceParamNamesOf`로 찾은 경로 파라미터마다 `assertMember`를 직접 호출하는 경로 분기이고, 174·180-202(`checkRequestContext`)는 헤더/토큰 분기다. 두 분기는 병렬 개념이지만 하나의 메서드 안에 순차 if/return 으로 나열돼 있고, "경로+헤더 동시 소비"(예: `adminPathAndHeader`) 조합을 위해 165-167 에서 이미 한 번 서로를 참조한다. 컨텍스트 소스가 지금처럼 정확히 둘일 때는 이 형태가 읽기 쉽지만, 장차 세 번째 소스(예: 쿼리 파라미터·바디 필드로 받는 워크스페이스)가 추가되면 이 메서드에 세 번째 분기를 더해야 하고, 분기 간 동시 소비 조합(2개 소스 간 1가지 조합 → 3개 소스 간 3가지 조합)도 함께 늘어난다.
  - 제안: 당장 리팩터가 필요한 임계치는 아니다. 다만 세 번째 컨텍스트 소스가 실제로 생기는 시점에는, "이 핸들러가 소비하는 워크스페이스 컨텍스트 소스들"을 나열해 주는 하나의 추출자 목록(각 항목이 값·역할판정 여부를 반환)을 순회하는 형태로 일반화해 두면 분기 조합 폭발을 피할 수 있다.

- **[INFO]** 경로 워크스페이스가 여럿인 핸들러(`workspaceParamNamesOf` 가 길이 ≥2를 돌려주는 경우)에서 `assertMember` 호출이 `for` 루프 안에서 순차적으로 `await` 된다 — 병렬화하지 않는다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:156-163`
  - 상세: 현재 프로덕션 라우트 중 이 배열의 길이가 2 이상인 곳은 없다(`workspace-roles-attachment.spec.ts` 표의 15곳 전부가 `['id']` 단일 파라미터). 다중 파라미터 경로는 `roles.guard.spec.ts`의 `twoPaths` 케이스로만 커버되는 대비용 일반화다. 지금은 실질적 성능 영향이 없지만, 다중 워크스페이스 경로 파라미터를 쓰는 라우트가 실제로 생기면 멤버십 조회가 파라미터 수만큼 순차 왕복(N+1 유사)한다.
  - 제안: 지금 고칠 필요는 없다 — 다만 다중 파라미터 라우트가 실제로 도입되는 시점에 `Promise.all`로 병렬화할지 여부를 함께 검토할 항목으로 남겨 둔다.

## 요약

이번 변경은 워크스페이스 인가를 "경로 파라미터로 받는 워크스페이스"까지 확장하면서, 가드(`RolesGuard`)·데코레이터(`@WorkspaceParam`)·서비스 계층·저장소 정적 가드(`workspace-param-binding`)·e2e 테스트까지 하나의 일관된 설계로 엮은 성숙한 리팩터다. 역할 서열·거부 코드·비멤버 처리 규칙을 `common/constants/workspace-roles.ts` 단일 모듈로 모아 가드와 서비스 두 계층이 같은 표를 보게 한 것, `decoratorCallName`을 공용 `source-scan.ts`로 뽑아 두 저장소 가드의 중복을 제거한 것, `param-uuid-pipe-guard`/`workspace-param-binding-guard` 같은 AST 기반 "아키텍처 적합성 함수"로 컨벤션을 코드 리뷰가 아니라 CI 가 강제하게 한 것은 전부 SOLID·DRY·레이어 분리 관점에서 견고한 선택이다. 순환 의존성은 발견되지 않았고(`workspace-roles.ts`는 의존성 없는 leaf 모듈), 가드의 새 경로 분기와 기존 헤더/토큰 분기도 멀티 파라미터·동시 소비 등 경계 조건까지 유닛·e2e 양쪽에서 두텁게 테스트됐다. 유일하게 아쉬운 지점은 이번 PR 이 명시적으로 내세운 "서열 하나에서 파생한다"는 SSOT 원칙이 `modules/workspaces/dto/add-member.dto.ts`의 `WORKSPACE_ROLES` 배열까지는 완결되지 않고 테스트 기반 교차검증으로 남아 있다는 것이며, 이는 구조적으로(파생 타입으로) 마저 닫을 수 있는 잔여 항목이다. 나머지는 향후 확장(세 번째 컨텍스트 소스, 다중 경로 파라미터) 시점에 재검토할 만한 낮은 우선순위의 관찰이다.

## 위험도

LOW
