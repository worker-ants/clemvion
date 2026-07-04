# 아키텍처(Architecture) Review — exec-intake-pr4-stalled (PR4: BullMQ stalled 자동 재배달)

## 발견사항

- **[WARNING]** `ExecutionRunDlqMonitorService`/`execution-run-dlq-monitor.config.ts` 가 `ContinuationDlqMonitorService`/`continuation-dlq-monitor.config.ts` 를 사실상 통째로 복제 (DRY / 추상화 수준)
  - 위치:
    - `codebase/backend/src/modules/execution-engine/queues/execution-run-dlq-monitor.service.ts:1-120`
    - `codebase/backend/src/modules/execution-engine/queues/execution-run-dlq-monitor.config.ts:1-55`
    - vs `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts:1-158`
    - vs `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.config.ts:1-52`
  - 상세: 두 서비스는 (1) `onModuleInit`/`onModuleDestroy` 타이머 라이프사이클, (2) `checkOnce` 의 in-flight 가드(`checking`) + cooldown 로직, (3) `parsePositiveInt`/`DISABLED_VALUES` env 파서, (4) DI 토큰·`useFactory` 주입 패턴까지 라인 단위로 거의 동일하다(큐 이름·로그 문자열·env 변수 접두어만 다름). `ContinuationDlqMonitorService` 는 추가로 `BusinessMetricsService.registerQueueDepthProvider` gauge 등록 책임을 갖고, `ExecutionRunDlqMonitorService` 는 (기존 `ExecutionEngineService.onModuleInit` 이 이미 gauge 를 등록한다는 이유로) 이 책임을 뺀 것이 유일한 구조적 차이다. `parsePositiveInt`/`DISABLED_VALUES` 는 이미 `execution-run.queue.ts`(`resolveExecutionRunWorkerConcurrency`) 등 프로젝트 전역에 반복되는 idiom이라, 이번 복제로 3번째 이상 사본이 생겼을 가능성이 높다.
  - 참고: 프로젝트 memory 에 "cafe24/makeshop 미러 중복은 의도(철회)" 사례가 있어, sibling 모듈 간 의도적 비대칭 미러링이 이 코드베이스의 확립된 패턴일 수 있다(추상화 강제가 과거 반려된 전례). 다만 이번 경우는 도메인 모델이 다른 두 API 클라이언트가 아니라 **동일 로직(큐 depth 폴링 + cooldown 알람)의 순수 파라미터화 가능한 반복**이라 재사용 여지가 더 명확하다.
  - 제안: 즉시 강제하기보다 백로그 후보로 남길 것을 권고 — 예: `GenericQueueDlqMonitor<TConfig>` 베이스 클래스나 `createQueueDlqMonitor(queueToken, configToken, queueName)` 팩토리로 공통화하고, gauge 등록 여부만 옵션으로 분기. 이미 컨벤션대로 3번째 큐(예: background-execution)에도 이 패턴이 필요해지면 통합을 재고할 것.

- **[INFO]** `onFailed` 핸들러가 의미가 다른 두 실패 경로(setup-throw / stalled 소진)를 하나의 이벤트 핸들러에서 처리 — 조건부 UPDATE 로 분기를 위임 (응집도)
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts:68-96`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2744-2803` (`finalizeStalledExhausted`)
  - 상세: `onFailed` 는 job 실패 원인을 구분하지 않고 항상 `finalizeStalledExhausted(executionId)` 를 호출한다. 실제 분기는 DB 쪽 `status='running' AND id=:id` 조건부 UPDATE 의 `affected` 여부로 사후에 이루어진다(`(1) setup-throw 경로는 이미 terminal → no-op`, `(2) stalled 소진만 발동`). 코드 자체는 정확하고 테스트도 두 케이스 모두 커버하지만(`execution-run.processor.spec.ts:728-738`, `execution-engine.service.spec.ts:76-158`), "job 이 왜 실패했는가"(비즈니스 원인 구분)를 다루는 로직이 이벤트 핸들러 계층이 아니라 DB WHERE 절의 부작용으로 암묵적으로 정의되어 있어, 이 메서드만 봐서는 두 경로가 뭉쳐 있다는 사실이 즉시 드러나지 않는다.
  - 제안: 현재 방식(idempotent 조건부 UPDATE)은 견고하고 변경을 요구할 정도는 아니다. 다만 주석에 이미 잘 설명돼 있으므로(±) 변경 불요, 참고 기록.

- **[INFO]** `ExecutionsController` 의 test-hook 이 `ExecutionRunProcessor` 전용으로 문서화된 internal 진입점을 직접 호출 (모듈 경계)
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:224-244` (`simulateExecutionRunRedeliveryForTest`) 호출 대상 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3121` (`runExecutionFromQueue`, JSDoc `@internal — ExecutionRunProcessor 전용 진입점`)
  - 상세: `runExecutionFromQueue` 의 JSDoc 은 "모듈 외부에서 직접 호출해서는 안 된다"고 명시하는데, `executions.controller.ts` 가 e2e 시뮬레이션을 위해 그 규칙을 의도적으로 우회한다. 기존 sibling(`_test/recover-stuck-executions` → `runStuckRecoveryScan()`)과 동일한 게이팅(`NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` + `@Roles('owner')` + `@ApiExcludeEndpoint()`)을 재사용해 프로덕션 표면에 노출되지 않도록 다층 방어가 돼 있고, 문서화도 충실하다. 다만 "internal 전용" 계약과 실제 호출자가 문서상으로만 구분되고 타입 시스템(`private`/모듈 캡슐화)으로는 강제되지 않는다는 점은 구조적으로 leaky 하다(NestJS DI 제약상 `private` 불가하다는 이유가 JSDoc에 이미 명시돼 있어 불가피한 trade-off로 보임).
  - 제안: 변경 불요 — 기존 확립 패턴과 일관되고 의도적 e2e-only backdoor 로 문서화됨. 참고 기록.

