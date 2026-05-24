# 문서화(Documentation) 리뷰 결과

**리뷰 대상**: workflow-resumable-execution Phase 1.1 + 1.2 (Graceful Shutdown + Recovery 정책 변경)
**리뷰 일자**: 2026-05-25
**파일 수**: 28개 (코드 8개, 테스트 2개, plan/review 산출물 18개)

---

## 발견사항

### [INFO] `ShutdownStateService` 클래스 수준 JSDoc — 양호
- 위치: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` L20–39
- 상세: 클래스 상단에 Phase 참조, SoT 링크, 4단계 동작 개요, 다중 인스턴스 WHERE 절 의도까지 포함한 상세 JSDoc 이 작성되어 있다. 공개 getter(`isShuttingDown`, `inFlightCount`, `retryAfterSec`)와 `registerInFlight` / `unregisterInFlight` 메서드 각각에도 1–2줄 주석이 있어 최소 기대치를 충족한다.
- 제안: 없음.

---

### [INFO] `recoverStuckExecutions()` JSDoc 업데이트 — 정확성 확보됨
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (diff 내 JSDoc 블록)
- 상세: 구 주석("WAITING_FOR_INPUT 이 … stuck 으로 간주")이 새 동작("RUNNING execution 의 heartbeat 미응답")과 일치하도록 완전히 교체되었다. `STUCK_RECOVERY_STALE_MS` 상수 주석, `recoverStuckExecutions` 메서드 주석 모두 변경된 SQL WHERE 절(`status = 'running'`)과 일치한다.
- 제안: 없음.

---

### [INFO] `main.ts` 인라인 주석 — 목적·SoT·부재 시 부작용 모두 기술
- 위치: `codebase/backend/src/main.ts` L35–41 (diff 기준)
- 상세: `app.enableShutdownHooks()` 추가 시 "본 호출이 없으면 ShutdownStateService.onApplicationShutdown 이 SIGTERM 도착해도 트리거되지 않아 in-flight node execution 이 SERVER_INTERRUPTED 로 마킹되지 못한다"는 부재 시 결과까지 명시하고 있다. 간결하고 충분한 설명이다.
- 제안: 없음.

---

### [INFO] 테스트 주석 — 회귀 가드 의도 명시
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` L139–142, L167–183
- 상세: `WAITING_FOR_INPUT 은 recovery WHERE 절에 절대 포함되지 않는다` 테스트 케이스 앞에 Phase 참조·행동 변화 배경·운영 회귀 위험을 기술하는 블록 주석이 추가되었다. 이는 테스트 의도 문서화의 모범적 패턴이다.
- 제안: 없음.

---

### [WARNING] `ShutdownStateService.fromConfig()` 정적 팩토리 — 미사용 가능성 및 문서 미비
- 위치: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` L69–80
- 상세: `static fromConfig(config: ConfigService, ...)` 팩토리 메서드가 구현되어 있으나, 실제 `ExecutionEngineModule` 에서는 `useFactory: () => Number(process.env.SIGTERM_GRACE_MS ?? 30_000)` 방식의 DI 프로바이더를 사용한다. `fromConfig` 는 어디서도 호출되지 않는 것으로 보인다. 주석에 "DI 의 ConfigService 우선 적용은 ShutdownStateService.forRoot 형태가 필요하면 추후 도입" 이라고 기재되어 있으나, 현재 상태에서 `fromConfig` 가 dead code 인지 아닌지가 불명확하다.
- 제안: (a) 사용처가 없다면 이 메서드를 제거하거나, (b) 사용될 예정이라면 JSDoc 에 "현재 미사용 — Phase 2 에서 ConfigService 기반 초기화 시 활용 예정" 을 명시해 의도를 드러낸다.

---

### [WARNING] `WorkflowsController.execute()` 에 503 응답 Swagger 문서 누락
- 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` L200–234
- 상세: `execute` 핸들러에 `@ApiBadRequestResponse`, `@ApiUnauthorizedResponse`, `@ApiForbiddenResponse`, `@ApiNotFoundResponse` 데코레이터는 존재하지만, 신규로 추가된 503 `SERVICE_UNAVAILABLE` 응답에 대한 `@ApiServiceUnavailableResponse` 또는 `@ApiResponse({ status: 503 })` 데코레이터가 없다. `spec/conventions/swagger.md` 에서 명시적 응답 코드 문서화를 의무화하는 경우 직접 위반이다.
- 제안: 핸들러에 다음 형태의 Swagger 어노테이션 추가:
  ```ts
  @ApiResponse({
    status: 503,
    description: '서버 종료 중 — Retry-After 헤더 참조 후 재시도',
  })
  ```
  또는 프로젝트가 사용하는 래퍼 데코레이터 패턴 (예: `@ApiServiceUnavailableResponse`) 으로 표현.

---

### [WARNING] `SIGTERM_GRACE_MS` 환경변수 — README / 운영 설정 문서 업데이트 누락
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.module.ts` L74–78, `plan/in-progress/self-hosting-deployment.md`
- 상세: `SIGTERM_GRACE_MS` 환경변수가 코드에서 처음 도입되었다. spec (`spec/5-system/4-execution-engine.md §11`)에는 문서화되었으나, `codebase/backend` 에 `.env.example` 또는 `README` 가 있다면 해당 파일에 변수 설명이 추가되었는지 확인이 필요하다. `self-hosting-deployment.md` 에 `terminationGracePeriodSeconds` 와의 동기화 가이드라인이 추가된 것은 긍정적이나, 실제 배포 환경에서 개발자가 참조하는 `.env.example` 또는 `docker-compose` 주석에도 반영되어야 한다.
- 제안: `codebase/backend/.env.example` (또는 동등한 파일) 에 `SIGTERM_GRACE_MS=30000  # SIGTERM 수신 후 in-flight 노드 실행을 기다리는 최대 밀리초. k8s terminationGracePeriodSeconds 와 동기화 필요 (기본값+5초 여유).` 행 추가 여부 확인 및 반영.

