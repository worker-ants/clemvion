# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — `package.json`/lockfile 미변경
  - 위치: 변경 파일 목록 전체 (diff 에 `package.json`·`pnpm-lock.yaml` 없음 — `grep` 확인)
  - 상세: 이번 diff(17개 파일: `CHANGELOG.md`, `auth.controller.ts`, `triggers.controller.ts`/`.spec.ts`, 신규 가드 3파일, 문서 mdx 6개, `backend-labels.ts`/`.test.ts`, plan 2개)에서 신규 외부 패키지를 추가하는 변경은 없다. `triggers.controller.spec.ts` 에 새로 등장한 `import request from 'supertest'`, `import { Test } from '@nestjs/testing'`, `import { INestApplication } from '@nestjs/common'` 는 모두 `codebase/backend/package.json` 에 이미 있는 dependency(`supertest: ^7.0.0`, `@nestjs/testing`, `@nestjs/common`)이고, 같은 패턴이 형제 파일 `codebase/backend/src/modules/health/health.controller.spec.ts` 에 이미 존재한다(신규 도입 아님, 기존 관례 재사용).
  - 제안: 없음 — 정보성.

- **[INFO]** 신규 가드가 쓰는 `typescript` AST API 는 기존 devDependency 재사용
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` (`import * as ts from 'typescript'`)
  - 상세: `codebase/backend/package.json:129` 에 `"typescript": "^5.7.3"` 로 이미 고정되어 있고, `repo-guards/__tests__/` 하위의 다른 10여 개 가드(`swagger-dto-contract-guard.ts`, `dto-class-name-collision-guard.ts`, `masked-reject-callers-guard.ts` 등)가 이미 같은 방식으로 `typescript` 를 정적 파서로 사용 중이다. 새 devDependency 추가가 아니라 기존 패턴의 반복이며, 버전 고정도 기존 `^5.7.3` 그대로다.
  - 제안: 없음 — 정보성.

- **[INFO]** 내부 의존성: 신규 가드는 기존 공유 테스트 유틸을 그대로 재사용
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` → `import { toPosixRelative } from '../../common/__test-utils__/source-scan'`; `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts` → `import { collectTsFiles } from '../../common/__test-utils__/source-scan'`
  - 상세: `collectTsFiles`/`toPosixRelative` 는 `codebase/backend/src/common/__test-utils__/source-scan.ts` 에 이미 존재하는(diff 에 포함되지 않은, 즉 이번 PR 이 새로 만들지 않은) 공유 유틸리티다. 형제 가드들도 이미 이 모듈을 공유하고 있어, 새 내부 모듈 결합(coupling)이 추가되는 것이 아니라 기존 계층 구조(`repo-guards/__tests__/*-guard.ts` → `common/__test-utils__/source-scan`)를 그대로 따른 것이다. 순환 의존이나 계층 위반은 관찰되지 않는다.
  - 제안: 없음 — 정보성.

- **[INFO]** `triggers.controller.ts` 의 `ParseUUIDPipe` 사용은 이미 임포트된 심볼의 적용 범위 확장일 뿐
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 핸들러의 `@Param('id', ParseUUIDPipe)`
  - 상세: `ParseUUIDPipe` 는 해당 파일 상단(`import { ..., ParseUUIDPipe, ... } from '@nestjs/common'`)에 이미 임포트되어 있고 같은 파일의 다른 6개 핸들러(`findOne`, `update`, `getHistory`, `remove` 등)에서 이미 사용 중이다. 이번 변경은 새 임포트나 새 의존성이 아니라 기존 사용 패턴을 누락됐던 한 자리에 적용한 것이다.
  - 제안: 없음 — 정보성.

- **[INFO]** 신규 fixture 파일(`sample.controller.ts`)의 임포트도 기존 의존성만 사용
  - 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts`
  - 상세: `@nestjs/common`(`Controller, Get, Param, ParseUUIDPipe, Post`), `@nestjs/swagger`(`ApiExcludeEndpoint, ApiParam`) 모두 이미 프로젝트 의존성이며, 이 파일은 프로덕션 스캔 루트(`src/modules`) 밖에 위치해 런타임 번들·빌드에 포함되지 않는다(테스트 전용 fixture).
  - 제안: 없음 — 정보성.

## 요약

이번 변경 세트(백엔드 컨트롤러 2곳의 `ParseUUIDPipe`/`@ApiParam` 보강, 신규 AST 기반 repo-guard 3파일, 프런트엔드 문서·라벨 매핑 수정, CHANGELOG·plan 갱신)에는 신규 외부 패키지 추가, 버전 변경, lockfile 수정이 전혀 없다. 새로 등장한 임포트(`supertest`, `@nestjs/testing`, `INestApplication`, `typescript` AST API, `ParseUUIDPipe`)는 모두 이미 프로젝트에 고정되어 있는 기존 dependency 이며, 사용 패턴도 저장소 내 형제 파일(`health.controller.spec.ts`, 다른 `repo-guards/__tests__/*-guard.ts`)과 동일해 새로운 라이선스·취약점·버전 충돌 리스크가 없다. 내부 모듈 의존 관계도 신규 가드가 기존 공유 테스트 유틸(`common/__test-utils__/source-scan`)을 그대로 재사용하는 형태로, 계층 구조나 순환 의존 문제는 관찰되지 않는다. 의존성 관점에서는 검토할 실질적 리스크가 없다.

## 위험도

NONE
