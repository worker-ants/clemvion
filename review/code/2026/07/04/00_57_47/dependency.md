# 의존성(Dependency) Review — PR3 크래시/재시작 RUNNING 세그먼트 제어된 re-drive

대상 범위: 28개 변경 파일 (`codebase/backend/src/modules/execution-engine/*`, `codebase/backend/src/modules/executions/executions.controller.ts`, `codebase/backend/test/execution-crash-redrive.e2e-spec.ts`, `plan/**`, `review/consistency/**`, `spec/**`).

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 신규 npm 패키지 추가 0건
  - 위치: 변경 파일 전체 (`package.json`, `pnpm-lock.yaml` 등 매니페스트 파일이 diff 목록에 없음 — `git diff origin/main --stat`로 확인)
  - 상세: 이번 변경은 (1) `execution-engine.service.ts`/`execution-engine.service.spec.ts`/`graph-dispatch.types.ts`/`executions.controller.ts` 내부 로직 리팩터(`recoverStuckExecutions` fail-only → 원자 re-claim + rehydration re-drive), (2) 신규 e2e 스펙 파일(`execution-crash-redrive.e2e-spec.ts`), (3) plan/spec/review 문서 갱신으로 구성된다. 신규 `import` 라인은 기존 `ai-conversation-helpers` 모듈에서 이미 존재하는 `RehydrationError`를 추가로 가져오는 것과 `@nestjs/common`의 `NotFoundException`, `@nestjs/swagger`의 `ApiExcludeEndpoint` 뿐이며, 모두 이미 프로젝트에 설치된 기존 의존성(NestJS core/swagger)의 이미 사용 중인 export 다. e2e 스펙이 사용하는 `pg`(`Client`), `supertest`, `@jest/globals`, `crypto`(`randomUUID`)도 기존 backend test 의존성/Node 표준 라이브러리 재사용이다.
  - 제안: 조치 불필요.

- **[INFO]** 버전 고정(pinning) — 해당 없음
  - 상세: 신규 패키지 도입이 없으므로 버전 고정 이슈도 발생하지 않는다. 기존 `pnpm-lock.yaml`은 변경되지 않았다.

- **[INFO]** 라이선스 호환성 — 해당 없음
  - 상세: 신규 외부 패키지가 없어 라이선스 검토 대상이 없다.

- **[INFO]** 알려진 취약점 — 해당 없음
  - 상세: 의존성 그래프 변경이 없으므로 신규 취약점 표면도 없다. 코드 변경 자체(원자 UPDATE... RETURNING 기반 re-claim, in-process 재구동)는 보안 리뷰어(별도 관점) 영역이며 의존성 관점에서는 이슈 없음.

- **[INFO]** 불필요한 의존성/표준 라이브러리 대체 가능성 — 해당 없음
  - 상세: `redriveStuckExecution`/`reclaimStuckRunningExecution`는 TypeORM `createQueryBuilder`(기존 의존성)만 사용하며 신규 라이브러리(e.g., 별도 job-queue, retry 라이브러리)를 끌어오지 않는다. BullMQ `maxStalledCount`/`attempts` 설정도 기존 큐 설정 유지(변경 없음, PR4로 이연)이므로 신규 의존성 검토 대상이 아니다.

- **[INFO]** 의존성 크기/번들·빌드 시간 영향 — 없음
  - 상세: 순수 내부 로직·문서 변경이라 번들 크기·빌드 시간에 미치는 영향은 사실상 0이다. 신규 파일(`execution-crash-redrive.e2e-spec.ts`)은 e2e 전용이라 production 번들에 포함되지 않는다.

- **[INFO]** 기존 의존성과의 버전 충돌/호환성 — 해당 없음
  - 상세: `@jest/globals`, `supertest`, `pg` 등 e2e 스펙이 사용하는 것들은 기존 backend test suite(`codebase/backend/test/**`)의 다른 e2e 스펙들과 동일한 이미 검증된 조합이다. 신규/변경 버전 지정 없음.

