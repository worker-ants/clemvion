# 동시성(Concurrency) Review — linear-cancel-mechanism

대상: `assertExecutionNotCancelled` 노드-경계 cancel 가드 신설(§2.3/§5.1) + 관련 spec/e2e/plan 갱신.

## 발견사항

- **[WARNING]** `ExecutionCancelledError` 종결 경로가 **무조건(unconditional) full-entity `save()`** 를 쓴다 — 같은 파일의 다른 모든 cancel/shutdown 종결 경로가 쓰는 **조건부 guarded UPDATE** 패턴과 불일치하며, 본 PR 이 이 취약한 경로의 도달 빈도를 크게 늘린다.
  - 위치:
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4504-4517` (`runExecution` catch — `if (err instanceof ExecutionCancelledError) { savedExecution.status = ...; await this.executionRepository.save(savedExecution); }`)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2619-2631` (`finalizeResumedExecutionOutcome` — `runNodeDispatchLoop` 를 쓰는 재개/retry 세그먼트 전부가 여기로 수렴: 호출부 `execution-engine.service.ts:2284`, `:2447`, `:3355`)
    - 새로 추가된 트리거: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7796-7807` (`assertExecutionNotCancelled`) 와 그 3개 호출 지점 `:1638`(`runNodeDispatchLoop`) · `:3729`(`executeInline`) · `:4261`(`runExecution`).
  - 상세: `assertExecutionNotCancelled` 는 `findOneBy` 로 **fresh row** 를 읽지만(`:7799`) `row.status` 하나만 보고 나머지는 버린다. 이후 `ExecutionCancelledError` 를 잡는 두 catch 는 (여러 노드를 거치며) **세그먼트 시작 시점부터 들고 있던 stale in-memory `savedExecution`** 에 `status/finishedAt/durationMs` 만 다시 세팅한 뒤 `this.executionRepository.save(savedExecution)` 를 호출한다. TypeORM `.save()` 는 PK 기준 무조건 UPDATE(엔티티에 `@VersionColumn` 없음 — optimistic lock 없음)이고, `savedExecution` 객체에 실려 있는 **다른 모든 컬럼도 함께 덮어쓴다**.
    같은 파일/모듈에서 정확히 이 문제(동시 cancel/park 로 인한 lost-update)를 겨냥해 이미 두 가지 안전 패턴이 확립돼 있다: ① `updateExecutionStatus` else 분기의 **guarded raw UPDATE**(`WHERE status IN ('pending','running','waiting_for_input') RETURNING id`, M-3, `execution-engine.service.ts:7941-7975`, affected=0 이면 no-op), ② `cancelParkedExecution`/`markExecutionCancelled`(`execution-engine.service.ts:910-937`, `:2657-2686`)와 `executions.service.ts` 의 `stop()`(`:780-792`)이 쓰는 **조건부 QueryBuilder UPDATE**(`WHERE id=... AND status IN (...)`). `ShutdownStateService.markRemainingAsInterrupted`(`shutdown-state.service.ts:179-238`)도 동일하게 `WHERE ... AND status = 'running'` 가드를 쓴다. 이 두 catch 만 이 규약 밖에 있다 — M-3 코멘트가 명시한 "옛 full-entity save 는 stale 엔티티의 모든 컬럼을 덮어써 동시 cancel/park 전이를 잃어버리는 lost-update 위험" 이 정확히 이 두 곳에 여전히 남아 있다.
    "단일 Execution 은 한 번에 하나의 active 세그먼트만 처리된다"(W5 불변식, `:509-514`) 하에서는 `stop()` 이 이미 쓴 `status`(CANCELLED, 동일값)/`finishedAt`/`durationMs`(engine 이 더 늦게 재계산한 값으로 덮어씀 — "되돌림"이 아니라 소폭 전진하는 drift)만 영향받아 실질 데이터 손실은 낮다. 그러나 이 PR 이전에는 이 catch 가 (comment 상) "park 중 in-memory 코루틴 주입" 이라는 사실상 죽은 경로로만 도달했는데, 이제는 **RUNNING 세그먼트의 매 노드 경계에서 일상적으로** 도달한다. W5 가 깨지는 알려진 예외 경로(크래시 후 stalled-job 재배달로 두 세그먼트가 짧게 겹치는 케이스 — `project_exec_park_pr3_crash_redrive_done.md` 참고) 나 아래 shutdown 레이스와 겹치면, 이 두 catch 는 **가드 없이** 상대방이 쓴 컬럼을 조용히 덮어쓴다. `assertExecutionNotCancelled` 가 이미 읽어 온 fresh row(=`stop()` 이 쓴 정확한 finishedAt/durationMs)를 버리지 않고 재사용하거나, catch 자체를 guarded conditional UPDATE 로 바꾸는 것이 M-3 와 일관된 수정이다.
  - 제안: 두 `ExecutionCancelledError` catch 를 `updateExecutionStatus`/`cancelParkedExecution` 과 동일한 **조건부 UPDATE**(`WHERE id=... AND status IN (non-terminal...)`)로 교체하거나, 최소한 `assertExecutionNotCancelled` 가 이미 읽은 fresh row 를 catch 에 전달해 무조건 `.save()` 대신 그 값을 신뢰하도록 배선한다. 회귀 테스트로 "stop() 이후 catch 의 save() 가 stop() 이 쓴 finishedAt 을 되돌리지 않는다"(및 이상적으로는 "동시 SERVER_INTERRUPTED FAILED 를 덮어쓰지 않는다")를 mock-repo 수준에서 고정할 것 — 현재 신규 테스트(`execution-engine.service.spec.ts:4934-4970`)는 dispatch 호출 횟수만 보고 저장되는 컬럼은 검증하지 않는다.

- **[WARNING]** `assertExecutionNotCancelled` 의 관측 대상이 `ExecutionStatus.CANCELLED` 로 좁게 고정돼 있어, graceful shutdown 이 붙이는 `FAILED`(`SERVER_INTERRUPTED`)에는 반응하지 않는다 — stop() 이후 부수효과를 멈추는 이번 수정의 취지가 shutdown 경로엔 적용되지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7799-7800` (`if (row?.status !== ExecutionStatus.CANCELLED) return;`) vs `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts:213-237` (`markRemainingAsInterrupted` — grace 만료 후 `status: FAILED, error.code: 'SERVER_INTERRUPTED'` 로 마킹, `WHERE ... AND status = 'running'`).
  - 상세: `ShutdownStateService` 의 §11.2 설계는 "shutdown 진입 후에도 동일 세그먼트는 완료까지 진행"(`shutdown-state.service.ts:32-34`)을 명시적으로 허용한다. grace(기본 30s) 가 만료돼 in-flight 실행이 `FAILED`+`SERVER_INTERRUPTED` 로 마킹된 뒤에도, 같은 프로세스에서 그 세그먼트의 dispatch 루프가 계속 살아 있다면 `assertExecutionNotCancelled` 는 `row.status === 'failed'` 를 보고도 **정상 반환**해 다음 노드를 계속 dispatch 한다(이메일/HTTP/DB 부수효과 포함) — 정확히 이 PR 이 `stop()` 에 대해 막으려던 것과 같은 종류의 문제가 shutdown 경로에는 남는다. 최종 `updateExecutionStatus(COMPLETED)` 자체는 guarded 라 DB 상태를 어긋나게 뒤엎지는 않지만(`affected=0` → no-op), 그 사이 계속되는 노드 실행의 부수효과는 막지 못한다.
  - 제안: 즉시 수정이 아니라도 인지 필요 — `plan/in-progress/node-cancellation-residual-signal-propagation.md` 의 "⛔ BLOCKED — Workflow 단위 timeout / graceful shutdown 의 노드 abort 통합" 항목이 이미 이 계열의 race(§5.1 cancelled 규칙과 SERVER_INTERRUPTED bulk UPDATE 의 동일 row 경합)를 planner 결정 대기로 분류해 뒀다. `assertExecutionNotCancelled` 를 `status IN (CANCELLED, FAILED)` 로 넓히는 안이 이 결정에 포함돼야 한다는 점을 그 트래킹 문서에 명시적으로 남길 것을 권장한다(현재는 CANCELLED 사례만 언급됨).