---

### [WARNING] `execution-engine.module.ts` — `SHUTDOWN_GRACE_MS` 토큰과 `SIGTERM_GRACE_MS` ENV 이름 불일치 주석 미비
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.module.ts` L74–78
- 상세: DI 토큰은 `'SHUTDOWN_GRACE_MS'` 이고, 읽는 환경변수는 `process.env.SIGTERM_GRACE_MS` 이다. 코드 상의 `// SoT: spec §11. ENV var name 은 spec 표와 일치.` 주석으로 연결 의도를 표시했으나, DI 토큰 이름(`SHUTDOWN_GRACE_MS`)과 ENV 이름(`SIGTERM_GRACE_MS`)이 다른 이유에 대한 설명이 없다. 나중에 보는 개발자가 둘 중 어떤 것이 공개 설정 인터페이스인지 혼동할 수 있다.
- 제안: 주석을 "DI token `SHUTDOWN_GRACE_MS` — 내부 식별자. 운영 ENV 이름은 `SIGTERM_GRACE_MS` (spec §11 환경변수 표 참조)" 으로 보강한다.

---

### [INFO] `execution-engine.service.ts` 인라인 주석 — Phase 참조 일관성 양호
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` diff 내 여러 위치
- 상세: `// Phase 1.2 — Graceful Shutdown 추적`, `// Phase 1.2 — register 짝.` 등 신규 로직에 Phase 번호와 의도가 명시되어 있다. `_resumeState` 관련 영어 주석도 Phase 1.1 현황과 Phase 2 예정 내용을 명확히 구분하여 기술하고 있다. 장기적으로 Phase 참조 주석이 코드에 남아 있는 것은 혼란을 줄 수 있지만, 과도기 hotfix 코드로서는 적절한 문서화 방식이다.
- 제안: Phase 2 완료 시 Phase 참조 주석 정리 태스크를 plan 또는 TODO 로 등록하는 것을 권장한다.

---

### [INFO] `plan/in-progress/workflow-resumable-execution.md` — Phase 진행 현황과 plan 본문 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-resumable-execution-6b105e/plan/in-progress/workflow-resumable-execution.md` L38–52
- 상세: plan 에 Phase 1.1, 1.2, 1.3 이 모두 `- [ ]` (미완료) 로 표시되어 있다. 그러나 이번 코드 변경에 Phase 1.1 (`recoverStuckExecutions` 수정)과 Phase 1.2 (`ShutdownStateService` 구현 + `enableShutdownHooks`) 가 실제로 구현된 것으로 보인다. plan 체크박스가 코드 구현 상태를 반영하지 않으면 추적성이 저하된다.
- 제안: Phase 1.1, 1.2 의 해당 체크박스를 `- [x]` 로 갱신하여 plan 문서의 실태를 반영한다.

---

### [INFO] `shutdown-state.service.spec.ts` — 테스트 파일 자체의 설명 문서화 양호
- 위치: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.spec.ts`
- 상세: 신규 테스트 파일이 완전히 새로 추가되었으며, 각 `describe` / `it` 블록 앞에 Phase 참조 및 의도 주석이 달려 있다. SQL WHERE 절 격리 테스트, 멱등성 테스트, drain 시나리오 테스트 각각에 맥락 설명이 있어 문서화 기준을 충족한다.
- 제안: 없음.

---

### [INFO] review 산출물 파일들 (파일 13–28) — 문서 대상 아님, 형식 준수
- 위치: `review/consistency/2026/05/24/23_26_13/` 및 `review/consistency/2026/05/24/23_39_12/` 하위 파일들
- 상세: 이 파일들은 consistency checker 산출물로 문서화 리뷰 대상 코드가 아니다. 내용적으로 각 checker 보고서가 구조화된 형식(발견사항 / 요약 / 위험도)으로 작성되어 있어 프로젝트 규약을 준수한다.
- 제안: 없음.

---

## 요약

이번 변경에서 문서화 수준은 전반적으로 높다. `ShutdownStateService` 의 클래스 JSDoc 이 동작 4단계와 멀티인스턴스 안전 장치를 상세히 설명하고, `recoverStuckExecutions` 관련 주석도 변경된 SQL 로직과 완전히 일치하도록 갱신되었다. 다만 세 가지 실질적 개선이 필요하다. 첫째, `WorkflowsController.execute()` 에 신규 503 응답에 대한 Swagger 데코레이터가 없어 API 소비자 문서에 갭이 생긴다. 둘째, 신규 환경변수 `SIGTERM_GRACE_MS` 가 코드와 spec 에는 등재되었으나 `.env.example` 등 운영자 참조 파일에 반영 여부가 불확실하다. 셋째, `ShutdownStateService.fromConfig()` 팩토리가 현재 DI 흐름에서 미사용 상태로 보이는데 JSDoc 에 그 위상이 명시되어 있지 않아 dead code 오인 위험이 있다. plan 체크박스의 구현 현황 반영도 추적성 차원에서 보완이 필요하다.

---

## 위험도

LOW
