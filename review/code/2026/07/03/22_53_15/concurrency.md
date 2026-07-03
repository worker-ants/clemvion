# 동시성(Concurrency) Review

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
  - `failFirstSegmentSetupBestEffort` private 헬퍼 신설 (`failFirstSegmentSetup` 호출 + 2차 실패 로그 흡수 쌍을 추출)
  - `runExecutionFromQueue` catch 블록이 신설 헬퍼로 위임
  - `executeAsync` 의 fire-and-forget `runExecution(...).catch(...)` 콜백을 `async` 로 바꾸고 내부에서 신설 헬퍼를 `await` 호출 (M-4, Option B)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 위 `executeAsync` 변경에 대한 단위 테스트 2건 추가 (setup throw → best-effort 마감 / `failFirstSegmentSetup` 2차 실패 → 로그 흡수)
- `plan/in-progress/refactor/06-concurrency.md`, `plan/in-progress/refactor/README.md` — 문서 동기화(코드 변경 없음)
- `review/code/2026/07/03/22_35_54/**` — 직전 회차 리뷰 산출물(SUMMARY/RESOLUTION/서브에이전트 출력). 본 회차의 diff 로 나타나지만 신규 코드가 아니라 이전 리뷰 결과물이므로 별도 분석 대상은 아님(참고만).

이번 diff 는 `plan/in-progress/refactor/06-concurrency.md` M-4 항목 자체의 구현 커밋(`a18a8d5a0`) + 그 직전 ai-review WARNING 을 반영한 review-fix 커밋(`af0ce08fb`, 헬퍼 추출)에 해당한다.

## 발견사항

- **[INFO]** fire-and-forget catch 콜백이 반환하는 Promise 는 어디에도 연결되지 않음
  - 위치: `execution-engine.service.ts:3395` `this.runExecution(savedExecution, input).catch(async (err) => {...})`
  - 상세: 콜백을 `async` 로 바꾸면서 내부에서 `await this.failFirstSegmentSetupBestEffort(...)` 를 쓰지만, `.catch(...)` 가 반환하는 Promise 자체는 `executeAsync` 함수 어디에서도 `await`/할당되지 않는다(원래도 fire-and-forget 설계 의도이므로 이 자체는 변경 전과 동일한 패턴). 다만 `failFirstSegmentSetupBestEffort` 내부의 `failFirstSegmentSetup` 은 이미 자체 `try/catch` 로 모든 예외를 흡수하고(`:501-530`), `failFirstSegmentSetupBestEffort` 도 외부에 `.catch` 를 한 겹 더 씌워(`:545-555`) 사실상 이 콜백이 reject 할 경로가 없다. 따라서 "연결되지 않은 Promise" 자체가 unhandled rejection 으로 이어질 가능성은 실질적으로 0에 가깝다 — 방어적 이중 흡수 구조다.
  - 제안: 조치 불요. 다만 향후 `failFirstSegmentSetup` 내부 try/catch 가 제거되거나 새로운 async 호출이 이 체인에 추가될 경우, 콜백 내부에서 uncaught 예외가 나면 Node 의 unhandled rejection 경보로 이어질 수 있음을 유지보수 시 유의.

- **[INFO]** `runExecutionFromQueue`(await 방식) vs `executeAsync`(fire-and-forget `.catch`) 의 동시성 모델 차이는 의도된 비대칭
  - 위치: `execution-engine.service.ts:2855-2865`(큐 경로, `try { await this.runExecution(...) } catch`) vs `:3395-3406`(비동기 경로, `.catch(async (err) => {...})`)
  - 상세: 큐 경로는 BullMQ worker 가 job 하나를 통째로 await 하는 구조라 setup throw 가 동기적으로 catch 절에 도달하지만, `executeAsync` 는 호출자에게 `executionId` 를 즉시 반환하고 실행은 백그라운드에서 진행되는 fire-and-forget 이다. 이번 diff 는 이 두 경로가 "setup 실패 시 best-effort terminal 마감" 이라는 종착 동작만 동일 헬퍼로 통일했을 뿐, 실행 모델(동기 await vs fire-and-forget)의 근본 차이는 그대로 남겨두었다 — plan 문서에도 "Option A(큐 통일)는 후속" 으로 명시돼 있어 의도된 범위 한정이다.
  - 제안: 조치 불요(설계 결정 기록됨, plan §M-4 참고).

