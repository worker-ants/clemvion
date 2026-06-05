# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [WARNING] applyCancellation: has() 체크와 cancelParkedExecution 사이 TOCTOU 경합 윈도우

- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `applyCancellation` 메서드 (diff 기준 +709~715 라인)
- **상세**:
  ```
  if (this.pendingContinuations.has(executionId)) {
    this.rejectPending(executionId, new ExecutionCancelledError());
    return;
  }
  await this.cancelParkedExecution(executionId);
  ```
  `CONTINUATION_WORKER_CONCURRENCY > 1` 환경에서 cancel job과 resume(form/button) job이 서로 다른 worker 슬롯에서 동시에 pick up되는 경우, 다음 시나리오가 가능하다:
  1. cancel worker: `has(executionId)` → `false` (park-release 후 resolver 없음) → `cancelParkedExecution` 진입
  2. resume worker: 동시에 `rehydrateAndResume` 진입 → DB `WAITING_FOR_INPUT` 행을 `RUNNING`으로 전환
  3. cancel worker: `UPDATE ... WHERE status = WAITING_FOR_INPUT` → `affected = 0` → no-op (정상 처리)

  이 방향은 DB-level status 가드가 정상 흡수한다. 반대 방향:
  1. cancel worker: `cancelParkedExecution` → `CANCELLED` 마킹 완료 + emit
  2. resume worker: `rehydrateAndResume` 진입 — 이 경로에서 execution.status가 `CANCELLED`인 경우를 `WAITING_FOR_INPUT` invariant 검증이 차단하는지 여부가 핵심. `rehydrateAndResume` 내부의 상태 가드(`Execution.status === WAITING_FOR_INPUT` 검증)가 없거나 약하면 CANCELLED 상태의 execution이 재개될 수 있다.

  코드 주석은 "isNodeExecutionWaiting status 가드 + WAITING_FOR_INPUT andWhere 멱등 가드 + BullMQ jobId 멱등성이 흡수한다"고 설명하지만, `isNodeExecutionWaiting`은 `NodeExecution` 상태를 체크하고 `Execution` 테이블은 별도 상태를 보유한다. `cancelParkedExecution`은 `Execution` 행만 CANCELLED로 마킹하고 `NodeExecution`은 그대로 두므로(`NodeExecution 은 옛 catch 경로와 동일하게 별도 마킹하지 않는다` 주석), resume worker의 `isNodeExecutionWaiting` 체크가 NodeExecution을 보고 `still WAITING`이라고 판단한 뒤 재개를 계속 진행할 수 있는 가능성이 존재한다.

- **제안**: `rehydrateAndResume` 진입 초기에 `Execution.status === WAITING_FOR_INPUT` 재검증을 추가하거나(DB re-read), `cancelParkedExecution`이 해당 `NodeExecution` 행도 `CANCELLED`로 마킹하여 `isNodeExecutionWaiting` 가드가 이를 차단하도록 정렬할 것. 현재 기본 concurrency = 1이므로 실제 발생 확률은 낮지만 concurrency 상향 시 잠재 위험.

---

### [WARNING] applyCancellation 의 async 전환: processor job ack 시점 보장 vs 기존 fast-path 코루틴 경쟁

- **위치**: `/codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` — `case 'cancel':` 블록, diff +89 라인
- **상세**:
  변경 전에는 `void this.engine.applyCancellation(executionId)` (fire-and-forget, 동기 완료 전제)였다. 변경 후 `await this.engine.applyCancellation(executionId)` 로 전환되었는데, 이제 `applyCancellation` 내부에서 `cancelParkedExecution`이 DB write를 수행하므로 job ack이 DB 완료 후 이루어진다. 이는 의도된 개선이다.

  그러나 PR-B2 완료 전까지 멀티턴 AI는 여전히 in-memory `pendingContinuations`에 resolver를 등록한다. AI conversation 실행 중 cancel job이 pick up되면 `applyCancellation`은 `has()` 체크 → `true` → `rejectPending` 경로를 타는데, 이 경로는 동기 완료이며 문제없다. 단, `rejectPending`이 호출되는 시점에 코루틴이 `waitForAiConversation`의 `await new Promise` 안에 있고 다른 turn resume이 동시에 진행 중일 경우, reject + resume 순서가 뒤집히는 경합 가능성이 남아 있다. 이는 PR-B1 신규 도입 문제가 아니라 기존 AI in-memory 경로의 기존 위험이므로 참고 수준으로 기록.

