# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] `registerInFlight` early-return 제거 후 grace 만료 시점의 스냅샷 경쟁 조건 (이론적)
- 위치: `shutdown-state.service.ts` L538-551 (`onApplicationShutdown` 내 `waitForDrain` 완료 직후)
- 상세: `waitForDrain` 반환 직후 `remainingNodeExecutionIds` 를 스냅샷(`Array.from`)하기 전, 이벤트 루프 틱 사이에 이론적으로 새 `registerInFlight` 호출이 끼어들어 스냅샷에 포함될 수 있다. Node.js 는 단일 스레드이므로 실제 인터리빙은 `await` 경계에서만 발생한다. `waitForDrain` 마지막 `await new Promise(setTimeout)` 이후부터 `Array.from` 호출까지는 동기 구간이므로 실제 race는 발생하지 않는다. 다만 early-return 제거로 shutdown 이후에도 `registerInFlight`가 호출 가능해진 만큼, 향후 코드 수정 시 `await` 가 해당 구간에 삽입되면 스냅샷 누락이 발생할 수 있다는 점을 인지해야 한다.
- 제안: 현재 구조로는 문제 없음. 추후 `markRemainingAsInterrupted` 앞에 `await` 를 추가하는 리팩터링 시 스냅샷 시점을 재검토할 것.

### [INFO] `shuttingDown` 플래그와 `registerInFlight` 간 원자성 — Node.js 단일 스레드 특성으로 보장됨
- 위치: `shutdown-state.service.ts` L514-518, L504-506
- 상세: `this.shuttingDown = true` 세팅과 `inFlightNodeExecutions.set()` 은 동기 코드이며 `await` 경계 없이 실행된다. Node.js 단일 스레드 이벤트 루프 특성상 이 두 연산 사이에 다른 코루틴이 끼어들 수 없다. early-return 제거 전에는 `shuttingDown=true` 이후 들어오는 등록을 의도적으로 차단했으나, 제거 후에는 shutdown 중 추가 등록이 모두 `inFlightNodeExecutions` 에 반영된다 — 이것이 이번 fix 의 의도이며 원자성 관점에서 안전하다.
- 제안: 조치 불요.

### [INFO] `waitForDrain` polling 루프 — 이벤트 루프 블로킹 없음
- 위치: `shutdown-state.service.ts` L554-564
- 상세: `while` 루프 내부에서 `await new Promise<void>((resolve) => setTimeout(resolve, pollMs))` 로 이벤트 루프를 양보하고 있어 블로킹이 없다. `pollMs` 기본값 200ms 는 충분한 양보 간격이다. `inFlightCount` 조회는 `Map.size` 접근(동기, O(1))이므로 루프 내 블로킹 연산 없음.
- 제안: 조치 불요.

### [INFO] `unregisterInFlight` 와 grace 만료 마킹 간 TOCTOU (Time-Of-Check-Time-Of-Use) — DB 수준에서 처리됨
- 위치: `shutdown-state.service.ts` L508-511, L586-590
- 상세: grace 만료 후 스냅샷된 `nodeExecutionIds` 중 일부가 `markRemainingAsInterrupted` DB UPDATE 도달 전에 정상 완료(`unregisterInFlight`)될 수 있다. 그러나 `.andWhere('status = :status', { status: NodeExecutionStatus.RUNNING })` 조건이 DB 레벨에서 이미 완료된 row 를 보호한다. 이것은 올바른 방어 패턴이다.
- 제안: 조치 불요. 현재 구조가 TOCTOU 를 DB 조건으로 안전하게 처리하고 있음.

## 요약

변경의 핵심은 Node.js 단일 스레드 런타임의 `ShutdownStateService` 에서 `registerInFlight` 의 early-return 제거다. `await` 경계가 없는 동기 구간(shuttingDown 세팅 → 스냅샷 추출)에서 실제 race condition 은 발생하지 않으며, `inFlightNodeExecutions` (`Map`)과 `shuttingDown` (boolean) 는 단일 스레드 이벤트 루프에서 안전하게 접근된다. grace 만료 후 DB UPDATE 는 `.andWhere('status = RUNNING')` 조건으로 이미 완료된 row 를 보호하는 TOCTOU 방어 패턴을 사용하고 있다. `waitForDrain` 은 `setTimeout` 기반 await 로 이벤트 루프를 양보하므로 블로킹이 없다. 동시성 관점에서 이번 변경은 안전하며 zombie RUNNING row 문제를 올바르게 해결한다.

## 위험도

LOW
