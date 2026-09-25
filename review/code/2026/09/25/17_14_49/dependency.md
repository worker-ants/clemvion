# 의존성(Dependency) 리뷰 — workspace-path-guard

## 검토 범위

`codebase/backend/**` 27개 파일 (`common/__test-utils__`, `common/constants/workspace-roles.*`,
`common/decorators/*`, `common/guards/roles.guard.*`, `modules/auth`, `modules/executions`,
`modules/workspaces/*`, `repo-guards/__tests__/*`, `test/*.e2e-spec.ts`). `package.json` ·
`pnpm-lock.yaml` 등 의존성 매니페스트는 이번 diff 에 포함되지 않았다
(`git diff --stat origin/main...HEAD -- codebase/` 로 확인, 27개 파일 전부 `.ts` 소스/테스트).

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음
  - 위치: 전체 changeset (`git diff --stat origin/main...HEAD -- codebase/`)
  - 상세: 이번 diff 에서 등장하는 import 는 모두 이미 `codebase/backend/package.json` 에 존재하는
    기존 의존성뿐이다 — `@nestjs/common`(`^11.0.1`), `@nestjs/core`, `typescript`(`^5.7.3`),
    `@jest/globals`(`^30.0.0`), `pg`(`^8.23.0`), `supertest`(`^7.0.0`), `node:fs`/`node:path`.
    새 devDependency/dependency 항목, lockfile 변경, `package.json` 변경이 전혀 없다. 따라서
    버전 고정·라이선스·취약점·번들 크기·기존 의존성과의 충돌 항목은 이번 변경 범위에서 해당 없음.
  - 제안: 없음 (정보성 확인).

- **[INFO]** `source-scan.ts` 신규 함수(`decoratorCallName`)는 이미 격리된 devDependency 표면 안에 머문다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` (게이트 140-146, `decoratorCallName`)
  - 상세: 추가된 함수는 그 파일이 이미 import 하고 있는 `typescript`(devDependency) 의 `ts.Decorator`
    / `ts.isCallExpression` 만 사용하고 새 import 를 추가하지 않는다. `typescript` 는 프로덕션 런타임에
    없는 devDependency 라 dist 유출이 우려되는 지점인데, `tsconfig.build.json` 이 `**/__test-utils__/**`
    전체를 이미 exclude 하고 있어(주석에 이 파일의 devDependency 유출 이력이 명시돼 있다) 이번 추가로
    새로운 노출 표면이 생기지 않는다. 확인: `codebase/backend/tsconfig.build.json` exclude 목록.
  - 제안: 없음 — 기존 격리 경계가 이번 변경에도 그대로 유효함을 확인.

- **[INFO]** 내부 의존성 정리(DRY) — 중복 제거가 목적에 부합하는 방향
  - 위치:
    - `codebase/backend/src/common/__test-utils__/source-scan.ts` (`decoratorCallName` export 신설)
    - `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`,
      `codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts`
      (로컬 중복 함수 삭제 → 공유 함수 import 로 교체)
    - `codebase/backend/src/common/constants/workspace-roles.ts` (신설) →
      `codebase/backend/src/common/guards/roles.guard.ts`,
      `codebase/backend/src/modules/auth/auth.service.ts`,
      `codebase/backend/src/modules/workspaces/workspaces.service.ts`,
      `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` 가 공유
  - 상세: 두 axis 모두 이전에 파일마다 흩어져 있던 로직(데코레이터 이름 파싱, 역할 서열/거부 본문)을
    단일 모듈로 승격해 여러 소비처가 참조하는 구조다. `source-scan.ts` 헤더 주석이 이 정리가
    `review/code/2026/09/25/16_39_25` maintainability WARNING 후속 조치임을 명시하고 있어 의도된
    리팩터다. 순환 의존은 관찰되지 않는다 — `common/constants` → `common/guards`/`modules/*` 방향
    단방향이고, `common/guards/roles.guard.ts` 가 기존부터 갖고 있던
    `../../modules/workspaces/workspaces.service` 역참조(레이어 역전)는 이번 diff 가 만든 것이
    아니라 diff 컨텍스트 줄(unchanged)로 이미 존재하던 것이다.
  - 제안: 없음 — 방향이 옳다. 다만 `common/guards` → `modules/workspaces` 의 기존 레이어 역전은
    별도 아키텍처 이슈이며 이번 변경의 책임 범위 밖.

## 요약

이번 changeset 은 backend 내부 리팩터/테스트 추가로 한정되며, `package.json`·lockfile 변경이나
새 외부 패키지 도입이 전혀 없다. 사용된 모든 import 는 기존 의존성(`@nestjs/*`, `typescript`,
`pg`, `supertest`, `@jest/globals`, Node 내장 모듈)이며 이미 버전이 고정/캐럿 범위로 관리되고 있어
버전 고정·라이선스·취약점·번들 크기·의존성 충돌 항목은 해당 없음. `typescript` devDependency 를
쓰는 신규 함수(`decoratorCallName`)도 기존 `tsconfig.build.json` exclude 경계 안에 머물러 프로덕션
유출 위험이 없다. 유일하게 의미 있는 축은 내부 모듈 의존 관계인데, `workspace-roles.ts` 상수 모듈과
`source-scan.ts` 의 `decoratorCallName` export 로 중복 로직을 단일 소스로 모으는 방향이라 긍정적이며
새로운 순환/역전 의존을 만들지 않는다.

## 위험도

NONE
