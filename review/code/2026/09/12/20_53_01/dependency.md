# 의존성(Dependency) 리뷰

## 발견사항

없음. 이 변경은 `package.json`/lockfile 을 건드리지 않으며, 새로 추가된 import 는 전부 기존 의존성(런타임·devDependency 불문)이다.

### 확인 내역 (참고용, 문제 없음)

- **새 의존성 없음**: 17개 변경 파일 중 `package.json`/`pnpm-lock.yaml` 변경이 없다. 새로 등장한 import 는 다음이 전부이고 모두 `codebase/backend/package.json` 에 이미 존재한다(버전 확인 완료): `typescript`(`^5.7.3`, devDependency), `supertest`(`^7.0.0`, devDependency), `@nestjs/testing`(`^11.0.1`), `@nestjs/common`(`^11.0.1`), `@nestjs/swagger`(`^11.4.5`), `@jest/globals`(`^30.0.0`).
- **버전 고정**: 해당 없음(신규 의존성 없음). 기존 버전 범위(`^`)도 이 PR 로 변경되지 않았다.
- **라이선스**: 해당 없음(신규 의존성 없음).
- **취약점**: 해당 없음(신규 의존성 없음). 기존 패키지 버전도 변경되지 않았다.
- **불필요한 의존성**: 신규 가드(`codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`)는 정규식 대신 `typescript` 컴파일러 API 를 직접 사용한다(`ts.createSourceFile`, `ts.forEachChild` 등). 이는 새 의존성이 아니라 같은 디렉터리의 11개 형제 가드(`swagger-dto-contract-guard.ts`, `dto-class-name-collision-guard.ts`, `production-build-devdep-guard.ts` 등)가 이미 쓰는 정본 패턴을 재사용한 것 — 표준 라이브러리로 대체할 이유가 없다(정규식으로 되돌리면 오히려 이 PR 의 plan(`plan/in-progress/trigger-uuid-and-guide-error-codes.md`)이 스스로 기록한 "정규식이 127을 144로 놓친" 실패를 재도입한다).
- **의존성 크기/빌드 시간**: 신규 가드·spec·fixture 는 모두 `codebase/backend/src/repo-guards/**` 아래에 있고, `tsconfig.build.json` 의 exclude 목록에 `"src/repo-guards/**"` 가 이미 있어 프로덕션 빌드 산출물에서 제외된다(직접 확인). 즉 `typescript`(devDependency)가 런타임 번들로 새는 경로가 아니다 — 이 저장소의 자체 가드(`production-build-devdep-guard.ts`)가 지키는 바로 그 불변식과 일치한다. `triggers.controller.spec.ts` 의 `supertest` 기반 HTTP 왕복 3케이스 추가도 devDependency 범위 안이고, 이미 `health.controller.spec.ts` 에서 같은 패턴(`Test.createTestingModule` + `supertest` + `INestApplication`)을 사용 중이라 빌드 시간에 미치는 한계 영향은 미미하다.
- **호환성**: 기존 의존성 버전과 충돌 없음. `ts.getDecorators` API 는 TS 4.8+ 에서 안정 API 이고 저장소 pin(`^5.7.3`)과 호환되며, 형제 가드들이 이미 동일 API 를 쓴다.
- **내부 의존성**:
  - `triggers.controller.ts` 의 `ParseUUIDPipe` 는 이미 파일 상단 `@nestjs/common` import 목록에 있던 것을 사용에 추가한 것뿐 — 새 import 문 없음(전체 파일 컨텍스트 1~14행에서 확인).
  - `triggers.controller.spec.ts` 가 새로 끌어온 `GlobalExceptionFilter`(`../../common/filters/http-exception.filter`)는 기존 공용 필터를 테스트에서 재사용하는 것으로, 형제 `health.controller.spec.ts` 와 동일한 내부 의존 방향이라 계층 위반 없음.
  - `param-uuid-pipe-guard.ts`/`param-uuid-pipe.spec.ts` 가 `common/__test-utils__/source-scan`(`toPosixRelative`, `collectTsFiles`)에 의존하는 것도 다수 형제 가드가 공유하는 기존 유틸이라 신규 결합이 아니다.
  - `sample.controller.ts` fixture 는 `repo-guards/__tests__/fixtures/` 아래에 있어 가드의 프로덕션 스캔 루트(`src/modules`) 밖이고, `@nestjs/common`/`@nestjs/swagger` 만 참조 — 순환·계층 역전 없음.

## 요약

이번 변경은 `rotateBotToken` 엔드포인트에 `ParseUUIDPipe`/`@ApiParam(format:'uuid')` 두 축을 채우고 이를 지키는 정적 가드(AST 기반)·HTTP 왕복 테스트·문서(MDX·i18n 라벨) 정정으로 구성되며, 의존성 관점에서는 **변경 표면이 전혀 없다** — `package.json`/lockfile 수정 없음, 신규 외부 패키지 없음, 모든 신규 import 는 이미 선언된 의존성(대부분 devDependency)이고 기존 형제 가드·형제 스펙과 동일한 패턴을 재사용한다. 신규 가드 코드가 `typescript` 컴파일러 API 를 쓰지만 `repo-guards/**` 는 `tsconfig.build.json` 에서 이미 제외되어 있어 devDependency 가 프로덕션 빌드로 새지 않는다는 이 저장소 자체 불변식과도 일치한다.

## 위험도

NONE
