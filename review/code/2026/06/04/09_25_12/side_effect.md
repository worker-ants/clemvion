# Side Effect Review — PR1 execution-run intake 큐

## 발견사항

### [WARNING] `execute()` 시그니처 내부 동작 변경 — 반환 시점은 동일하나 실행 타이밍이 근본적으로 달라짐
- 위치: `execution-engine.service.ts` `execute()` 메서드, diff 라인 2162–2289
- 상세: `execute()` 는 기존에 `runExecution(...)` 을 fire-and-forget 으로 즉시 in-process 실행했으나, PR1 이후 BullMQ `execution-run` 큐에 enqueue 하고 반환한다. 반환 타입·시그니처는 동일(`Promise<string>`)하지만, 실제 실행은 임의 시점의 임의 인스턴스가 수행한다. 이는 **공개 인터페이스는 유지되나 행동 계약(실행이 언제 시작되는지)이 암묵적으로 변경된 케이스**다. plan 문서가 "동기 caller 0건 확인"을 명시하고 있어 현재는 회귀 위험이 낮지만, 미래 caller 가 `execute()` 후 즉시 DB 행 상태를 의존할 경우(예: 상태가 RUNNING 이기를 기대) race condition 이 발생할 수 있다. 이 계약 변경이 JSDoc/공개 인터페이스에 명시되지 않았다.
- 제안: `execute()` 메서드 JSDoc 에 "반환 직후 실행은 큐에서 비동기 시작됨, row 는 PENDING 상태" 를 명시한다.

### [WARNING] `resolveExecutionRunWorkerConcurrency` 가 모듈 로드 시 `process.env` 를 읽어 `@Processor` 데코레이터에 고정
- 위치: `execution-run.processor.ts` 46행, `execution-run.queue.ts` `resolveExecutionRunWorkerConcurrency()`
- 상세: `@Processor(EXECUTION_RUN_QUEUE, { concurrency: resolveExecutionRunWorkerConcurrency() })` 는 **클래스 데코레이터가 평가되는 시점(모듈 로드)**에 `process.env.EXECUTION_RUN_WORKER_CONCURRENCY` 를 읽는다. 이는 의도된 동작이고 `.env.example` 에도 "모듈 로드 시 1회 읽음" 으로 문서화되어 있다. 그러나 이 호출은 NestJS DI 컨테이너 외부에서 전역적으로 평가되므로, 테스트 환경에서 환경변수를 설정하지 않으면 항상 기본값 1 이 고정된다. 이미 `ContinuationWorkerConcurrency` 와 동일한 패턴이므로 신규 패턴 도입은 아니나, 환경변수가 의도치 않게 고정될 수 있다는 잠재 부작용이 있다.
- 제안: 기존 패턴과 일관성이 있으므로 현재로서는 수용 가능하나, 테스트에서 concurrency 를 변경해야 하는 케이스가 생기면 `@Processor` 옵션을 팩토리 패턴으로 교체할 것.

### [WARNING] `runExecutionFromQueue` 가 공개 메서드(`public`)로 노출 — 의도치 않은 직접 호출 가능
- 위치: `execution-engine.service.ts` `runExecutionFromQueue()` 메서드 시그니처
- 상세: 이 메서드는 `ExecutionRunProcessor` 전용 진입점이지만 NestJS 서비스의 공개 메서드로 노출된다. 동일 프로세스 내 다른 서비스가 이 메서드를 직접 호출하면 "row 재조회 → status 재검증 → routing 등록" 흐름을 우회하지 않으므로 큰 위험은 없다. 그러나 테스트 파일 내에서 직접 호출(`service.runExecutionFromQueue(...)`)하는 코드가 다수 작성되어, 이것이 production 경로와 동일하지 않은 타이밍으로 호출될 경우 테스트와 실제 동작의 격차가 생긴다. spec 주석도 "ExecutionRunProcessor 가 호출한다"고 명시하고 있어 내부 전용 의도가 분명하다.
- 제안: `/** @internal — only called by ExecutionRunProcessor */` JSDoc 주석을 추가해 소비자를 명시한다. TypeScript `private` 으로는 NestJS 가 주입할 수 없으므로, 접근 제어보다 문서로 관리하는 것이 현실적이다.

