# Testing Review — PR1 execution-run intake 큐

## 발견사항

### [INFO] 인라인 worker 브릿지 패턴의 양면성
- 위치: `execution-engine.service.spec.ts` — beforeEach `EXECUTION_RUN_QUEUE` mock, 라인 약 440–598
- 상세: `mockExecutionRunQueue.add` 의 default implementation 이 `void service.runExecutionFromQueue(...)` 를 즉시 fire-and-forget 으로 실행하는 브릿지 구조다. 기존 `execute()` 테스트 계약(실행이 실제로 돌아간다는 전제)을 보존하는 영리한 설계이나, 동일 `beforeEach` 에서 설정된 브릿지가 이후 asRecorder() 오버라이드를 하지 않은 테스트에서 의도치 않게 실제 실행 경로를 진입시킬 수 있다. `void` + `.catch(() => undefined)` 로 에러를 삼키기 때문에 브릿지 내부에서 발생한 예외가 해당 테스트 실패로 표면화되지 않는다.
- 제안: 브릿지가 실행을 trigger 한다는 사실과 "error 를 묵음한다" 는 동작을 `beforeEach` 주석으로 명시하거나, 브릿지 실행 중 예기치 않은 에러를 `console.warn` 수준으로라도 출력해 디버깅 시 인식할 수 있도록 한다.

### [WARNING] `chatChannel.conversationKey` 빈 문자열 경계값 테스트 제거
- 위치: `execution-engine.service.spec.ts` diff, 기존 `chatChannel.conversationKey 가 빈 문자열이면...` 테스트 삭제 확인
- 상세: 기존 `runExecution — chat-channel routing context registration` describe 에 있던 `conversationKey 빈 문자열` 케이스(`trg-bad2`)가 `runExecutionFromQueue` 리팩터링 과정에서 대응 테스트 없이 삭제됐다. `extractChatChannelFromInput` 의 `conversationKey` 경계값 검증이 여전히 `provider` 경우만 테스트된다. `chatChannel.provider 가 빈 문자열이면 chatChannel 등록 제외` 테스트는 존재하지만 conversationKey 누락 케이스는 커버리지 갭으로 남는다.
- 제안: `runExecutionFromQueue — worker 진입점 + routing context 재등록` describe 안에 `chatChannel.conversationKey 가 빈 문자열이면 chatChannel 등록 제외` 케이스를 복원한다.

### [WARNING] `ExecutionRunProcessor` 테스트의 `onFailed` 커버리지 불완전
- 위치: `/codebase/backend/src/modules/execution-engine/queues/execution-run.processor.spec.ts` 전체 (55라인)
- 상세: `onFailed` 는 `job` 핸들이 있는 정상 경우(attemptsMade, maxAttempts 계산 + 로그)와 `job` 핸들이 없는 경우 두 분기가 있다. `job 핸들 없어도 throw 하지 않는다` 케이스만 있고 **job 핸들이 있는 경우의 로그 포맷** 검증이 없다. `job.opts?.attempts` 가 undefined 일 때 `EXECUTION_RUN_QUEUE_DEFAULT_OPTS.attempts` 로 fallback 하는 경로, 그리고 `job.data?.executionId` / `job.id` 가 포함된 dead-letter 메시지 포맷도 미검증이다.
- 제안: job 객체가 있는 경우의 `onFailed` 테스트를 추가해 경고 로그 메시지에 executionId 와 시도 횟수가 포함되는지 검증한다.

### [WARNING] `resolveExecutionRunWorkerConcurrency` 의 `null` 입력 미테스트
- 위치: `execution-run.queue.spec.ts` — `resolveExecutionRunWorkerConcurrency` describe
- 상세: env 객체에 `EXECUTION_RUN_WORKER_CONCURRENCY` 키가 아예 없는 경우(`{}`)와 `undefined` 값인 경우(`{ EXECUTION_RUN_WORKER_CONCURRENCY: undefined }`)는 테스트된다. 그러나 `null` 값이 주입되는 경우는 `NodeJS.ProcessEnv` 타입상 허용되지 않으나, 공학표기 케이스(`'1e10'`)와 함께 공백 전용 문자열(`'  '`)도 regex `^\d+$` 테스트를 통과하지 못하므로 fallback 이 맞는데, 이 케이스가 명시적 테스트로 포함되어 있지 않다. 또한 최대값 경계(`Number.MAX_SAFE_INTEGER` 등 극단값)도 미검증이다.
- 제안: `'   '`(공백 전용) 케이스를 `bad` 배열에 추가하고, 극단값(`'9007199254740991'`) 동작을 문서화하는 테스트를 추가한다.

