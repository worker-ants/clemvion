# 동시성(Concurrency) 리뷰 결과

리뷰 대상: Phase 2 Durable Continuation Bus — BullMQ 전환 + Rehydration 구현
분석 파일: continuation-bus.service.ts / continuation-execution.processor.ts / execution-engine.service.ts / websocket.gateway.ts (+ 각 spec 파일)

---

## 발견사항

### [WARNING] `getLockClient()` lazy init 에 동시성 경쟁 조건 잠재 가능성
- **위치**: `continuation-bus.service.ts` — `getLockClient()` (라인 80-105)
- **상세**: `getLockClient()` 는 `if (!this.lockClient)` 체크 후 `this.lockClient = new Redis(...)` 를 동기로 할당한다. Node.js 는 단일 스레드이므로 동일 호출 스택 안에서는 race 가 없다. 그러나 두 개의 비동기 작업(예: `acquireLock` 과 `publish` 가 동시에 Promise 체인으로 진입)이 각각 `getLockClient()` 를 호출할 때, 두 번째 호출이 `new Redis(...)` 생성 직전 event loop tick 을 양보하면 중복 인스턴스가 생성될 수 있다. 실제 위험은 낮으나 (synchronous assignment 이므로 동일 tick 내 완료), 향후 `getLockClient()` 가 async 로 변경될 경우 즉시 race 조건으로 전환된다.
- **제안**: 단기적으로는 현행 코드 안전. 중기적으로 double-check 패턴(`if (!this.lockClient) { this.lockClient = new Redis(...); }`)이 이미 적용되어 있어 현재는 허용 가능. async 변환 시 Promise lock (initialization promise 패턴) 적용 권고.

---

### [WARNING] `applyCancellation()` 의 `await` 제거 — unhandled rejection 잠재 위험
- **위치**: `continuation-execution.processor.ts` 라인 81-82
- **상세**: 변경 코드는 `await this.engine.applyCancellation(executionId)` 를 `this.engine.applyCancellation(executionId)` (fire-and-forget) 으로 바꾸었다. 코드 주석은 "applyCancellation 은 sync (rejectPending 만 호출) — await 불필요" 라고 설명한다. 실제 `applyCancellation` 의 시그니처가 `void` (non-async) 로 선언되어 현재는 Promise 를 반환하지 않으므로 런타임 위험은 없다. 그러나 향후 `applyCancellation` 이 async 로 변경되거나 내부에서 rehydration 경로를 추가한다면, 그 Promise 는 완전히 유실된다. BullMQ processor 내에서 await 누락은 worker 가 job 을 success-ack 한 뒤 뒤늦게 에러가 발생해도 retry 가 트리거되지 않는 무음 실패 경로를 만든다.
- **제안**: `applyCancellation` 이 현재 sync 인 것은 명백하므로 즉각적 버그는 아니다. 그러나 타입 시그니처 보호를 위해 `void this.engine.applyCancellation(executionId)` 대신 호출 시점에 TypeScript 컴파일러가 async 로 변환을 감지할 수 있도록 다음 방어 패턴을 권고한다:
  ```ts
  // 명시적으로 Promise 반환 여부를 assertion
  const _: void = this.engine.applyCancellation(executionId);
  ```
  또는 장기적으로 `applyCancellation` 을 항상 `Promise<void>` 로 유지하고 processor 에서 `await` 복원.

---