- **제안**: PR-B2에서 AI 멀티턴도 park-release로 전환 시 이 경합 가능성이 자연히 해소된다. PR-B1 범위에서는 현행 유지가 합리적.

---

### [INFO] 테스트의 real-timer 기반 polling (flushResumeDrive) — 잠재적 CI flakiness

- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `flushResumeDrive` 헬퍼 및 적용 위치 다수
- **상세**:
  `flushResumeDrive(ms = 40)`는 실제 `setTimeout(resolve, ms)`을 사용한다. `driveResumeDetached` 내부 `setTimeout(0)` + 20ms 폴링을 덮기 위한 설계라는 주석이 있다. 이는 jest fake timer 없이 real timer에 의존하므로:
  - CI 머신 부하에 따라 40ms 내 완료 보장 불가 → 간헐 테스트 실패 가능성
  - `for (let i = 0; i < 50; i++) { await flushResumeDrive(20); }` (최대 1초 polling) 방식으로 개선된 케이스도 있으나 일관성 없음

  이는 프로덕션 코드의 동시성 문제가 아닌 테스트 설계 취약성이다.

- **제안**: `driveResumeDetached` 내부 `setTimeout(0)` + 폴링 로직을 jest fake timer로 제어 가능한 방식으로 리팩터링하거나, 모든 사용처에서 `50 * 20ms` polling 패턴을 일관 적용하는 것을 검토.

---

### [INFO] PARK_RELEASED Symbol의 단일 모듈 범위 보장

- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `const PARK_RELEASED = Symbol('park_released')`
- **상세**:
  `Symbol('park_released')`는 모듈 로드 시 1회 생성된다. NestJS DI 환경에서 모듈이 중복 로드되거나 서비스가 다른 번들 context에서 인스턴스화되는 경우 동일 description이지만 다른 Symbol이 생성되어 `=== PARK_RELEASED` 비교가 실패할 수 있다. 현재 단일 백엔드 프로세스 구조에서는 문제 없으나, 마이크로서비스 분리 시 주의 필요. TypeScript 구조상 `import`가 아닌 Symbol이므로 모듈 경계 내에서 안전하게 사용되고 있음.
- **제안**: 현행 유지. 향후 서비스 분리 시 Symbol 대신 고유 클래스 인스턴스 또는 tagged union 방식 검토.

---

## 요약

이번 변경의 핵심 동시성 설계는 `waitForFormSubmission`/`waitForButtonInteraction`의 코루틴을 park 시점에 즉시 해제하고(PARK_RELEASED sentinel), 재개 경로를 BullMQ + DB-level 멱등 가드(WAITING_FOR_INPUT status 가드, affected=0 no-op)로 일원화하는 것이다. 이 설계는 기본 concurrency=1 환경에서 올바르고 DB-level 멱등성을 통해 경합을 흡수한다. 주요 우려는 `cancelParkedExecution`이 `Execution` 행만 CANCELLED 마킹하고 해당 `NodeExecution`은 마킹하지 않아, concurrency > 1 환경에서 cancel 후 resume worker가 `isNodeExecutionWaiting`(NodeExecution 기준) 체크를 통과해 CANCELLED execution을 재개 시도할 수 있는 잠재적 TOCTOU 경합이다. `rehydrateAndResume` 내부에서 `Execution.status` 재검증이 보완 가드로 추가되어 있다면 이 위험이 차단되므로, 해당 함수의 구현을 확인하여 `WAITING_FOR_INPUT` 재검증 로직 존재 여부를 확인하는 것이 권장된다. 테스트에서 real-timer 기반 polling 사용은 CI 환경 의존성을 도입하나 프로덕션 코드 위험은 아니다.

## 위험도

MEDIUM