- **[INFO]** `ExecutionEngineService` 가 계속 커지는 God Class 에 신규 책임(`finalizeStalledExhausted`, `runExecutionFromQueue` 3-way 분기 확장)이 추가됨 (SRP / 확장성)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (전체 7406 라인), 신규 메서드 `finalizeStalledExhausted:2754`, 수정된 `runExecutionFromQueue:3121` RUNNING 분기(`3142-3151`)
  - 상세: 이 서비스는 이미 이전 refactor(M-1 god-handler 분할, #665/#668/#669 등)로 여러 handler 를 분리했음에도 여전히 7000줄 이상이다. PR4 는 여기에 큐 실패 마감(`finalizeStalledExhausted`), stalled 재배달 라우팅(RUNNING 분기), §8 세그먼트 tracking 보정(`recordRunningSegmentStart` 재사용) 등 큐/인프라 레벨 책임을 계속 이 서비스에 축적한다. 기능적으로는 기존 `redriveStuckExecution`/`recoverStuckExecutions`/`recordRunningSegmentStart` 등 인접 메서드와 강하게 결합돼 있어 이 파일에 두는 것이 국소적으로는 합리적이지만, 장기적으로 "실행 엔진 코어 로직"과 "큐 인프라 장애 복구 로직"이 같은 클래스에 섞이는 경향이 누적되고 있다.
  - 제안: 즉각적 조치 불요 — 이미 프로젝트가 인지 중인 채무(리팩터 백로그 M-1 계열)이고, 이번 변경분 자체는 기존 메서드(`redriveStuckExecution`, `recordRunningSegmentStart`, `finalizeRehydrationCleanup`)를 재사용하는 응집적 확장이라 국소적 위반은 아니다. 향후 리팩터 사이클에서 "큐 장애/크래시 복구" 책임 그룹(recoverStuckExecutions/redriveStuckExecution/finalizeStalledExhausted/recordRunningSegmentStart)을 별도 `ExecutionCrashRecoveryService` 로 추출하는 것을 후보로 고려할 만하다(코드가 이미 "옛 recoverStuckExecutions cascade 복원" 등 상호 참조 주석으로 응집된 하나의 관심사임을 스스로 드러내고 있어 추출 시 경계가 비교적 명확해 보인다).

- **[INFO]** BullMQ native stalled 재배달 채택으로 `exec:run:seq` 예약 키가 "죽은 설계"로 남음 (추상화 수준)
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:48-61` (`buildExecutionRunJobId`, `<executionId>:run:<seq>` 언급), spec `§9.2`
  - 상세: PR4 는 당초 spec 이 예고했던 "jobId 를 `<executionId>:run:<seq>` 로 확장해 명시적 re-enqueue" 설계 대신 BullMQ 네이티브 stalled 재배달(같은 jobId 유지)을 채택했다. 그 결과 `exec:run:seq` 관련 서술·주석이 코드/스펙에 "미래 예약이었으나 결국 쓰이지 않는" 상태로 남는다. 코드 자체(`buildExecutionRunJobId`)는 여전히 단순하고 정직하게 주석 처리돼 있어 실질적 결함은 아니다.
  - 제안: 필수 아님. 이미 consistency-check(convention_compliance, `review/consistency/2026/07/04/12_57_25/convention_compliance.md`)에서 문서 경량화 제안으로 기록됨 — 중복 지적 불필요, 참고만.

## 요약

이번 변경(PR4: BullMQ stalled-job 자동 재배달 도입 + DLQ 모니터 + 3-way `runExecutionFromQueue` 라우팅)은 기존 PR1~PR3 인프라(§7.5 case B `redriveStuckExecution`, `recordRunningSegmentStart`, `finalizeRehydrationCleanup`)를 재사용하는 응집적 확장이며, DI/설정 분리(useFactory 주입, config 인터페이스), 조건부 UPDATE 기반 idempotent 종결 처리, sibling 패턴(`ContinuationDlqMonitorService`, `_test/recover-stuck-executions`) 과의 일관성 등 구조적으로 견고하다. 다만 `ExecutionRunDlqMonitorService`/config 가 `ContinuationDlqMonitorService`/config 를 거의 라인 단위로 복제한 점은 DRY 관점에서 재사용 리팩터링 후보로 남기며(단, 이 코드베이스가 sibling 미러 중복을 의도적으로 허용해 온 전례가 있어 강제 리팩터로 단정하지 않음), 이미 7000줄을 넘는 `ExecutionEngineService` 에 큐 장애 복구 책임이 계속 누적되는 경향은 향후 SRP 관점의 서비스 분리 후보로 관찰할 가치가 있다. 발견된 사항 중 기능적 결함이나 순환 의존성, 레이어 경계 붕괴 수준의 CRITICAL 은 없다.

## 위험도

LOW
