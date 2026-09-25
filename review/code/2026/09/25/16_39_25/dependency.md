# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 순수 내부 리팩터링
  - 위치: 변경 파일 25개 전체 (`package.json` / `pnpm-lock.yaml` 은 변경분에 없음)
  - 상세: 이번 변경분(워크스페이스 경로 파라미터를 `RolesGuard` 가 판정하도록 하는 `@WorkspaceParam` 데코레이터 도입 + 역할 서열 단일화 + 저장소 가드 확장)에서 새로 등장하는 import 는 `@jest/globals`, `@nestjs/common`, `node:fs`, `node:path`, `pg`, `supertest`, `typescript` 뿐이며, 전부 `codebase/backend/package.json` 에 이미 존재하는 의존성(`typescript ^5.7.3`, `pg ^8.23.0`, `supertest ^7.0.0`, `@jest/globals ^30.0.0`, `@types/pg ^8.23.1`)이다. `package.json`/lockfile 자체가 diff 에 포함되지 않아 버전 고정·라이선스·취약점·번들 크기 항목은 모두 해당 없음(N/A).
  - 제안: 없음 — 그대로 승인 가능.

- **[INFO]** 내부 의존성 정리 — `ADMIN_ROLES` / 역할 서열 단일 소스화 (긍정적)
  - 위치: `codebase/backend/src/common/constants/workspace-roles.ts`(신규), `codebase/backend/src/modules/workspaces/workspaces.service.ts`, `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts`, `codebase/backend/src/common/guards/roles.guard.ts`
  - 상세: 종전에는 `roles.guard.ts` 의 `ROLE_HIERARCHY`, `workspaces.service.ts` 와 `workspace-invitations.service.ts` 각각의 로컬 `ADMIN_ROLES = new Set([...])` 세 곳이 같은 개념을 중복 정의했다. 이번 변경으로 `common/constants/workspace-roles.ts` 하나에서 `WORKSPACE_ROLE_LEVEL` / `ADMIN_ROLES` / `workspaceRoleLevel()` 을 파생시키고 세 소비처가 모두 이를 import 하도록 통합했다. 의존성 관점에서 바람직한 방향(중복 상수 제거, 단일 진실 소스)이며 순환 의존도 없다 — `workspace-roles.ts` 는 다른 내부 모듈을 import 하지 않는 leaf 상수 파일이다.
  - 제안: 없음 — 참고용 긍정 기록.

- **[INFO]** `common/guards/roles.guard.ts` → `modules/workspaces/workspaces.service.ts` 계층 역방향 의존 (기존 패턴, 이번 diff 로 신규 도입 아님)
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` (`import { WorkspacesService } from '../../modules/workspaces/workspaces.service';` — 이 줄은 diff 상 컨텍스트 줄이며 `+`/`-` 표시가 없어 이번 변경 이전부터 존재)
  - 상세: 통상 `common/` 계층은 도메인 모듈(`modules/`)에 의존하지 않는 것이 계층 방향이지만, 이 저장소는 `RolesGuard` 가 멤버십을 판정하기 위해 이미 `WorkspacesService` 에 의존해 왔다. 이번 PR 은 이 기존 의존선 위에 `isUuidShaped`(`common/utils/uuid`, 재사용) 와 `workspaceRoleLevel`(신규 상수) import 를 추가했을 뿐 방향을 바꾸지 않았고, 새 유틸도 기존 파일 재사용이라 중복이 늘지 않는다.
  - 제안: 이번 PR 범위 밖 — 기존 아키텍처 결정이므로 조치 불요. 향후 `common/guards` 를 순수 계층으로 분리하고 싶다면 별도 리팩터링 논의 대상으로 기록만 남김.

- **[INFO]** 저장소 정적 가드(TS 컴파일러 API 기반) 1개 신규 추가로 테스트 스위트 실행 시간 소폭 증가 가능
  - 위치: `codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts` (신규), 소비처 `workspace-param-binding.spec.ts`
  - 상세: 기존에도 `param-uuid-pipe-guard.ts` 가 `typescript` 컴파일러 API로 컨트롤러 전수를 파싱하는 가드가 있었는데, 이번 PR 이 같은 패턴의 두 번째 가드(`workspace-param-binding-guard.ts`, 평범한 `@Param` 으로 워크스페이스 ID 를 받는 자리를 탐지)를 추가했다. 둘 다 소스 전체를 매 테스트 실행마다 재파싱하므로 CI 시간에 미세하게 누적된다. 다만 devDependency(`typescript`) 재사용이고 패턴이 이미 정착돼 있어 새로운 의존성 리스크는 아니다.
  - 제안: 조치 불요(INFO). 저장소 가드 수가 계속 늘어나면 공통 AST 파싱 결과를 캐싱/공유하는 것을 향후 고려할 수 있다는 정도만 기록.

## 요약

이번 변경분은 워크스페이스 경로 파라미터(`@WorkspaceParam`) 인가 가드 도입과 역할 서열(`ADMIN_ROLES`/`ROLE_HIERARCHY`) 단일화를 위한 순수 내부 리팩터링이며, `package.json`/lockfile 변경이 전혀 없다. 새로 등장하는 모든 import(`typescript`, `pg`, `supertest`, `@jest/globals`, `@nestjs/common`, `node:fs`, `node:path`)는 이미 `codebase/backend` 에 고정 버전으로 존재하는 기존 의존성의 재사용이라 새 의존성·버전 고정·라이선스·취약점·번들 크기 항목은 모두 해당 없음이다. 내부 의존성 측면에서는 세 곳에 중복돼 있던 `ADMIN_ROLES` 상수를 `common/constants/workspace-roles.ts` 단일 소스로 통합한 것이 긍정적이며, 순환 의존이나 계층 위반의 신규 도입은 발견되지 않았다(기존에 있던 `common/guards → modules/workspaces` 역방향 의존은 이번 PR 이전부터 존재).

## 위험도

NONE
