# 테스트(Testing) 리뷰

대상: `Webchat`→`WebChat` 리네이밍 + `processInBatches` DRY 추출 + `emitCancellationEvent` DRY 추출 (behavior-preserving refactor, `plan/in-progress/refactor-reaper-dry.md`).

## 발견사항

- **[WARNING]** `cancelParkedExecution` 의 `EXECUTION_CANCELLED` emit payload 회귀 검증이 다른 3개 형제 메서드보다 약함 — `emitCancellationEvent` 의 핵심 계약("error 는 있을 때만 payload 에 포함")이 정확히 검증되지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:2922-2943` (`affected:1 — Execution CANCELLED, NodeExecution CANCELLED, EXECUTION_CANCELLED emit`)
  - 상세: 새 private 헬퍼 `emitCancellationEvent`(`execution-engine.service.ts:394-419`)는 `...(opts.error ? { error: opts.error } : {})` 로 `error` 키를 조건부 포함한다. JSDoc 은 "`cancelParked` 는 error 없이 방출" 을 명시적 불변식으로 걸었다. 그런데 이 케이스의 유일한 테스트는 `expect.objectContaining({ status: 'cancelled' })` 만 검증 — `result.cancelledBy === 'user'` 도, `error` 키 부재도 확인하지 않는다. 반면 형제 3개(`markExecutionCancelled` L12825-12834, `markQueueWaitTimeout` L4016-4025, `markWebChatIdleTimeout` L2812-2820)는 전부 `result: { cancelledBy: '...' }` 리터럴 동등 비교 + `error: expect.objectContaining(...)` 를 명시적으로 검증한다. 즉 4갈래 중 "error 생략" 분기(스프레드 삼항의 `else` 브랜치)를 실제로 회귀 방지하는 assertion 이 코드베이스에 하나도 없다 — 예를 들어 헬퍼가 실수로 `error: opts.error`(undefined 값이라도 키 자체는 항상 존재)로 바뀌어도 이 테스트는 통과한다.
  - 제안: `cancelParkedExecution` 테스트에 `result: { cancelledBy: 'user' }` 리터럴 비교 추가 + `error` 키 부재를 `expect.not.objectContaining` 또는 `expect(emittedPayload).not.toHaveProperty('error')` 로 명시적으로 고정.

- **[INFO]** `processInBatches` 의 `concurrency` 소수점 floor 케이스 미검증.
  - 위치: `codebase/backend/src/common/utils/process-in-batches.spec.ts` (전체)
  - 상세: `chunkSize = Math.max(1, Math.floor(concurrency))` — `0`/음수 → 1 floor 테스트는 있으나(`concurrency 0/음수는 1(직렬)로 floor`), 양의 소수(`concurrency=2.7`) 가 `Math.floor` 로 2 로 내려가는 경로는 테스트되지 않는다. 로직이 단순해 위험도는 낮음.
  - 제안: 필요 시 `it.each([0, -1, 2.7])` 형태로 통합해도 좋음(선택).

- **[INFO]** `processInBatches` 워커가 동기적으로 throw 하는 경우(비-`Promise` reject) 미검증 — fail-open 보장의 경계 케이스.
  - 위치: `codebase/backend/src/common/utils/process-in-batches.ts:206` (`chunk.map((item) => worker(item))`)
  - 상세: 타입 시그니처는 `worker: (item: T) => Promise<R>` 이라 정상 `async` 함수는 내부 예외가 항상 rejection 으로 변환되지만, 만약 호출자가 non-async 함수를 넘기고 그 함수가 동기적으로 throw 하면 `chunk.map()` 자체가 throw 해 `Promise.allSettled` 에 도달하지 못하고 배치 전체가 fail-closed 로 깨진다(모듈 문서가 강조하는 "한 item 의 rejection 이 배치를 중단하지 않는다"는 보장의 예외). 현재 실 호출처 2곳(`reapOne`, `revokeAllForExecution`)은 모두 진짜 `async` 함수라 실전 위험은 낮음.
  - 제안: 우선순위 낮음 — 필요 시 문서화("worker 는 반드시 async 함수여야 함")만으로 충분.

- **[INFO]** `interaction-token.service.ts` 의 `verify()` 반환값 타입 캐스트(`as {...}`) 제거는 순수 타입 레벨 변경으로 보이나, 해당 변경에 대응하는 전용 테스트/회귀 근거가 diff 에 없음.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:756`
  - 상세: 기능 변경이 아니라 타입 정리로 판단되며 `verifyPerExecution` 기존 테스트(malformed/expired/audience_mismatch 등)가 회귀를 커버한다. `plan/in-progress/refactor-reaper-dry.md` 가 "unit 4 spec 462 tests + build PASS" 를 주장하므로 컴파일 안전성은 확보된 것으로 보임 — 테스트 관점에서는 문제 없음(참고용 기록).

## 요약

핵심 신규 유닛(`process-in-batches.spec.ts`)은 순서 보존·청크 경계·동시성 상한·fail-open 격리·빈 입력·concurrency 하한 floor 까지 6개 케이스로 알고리즘 표면을 꼼꼼히 커버하고, mock 없이 순수 함수 대상 실제 워커를 사용해 mock 괴리 위험이 없다. `Webchat`→`WebChat` 리네이밍은 grep 으로 확인한 결과 스캔 잔존 없이 전체 완료됐고, 두 호출처(`WebChatIdleReaperService.reap`, `InteractionTokenService.reconcileTerminalRevocations`)의 청크 경계 회귀 테스트가 `processInBatches` 통합 이후에도 그대로 유지되어 동작 보존을 실증한다. 유일한 실질적 갭은 `emitCancellationEvent` DRY 추출의 "error 는 있을 때만 포함" 이라는 핵심 불변식이 4갈래 호출 중 `cancelParkedExecution`(error 없는 유일한 분기) 한 곳만 약한 `objectContaining` assertion 으로 남아있어, 이 분기의 회귀를 실제로 잡아내지 못한다는 점이다. 나머지는 test isolation·가독성·구조(private 헬퍼를 공개 메서드를 통해 간접 검증하는 방식) 모두 양호하다.

## 위험도
LOW