### [INFO] `setImmediate` polling 50회 retry — 이벤트 루프 부하 및 중단 미보장
- **위치**: `execution-engine.service.ts` — `resumeFromCheckpoint()` 내 `firePayload` 함수 (라인 996-1010)
- **상세**: rehydration 경로의 resolver fire scheduler 가 `setImmediate` 를 최대 50회 재귀적으로 스케줄링한다. `waitForX` 가 `pendingContinuations` 에 키를 등록하지 않는 비정상 경로(예: `waitForX` 자체가 예외 throw)에서 50회 모두 소진될 때까지 이벤트 루프에 마이크로 태스크가 누적된다. 50회 setImmediate 이면 실제 지연은 수 ms 수준이라 이벤트 루프 블로킹은 아니지만, 진단 로그만 남고 조용히 포기하므로 payload 유실이 관찰 불가능한 상태로 발생할 수 있다.
- **제안**: `waitForX` 가 resolver 등록 전 예외를 throw 하면 `pendingContinuations.has()` 가 영원히 false 이므로 50회 retry 가 실질적 도움 없이 소진된다. `waitForX` 호출부의 try/catch 에서 예외 시 즉시 `firePayload(0)` 을 호출해 polling 을 조기 종료하는 패턴 또는 `resumeFromCheckpoint` 의 outer Promise resolution 에 연동하는 AbortSignal 방식 권고. 현재는 INFO 수준.

---

### [INFO] `lockToken` 인스턴스 재시작 시 교체 — 이전 lock 자동 만료 의존
- **위치**: `continuation-bus.service.ts` 라인 65
- **상세**: `lockToken = \`${hostname()}:${randomUUID()}\`` 는 프로세스 시작 시 1회 생성된다. 프로세스가 재시작되면 lockToken 이 바뀌므로, 재시작 전 보유하던 Redis lock (TTL 만료 전) 을 새 인스턴스가 release 할 수 없다. `RECOVERY_LOCK_KEY` 는 TTL 이 있으므로 자연 만료까지 최대 해당 TTL 동안 lock 을 재획득하지 못한다. 이것은 분산 lock 의 통상적 트레이드오프이며 설계 의도 내에 있다. 그러나 TTL 값이 코드/spec 어디에서도 명시적으로 문서화되지 않았다.
- **제안**: `acquireLock` 호출 시 TTL 파라미터를 환경변수(`RECOVERY_LOCK_TTL_SECONDS`)로 노출하거나 spec 에 기본값을 명시해 운영자가 재시작 시 lock 대기 시간을 예측할 수 있도록 권고. 현재는 INFO 수준.

---

### [INFO] `rehydrateContext` 내 순차적 DB 루프 — N+1 쿼리 패턴
- **위치**: `execution-engine.service.ts` — `rehydrateContext()` (라인 1558-1586)
- **상세**: `execution_node_log` 의 각 nodeId 에 대해 `nodeExecutionRepository.findOne(...)` 을 개별 호출한다. 이는 완료 노드 수 N 에 비례하는 N+1 쿼리로, rehydration 시 DB 부하가 선형 증가한다. 동시성 직접 이슈는 아니나, 다수 worker 가 동시에 rehydration 경로에 진입하면 DB connection pool 을 잠식할 수 있다.
- **제안**: `IN` 절로 일괄 조회 후 Map 으로 인덱싱하는 방향으로 최적화 권고. 긴급도는 낮으나 scale 시 병목이 될 수 있음.

---

## 요약

본 변경에서 가장 주목할 동시성 이슈는 두 가지다. 첫째, `continuation-execution.processor.ts` 에서 `applyCancellation()` 의 `await` 를 제거한 것은 현재 `void` 시그니처 기준으로는 안전하지만, 향후 해당 메서드가 async 로 진화할 경우 BullMQ processor 레벨에서 unhandled rejection 으로 조용히 실패하는 잠재 경로가 된다. 둘째, `getLockClient()` lazy init 패턴은 단일 스레드 Node.js 에서 현재는 안전하나, async 확장 시 race 조건 전환 위험이 있어 향후 변경을 고려한 사전 설계가 필요하다. `setImmediate` 50회 polling 패턴은 기능적으로 작동하지만 비정상 경로에서 payload 유실이 무음으로 발생할 수 있어 가시성 개선이 필요하다. Redis pub/sub 에서 BullMQ 로의 전환 자체는 내구성과 exactly-once 처리 측면에서 동시성 안전성을 전반적으로 향상시켰다. 전체 평가로는 심각한 동시성 버그는 없으나 `await` 제거와 lazy init 관련 WARNING 두 건의 개선을 권고한다.

---

## 위험도

LOW
