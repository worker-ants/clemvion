# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** 부팅 시퀀스에 새로운 fail-closed 정지 지점 도입 (`assertWorkspaceIdReflectionWorks`)
  - 위치: `codebase/backend/src/main.ts:168` (호출부), `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:91-115` (`assertWorkspaceIdReflectionWorks` 정의)
  - 상세: `bootstrap()` 안에서 `app` 생성 직후 `assertWorkspaceIdReflectionWorks(app)` 를 호출한다. 인식된 `@WorkspaceId()` 소비 라우트가 0건이면 `WorkspaceIdReflectionBrokenError` 를 throw 한다. `main.ts` 끝의 `void bootstrap();`(main.ts:239) 은 반환값을 버리고 `unhandledRejection` 핸들러도 저장소에 없음을 확인했다(`grep -rn "unhandledRejection\|uncaughtException" codebase/backend/src` 0건) — 즉 이 예외는 Node 의 기본 unhandled-rejection 정책(Node ≥15: 프로세스 종료)에 그대로 노출된다. `backend/package.json` 의 `engines.node` 는 `>=24` 로 고정돼 있어(gate 132-134) 이 fail-closed 가정이 실제로 성립함을 확인했다. **의도된 설계**(CHANGELOG.md:34-37, plan 문서, 캐너리 자체 JSDoc 이 모두 이 위험을 명시)이며 e2e 로 실제 앱 부팅 경로에서 통과가 검증됐다. 다만 이 지점이 "새로운 프로세스 종료 트리거"라는 사실 자체는 배포 파이프라인(헬스체크 재시도 정책, 알림)이 일반 크래시와 구분해 인지하는지 운영 관점에서 재확인할 가치가 있다.
  - 제안: 조치 불요 — 근거·테스트가 충분. 배포 런북에 "부팅 실패 시 `[SECURITY]` 로그 라인을 먼저 볼 것"이 이미 예외 메시지에 내장돼 있어 운영자 관측 경로는 갖춰져 있다.

- **[INFO]** `app.module.ts` 전역 `imports` 에 `DiscoveryModule` 추가
  - 위치: `codebase/backend/src/app.module.ts:4-10`(import), `:79-82`(`imports` 배열)
  - 상세: `DiscoveryService`/`MetadataScanner` 를 루트 인젝터에 등록한다. 요청 경로(가드·인터셉터·미들웨어)에는 관여하지 않고 부팅 시 `main.ts` 에서 `app.get(DiscoveryService)`/`app.get(MetadataScanner)` 로 1회 소비되는 용도임을 코드 주석(app.module.ts:79-80)과 실제 사용처(`workspace-reflection-canary.ts:95-96`) 모두에서 확인했다. `DiscoveryModule` 은 `@Global()` 이 아니므로 다른 모듈 provider 와 충돌하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 공용 헬퍼 `resolveRequestWorkspaceContext` 가 순수 함수 → 조건부 throw 함수로 계약 확장
  - 위치: `codebase/backend/src/common/utils/workspace-context.util.ts:74-79`(신규 throw 블록), `:8-9`(신규 import)
  - 상세: 이 함수는 `RolesGuard.canActivate`(`common/guards/roles.guard.ts:124`)와 `WorkspaceId` 데코레이터 팩토리(`common/decorators/workspace.decorator.ts:33`) 두 곳에서만 소비된다(`grep -rn resolveRequestWorkspaceContext` 로 전수 확인, `.spec.ts` 제외 2곳). 두 호출부 모두 try/catch 로 감싸지 않아 `BadRequestException` 이 Nest 의 가드/파라미터 데코레이터 예외 전파 경로를 그대로 타고 `GlobalExceptionFilter` 까지 도달한다 — 정상적인 NestJS 패턴이며 삼켜지는 경로 없음을 확인했다. 함수 시그니처(매개변수/반환 타입) 자체는 안 바뀌었지만 **동작 계약**이 넓어진 것이므로, 이 헬퍼를 새로 호출하는 코드가 향후 추가될 경우 throw 가능성을 놓치기 쉽다. JSDoc 에는 이유가 상세히 적혀 있으나 `@throws` 태그는 없다.
  - 제안: 사소 — JSDoc 에 `@throws {BadRequestException}` 한 줄 추가하면 IDE 자동완성에서도 계약이 드러난다. 이번 PR 범위에서 실질 결함은 아니다.

- **[INFO]** 외부에 노출되는 HTTP 응답 코드 변경 (의도된 인터페이스 변경, 문서화됨)
  - 위치: `CHANGELOG.md:39-44`, `codebase/backend/src/common/utils/workspace-context.util.ts:74-79`
  - 상세: 형식이 깨진 `X-Workspace-Id` 헤더를 보내는 클라이언트는 종전 500 `INTERNAL_ERROR`(DB SQLSTATE 22P02 마스킹) 대신 이제 400 `VALIDATION_ERROR` 를 받는다. 클라이언트에 보이는 응답 코드가 바뀌는 공개 API 동작 변경이지만, CHANGELOG 에 명시적으로 기록돼 있고 이전 동작이 결함(에러 마스킹)이었다는 근거도 충분하다.
  - 제안: 조치 불요.

- **[INFO]** `main.ts` 는 유일한 HTTP 진입점 — CLI 스크립트는 캐너리를 우회하지만 HTTP 라우트를 노출하지 않음
  - 위치: `codebase/backend/src/scripts/generate-golden-set.ts:184`, `codebase/backend/src/scripts/eval-retrieval.ts:144`
  - 상세: 두 스크립트는 `NestFactory.createApplicationContext(EvalCliModule, …)` 를 쓰며 `AppModule` 이 아닌 별도 `EvalCliModule` 을 로드하고 `app.listen()` 을 호출하지 않는다(grep 확인). 따라서 `RolesGuard`/`@WorkspaceId()` 가 보호하는 HTTP 라우트는 노출되지 않고, 이 캐너리를 거치지 않아도 실제 보안 커버리지 공백은 없다.
  - 제안: 조치 불요 — 확인 목적의 기록.

## 요약

이번 변경의 핵심 부작용은 (1) 부팅 시 `DiscoveryService` 기반 reflection 캐너리를 신설해 실패 시 프로세스를 fail-closed 로 종료시키는 것과 (2) 기존 공용 헬퍼 `resolveRequestWorkspaceContext` 가 조건부로 `BadRequestException` 을 던지도록 계약이 확장된 것 두 가지다. 두 변경 모두 전역 상태·환경 변수·파일시스템·네트워크 호출에는 관여하지 않고, 소비처가 명확히 한정돼 있으며(호출부 전수 grep 으로 확인), 예외 전파 경로가 Nest 의 표준 처리 메커니즘을 그대로 타 삼켜지는 지점이 없음을 소스 레벨에서 직접 확인했다. 두 변경 모두 CHANGELOG·plan 문서·소스 주석에 의도와 위험이 상세히 기록돼 있고 회귀 테스트(단위+e2e)로 뒷받침돼, 새로 발견된 미문서화 부작용은 없다.

## 위험도

LOW
