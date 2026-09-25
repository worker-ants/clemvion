# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 이번 변경(8개 파일)은 전부 `codebase/backend/src/**` 내부 리팩터링이며 `package.json`·lockfile 은 diff 에 등장하지 않는다.
  - 위치: 리뷰 대상 8개 파일 전체 (`workspace-roles.ts`, `workspace.decorator.ts`, `auth.controller.ts`, `executions.controller.ts`, `integrations.service.ts`, `workspaces.controller.ts`, `workspaces.service.spec.ts`, `workspaces.service.ts`)
  - 상세: `+import` 로 추가된 라인은 4곳(`auth.controller.ts:72`, `executions.controller.ts:19-22`, `integrations.service.ts:16`, `workspaces.controller.ts:35-38`) 뿐이며 전부 프로젝트 내부 모듈 `../../common/constants/workspace-roles`(`NOT_A_MEMBER`, `ROLE_REQUIRED`, `ADMIN_ROLES`) 를 가져오는 것이다. `@nestjs/*`, `typeorm`, `p-limit`, `uuid`, `express` 등 기존 외부 패키지 import 는 모두 변경 전부터 있던 컨텍스트 라인이고 버전·사용법 변경도 없다. 따라서 버전 고정·라이선스·취약점·번들 크기 항목은 이번 diff 범위에서 해당 없음.
  - 제안: 없음(정보성).

- **[INFO]** 내부 의존성 정리 — `integrations.service.ts` 의 로컬 `const ADMIN_ROLES = new Set(['owner', 'admin']);` 정의(구 `integrations.service.ts:112` 부근)를 제거하고 공유 상수 `common/constants/workspace-roles.ts` 의 `ADMIN_ROLES` 를 import 하도록 통합했다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (diff 상 `-const ADMIN_ROLES = ...` 삭제, `+import { ADMIN_ROLES } ...` 16번째 게이트 라인 추가), `codebase/backend/src/common/constants/workspace-roles.ts:7-8` (docstring 갱신, 통합 배경 서술)
  - 상세: 동일한 값(`['owner','admin']`)을 갖는 동명 로컬 상수가 여러 파일에 흩어져 있던 것을 단일 SoT 로 모으는 방향으로, 의존성 관점에서 바람직한 변화다(점검 관점 5·8). `common/constants/workspace-roles.ts` 자체는 외부 import 가 없는 leaf 모듈이라, 이제 `auth.controller.ts` / `executions.controller.ts` / `integrations.service.ts` / `workspaces.controller.ts` / `workspaces.service.ts` 다섯 곳이 이 모듈에 fan-in 하게 되지만 역방향 import 가 없어 순환 의존 위험은 없다.
  - 제안: 없음 — 의도된 리팩터링이며 부작용 없음.

- **[INFO]** `workspace.decorator.ts` 의 공통 헬퍼 추출(`routeArgEntriesMatching`)도 순수 내부 코드 이동이며, 기존에 이미 사용 중이던 `@nestjs/common`·`@nestjs/common/constants`(`ROUTE_ARGS_METADATA`, 즉 `reflect-metadata` 기반) 외 새 의존성을 끌어들이지 않는다.
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts` (전체 파일 컨텍스트 게이트 49-80줄)
  - 상세: 두 판별 함수(`handlerConsumesWorkspaceId`, `workspaceParamNamesOf`)의 중복 로직을 한 함수로 합쳤을 뿐, import 목록은 변경 전과 동일(`createParamDecorator`, `ExecutionContext`, `BadRequestException`, `ParseUUIDPipe`, `ROUTE_ARGS_METADATA`, `resolveRequestWorkspaceContext`).
  - 제안: 없음.

## 요약
리뷰 대상 8개 파일 전부 `codebase/backend` 내부 파일이며, 새 외부 패키지 추가·버전 변경·`package.json`/lockfile 수정이 전혀 없다. 유일한 의존성 관련 변화는 내부 모듈 수준으로, `integrations.service.ts` 에 중복 정의돼 있던 로컬 `ADMIN_ROLES` 상수를 공유 SoT(`common/constants/workspace-roles.ts`)로 흡수한 것과, `workspace.decorator.ts` 내부의 중복 reflection 로직을 헬퍼 함수로 통합한 것뿐이다. 두 변화 모두 fan-in 이 leaf 상수/유틸 모듈로 향하고 역방향 참조가 없어 순환 의존이나 결합도 악화 위험이 없으며, 오히려 동일 값 상수의 분산을 줄이는 긍정적 정리다. 외부 라이브러리 취약점·라이선스·번들 크기·버전 충돌 항목은 이번 diff 범위에서 검토할 대상 자체가 없다.

## 위험도
NONE
