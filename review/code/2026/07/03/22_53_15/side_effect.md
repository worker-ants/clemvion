# 부작용(Side Effect) Review

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `executeAsync` 의 fire-and-forget `runExecution(...).catch()` 핸들러가 로그만 하던 것에서 `failFirstSegmentSetupBestEffort(executionId, err)` 호출을 추가(M-4, Option B). 동시에 `runExecutionFromQueue` catch 블록에 인라인돼 있던 "failFirstSegmentSetup 호출 + 2차 실패 로그 흡수" 로직을 `failFirstSegmentSetupBestEffort` private 헬퍼로 추출해 두 진입점이 공유.
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 위 변경에 대한 단위 테스트 2건 추가(setup throw 시 best-effort 마감 / 2차 실패 로그 흡수).
- `plan/in-progress/refactor/06-concurrency.md`, `plan/in-progress/refactor/README.md` — 문서 상태 갱신(체크박스·집계표).
- `review/code/2026/07/03/22_35_54/**` — 직전 리뷰 라운드 산출물(SUMMARY/RESOLUTION/서브에이전트 리포트) 신규 커밋. 이 파일들 자체는 리뷰 대상 코드가 아니라 산출물 기록.

## 발견사항

- **[INFO]** `executeAsync` fire-and-forget catch 콜백이 새로 `FAILED` 상태 UPDATE + WS `EXECUTION_FAILED` 이벤트 emit 이라는 부작용을 발생시킴 (의도된 변경)
  - 위치: `execution-engine.service.ts:3398-3410` → `failFirstSegmentSetupBestEffort` → `failFirstSegmentSetup` (`:497-531`)
  - 상세: 변경 전에는 `runExecution` 이 setup 단계에서 throw 하면 catch 블록이 `logger.error` 만 호출하고 종료 — DB 상태 변경도 이벤트 emit 도 없었다. 변경 후에는 동일 경로에서 execution row 를 `FAILED` 로 업데이트하고 `EVENT_TYPE.EXECUTION_FAILED` WS 이벤트를 emit 한다. 이는 이 PR 의 명시적 목적(RUNNING/PENDING 잔류 방지)이며, `failFirstSegmentSetup` 내부에 이미 idempotent guard(`row.status` 가 COMPLETED/FAILED/CANCELLED 면 early return, `:503-510`)가 있어 이중 마감이나 정상 완료 케이스 덮어쓰기 위험은 없다. WS 구독자(프론트)가 이 새 이벤트를 예상 못한 채 수신할 가능성은 있으나, 큐 경로(`runExecutionFromQueue`)에서는 이미 동일 이벤트가 발생해왔던 기존 계약이므로 신규 이벤트 타입 도입이 아니라 sub-workflow 경로로의 대칭 확장이다.
  - 제안: 조치 불요. RESOLUTION.md 에도 "의도된 변경"으로 이미 기록됨.

- **[INFO]** catch 콜백이 동기 함수에서 `async` 콜백으로 변경 — fire-and-forget 내부에 `await` 도입
  - 위치: `execution-engine.service.ts:3398` `this.runExecution(savedExecution, input).catch(async (err: unknown) => {...})`
  - 상세: 이전에는 `.catch((err) => { this.logger.error(...) })` 로 동기 콜백이었으나 이제 `async (err) => { ...; await this.failFirstSegmentSetupBestEffort(executionId, err); }` 로 바뀌었다. `executeAsync` 자신은 `savedExecution` 저장 직후 `executionId` 를 즉시 `return` 하므로(:3412) 이 `.catch()` 체인의 완료를 기다리지 않는다 — 여전히 순수 fire-and-forget 이며 `executeAsync` 호출자(예: sub-workflow 를 발동한 상위 실행)의 흐름에는 영향이 없다. 다만 이 `.catch()` 프라미스 체인 자체가 unhandled-rejection 후보가 될 수 있는데, `failFirstSegmentSetupBestEffort` 가 내부에서 `.catch()` 로 2차 실패까지 흡수하므로(`:545-556`) 이 async 콜백이 reject 될 경로는 없다.
  - 제안: 조치 불요. 테스트(`execution-engine.service.spec.ts` 신규 2건)가 `setImmediate` flush 로 이 비동기 체인의 settle 을 검증하고 있어 회귀 방지 커버리지도 확보됨.

- **[INFO]** private 헬퍼 추출(`failFirstSegmentSetupBestEffort`)은 순수 리팩터링 — 공개 시그니처·호출자 계약 불변
  - 위치: `execution-engine.service.ts:541-556` (신규 헬퍼) / `:2866` (`runExecutionFromQueue` catch, 기존 인라인 로직을 헬퍼 호출로 교체) / `:3409` (`executeAsync` catch, 신규 헬퍼 호출)
  - 상세: `failFirstSegmentSetup` (기존 공개 아님, private) 자체의 시그니처·동작은 변경 없음. 새 헬퍼는 private 이라 클래스 외부 호출자가 없고, 로그 메시지 문구도 기존 W7 로직과 동일하게 유지돼(`failFirstSegmentSetup secondary error for ${executionId}: ...`) 로그 기반 모니터링/알림 룰이 있다면 매칭 패턴이 그대로 보존된다.
  - 제안: 조치 불요.

- **[INFO]** `executeAsync` 의 공개 시그니처(`workflowId, input?, options?`) 및 반환값(`Promise<string>`)은 변경 없음
  - 위치: `execution-engine.service.ts:3367-3371`
  - 상세: diff 는 `.catch()` 콜백 내부 로직만 확장했을 뿐 메서드 시그니처·즉시 반환 타이밍·에러 throw 조건은 그대로다. 이 메서드를 호출하는 다른 서비스(sub-workflow 노드 등)에 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** 환경 변수·네트워크 호출·전역 변수 신규 도입 없음
  - 상세: diff 전체가 클래스 내부 private 메서드 추출/호출 재배선과 기존 리포지토리(`executionRepository`)·기존 이벤트 emitter(`eventEmitter.emitExecution`) 재사용에 국한된다. 새 외부 서비스 호출, 새 env var 읽기/쓰기, 새 module-level/static mutable 상태 없음.

## 요약

이번 변경은 큐 경로(`runExecutionFromQueue`)에 이미 존재하던 "setup 단계 실패 시 best-effort terminal 마감" 패턴을 fire-and-forget sub-workflow 경로(`executeAsync`)로 대칭 이식하고, 두 진입점이 공유하던 인라인 로직을 `failFirstSegmentSetupBestEffort` private 헬퍼로 추출한 것이다. 새로 발생하는 부작용(FAILED UPDATE + WS emit)은 PR 의 명시적 목적이며 idempotent guard 로 이중 마감이 방지되고, catch 콜백의 async화는 fire-and-forget 반환 타이밍에 영향을 주지 않으며 헬퍼 내부에서 2차 실패까지 흡수해 unhandled rejection 경로가 없다. 공개 메서드 시그니처·반환값·호출자 계약은 전혀 변경되지 않았고 전역 상태·환경 변수·네트워크 호출의 신규 도입도 없다. 발견된 항목은 모두 의도된 설계이거나 이미 안전하게 처리된 것으로 CRITICAL/WARNING 대상은 없다.

## 위험도
LOW
