# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [WARNING] `lastAlarmAt` 필드 — setInterval overlap 시 경쟁 조건 가능성
- **위치**: `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` — `checkOnce()` 메서드, `lastAlarmAt` 읽기/쓰기
- **상세**: `checkOnce()` 는 `async` 메서드이며 `setInterval` 콜백에서 `void this.checkOnce()` 로 fire-and-forget 호출된다. 이전 `checkOnce()` 가 `await this.queue.getJobCounts(...)` 에서 응답을 기다리는 동안 다음 interval tick 이 새 `checkOnce()` 를 시작할 수 있다. 이 경우 두 호출이 동시에 `this.lastAlarmAt` 의 동일한 값을 읽어 cooldown 조건을 통과한 뒤 둘 다 알람을 발생시키고 `this.lastAlarmAt = now` 를 쓰는 중복 알람이 발생할 수 있다. 기본값(intervalMs=60000ms)에서는 Redis getJobCounts 가 60초를 초과하지 않으므로 실질적 발생 확률은 매우 낮다. 그러나 `CONTINUATION_DLQ_MONITOR_INTERVAL_MS` 를 짧게(예: 100ms) 설정하거나 Redis 지연이 길어지는 장애 상황에서 재현 가능하다.
- **제안**: setInterval 대신 재귀적 setTimeout 패턴으로 전환하거나, in-flight 플래그를 추가해 overlap 을 방지한다.

```typescript
// 권장: in-flight 플래그 추가
private checking = false;

setInterval(() => {
  if (this.checking) return;
  this.checking = true;
  void this.checkOnce().finally(() => { this.checking = false; });
}, this.intervalMs);
```

---

### [INFO] `void this.checkOnce()` — 예상치 못한 예외가 무음으로 사라질 수 있음
- **위치**: `continuation-dlq-monitor.service.ts` — `onModuleInit()` 내 setInterval 콜백
- **상세**: `checkOnce()` 내부에 try-catch 가 있으므로 실제로 unhandled rejection 이 발생할 가능성은 낮다. 그러나 `checkOnce()` 자체의 미처리 버그가 있을 경우 예외가 무음으로 사라진다. 현재 코드 수준에서는 허용 가능하다.
- **제안**: `.catch(err => this.logger.error(...))` 를 setInterval 콜백에 추가하면 완전한 안전망이 된다.

---

### [INFO] `assertWaiting` 이후 `resolveWaitingNodeExecutionId` 재조회 사이의 TOCTOU race — 변경 2.3 이 올바르게 보강함
- **위치**: `codebase/backend/src/modules/external-interaction/interaction.service.ts` — `interact()` 메서드
- **상세**: `assertWaiting(execution)` 에서 읽어온 execution status 검증 후 실제 BullMQ enqueue(내부 `resolveWaitingNodeExecutionId` 재조회) 사이의 race window 에서 다른 요청이 execution 상태를 변경할 수 있다. 이 TOCTOU 는 변경 이전에도 존재하던 구조적 문제이며, 이번 변경 2.3 은 `resolveWaitingNodeExecutionId` 에서 DB 를 재조회해 0건이면 `INVALID_EXECUTION_STATE` 를 throw 함으로써 이 gap 을 의도적으로 보강한다.
- **제안**: 해당 없음 — 이번 변경의 설계 의도가 이 race 보강이며 구현이 적절하다.

---

### [INFO] `onFailed` 핸들러 — 공유 상태 없음, 동시성 문제 없음
- **위치**: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` — `onFailed()`
- **상세**: `@OnWorkerEvent('failed')` 는 Node.js 이벤트 루프 내에서 실행되며, 내부에서 공유 가변 상태 접근 없이 로그만 기록한다. 동시성 이슈 없음.

---

## 요약

이번 변경의 핵심인 `ContinuationDlqMonitorService` 와 `resolveWaitingNodeExecutionId` throw 전환은 Node.js 단일 스레드 이벤트 루프 기반으로 설계됐으며 전반적으로 구조적 결함은 없다. 주목할 점은 `setInterval` + `void checkOnce()` 패턴에서 Redis 지연이 `intervalMs` 를 초과할 경우 두 개의 `checkOnce()` 가 동시에 실행되어 `lastAlarmAt` 을 경쟁적으로 읽고 쓰는 상황이 발생할 수 있다는 점이다. 기본값(60000ms) 환경에서는 거의 발생하지 않지만, 짧은 interval 설정이나 Redis 지연 장애 시 cooldown 을 우회한 중복 알람이 발생할 수 있다. `assertWaiting` 이후의 TOCTOU race 는 이번 변경 2.3 이 의도적으로 보강한 부분으로 개선 방향이 올바르다. `onFailed` 핸들러와 `InvalidExecutionStateError` 전파 체인은 공유 상태 접근 없이 설계되어 동시성 문제가 없다.

## 위험도

LOW
