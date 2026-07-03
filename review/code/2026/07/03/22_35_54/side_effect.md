# 부작용(Side Effect) 리뷰 결과

## 리뷰 대상
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (M-4: `executeAsync` fire-and-forget catch 체인 확장)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (위 변경에 대한 신규 유닛 테스트 2건)

## 발견사항

- **[INFO]** `executeAsync` catch 경로에 `failFirstSegmentSetup` 부가 DB write + WS emit 추가
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3383-3407`
  - 상세: `this.runExecution(...).catch(...)` 블록이 기존에는 `logger.error` 로만 끝났으나, 이제 `failFirstSegmentSetup(executionId, err)` 를 호출해 `Execution` row 를 `FAILED` 로 UPDATE 하고 `ExecutionEventEmitter.emitExecution(EXECUTION_FAILED)` 이벤트를 추가로 발행한다. 이는 새 부작용(DB write, WS 이벤트 발행)이지만, 이미 동일 클래스 내 `runExecutionFromQueue` catch 경로(2844-2850행)에 존재하는 검증된 패턴을 그대로 재사용한 것이며, PR 목적(M-4: setup 단계 throw 시 RUNNING/PENDING 잔류 방지) 자체가 이 부작용을 의도한 것이다. `failFirstSegmentSetup` 내부는 이미 idempotent guard(row 가 이미 terminal 이면 no-op)를 가지므로 정상 종료 케이스(`runExecution` 이 스스로 이미 terminal 처리한 경우)에 대한 이중 emit 위험은 없다.
  - 제안: 별도 조치 불필요. 의도된 변경.

- **[INFO]** 2차 실패(`failFirstSegmentSetup` 자체의 throw)를 흡수하는 `.catch()` 추가
  - 위치: `execution-engine.service.ts:3396-3406`
  - 상세: fire-and-forget 컨텍스트(`this.runExecution(...).catch(async (err) => {...})`)이므로 이 async catch 콜백 내부에서 발생하는 예외는 흡수하지 않으면 Node.js unhandled promise rejection 이 된다. 새 코드는 `await this.failFirstSegmentSetup(...).catch(secondaryErr => logger.error(...))` 로 명시적으로 흡수해 unhandled rejection 을 방지한다. 큐 경로(W7 커밋)와 동일한 패턴이며 올바르게 적용됨.
  - 제안: 없음.

- **[INFO]** `executeAsync` 공개 시그니처(파라미터, 반환값) 는 변경 없음
  - 위치: `execution-engine.service.ts:3352-3356`
  - 상세: `workflowId`, `input`, `options` 파라미터와 `Promise<string>` 반환 타입 모두 그대로. `runExecution(...).catch(...)` 은 fire-and-forget 이라 `executeAsync` 자체의 반환 시점(“return executionId”, 3409행)에는 영향 없음. `workflow.handler.ts` 등 유일한 프로덕션 호출자(sub-workflow 노드)는 이 catch 블록 내부 동작을 알 필요 없이 그대로 동작한다.
  - 제안: 없음.

- **[INFO]** 테스트 파일의 `service as unknown as M4AsyncFailSubject` private 메서드 spy
  - 위치: `execution-engine.service.spec.ts:49-105`
  - 상세: 신규 테스트 2건이 `runExecution` / `failFirstSegmentSetup` 을 `jest.spyOn` 으로 몽키패치한다. 두 테스트 모두 `mockRestore()` 로 스파이를 원복하고, `beforeEach` 가 매 테스트마다 새 `TestingModule` 을 재컴파일하므로 전역 상태 오염이나 다른 테스트로의 누수는 없다. `setImmediate` 플러시로 fire-and-forget 체인 settle 을 기다리는 방식도 기존 `flushPromises` 헬퍼와 동일 패턴.
  - 제안: 없음.

- **[INFO]** 파일시스템/환경변수/네트워크 호출 없음
  - 상세: 이번 diff 는 순수하게 클래스 내부 catch 체인 확장과 그에 대응하는 유닛 테스트 추가로, 파일시스템 쓰기, 환경 변수 읽기/쓰기, 외부 네트워크 호출은 포함하지 않는다.

## 요약
이번 변경은 `executeAsync` 의 fire-and-forget 실행 실패 시 처리 경로에 이미 큐 경로(`runExecutionFromQueue`)에서 검증된 `failFirstSegmentSetup` best-effort 마감 로직을 동일하게 적용한 것으로, 새로 도입되는 부작용(Execution row FAILED 업데이트 + WS 이벤트 발행)은 PR 목적 그 자체이며 idempotent guard 로 이중 실행이 방지된다. 2차 실패도 명시적으로 흡수해 unhandled rejection 을 만들지 않으며, 공개 시그니처·반환값·호출자 계약에는 변화가 없다. 신규 유닛 테스트는 스파이를 적절히 원복해 격리를 유지한다. 부작용 관점에서 우려할 CRITICAL/WARNING 사항은 발견되지 않았다.

## 위험도
LOW