### [INFO] `ExecutionRunProcessor` 테스트가 `NestJS Test.createTestingModule` 을 사용하지 않고 직접 생성 가능한 구조인데 모듈을 생성함
- 위치: `execution-run.processor.spec.ts` 라인 9–15
- 상세: `ExecutionRunProcessor` 는 생성자에서 `engine` 만 주입받는 단순한 클래스다. `BackgroundExecutionProcessor` 의 spec 처럼 `new ExecutionRunProcessor(engine as never)` 방식으로 인스턴스화하면 더 가볍고 가독성도 좋다. 현재 `Test.createTestingModule` 방식은 불필요한 DI overhead 를 추가한다.
- 제안: 해결이 필요한 수준은 아니지만, `background-execution.processor.spec.ts` 의 단순 인스턴스화 패턴과 일관성을 맞추는 것을 고려한다.

### [INFO] `execute()` 의 enqueue 실패(네트워크 오류) 경로 테스트 부재
- 위치: `execution-engine.service.spec.ts` — `execute() — execution-run intake 큐 발행 (PR1)` describe
- 상세: `executionRunQueue.add()` 가 네트워크 오류 등으로 reject 했을 때 `execute()` 가 어떻게 동작하는지(오류 전파 vs 묵음) 테스트가 없다. 현재 코드는 `await this.executionRunQueue.add(...)` 이므로 오류가 `execute()` 호출자까지 전파된다. 이때 이미 저장된 PENDING 상태의 Execution row 가 orphan 으로 남는 문제에 대한 처리 경로(롤백 or recoverStuckExecutions 의존)도 미검증이다.
- 제안: `executionRunQueue.add` 가 reject 할 때 `execute()` 가 오류를 전파하는지, 그리고 Execution row 상태가 어떻게 되는지를 검증하는 테스트를 추가한다(또는 명시적으로 이 경로는 `recoverStuckExecutions` 의존임을 주석으로 문서화).

### [INFO] 테스트 격리 — `lastSaved` 클로저의 beforeEach 재초기화 의존
- 위치: `execution-engine.service.spec.ts` 라인 약 551–562
- 상세: `lastSaved` 변수가 `beforeEach` 내 `let lastSaved` 로 선언되어 각 테스트마다 재초기화되는 구조는 올바르다. 그러나 `mockImplementationOnce` 로 `findOneBy` 를 override 한 `runExecutionFromQueue` 테스트들이 브릿지 default mock 과 혼재할 경우, 한 테스트의 `findOneBy` override 가 같은 실행 흐름에서 브릿지가 호출하는 `findOneBy` 를 소비해버릴 수 있다. 현재 `asRecorder()` 호출로 격리를 보장하지만, 브릿지 disable 없이 `findOneBy.mockResolvedValueOnce` 를 쓰는 경우 경쟁 조건이 발생할 수 있다.
- 제안: `runExecutionFromQueue` describe 안의 테스트들이 브릿지를 비활성화(`asRecorder()` 유사 메커니즘)하거나 직접 `runExecutionFromQueue` 를 호출하는 방식으로 일관성을 유지하도록 명시적 주석을 추가한다. 현재 구현은 이 패턴을 따르고 있으나 향후 테스트 추가 시 함정이 될 수 있다.

### [INFO] `execution-run.queue.spec.ts` — `buildExecutionRunJobId` 빈 문자열 입력 미검증
- 위치: `execution-run.queue.spec.ts` `buildExecutionRunJobId` describe
- 상세: 현재 `executionId = 'exec-123'` 케이스 한 건만 검증한다. `buildExecutionRunJobId('')` 시 동작(빈 문자열 그대로 반환)은 BullMQ dedup 관점에서 위험한 edge case 이므로, 호출자가 executionId 를 공백 없이 전달함을 보장하는 계약을 테스트 또는 코드 단에서 명시하면 더 안전하다.
- 제안: 빈 문자열 입력에 대한 동작(현재는 `''` 반환)을 명시하는 테스트를 추가하거나, 생산 코드에서 assertion 을 추가한다.

## 요약

PR1 테스트 커버리지는 전반적으로 충실하다. 신규 경로(`execute()` enqueue 계약, `runExecutionFromQueue` worker 진입점, ack-discard 케이스, priority 매핑, concurrency 파서 fallback)가 전부 unit 테스트로 커버되었고, 기존 execute() 테스트 계약을 보존하는 인라인 worker 브릿지 패턴은 설계 의도가 명확하게 주석으로 설명되어 있다. 주요 미비점은 (1) `chatChannel.conversationKey` 빈 문자열 경계값 케이스 삭제, (2) `ExecutionRunProcessor.onFailed` 의 job-present 분기 미검증, (3) `execute()` 의 enqueue 실패 시 PENDING orphan row 처리 경로 미검증이다. 이 중 conversationKey 케이스는 회귀 위험이 있어 복원이 권장된다.

## 위험도

LOW
