# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 신규 외부 패키지·매니페스트 변경 없음
  - 위치: 리뷰 대상 30개 파일 전체 (해당 diff 에 `package.json`/`package-lock.json`/`pnpm-lock.yaml` 없음)
  - 상세: 전체 diff 를 훑어 `import` 문을 전수 확인했다. 새로 등장하는 외부 식별자는 `Client` (`'pg'`), `ForbiddenException`/`ParseUUIDPipe` (`'@nestjs/common'`), `describe/it/expect/beforeAll/afterAll` (`'@jest/globals'`), `request` (`'supertest'`), `* as ts` (`'typescript'`), `ApiForbiddenResponse` (`'@nestjs/swagger'`) 뿐이며, 전부 `codebase/backend/package.json` 에 이미 선언돼 있다 — `pg`(`^8.23.0`, dependencies), `@types/pg`(devDependencies), `typescript`(`^5.7.3`, devDependencies), `@jest/globals`/`jest`/`ts-jest`(devDependencies), `supertest`(`^7.0.0`, devDependencies), `@nestjs/swagger`(dependencies). 따라서 버전 고정·라이선스·취약점·번들 크기·빌드 시간·호환성 항목은 이번 변경으로 새로 발생하는 리스크가 없다.
  - 제안: 없음 (정보 제공).

- **[INFO]** `pg` `Client` 직접 사용은 저장소 전역 관례, 신규 패턴 아님
  - 위치: `codebase/backend/test/workspace-delete-concurrency.e2e-spec.ts:2`, `codebase/backend/test/workspace-path-guard.e2e-spec.ts:2`, `codebase/backend/test/workspace-rbac.e2e-spec.ts:2`
  - 상세: 세 e2e 스펙 모두 `import { Client } from 'pg';` 를 쓴다. 저장소 전체 `test/*.e2e-spec.ts` 70여 개 파일이 동일 패턴을 이미 쓰고 있어(`grep` 확인), 이번 PR 이 새 의존 표면을 여는 것이 아니다.
  - 제안: 없음.

- **[INFO]** `typescript` 컴파일러 API 런타임 사용도 기존 `repo-guards` 관례를 그대로 따름
  - 위치: `codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts` (신규 파일), `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`
  - 상세: 두 가드 모두 `import * as ts from 'typescript'` 로 AST 를 파싱해 컨트롤러의 데코레이터 바인딩을 정적 검사한다. `repo-guards/__tests__/` 아래 이미 10개 넘는 가드가 같은 방식(정본 파서, blind 정규식이 아님)을 쓰고 있어 프로젝트 컨벤션에 부합한다. `typescript` 는 devDependency 로만 존재하며 런타임 프로덕션 번들에는 들어가지 않는 테스트/가드 전용 스크립트이므로 배포 산출물 크기에 영향 없다.
  - 제안: 없음.