- **[INFO]** 테스트의 `setImmediate` flush 관용구는 fire-and-forget 검증 패턴과 일관
  - 위치: `execution-engine.service.spec.ts:2229` (`await new Promise((r) => setImmediate(r));`)
  - 상세: `executeAsync` 는 `runExecution` 을 await 하지 않고 즉시 `executionId` 를 반환하므로, catch 체인이 settle 하는 시점은 테스트 호출 시점과 분리된다. 신규 테스트 2건 모두 `service.executeAsync(...)` 의 반환을 먼저 검증한 뒤 `setImmediate` 로 한 tick 양보하고 나서 `failFirstSegmentSetupBestEffort`(→ 위임된 `failFirstSegmentSetup`) 호출을 검증한다. 이는 기존 W5/W7 테스트가 큐 경로에서 쓰던 것과 동일한 검증 관용구이며, race 없이 결정적으로 catch 콜백의 settle 을 관측한다.
  - 제안: 조치 불요.

- **[INFO]** `failFirstSegmentSetup` 자체의 read-then-write 비원자성은 기존 패턴 재사용, 신규 회귀 아님
  - 위치: `execution-engine.service.ts:497-531`
  - 상세: `findOneBy` 로 조회 후 상태를 검사하고 `save` 로 갱신하는 흐름은 두 동시 호출(예: 큐 worker 의 setup throw 경로와 다른 취소/복구 경로)이 겹칠 경우 이론적 TOCTOU 여지가 있으나, 이는 이번 M-4 diff 가 새로 만든 것이 아니라 기존 `failFirstSegmentSetup`(및 그 W5/W7 호출부)의 계약을 `executeAsync` 경로로 대칭 확장한 것뿐이다. 상태 가드(`COMPLETED/FAILED/CANCELLED` 면 no-op)가 최소한의 idempotency 방어선을 제공한다. `06-concurrency.md` C-2(원자 claim) 스코프와는 별개 축이며, 이번 diff 로 인한 신규 노출 표면 확대는 크지 않다(fire-and-forget setup-throw 라는 상대적으로 드문 실패 경로 한정).
  - 제안: 조치 불요. 재발 시 C-2 와 같은 원자 claim/conditional UPDATE 패턴으로 통합 검토 여지는 있으나 본 diff 범위 밖.

## 요약

이번 변경은 이미 큐 경로(`runExecutionFromQueue`, W7)에서 검증된 "setup 단계 throw/2차 실패에 대한 best-effort terminal 마감 + 로그 흡수" 패턴을, sub-workflow fire-and-forget 경로(`executeAsync`)에 대칭적으로 이식하고 두 경로가 공유하는 `failFirstSegmentSetupBestEffort` 헬퍼로 DRY 화한 것이다. `failFirstSegmentSetup` 내부 try/catch + 헬퍼의 외부 `.catch` 라는 이중 흡수 구조 덕에 fire-and-forget 콜백에서 unhandled rejection 이 발생할 경로는 사실상 없으며, 신규 테스트 2건도 `setImmediate` flush 로 비동기 catch 체인의 settle 을 결정적으로 검증한다. 큐 경로(동기 await)와 fire-and-forget 경로(비동기 catch)의 근본적 실행 모델 차이는 여전히 남아 있으나 이는 plan 에 "Option A 후속" 으로 명시된 의도된 범위 한정이며, 신규 경쟁 조건·데드락·동기화 결함은 발견되지 않았다.

## 위험도
LOW
