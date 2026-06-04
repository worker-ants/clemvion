# 동시성(Concurrency) 리뷰 결과

## 발견사항

### **[WARNING]** `runExecutionFromQueue` — status 재검증과 routing 등록 사이의 TOCTOU 간격

- 위치: `execution-engine.service.ts` — `runExecutionFromQueue` 내 `findOneBy` → `status !== PENDING` 확인 → `registerExecutionRouting` 흐름
- 상세: `findOneBy({id})` 로 row 를 읽고 `status === PENDING` 을 검증한 뒤 `registerExecutionRouting` 을 호출하는 사이에 다른 경로(cancel API, crash-recovery `recoverStuckExecutions`)가 해당 row 의 status 를 변경할 수 있다. 이 경우 PENDING 이 아닌 실행에 대해 routing context 가 등록되고 `runExecution` 이 시작된다. 실행 자체는 `runExecution` 내부에서 다시 검증하겠지만, routing context 는 Map 에 등록된 채로 남을 수 있으며, 이후 `releaseExecutionRouting` 이 호출되지 않으면 stale context 로 잔류한다.
- 제안: status 재검증을 낙관적 잠금(optimistic lock) 또는 DB 수준의 conditional UPDATE(`UPDATE ... WHERE status = 'pending' RETURNING *`)로 원자화하거나, routing 등록 후 `runExecution` 진입 시 동일 try/catch 범위 내에서 `releaseExecutionRouting` 안전망이 이미 있으므로 최소한 re-check 결과를 로깅해 운영 가시성을 확보할 것. PR2 동시성 cap 시 실제 문제가 될 가능성이 높으므로 PR2 전에 처리 권장.

---

### **[WARNING]** `maxStalledCount: 0` — worker 크래시 시 RUNNING row 는 30분 대기 후 일괄 FAILED

- 위치: `execution-run.queue.ts` — `EXECUTION_RUN_MAX_STALLED_COUNT = 0`, `execution-run.processor.ts` 주석
- 상세: `maxStalledCount: 0` 은 stalled job(worker 프로세스 사망 등)이 재배달되지 않는다는 의미다. PR1 의 의도적 설계 선택이며 주석에도 명시돼 있다. 그러나 worker 크래시 시점부터 `recoverStuckExecutions`(30분 threshold) 가 감지해 FAILED 로 전환하기까지 최장 30분 간 실행이 RUNNING 상태로 방치된다. 이 기간 동안 동시성 cap(PR2)이 해당 슬롯을 계속 점유하는 것으로 집계할 경우 처리량이 불필요하게 막힌다. 또한 BullMQ 의 stall check interval(`stalledInterval`, 기본 30초)이 재배달을 시도하지 않으므로 Redis 에서 active set 에 job 이 잔류한다.
- 제안: 설계 의도(PR3/PR4 범위)가 명확하므로 차단하지는 않으나, PR2 동시성 cap 구현 시 orphan RUNNING row 집계를 active count 에서 제외하는 보정 로직을 반드시 고려할 것. stall check 에 의한 재배달 없이 orphan 처리는 전적으로 `recoverStuckExecutions` 스케줄에 의존하므로 interval 이 충분히 짧은지 재검토 필요.

---

### **[INFO]** `void service.runExecutionFromQueue(...).catch(...)` — 테스트 인라인 브릿지의 비동기 에러 소거

- 위치: `execution-engine.service.spec.ts` — EXECUTION_RUN_QUEUE mock `add` 구현 (line ~594)
- 상세: 테스트 mock 에서 `void service.runExecutionFromQueue(...).catch(() => undefined)` 패턴으로 에러를 모두 소거한다. 이는 multi-turn(waiting_for_input) 테스트에서 타이밍을 맞추기 위한 의도적 선택이며 주석에도 설명돼 있다. 그러나 setup 단계 throw(routing 등록 실패 등)가 테스트에서 검출되지 않아 false-green 을 만들 수 있다. `catch(() => undefined)` 는 `.catch(err => { if (err) capturedError = err; })` 처럼 기록용 var 로 바꿔 필요한 테스트에서 assert 가능하도록 두는 것이 더 견고하다.
- 제안: 치명적 수정 필요는 없으나, 인라인 브릿지 에러를 소거하지 않고 변수로 캡처해 주요 테스트에서 `expect(capturedError).toBeUndefined()` 를 추가하면 회귀 감지력이 높아진다.

---

### **[INFO]** `resolveExecutionRunWorkerConcurrency` — `@Processor` 데코레이터 시점 1회 평가

- 위치: `execution-run.processor.ts` — `@Processor(EXECUTION_RUN_QUEUE, { concurrency: resolveExecutionRunWorkerConcurrency(), ... })`
- 상세: TypeScript 데코레이터는 클래스 정의 시(모듈 로드 시) 1회 평가된다. 따라서 `EXECUTION_RUN_WORKER_CONCURRENCY` 환경변수 변경은 프로세스 재시작 없이는 반영되지 않는다. `.env.example` 주석에 이미 명시돼 있으며, 같은 패턴인 `CONTINUATION_WORKER_CONCURRENCY` 와 동일하므로 기존 규약과 일관성이 있다. 단, 테스트에서 `process.env.EXECUTION_RUN_WORKER_CONCURRENCY` 를 변경한 후 모듈을 재컴파일하지 않으면 다른 값으로 평가될 수 있는데, `resolveExecutionRunWorkerConcurrency(env?)` 가 `env` 인자를 받는 함수 형태로 테스트 격리를 지원하도록 설계된 점은 올바르다.
- 제안: 현재 설계는 적절하다. `spec.ts` 테스트가 `process.env` 대신 인자 `{}` 를 사용하는 것을 확인 — 해당 없음.

---

### **[INFO]** `execute()` 에서 `executionRunQueue.add` 실패 시 PENDING row 고아 처리 미비

- 위치: `execution-engine.service.ts` — `execute()` 의 `await this.executionRunQueue.add(...)` 이후 `return executionId`
- 상세: `execution.save()` 로 PENDING row 가 DB 에 저장된 후 `executionRunQueue.add()` 가 Redis 오류 등으로 throw 하면 PENDING row 가 고아(orphan)로 남는다. 이 row 는 `recoverStuckExecutions` 의 대상(`RUNNING` 한정)이 아니므로 영구적으로 PENDING 상태로 잔류할 수 있다.
- 제안: `executionRunQueue.add()` 가 실패한 경우 PENDING row 를 FAILED 로 마킹하거나, `recoverStuckExecutions` 에 오래된 PENDING row(예: 5분 이상) 수거 로직을 추가하는 것을 고려. PR2 범위에서 동시성 cap 의 PENDING row 집계와 함께 검토 권장.

---

## 요약

PR1 의 핵심 동시성 설계(BullMQ work-stealing intake 큐, `maxStalledCount: 0` 로 이중 실행 방지, `jobId = executionId` dedup, routing context 를 consumer 인스턴스에서 등록·해제 짝 맞춤)는 전반적으로 올바르게 구현돼 있다. 다만 `runExecutionFromQueue` 내 status 재검증과 `registerExecutionRouting` 호출 사이의 TOCTOU 간격이 경쟁 조건으로 발전할 수 있으며, PR2 동시성 cap 구현 시 orphan RUNNING 슬롯 집계 문제가 실질적 처리량 저하로 이어질 수 있어 미리 인지하고 설계에 반영해야 한다. `execute()` 에서 큐 add 실패 시 PENDING row 고아 문제는 현재 낮은 발생 확률이지만 Redis 장애 시나리오에서 운영 회귀가 될 수 있다.

### 위험도

MEDIUM