## 판단 (지시된 3가지 항목)

**(a) 노드 경계 관측(best-effort) 이 spec §5 와 정합한가 — 정합.** `spec/conventions/node-cancellation.md` §2.2("CPU 바운드... signal 미지원 — best-effort. 자기 작업 완료까지 계속 진행해도 무방")·§2.3("현재는 다음 노드 경계에서 판정")이 이미 이 정책을 명문화했고, 기존 `assertActiveTimeWithinLimit`(§8 워크플로 시간 한도)도 동일한 "노드 경계 재확인" 패턴을 쓴다. 신규 e2e(`node-cancellation-propagation.e2e-spec.ts`)도 in-flight code 노드의 완주를 전제로 "하류 미도달" 만 단언하도록 설계됐다(대조군 테스트 포함, vacuous 판정 배제). 코드·spec·테스트 삼자가 일관된다 — 결함 아님.

**(b) `ExecutionCancelledError` catch 의 full `save()` 가 `stop()` 이 쓴 컬럼을 되돌릴 위험 — 존재하나 현재 설계 하에서는 완만(WARNING), 잠재적으로는 실재.** 위 첫 발견사항 참고. 통상 케이스(단일 세그먼트 + `stop()` 단독)에서는 `status`(동일)·`finishedAt`/`durationMs`(더 늦은 값으로 전진)만 영향받아 실질 훼손은 작다. 다만 이 catch 는 M-3 가 명시적으로 제거하려 했던 "무조건 full-entity save" 패턴 그대로이며, `assertExecutionNotCancelled` 도입으로 이 경로의 도달 빈도가 (거의 죽어 있던 park-injection 전용 경로에서) RUNNING 세그먼트의 일상 경로로 크게 넓어졌다. W5 불변식이 깨지는 크래시-재배달 edge case 나 아래 (c) 의 shutdown 레이스와 겹치면 가드 없는 덮어쓰기가 실제 손실로 이어질 수 있다.