- **[INFO, 긍정적]** 워크스페이스 역할 서열·거부 상수를 단일 모듈로 통합 — 내부 의존 관계 개선
  - 위치: `codebase/backend/src/common/constants/workspace-roles.ts` (신규 파일, 전체) → `codebase/backend/src/common/guards/roles.guard.ts:9-21`, `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`ADMIN_ROLES`/`NOT_A_MEMBER`/`ROLE_REQUIRED` import 블록), `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` (`ADMIN_ROLES` import), `codebase/backend/src/modules/auth/auth.service.ts` (`NOT_A_MEMBER` import), `codebase/backend/src/modules/workspaces/dto/add-member.dto.ts:3` (`WorkspaceRoleName` 타입 import)
  - 상세: 종전에는 역할 서열이 `roles.guard.ts` 의 로컬 `ROLE_HIERARCHY`, `workspaces.service.ts`·`workspace-invitations.service.ts` 각각의 로컬 `ADMIN_ROLES = new Set(['owner','admin'])`, 그리고 흩어진 인라인 `{code, message}` 거부 객체로 **4곳에 중복**돼 있었다. 이번 변경으로 전부 `common/constants/workspace-roles.ts` 하나를 가리키도록 재배선됐다. 의존 방향은 `modules/* → common/constants/*` 로 기존 계층 규칙(공통 하위 계층 → 상위 모듈이 소비)을 그대로 따르고, `common/constants/workspace-roles.ts` 자신은 `modules/*` 를 참조하지 않아 순환 의존이 생기지 않는다.
  - 제안: 없음 — 내부 의존성 정리가 잘 되어 있다.

- **[INFO, 긍정적]** repo-guards 간 중복 로직을 공용 유틸로 승격 — 가드 간 직접 결합 없음
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` (신규 `decoratorCallName` export) ← `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`, `codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts` (신규 파일)
  - 상세: `decoratorCallName` 함수가 두 가드에 글자 그대로 복제돼 있던 것을 `common/__test-utils__/source-scan.ts` 공용 모듈로 옮기고 두 가드가 그 모듈만 import 하도록 정리했다. 두 가드는 서로를 참조하지 않고 공용 모듈에만 의존하므로 가드 간 순환·직접 결합이 없다.
  - 제안: 없음.

- **[INFO]** 프런트/백엔드 역할 서열 테이블의 손-동기화 패턴이 이번 변경 이후에도 남음 (PR 범위 밖, 신규 문제 아님)
  - 위치: `codebase/frontend/src/components/auth/role-gate.tsx:10-18` (`ROLE_LEVEL` 상수) vs `codebase/backend/src/common/constants/workspace-roles.ts:9-14` (`WORKSPACE_ROLE_LEVEL`)
  - 상세: 이번 PR 은 백엔드 쪽 4곳의 중복을 `workspace-roles.ts` 하나로 합쳤지만, 프런트엔드 `role-gate.tsx` 는 여전히 같은 서열(`viewer:1, editor:2, admin:3, owner:4`)을 손으로 복제한 상수를 유지한다. 바뀐 것은 주석뿐이다 — "Backend `roles.guard.ts` 의 ROLE_HIERARCHY" → "Backend `common/constants/workspace-roles.ts` 의 WORKSPACE_ROLE_LEVEL". 저장소에는 이미 backend/frontend 가 공유하는 `codebase/packages/*`(예: `expression-engine`, `masked-markers`, `node-summary`)가 존재해 크로스-레이어 공유 인프라 자체는 있으므로, 이 값을 그 경로로 옮겨 컴파일 타임에 동기화를 강제할 여지가 있다. 다만 이 중복은 이 PR 이전(구 `ROLE_HIERARCHY` 시절)부터 있던 기존 부채이고 이번 PR 이 새로 만든 것은 아니라 INFO 로 남긴다 — 두 표가 갈리면(예: 역할 추가·서열 변경) 프런트 UI 게이팅과 백엔드 인가 판정이 조용히 어긋날 수 있다는 점만 환기한다.
  - 제안: 별도 작업으로 `WORKSPACE_ROLE_LEVEL` 을 공유 패키지로 옮기거나, 최소한 두 파일이 같은 리터럴을 갖는지 검사하는 대조 테스트를 추가하는 것을 고려.

## 요약

이번 변경은 워크스페이스 경로 파라미터 인가(`@WorkspaceParam`) 기능 추가와 그에 따른 `RolesGuard`/서비스 계층 리팩터링으로, 30개 파일 중 `package.json` 등 매니페스트 변경은 전혀 없다. 새로 등장하는 모든 import(`pg`, `typescript`, `@jest/globals`, `supertest`, `@nestjs/*` 확장 export)는 이미 선언된 기존 의존성을 재사용할 뿐이라 신규 의존성·버전 고정·라이선스·취약점·번들 크기·호환성 항목에서 새로 발생하는 리스크는 없다. 오히려 내부 의존성 구조는 개선됐다 — 4곳에 흩어져 있던 역할 서열/거부 상수를 `common/constants/workspace-roles.ts` 하나로, 두 repo-guard 에 중복돼 있던 `decoratorCallName` 을 `source-scan.ts` 공용 유틸로 각각 통합해 계층 위반이나 순환 의존 없이 재배선했다. 유일하게 남는 관찰은 프런트엔드 `role-gate.tsx` 의 역할 서열 상수가 여전히 백엔드 표를 손으로 복제한다는 점인데, 이는 이 PR 이전부터 있던 기존 부채라 이번 범위에서 새로 만든 결함은 아니다.

## 위험도

NONE
