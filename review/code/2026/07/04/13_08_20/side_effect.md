# 부작용(Side Effect) Review — PR4 stalled 자동 재배달

대상: `finalizeStalledExhausted` cascade, `ExecutionRunProcessor.onFailed`, `eventEmitter.emitExecution`, 조건부 UPDATE(`runExecutionFromQueue` RUNNING 분기 포함).

## 발견사항

- **[WARNING]** `onFailed`(dead-letter)와 `redriveStuckExecution`(RUNNING 분기 재구동) 사이 fire-and-forget 레이스로 `finalizeStalledExhausted` 가 재구동 완료 직후 실행될 경우 방금 완료된(또는 재재배달로 진행 중인) Execution 을 잘못 FAILED 로 덮어쓸 이론적 창이 존재
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts:85-95` (onFailed → `void this.engine.finalizeStalledExhausted(executionId).catch(...)`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2754-2803` (`finalizeStalledExhausted`), `execution-engine.service.ts:3142-3151` (`runExecutionFromQueue` RUNNING 분기 → `redriveStuckExecution`)
  - 상세: BullMQ 의미상 `maxStalledCount` 소진으로 `failed` 이벤트가 발생하는 시점과, 같은 job 이 마지막으로 재배달되어 새 워커가 `runExecutionFromQueue`→RUNNING 분기→`redriveStuckExecution` 을 밟는 시점은 서로 다른 워커/타이밍에서 일어날 수 있다. `finalizeStalledExhausted` 는 `status='running'` 조건부 UPDATE 로 가드되어 있어 재구동이 이미 `completed`/`failed`/`waiting_for_input` 로 종결한 뒤라면 affected=0 no-op 이 되어 안전하다. 그러나 **재구동이 아직 진행 중(status 여전히 RUNNING)인 상태에서 onFailed 가 늦게 도착**하면 `finalizeStalledExhausted` 의 조건부 UPDATE 가 매치되어, 실제로는 살아서 정상 전진 중인 세그먼트를 `WORKER_HEARTBEAT_TIMEOUT` 로 강제 종료시키고 `EXECUTION_FAILED` 를 emit 할 수 있다. BullMQ 공식 문서상 "job 이 stalled 판정되어 재배달되면, 이후 `maxStalledCount` 회 stalled 되면 `failed` 이벤트가 발생"하는 흐름이라 이 순서(재배달 성공 후에도 `failed` 이벤트가 뒤늦게 도착)가 일반적으로는 없어야 하지만, 코드만으로는 두 콜백 간 순서를 보장하는 명시적 동기화 장치(예: job 완료 표시를 확인하는 이중 검증)가 보이지 않는다.
  - 제안: 이미 spec/코드 주석(§7.1 "attempts 소진")에서 이 설계를 의도적으로 문서화했으므로 CRITICAL 로 올리지 않으나, BullMQ `onFailed` 콜백 시점에 `job.finishedOn`/`job.isCompleted()` 류의 재검증을 추가하거나, 최소한 이 레이스가 이론적으로 존재함을 spec Rationale 에 명시하는 것을 권장. 실질 발생 가능성은 BullMQ 내부 job state machine 특성상 낮음(같은 jobId 는 한 시점에 한 워커만 lock 보유)이라 WARNING 등급으로 유지.

- **[INFO]** `finalizeStalledExhausted` 는 `finalizeRehydrationCleanup`(in-memory `contextService`/`llmDefaultConfigCache` 정리)을 호출하는데, 이 시점에 다른 워커가 이미 같은 executionId 로 재구동을 시작해 새 context 를 채워 넣었을 가능성이 있는 시나리오에서 정리 타이밍이 겹칠 수 있음
  - 위치: `execution-engine.service.ts:2794`
  - 상세: `finalizeRehydrationCleanup` 자체는 멱등(기존 주석 "멱등" 명시)하고 대상이 in-memory 캐시(`Map.delete`)뿐이라 실질 위험은 낮음. 다만 위 WARNING 항목과 결합되면(레이스로 잘못 FAILED 처리) 진행 중인 재구동의 context 를 조기 삭제해 후속 노드 dispatch 시 캐시 미스를 유발할 수 있음 — 기능 오류라기보다는 재계산 비용 증가 정도.
  - 제안: 별도 조치 불요. 위 WARNING 해소 시 자연 해소.