**(c) shutdown/재개 경로와의 상호작용 — 두 번째 발견사항 참고.** 재개(§7.5, `runNodeDispatchLoop`/`finalizeResumedExecutionOutcome`) 경로는 (b)와 동일한 catch 패턴을 그대로 공유하므로 위험 성격이 동일하다. Graceful shutdown 은 별도로, `assertExecutionNotCancelled` 가 CANCELLED 만 감지하고 shutdown 이 붙이는 FAILED/SERVER_INTERRUPTED 는 감지하지 못해 이번 수정의 보호가 shutdown 경로엔 미치지 못한다 — 다만 이는 plan 문서가 이미 별도 항목(⛔ BLOCKED)으로 인지·추적 중인 사안과 같은 결함 클래스다.

## 요약

`assertExecutionNotCancelled` 신설 자체(노드 경계에서 fresh SELECT 로 외부 cancel 을 관측)는 spec 이 명시한 best-effort/노드-경계 판정 정책과 정합하고, 단일 PK 인덱스 SELECT 라는 비용도 합리적이다. 다만 이 신설 가드가 흘려보내는 `ExecutionCancelledError` 를 받는 기존 두 catch 블록(`runExecution`, `finalizeResumedExecutionOutcome`)은 M-3 가 다른 모든 종결 경로에서 이미 제거한 "무조건 full-entity save" 패턴을 그대로 쓰고 있어, 이 PR 은 그 잠재 위험의 노출 빈도를 크게 늘린다. 통상적인 단일-세그먼트 `stop()` 시나리오에서는 피해가 제한적(타임스탬프 drift 수준)이지만, W5 불변식이 깨지는 크래시-재배달이나 graceful shutdown 의 SERVER_INTERRUPTED 마킹과 겹치는 edge case 에서는 가드 없는 덮어쓰기가 실제 lost-update 로 번질 수 있다. 두 catch 를 기존 guarded-UPDATE 패턴으로 통일하는 후속 조치와, shutdown FAILED 상태까지 감지 범위를 넓히는 논의(이미 별도 plan 항목으로 추적 중)를 권장한다.

## 위험도

MEDIUM