- **[INFO]** 내부 의존성(모듈 간 결합) — `ExecutionsController` → `ExecutionEngineService.runStuckRecoveryScan()` 신규 결합, 프로덕션 노출 게이팅 확인
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts` (`POST /executions/_test/recover-stuck-executions`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`runStuckRecoveryScan` public 메서드 신설)
  - 상세: 컨트롤러가 서비스 계층의 새 public 메서드 `runStuckRecoveryScan()`(내부적으로 `private recoverStuckExecutions()`를 호출)에 의존하는 것은 기존 계층 구조(controller → service)를 그대로 따르는 정상적인 내부 의존이다. `NODE_ENV !== 'test'` 가드로 프로덕션 표면에서 제외했고 `@ApiExcludeEndpoint()`로 Swagger 문서에서도 숨겼다 — e2e 전용 우회 경로가 실제 API 계약(외부 의존성 관점에서의 "표면")에 포함되지 않도록 적절히 격리됐다. `redriveStuckExecution`이 `rehydrateContext`/`loadAndBuildGraph`/`runNodeDispatchLoop`/`driveStuckRedrive`/`markExecutionCancelled` 등 기존 private 메서드들을 재사용하는 것도 신규 결합이 아니라 기존 내부 API 표면의 재사용이며, `graph-dispatch.types.ts`의 `skipExecutedNodes?: boolean` 옵션 필드 추가는 기존 `NodeDispatchLoopParams` 인터페이스를 확장하는 하위 호환적 변경(옵션 필드, 미전달 시 기존 동작 그대로)이라 호출부(`runExecution`/case A 경로) 파손 위험이 없다.
  - 제안: 조치 불필요 — 기존 계층 구조·캡슐화 원칙(private 메서드 재사용, 옵션 필드로 하위 호환 확장)을 잘 지켰다.

- **[INFO]** plan/spec 문서 변경의 "의존성" — 순수 문서 동기화, 코드 의존성 영향 없음
  - 위치: `spec/1-data-model.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md`, `plan/in-progress/exec-park-durable-resume.md`, `plan/in-progress/spec-draft-crash-running-redrive.md`, `review/consistency/**`
  - 상세: 이들은 `WORKER_HEARTBEAT_TIMEOUT` 의미 축소, `recoverStuckExecutions` 동작 서술 갱신 등 문서 동기화이며 런타임 의존성 그래프에 영향이 없다. (별도 관점인 consistency/spec 리뷰어가 이미 W1~W4 WARNING을 통해 문서 정합성을 다뤘고 BLOCK:NO로 해소됨을 확인 — 본 리뷰 범위인 의존성 관점에서는 추가 지적 사항 없음.)

## 요약

이번 변경은 전적으로 기존 backend 애플리케이션 코드(`execution-engine.service.ts` 등)의 내부 로직 리팩터와 신규 e2e 테스트, 그리고 관련 plan/spec 문서 동기화로 구성되며, `package.json`/`pnpm-lock.yaml` 등 의존성 매니페스트는 전혀 건드리지 않는다. 새로 등장하는 import(`RehydrationError`, `NotFoundException`, `ApiExcludeEndpoint`, e2e의 `pg`/`supertest`/`@jest/globals`)는 모두 이미 프로젝트에 설치된 기존 외부 패키지의 export 재사용이거나 Node 표준 라이브러리(`crypto`)이며, 신규 서드파티 패키지 도입·버전 변경·라이선스 이슈·취약점 노출은 발견되지 않았다. 신규 e2e 전용 엔드포인트(`_test/recover-stuck-executions`)는 `NODE_ENV` 가드와 Swagger 제외로 프로덕션 API 표면 확장 없이 적절히 격리되었고, `NodeDispatchLoopParams.skipExecutedNodes` 옵션 필드 추가도 하위 호환적이라 기존 호출부와의 충돌이 없다. 의존성 관점에서는 검토할 실질적 리스크가 없다.

## 위험도

NONE
