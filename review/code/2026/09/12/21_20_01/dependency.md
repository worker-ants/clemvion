# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — `package.json`/lockfile 변경 0건
  - 위치: 저장소 전체 diff (`git diff origin/main...HEAD --name-only` 로 17개 변경 파일 확인, `package.json`·`pnpm-lock.yaml` 미포함)
  - 상세: 이번 배치는 `rotateBotToken` 의 `ParseUUIDPipe` 누락 수정 + 신규 repo-guard(`param-uuid-pipe`) + 문서/i18n 라벨 귀속 정정으로 구성되며, 어느 파일도 새 외부 의존성을 도입하지 않았다. 신규 guard 파일(`param-uuid-pipe-guard.ts`)이 쓰는 `typescript`(`import * as ts from 'typescript'`)와 `node:fs`, 신규 HTTP 왕복 테스트(`triggers.controller.spec.ts`)가 쓰는 `supertest`·`@nestjs/testing`·`@jest/globals` 는 전부 `codebase/backend/package.json` 에 기존 devDependency 로 이미 선언되어 있다 (`supertest ^7.0.0`, `typescript ^5.7.3`, `@jest/globals ^30.0.0`, `@nestjs/testing ^11.0.1` — grep 으로 확인).
  - 제안: 조치 불필요 (정보성 확인).

- **[INFO]** 내부 의존성(신규 import) — 모두 기존 관례를 따르는 재사용, 새 결합 방향 아님
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` (`import { toPosixRelative } from '../../common/__test-utils__/source-scan'`), `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts` (`import { collectTsFiles } from '../../common/__test-utils__/source-scan'`), `codebase/backend/src/modules/triggers/triggers.controller.spec.ts` (`import { GlobalExceptionFilter } from '../../common/filters/http-exception.filter'`, `import request from 'supertest'`, `import { Test } from '@nestjs/testing'`)
  - 상세: `source-scan.ts` 의 `collectTsFiles`/`toPosixRelative` 는 이미 다른 형제 repo-guard(`swagger-dto-contract-guard.ts`, `engine-error-code-anchor-guard.ts`, `redis-fail-open-catalog-guard.ts` 등)가 동일하게 import 하는 공용 테스트 유틸이라 새 결합 방향이 아니다. `triggers.controller.spec.ts` 가 `Test.createTestingModule` + `supertest` + `GlobalExceptionFilter` 로 실제 Nest 파이프라인을 태우는 패턴도 형제 `health.controller.spec.ts` 가 이미 쓰던 형태(동일하게 `supertest` import·`Test.createTestingModule` 사용)를 그대로 따른 것으로 확인했다. `param-uuid-pipe-guard.ts`/`.spec.ts` 는 신규 파일이지만 production 코드(`src/modules/**`)를 향한 read-only 스캔이라 런타임 의존 그래프에는 영향이 없다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 fixture 는 프로덕션 스캔 루트 밖에 격리됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts`
  - 상세: 이 fixture 는 `@Controller`/`@Param`/`ParseUUIDPipe`/`@ApiParam` 등 실제 프로덕션 코드와 같은 데코레이터를 쓰지만, 가드의 프로덕션 스캔 루트가 `src/modules` 로 한정되어 있어(`param-uuid-pipe.spec.ts` 의 `SCAN_ROOT = path.join(SRC_ROOT, 'modules')`) 이 파일은 그 판정 대상에 들지 않는다. 파일 자체 주석이 "`src/` 전체를 훑는 형제 가드(`swagger-dto-contract`, `nullable-type-lie-cast`)는 이 파일도 순회한다"는 사실을 명시해 두어, 다른 전수 스캔 가드와의 상호작용도 인지하고 있다. 의존성 관점에서 문제 되는 순환·결합은 없다.
  - 제안: 조치 불필요.

- **[INFO]** 버전 고정 관찰(참고, 이번 diff 의 결함 아님)
  - 위치: `codebase/backend/package.json:96,99,124,129`
  - 상세: 이번 PR 이 새로 참조하는 기존 의존성들(`@jest/globals`, `@nestjs/testing`, `supertest`, `typescript`)은 모두 caret(`^`) 범위로 선언되어 있다. 이는 이 diff 가 만든 상태가 아니라 저장소의 기존 pinning 정책이며, 이번 변경이 그 정책을 바꾸거나 위반하지 않는다.
  - 제안: 조치 불필요 — 별도 pinning 정책 이슈로 다룰 사안이면 이 PR 범위 밖에서 논의.

## 요약

이번 변경은 `rotateBotToken` 엔드포인트의 `ParseUUIDPipe` 누락 수정, 그 계약을 고정하는 신규 정적 repo-guard, 관련 HTTP 왕복 테스트, 그리고 문서/i18n 라벨의 오귀속 정정(에러 코드·환경변수명)으로 구성되며 **새 외부 패키지·버전 변경·lockfile 변경이 전혀 없다**. 신규 파일이 사용하는 모든 외부 심볼(`typescript`, `supertest`, `@nestjs/testing`, `@jest/globals`)은 backend `package.json` 에 이미 선언된 기존 devDependency 이고, 신규 내부 import(`source-scan.ts` 유틸, `GlobalExceptionFilter`)도 형제 파일들이 이미 쓰던 패턴을 그대로 재사용한 것으로 실측 확인했다. 라이선스·취약점·번들 크기·호환성 축은 해당 사항이 없다.

## 위험도

NONE
