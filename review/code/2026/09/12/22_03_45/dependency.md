# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 전 사용 패키지가 기존 devDependencies
  - 위치: `codebase/backend/package.json` (변경 없음), `codebase/backend/src/modules/triggers/triggers.controller.spec.ts`, `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`, `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts`
  - 상세: 이번 diff(`49318bf13` → HEAD, 17개 파일)에는 `package.json`·lockfile 변경이 전혀 없음을 `git diff --stat -- '**/package.json' '**/pnpm-lock.yaml'` 로 확인했다(출력 0건). 새로 추가된 신규 파일 3개(`triggers.controller.spec.ts` 의 HTTP 왕복 describe 블록, `param-uuid-pipe-guard.ts`, `param-uuid-pipe.spec.ts`)가 쓰는 패키지는 다음과 같이 전부 `codebase/backend/package.json` 에 이미 선언되어 있다: `@nestjs/testing`(`^11.0.1`), `supertest`(`^7.0.0`), `typescript`(`^5.7.3`), `@nestjs/common`(`^11.0.1`, `ParseUUIDPipe`), `@nestjs/swagger`(`^11.4.5`, `@ApiParam`). `@jest/globals`·`node:fs`·`node:path` 는 Jest/Node 표준이라 별도 선언이 필요 없다. 내부 유틸(`../../common/__test-utils__/source-scan` 의 `toPosixRelative`/`collectTsFiles`)도 기존 모듈 재사용이며 신규 내부 의존 관계 추가가 아니다(형제 가드 `dto-class-name-collision` 이 이미 같은 유틸을 소비).
  - 제안: 해당 없음 — 새 의존성 도입이 없으므로 버전 고정·라이선스·취약점·번들 크기·호환성 항목 모두 이번 변경의 영향 범위 밖.

- **[INFO]** `triggers.controller.ts`/`auth.controller.ts` 의 `ParseUUIDPipe` 도입은 순수 사용처 확장, 신규 의존 아님
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` (`rotateBotToken` 의 `@Param('id', ParseUUIDPipe)`), `codebase/backend/src/modules/auth/auth.controller.ts` (`@ApiParam({ format: 'uuid' })`)
  - 상세: `ParseUUIDPipe` 는 이미 같은 파일의 `findOne`(파일 4, 82번째 줄)·`update` 등 형제 6곳에서 쓰이던 `@nestjs/common` 내장 파이프이고, `@ApiParam({ format: 'uuid' })` 도 `@nestjs/swagger` 의 기존 API 표면이다. 새 서드파티 패키지나 새 메이저/마이너 버전 요구가 없다.
  - 제안: 없음.

## 요약

이번 변경분(17개 파일, 전부 `49318bf13`..HEAD diff 안에 포함)은 `rotateBotToken` 엔드포인트에 누락된 `ParseUUIDPipe`/`@ApiParam(format:'uuid')` 를 채우고 이를 지키는 AST 기반 repo-guard 를 신설하는 작업으로, 새 외부 패키지 추가·버전 변경·lockfile 변경이 전혀 없다. 신규로 작성된 테스트·가드 코드는 `supertest`·`@nestjs/testing`·`typescript`(컴파일러 API)·`@jest/globals` 등 백엔드에 이미 선언된 devDependency 만 사용하며, 내부 공용 유틸(`source-scan`)을 재사용해 내부 의존 그래프도 새 엣지를 만들지 않는다. 의존성 관점에서는 검토할 리스크가 없다.

## 위험도

NONE