### [INFO] `execute()` 내 `triggerType` 결정 로직이 `options?.triggerId` 대신 `options?.executedBy` 로 분기
- 위치: `execution-engine.service.ts` diff 2278행 `const triggerType = options?.executedBy ? 'manual' : 'webhook';`
- 상세: `triggerId` 가 없어도 `executedBy` 가 없으면 `'webhook'` 으로 처리한다. 이는 webhook/schedule 을 구분하지 않는 임시 2-tier 처리다. plan 에 "webhook/schedule 세부 3-tier 는 후속" 으로 명기되어 있어 의도된 제한이다. `executeAsync` / `executeInline` 경로처럼 `executedBy` 도 `triggerId` 도 없는 호출이 있다면 `'webhook'` priority 를 얻게 되는 부작용이 있다.
- 제안: 이는 인지된 한계이므로 INFO 수준. PR2 에서 `ExecuteOptions` 에 `triggerType` 필드를 추가할 때 이 분기를 교체한다.

### [INFO] `EXECUTION_RUN_QUEUE_DEFAULT_OPTS` 가 `as const` 없이 mutable 객체로 내보내짐
- 위치: `execution-run.queue.ts` 2949–2953행
- 상세: `EXECUTION_RUN_QUEUE_DEFAULT_OPTS` 는 BullMQ 기본 옵션 상수로 사용되지만 `as const` 가 붙지 않아 외부에서 값을 변경할 수 있다. BullMQ `queue.add(name, data, opts)` 는 옵션 객체를 읽기만 하므로 실제로 문제가 발생하지는 않으나, spread(`...EXECUTION_RUN_QUEUE_DEFAULT_OPTS`) 로 사용하는 패턴이므로 원본 변경에 의한 부작용 여지가 있다.
- 제안: `export const EXECUTION_RUN_QUEUE_DEFAULT_OPTS = { ... } as const;` 로 변경해 불변성을 명시한다.

### [INFO] 테스트 내 인라인 worker 브릿지가 `void` 로 fire-and-forget 처리 — 미처리 rejection 가능
- 위치: `execution-engine.service.spec.ts` 내 `EXECUTION_RUN_QUEUE` mock 의 `add` 구현, diff 591–592행
- 상세: `void service.runExecutionFromQueue(...).catch(() => undefined)` 패턴은 의도적이다(주석이 명시). 그러나 `runExecutionFromQueue` 내에서 발생하는 예상치 못한 rejection 이 `.catch(() => undefined)` 로 모두 무음 처리되므로, 테스트 실패를 숨길 수 있다. 특정 테스트(`asRecorder()` 로 브릿지를 recorder 로 교체하는 경우)는 이 문제를 회피하지만, 기본 브릿지는 worker 오류를 항상 무시한다.
- 제안: 현 테스트 목적(기존 execute() 계약 보존)에서는 수용 가능하다. 다만 worker 내부 오류를 관측해야 하는 테스트는 개별 `mockImplementationOnce` 로 명시적으로 제어한다.

## 요약

PR1 의 핵심 변경은 `execute()` 내부의 fire-and-forget in-process `runExecution` 호출을 BullMQ `execution-run` 큐 enqueue 로 교체하는 것이다. 공개 메서드 시그니처는 변경되지 않았고, 신규 전역 변수·파일시스템 부작용·네트워크 호출(BullMQ Redis 는 기존 인프라)·이벤트 발생 변경은 없다. 주요 부작용 위험은 두 가지다: (1) `execute()` 의 암묵적 행동 계약 변경(실행 타이밍이 지연됨)이 문서화되지 않아 미래 caller 에 혼란을 줄 수 있고, (2) `runExecutionFromQueue` 가 public 으로 노출되어 의도치 않은 직접 호출 가능성이 있다. `resolveExecutionRunWorkerConcurrency` 의 모듈 로드 시 환경변수 고정도 기존 패턴과 동일하나 잠재적 테스트 격리 문제가 있다. 이 외 `EXECUTION_RUN_QUEUE_DEFAULT_OPTS` 의 mutability 와 테스트 브릿지의 무음 오류 처리는 경미한 INFO 수준이다. 전반적으로 의도하지 않은 중대 부작용은 없으며, 발견된 이슈들은 문서화와 방어적 타입 강화로 해소 가능하다.

## 위험도

LOW
