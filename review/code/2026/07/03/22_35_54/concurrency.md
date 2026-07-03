### 발견사항

- **[INFO]** `failFirstSegmentSetup` 의 read-then-write 는 원자적 UPDATE 가 아님 (기존 패턴 재사용, 신규 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `failFirstSegmentSetup` (L2008-2042), `executeAsync` 의 신규 catch 체인 (L3383-3407)
  - 상세: `failFirstSegmentSetup` 은 `findOneBy` 로 상태를 읽고 terminal 이 아니면 `save` 로 FAILED 마킹한다. 이 read-check-write 사이 간극에서 다른 경로(정상 `runExecution` 완료, `recoverStuckExecutions`, cancel API 등)가 동시에 같은 row 를 갱신하면 TOCTOU 로 stale write 가 발생할 수 있다(예: 정상 COMPLETED 직후 이 catch 가 나중에 도착해 FAILED 로 덮어쓰는 이론적 케이스). 다만 이번 diff 는 이미 `runExecutionFromQueue`(W7, 큐 경로)에 존재하던 동일 helper·동일 위험을 `executeAsync`(sub-workflow fire-and-forget 경로)에 **동일하게** 적용한 것으로, 새로운 위험을 도입한 것이 아니라 두 경로의 계약을 일관되게 맞춘 변경이다. `updateExecutionStatus`(M-3)가 쓰는 guarded raw UPDATE(`... RETURNING id`) 패턴과 달리 이 helper 는 여전히 비원자적이지만, 이는 기존에 이미 받아들여진 잔여 리스크이지 본 diff 의 회귀가 아니다.
  - 제안: 변경 불필요(신규 이슈 아님). 추후 이 helper 를 M-3 스타일 조건부 UPDATE 로 통합하는 리팩터를 고려할 수 있으나 별도 트랙.

- **[INFO]** 2차 실패(catch 내부의 catch) 로그 흡수는 unhandled rejection 방지 목적에 부합
  - 위치: `executeAsync` L3396-3406 / 대응 테스트 `execution-engine.service.spec.ts` L78-108
  - 상세: `this.runExecution(...).catch(async (err) => { ... await this.failFirstSegmentSetup(...).catch(secondaryErr => log) })` 구조는 fire-and-forget 컨텍스트에서 `failFirstSegmentSetup` 자체가 reject 할 경우 바깥 `.catch` 체인이 소비하지 못해 unhandled rejection 이 될 위험을 정확히 차단한다. `runExecutionFromQueue` 의 기존 W7 패턴과 동형이라 일관성도 확보됨.
  - 제안: 없음. 올바른 구현.

- **[INFO]** 테스트의 `setImmediate` flush 는 fire-and-forget assertion 관용구로 이 codebase 표준과 일치
  - 위치: `execution-engine.service.spec.ts` L69-70, L99
  - 상세: `executeAsync` 는 executionId 를 동기적으로 즉시 반환하고 `runExecution(...).catch(...)` 체인은 백그라운드에서 진행된다. 테스트가 `await new Promise((r) => setImmediate(r))` 로 microtask/일부 macrotask 큐를 flush 한 뒤 `failSpy`/`errorSpy` 호출을 검증하는 것은 파일 상단에 이미 정의된 `flushPromises()` 헬퍼와 동일한 패턴이며, `runExecutionFromQueue` 의 인라인 worker 브릿지 mock(L658-661, `void service.runExecutionFromQueue(...).catch(() => undefined)`)이 쓰는 관용구와도 일관된다. 다만 체인이 `.catch(async (err) => { ... await failFirstSegmentSetup ... })` 로 async catch 내부에 추가 await 이 있어 하나의 `setImmediate` tick 으로 충분히 settle 되는지는 미묘하지만(mock 들이 모두 즉시 resolve 하므로 실제로는 충분), 만약 향후 mock 이 아닌 실제 프라미스 체인이 더 깊어지면 flake 가능성이 있다 — 기존 `flushResumeDrive`(실제 타이머 200ms) 사례처럼 필요시 유사한 안전판을 고려할 수 있다.
  - 제안: 현재는 문제 없음(테스트는 모두 mock 이 즉시 resolve). 향후 체인이 깊어지면 관찰.

### 요약
이번 변경은 `executeAsync`(sub-workflow fire-and-forget 실행)의 setup 단계 throw 를 `runExecutionFromQueue`(큐 경로, W7)와 동일한 `failFirstSegmentSetup` best-effort 마감 + 2차 실패 로그 흡수 패턴으로 통일한 것이다. 새로운 동시성 프리미티브(락/뮤텍스/원자 연산)를 도입하지 않고 기존에 검증된 패턴을 대칭 적용했으며, 2차 실패를 흡수해 fire-and-forget 컨텍스트에서 unhandled rejection 을 만들지 않는다는 핵심 계약도 정확히 지켰다. 테스트 역시 fire-and-forget 특유의 비동기 settle 을 `setImmediate` flush 로 검증하는 codebase 기존 관용구를 그대로 따른다. `failFirstSegmentSetup` 자체의 비원자적 read-then-write 는 이미 다른 경로에도 존재하는 잔여 리스크로, 본 diff 가 새로 유입한 문제는 아니다.

### 위험도
LOW