- **[INFO]** `execution-run.processor.ts` 의 `@Processor` 데코레이터 옵션 변경(`maxStalledCount: 0→1`, `stalledInterval` 신규 추가)은 프로세스 재기동 시점부터 그 워커 인스턴스의 BullMQ Worker 생성 옵션에 적용되는 전역적 성격의 설정이나, 기존에 큐에 남아있던 job 이나 다른(구버전) 워커 인스턴스에는 소급 적용되지 않음(무중단 롤링 배포 중 신/구 워커 혼재 시 일시적으로 상이한 stalled 정책 적용 가능)
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts:32-36`
  - 상세: 이는 BullMQ 아키텍처상 통상적인 특성이며 본 PR 이 신규로 유발한 문제는 아님. 배포 문서/런북에 언급이 없다면 참고 사항으로 기록.
  - 제안: 조치 불요(정보 제공 목적).

- **[INFO]** `ExecutionRunDlqMonitorService` 가 `onModuleInit` 에서 `setInterval` 을 등록해 백그라운드 타이머(신규 전역 스케줄 부작용)를 생성함 — `ContinuationDlqMonitorService` 와 동일 패턴이며 `unref()` 호출로 프로세스 종료를 막지 않고 `onModuleDestroy` 에서 `clearInterval` 로 정리됨
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run-dlq-monitor.service.ts:615-636`
  - 상세: 새 반복 타이머 도입은 "이벤트/콜백 발생 방식 변경"에 해당하나, 기존 `ContinuationDlqMonitorService` 와 동형 패턴이고 lifecycle hook 으로 정리되므로 부작용 관점에서 정상.
  - 제안: 조치 불요.

- **[INFO]** `simulateExecutionRunRedeliveryForTest` 엔드포인트가 `runExecutionFromQueue` 를 직접 호출하는 신규 공개 라우트를 추가하나, 기존 `_test/recover-stuck-executions` 와 동일한 이중 게이팅(`NODE_ENV==='test'` && `E2E_TEST_HOOKS==='1'` + `@Roles('owner')`)으로 보호되어 프로덕션 표면에 노출되지 않음
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:224-244`
  - 상세: 인터페이스(공개 API) 확장이지만 기존 백도어 컨벤션을 그대로 따르고 있어 신규 위험 없음.
  - 제안: 조치 불요.

- **[INFO]** `finalizeStalledExhausted`/`onFailed` 가 시그니처 변경 없이 신규 메서드로 추가됐고, `ExecutionRunProcessor` 의 기존 `onFailed` 로직(로그만 수행)에 신규 부작용(DB UPDATE + cascade + event emit)이 추가됨 — 호출자(`@OnWorkerEvent('failed')`)는 BullMQ 내부이므로 외부 caller 영향 없음
  - 위치: `execution-run.processor.ts:68-96`
  - 상세: `onFailed` 는 반환 타입이 `void` 이고 내부적으로 `void this.engine.finalizeStalledExhausted(...).catch(...)` 로 fire-and-forget 처리되어 있어 unhandled rejection 은 없음. 순수 관측 로거였던 함수가 상태 변경 부작용을 갖게 된 것은 의도된 기능 확장(§7.1 PR4 스코프)이며 spec/plan 에 명시적으로 문서화됨.
  - 제안: 조치 불요.

- 그 외 항목(전역 변수 도입, 환경 변수 오·남용, 네트워크 호출, 파일시스템 부작용): 해당 없음.
  - `EXECUTION_RUN_DLQ_ALARM_THRESHOLD` / `EXECUTION_RUN_DLQ_MONITOR_INTERVAL_MS` / `EXECUTION_RUN_DLQ_ALARM_COOLDOWN_MS` / `EXECUTION_RUN_DLQ_MONITOR_ENABLED` 환경변수는 `loadExecutionRunDlqMonitorConfig` 를 통해서만 읽히고(`execution-run-dlq-monitor.config.ts:397-414`) DI factory 로만 주입되어 기존 `ContinuationDlqMonitorService` 패턴과 동일한 DIP 준수. 새 파일시스템 접근, 네트워크 호출(외부 서비스) 없음.

## 요약

이번 변경은 BullMQ stalled-job 재배달을 활성화(`maxStalledCount:0→1`)하고, 재배달 소진 시 `ExecutionRunProcessor.onFailed` 가 새로 `finalizeStalledExhausted` 를 호출해 조건부 UPDATE(`status='running'` 가드) + 자식 NodeExecution cascade FAILED + `EXECUTION_FAILED` emit 을 수행하도록 확장한다. 모든 DB mutation 이 `status='running'` 조건부(affected=0 no-op) 가드로 보호되어 있어 이미 terminal 인 Execution 을 건드리지 않는 설계는 견고하다. 다만 `onFailed`(dead-letter 알림)와 `runExecutionFromQueue` RUNNING 분기(재구동)가 서로 독립적인 fire-and-forget 경로로 동작하므로, "재배달이 사실상 성공해 재구동이 진행 중인데 `failed` 이벤트가 뒤늦게 도착"하는 이론적 레이스가 존재해 정상 진행 중인 세그먼트를 잘못 종결시킬 가능성이 완전히 배제되지는 않는다(BullMQ 의 job lock 특성상 실질 발생 가능성은 낮음). 그 외 신규 DLQ 모니터 서비스의 백그라운드 타이머, e2e 전용 backdoor 엔드포인트는 각각 기존 프로젝트 컨벤션(`ContinuationDlqMonitorService`, `_test/recover-stuck-executions`)을 그대로 답습해 부작용 관점의 신규 위험이 낮다.

## 위험도

LOW
