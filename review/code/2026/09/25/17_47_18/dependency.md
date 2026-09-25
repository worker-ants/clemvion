# 의존성(Dependency) 리뷰 — workspace-path-guard (28개 파일)

## 조사 방법

전체 unified diff(28개 파일, `+`로 추가된 모든 줄)에서 `import ... from '<외부 패키지>'` 패턴을 전수 추출하고, `codebase/backend/package.json` 의 `dependencies`/`devDependencies` 와 대조했다. 추가로 `tsconfig.build.json` 의 exclude 규칙(devDependency 프로덕션 번들 유출 방지 가드)을 확인해 새로 추가된 코드가 그 경계 안에 머무는지 검증했다. `package.json`/`pnpm-lock.yaml` 자체의 변경 여부도 `git diff` 로 확인했다.

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 이번 diff 는 순수 내부 리팩터
  - 위치: 전체 28개 파일 (diff 전수)
  - 상세: `+` 로 추가된 모든 `import` 문을 추출한 결과 `@jest/globals`, `@nestjs/common`, `pg`, `supertest`, `typescript`, `node:fs`, `node:path` 뿐이었다. 전부 `codebase/backend/package.json` 에 기존에 이미 선언되어 있던 패키지이며(`typescript`·`@jest/globals`·`supertest` 는 devDependencies, `pg`·`@nestjs/common` 은 dependencies), 버전 범위도 이번 diff 로 바뀌지 않았다(`git diff origin/main...HEAD -- '**/package.json' '**/*.lock*'` 결과 0건). 새 패키지 추가·버전 변경·라이선스·취약점·번들 크기 항목은 해당 사항 없음.
  - 제안: 없음 (확인용 기재).

- **[INFO]** devDependency(`typescript`) 프로덕션 유출 경계 — 새 코드는 기존 격리 구역 안에 머문다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` (신규 함수 `decoratorCallName`), `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`, `codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts`
  - 상세: `typescript` 는 devDependency 다(`dependencies` 에 없음, 프로덕션 설치엔 존재하지 않는다). `codebase/backend/tsconfig.build.json` 은 이미 `src/repo-guards/**` 와 `**/__test-utils__/**` 를 프로덕션 빌드에서 명시적으로 제외하고 있는데, 그 이유가 정확히 "이 디렉터리들이 `typescript`(devDependency)를 import 해 `dist` 로 새 나가면 프로덕션 설치에서 `require("typescript")` 가 지뢰가 된다"(주석 원문)이다. 이번 diff 가 추가하는 `decoratorCallName` 은 이미 `typescript` 를 import 하고 있던 `source-scan.ts`(`__test-utils__` 소속)에 함수를 더한 것이고, 이를 소비하는 두 guard 파일도 `src/repo-guards/**` 소속이다 — 즉 새 코드가 기존 devDependency 격리 경계를 벗어나지 않는다. `pg`·`supertest`·`@jest/globals` 를 쓰는 e2e/spec 파일들도 `test/`·`*spec.ts` exclude 패턴에 포섭된다.
  - 제안: 없음 — 확인 결과 이상 없음. 다만 앞으로 `source-scan.ts` 나 `repo-guards/**` 밖으로 `decoratorCallName`/`ts` import 를 재노출하는 변경이 생기면 이 경계를 다시 점검해야 한다.

- **[INFO]** 내부 의존성 통합 — 역할 서열 단일 진실원(SoT) 신설로 중복 제거
  - 위치: `codebase/backend/src/common/constants/workspace-roles.ts` (신규), 소비처 `common/guards/roles.guard.ts`, `modules/workspaces/workspaces.service.ts`, `modules/workspaces/workspace-invitations.service.ts`, `modules/auth/auth.service.ts`
  - 상세: 종전에 가드의 숫자 서열(`ROLE_HIERARCHY`, roles.guard.ts 내부)과 두 서비스의 `ADMIN_ROLES` 집합이 각자 따로 정의돼 있던 것을 `common/constants/workspace-roles.ts` 하나로 합쳤다. 내부 모듈 의존성 방향은 `common/constants` → (없음, 리프 모듈) 이고 `guards`/`modules/*` → `common/constants` 로 일관되어 순환 의존성이 생기지 않는다. 중복 제거는 의존성 관점에서 바람직한 방향이다.
  - 제안: 없음 — 긍정적 변경으로 기록.

- **[INFO]** 레이어 역전이지만 테스트 전용·의도된 상호 검증 패턴
  - 위치: `codebase/backend/src/common/constants/workspace-roles.spec.ts:8` (`import { WORKSPACE_ROLES } from '../../modules/workspaces/dto/add-member.dto'`)
  - 상세: `common/constants/` (하위 공용 계층) 의 스펙 파일이 `modules/workspaces/dto/` (상위 기능 계층) 를 import 한다 — 통상적인 레이어링 규칙(공용 계층은 기능 모듈을 모른다)의 역방향이다. 다만 (1) 프로덕션 런타임 코드가 아니라 `*spec.ts` 이며 `tsconfig.build.json` 에서 빌드 제외 대상이라 번들·순환 의존성에 영향이 없고, (2) 목적이 "DTO 가 받는 역할 전부가 서열에 있는지" 두 SoT 간 drift 를 잡는 캐너리 테스트로, 이 저장소에 이미 존재하는 패턴(`repo-guards/__tests__/workspace-roles-attachment.spec.ts` 등)과 동일한 설계다.
  - 제안: 조치 불필요. 다만 이런 교차 검증 스펙이 늘어나면 `common/` 에 대한 "하위 계층은 상위를 모른다" 규칙이 테스트 파일에는 적용되지 않는다는 점을 컨벤션 문서에 한 줄 명시해 두면 향후 리뷰에서 반복 지적을 줄일 수 있다(선택 사항, 이번 PR 범위는 아님).

## 요약

이번 변경은 28개 파일에 걸친 백엔드 리팩터(워크스페이스 역할 서열 단일화, `@WorkspaceParam` 데코레이터 신설, repo-guard 테스트 유틸 중복 제거)로, `package.json`/lockfile 변경이 전무하며 diff 전수에서 추출한 모든 import 가 기존에 이미 선언된 의존성(`@nestjs/common`, `typescript`, `pg`, `supertest`, `@jest/globals`)으로 확인되어 새 외부 의존성·버전 변경·라이선스·취약점·번들 크기 이슈는 없다. devDependency(`typescript`)를 쓰는 신규 코드는 기존 `tsconfig.build.json` 격리 경계(`__test-utils__/**`, `repo-guards/**`) 안에 정확히 머물러 프로덕션 유출 위험도 없다. 내부 의존성 측면에서는 역할 서열 로직을 `common/constants/workspace-roles.ts` 하나로 합쳐 중복을 줄인 긍정적 변화이며, 유일하게 눈에 띄는 것은 `common/` 스펙 파일이 `modules/`를 import 하는 레이어 역전인데 이는 테스트 전용 SoT 교차검증 패턴으로 이 저장소의 기존 관행과 일치해 문제로 보지 않는다.

## 위험도

NONE
