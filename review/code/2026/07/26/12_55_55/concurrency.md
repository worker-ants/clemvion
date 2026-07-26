# 동시성(Concurrency) Review — linear-cancel-mechanism (재검토, 2026-07-26 12:55)

대상: `review/code/2026/07/26/11_48_55` 라운드에서 concurrency 가 낸 WARNING 2건의 해소 여부 재검증 +
신규 추가된 `ForEachExecutor`/컨테이너/Parallel cancel 가드의 동시성 영향 판정.

## 검증 방법

`ff87ede27`(C1-C4/W1-W3 코드) · `107133cfd`(C3 테스트)의 실제 diff 를 읽고, `execution-engine.service.ts` ·
`foreach-executor.ts` · `loop-executor.ts` · `parallel-executor.ts` · `executions.service.ts` 의 현재
소스를 직접 열어 클레임(RESOLUTION.md/CHANGELOG)과 코드를 대조했다.

## 발견사항

- **[정보 — 직전 WARNING #1 해소 확인]** "두 catch 가 무조건 full-entity `save()`" WARNING — **실제로 해소됨.**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4524-4538`(`runExecution` catch),
    `:2619-2638`(`finalizeResumedExecutionOutcome`), guarded-UPDATE 본체는 `:7959-8033`(`updateExecutionStatus`
    else 분기 — `WHERE id=$1 AND status IN ('pending','running','waiting_for_input') RETURNING id`).
  - 상세: 두 catch 모두 `this.executionRepository.save(savedExecution)` 호출을
    `this.updateExecutionStatus(savedExecution, ExecutionStatus.CANCELLED)` 로 교체했고, 이 else 분기는
    M-3 규약과 동일한 조건부 raw UPDATE 다(같은 가드 문자열·반환 계약을 `:4801-4856`의 기존 단위 테스트가
    이미 고정하고 있다). 중요한 세부: 옛 코드가 갖고 있던 `savedExecution.status = ExecutionStatus.CANCELLED;`
    명시 대입이 **삭제됐다** — 이는 실수가 아니라 필수 수정이다. `updateExecutionStatus` 는 내부에서
    `assertTransition(execution.status, newStatus)` 를 **재대입 이전 상태**로 검증하므로(`:7965`), 만약
    호출 전에 이미 `status = CANCELLED` 로 바꿔놨다면 `assertTransition('cancelled','cancelled')` 가 표
    밖 전이로 throw 했을 것이다. `savedExecution.status` 를 그대로 두어(이 지점에서는 항상 `RUNNING` —
    `runExecution` 진입 시 `:4163-4166` 에서, `finalizeResumedExecutionOutcome` 호출부인
    `runNodeDispatchLoop` 진입 시 `:2159-2164` 에서 세팅됨) `RUNNING→CANCELLED` 정상 전이가 되도록 배선한
    것을 확인했다.
  - 왜 실제로 stop() 의 값이 보존되는가: 저장소 전수 검색 결과 `new ExecutionCancelledError(...)` 프로덕션
    호출부는 **`assertExecutionNotCancelled` 단 한 곳**(`:7847-7861`)뿐이다(옛 "coroutine 주입" fast-path 는
    `:894` 주석이 확인하듯 이미 제거됨). 즉 이 두 catch 에 `ExecutionCancelledError` 가 도달하는 시점엔 DB 행이
    **이미** `stop()` 이 커밋한 CANCELLED 상태다 — 그래서 guarded UPDATE 의 `status IN (비-terminal)` 가드가
    항상 0행 매칭(no-op)되어 `stop()` 이 쓴 `finishedAt`/`durationMs` 를 절대 덮어쓰지 않는다. 클레임대로
    동작함을 코드 레벨에서 확인했다.
  - 참고(경미): 주석이 "레이스로 이 catch 가 최초 관측자가 되는 극단 케이스 대비"라고 방어적 프레이밍을
    쓰는데, 위에서 확인했듯 현재 저장소엔 그 "최초 관측자" 시나리오를 만들 다른 생성 지점이 없어 그 분기는
    사실상 도달 불가(dead branch)다 — 버그는 아니고 향후 다른 발생지점이 추가될 때를 대비한 방어 코드로 읽힌다.
  - 부가 관찰(테스트 갭, testing 영역과 겹침): 신규/기존 회귀 테스트(`execution-engine.service.spec.ts:5042-5069`,
    `:6154-6180`)는 "하류 노드 미도달 + `execution.cancelled` emit / `execution.completed` 미emit" 만
    단언하고, `mockExecutionRepo.query` 모의는 항상 `[{id}]`(적용됨)를 반환해 실제 WHERE 가드의 조건부 매칭을
    흉내내지 않는다 — 즉 "guarded UPDATE 가 이 두 catch 에서 실제로 no-op 되어 `finishedAt` 이 보존된다"는
    이번 수정의 핵심 주장은 (제네릭 `updateExecutionStatus` 계약 테스트 `:4801-4856` 과 별개로) 이 두 신규 호출
    지점에 대해 전용 회귀 테스트로 고정돼 있지 않다. 회귀 방지 관점에서 낮은 우선순위 보강 항목.

- **[WARNING]** `ParallelExecutor` 의 실패 선택 로직이 **branch-index 순서**로 고정돼 있어, 같은 Parallel 노드
  안에서 "진짜 노드 실패"와 "외부 cancel(§2.3 신규 가드)" 이 서로 다른 branch 에서 거의 동시에 발생하면
  cancel 대신 실패가 우선 전파돼 Execution 이 `cancelled` 대신 `failed` 로 마감될 수 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:260-287`
    (`for (let i = 0; i < settled.length; i++)` 로 `settled` 를 index 순 순회해 `failures` 를 채운 뒤,
    `errorPolicy==='stop'` 는 `throw failures[0].error`, `errorPolicy==='cancel-others-on-fail'` 는
    `failures.find(f => f.error.name !== 'AbortError')` 로 첫 매칭을 root cause 로 고른다) — cancel 관측
    호출부는 `execution-engine.service.ts:7120`(`executeParallelBranchBody`, 노드 경계마다 branch 별 독립
    호출).
  - 상세: `Promise.allSettled` 로 모든 branch 를 끝까지 기다리므로(`parallel-executor.ts:211-258`), Stop 이
    눌린 시점에 이미 실패 중이던 branch(진짜 비즈니스 에러)와, 다음 노드 경계에서 `assertExecutionNotCancelled`
    를 만나 `ExecutionCancelledError` 를 던지는 다른 branch 가 **함께** `settled` 배열에 rejected 로 담길 수
    있다. 선택 로직은 두 경우 모두 **발생 시각이 아니라 배열 index(=branchIndex) 순서**로 첫 항목을 고른다 —
    `ExecutionCancelledError` 를 다른 에러보다 우선하는 분기가 없다. 그 결과 진짜 실패가 더 낮은 branchIndex
    라면 cancel 이 있었음에도 `failed` 로 마감돼 §5.1("취소는 `cancelled` 로 마감") 을 어길 수 있다.
  - 신규 회귀 여부: 이 PR 이 만든 새 결함은 아니다 — `parallel-executor.ts` 자체는 이번 diff 에 포함되지 않았고,
    이 index-순서 선택 로직은 기존에도 "두 branch 가 동시에 실패"하는 케이스에서 동일하게 임의적이었다. 다만
    이전엔 Parallel 본문에 cancel 관측이 **전혀** 없었으므로(이번 라운드 C3 이전) Stop 을 누른 Parallel 노드는
    100% `failed` 로만 귀결됐다 — 이번 수정으로 통상 케이스(동시 진짜 실패가 없는 경우)는 올바르게 `cancelled`
    로 귀결되도록 개선됐고, 위 "동시 진짜 실패 + 동시 cancel" 이라는 좁은 경합 창에서만 여전히 `failed` 로
    새는 잔여 갭이다. 데이터 손실·리소스 누수는 아니고 상태 라벨 오분류(§5.1) 범주.
  - 제안: `failures` 선택 시 `ExecutionCancelledError` 를 최우선(진짜 root-cause 보다도 우선 — 사용자가
    명시적으로 멈췄다는 사실이 branch 내부 실패 원인보다 신호로서 더 중요)으로 고르는 분기를 추가하거나,
    최소한 plan(`node-cancellation-residual-signal-propagation.md`)에 이 잔여 케이스를 알려진 갭으로 기록.

- **[정보]** 신규 catch 들의 `EXECUTION_CANCELLED` emit 이 `stop()` 과 중복 발행되지 않음을 확인.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:780-807`(`stop()` RUNNING/PENDING
    guarded UPDATE — emit 없음) vs `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:910-951`
    (`cancelParkedExecution`, `status = WAITING_FOR_INPUT` 가드로 RUNNING 경로와 상호 배타) vs 신규
    `emitCancellationEvent(..., logContext:'runExecution'|'finalizeResumedExecutionOutcome')` 호출.
  - 상세: `stop()` 의 RUNNING/PENDING 분기는 DB UPDATE 만 하고 이벤트를 쏘지 않으므로(주석이 주장하는 바
    그대로), 노드 경계 가드가 관측 후 던지는 이 두 catch 가 **유일한** emit 지점이다 — 중복 발행 없음. 다만
    이 무조건 emit 은 이전 라운드 concurrency 리뷰가 지적한 W5(단일 active 세그먼트) 불변식이 깨지는
    edge case(크래시 재배달로 두 세그먼트가 짧게 겹침, 별도 plan 항목으로 이미 추적 중)에서는 두 세그먼트가
    각각 독립적으로 `ExecutionCancelledError` 를 관측하고 각각 emit 할 수 있어 중복 위험이 남는다 — 이는
    **이번 PR 이 만든 회귀가 아니다**(옛 무조건 `.save()`+무조건 `emitExecution()` 코드도 동일하게 중복
    emit 에 노출돼 있었다). 새 위험 아님, 참고용 기록.

- **[정보 — 직전 WARNING #2, 이번 라운드 범위 밖으로 확인]** `assertExecutionNotCancelled` 는 여전히
  `ExecutionStatus.CANCELLED` 만 관측하고, graceful shutdown 이 붙이는 `FAILED`(`SERVER_INTERRUPTED`)는
  이번에도 감지 대상에 포함되지 않았다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7854`
    (`if (row?.status !== ExecutionStatus.CANCELLED) return;`).
  - 상세: 직전 라운드 concurrency 리뷰의 두 번째 WARNING(shutdown FAILED 미감지)은 이번 SUMMARY(C1-C4/W1-W8)
    조치 항목에 포함되지 않았다 — 다만 `plan/in-progress/node-cancellation-residual-signal-propagation.md:53-59`
    의 "⛔ BLOCKED — Workflow 단위 timeout / graceful shutdown 의 노드 abort 통합" 항목이 이 갭을 그대로
    추적 중이며 project-planner 결정 대기로 명시돼 있다(이번 diff 에서도 이 BLOCKED 섹션은 그대로 유지).
    조용히 누락된 것이 아니라 알려진 채로 스코프 밖에 남아 있다 — 이번 라운드가 지시받은 검증 항목(§2.3
    node-boundary CANCELLED 케이스)과는 별개의 결함 클래스라 새 지적으로 올리지 않는다.

- **[정보]** `ForEachExecutor`/`LoopExecutor`/Map(ForEachExecutor 재사용)의 cancel-bypass 는 순수 순차 실행
  안에서 일어나 고전적 데이터 레이스가 없음을 확인 — 동시성 관점의 핵심은 "engine 이 매 iteration 경계마다
  DB 를 다시 읽어 취소를 관측하는 시점"과 "그 신호가 executor 내부에서 삼켜지지 않고 즉시 전파되는지"였다.
  - 위치: `codebase/backend/src/modules/execution-engine/containers/foreach-executor.ts:74-127`(순수
    `for`+`await` 순차 루프, `Promise.all` 없음), `:99-101`(`ExecutionCancelledError` 는 `errorPolicy` switch
    이전에 조기 재throw), `containers/loop-executor.ts:81-116`(per-iteration try/catch 자체가 없어 수정 불요 —
    확인함), 취소 관측 지점 `execution-engine.service.ts:6480`(`executeContainerBody`, **아이템 경계**마다
    1회 — 바디 노드 실행 전에 먼저 체크하므로 취소된 아이템은 바디 노드를 전혀 실행하지 않고 즉시 중단).
  - 상세: `finally { context.itemContext = prevItemContext; }`(foreach-executor.ts:125-127)는
    `ExecutionCancelledError` 전파 경로에서도 항상 실행되므로 취소 시에도 `$item` context 오염 없이 복원됨을
    확인. 신규 회귀 테스트(`foreach-executor.spec.ts:176-202`, `describe.each(['stop','skip','continue'])`)가
    "첫 아이템만 시도되고 나머지는 dispatch 되지 않는다"를 정확히 고정하고 있다 — 코드 읽기로 재현한 동작과
    일치.

## 판단 (지시된 항목)

1. **직전 WARNING("무조건 full save()") 해소 여부 — 해소됨(코드 확인).** `updateExecutionStatus`(M-3 guarded
   UPDATE) 로 전환됐고, 현재 저장소 구조상 이 두 catch 는 항상 이미-terminal 인 행을 만나 no-op 되므로
   `stop()` 이 쓴 `finishedAt`/`durationMs` 가 실제로 보존된다. 다만 이를 직접 고정하는 전용 회귀 테스트는
   없다(제네릭 guarded-UPDATE 계약 테스트만 존재) — 재발 방지 관점에서 보강 여지.
2. **`ForEachExecutor` 재throw가 errorPolicy 처리와 경합하는가 — 경합 없음.** 순차 실행이라 데이터 레이스가
   구조적으로 불가능하고, 재throw 위치(스위치 이전)가 skip/continue 흡수를 정확히 우회한다.
3. **컨테이너/Parallel 가드가 새 race 를 만드는가 — 대체로 아니다. 단 하나의 잔여 경합(WARNING 참고)이 있다.**
   ForEach/Loop/Map 은 순차라 레이스 자체가 없고, Parallel branch 들은 서로 다른 SELECT(읽기 전용) 를 독립
   실행할 뿐이라 쓰기 경합은 없다. 다만 `ParallelExecutor` 의 실패-선택 로직이 branch-index 순서 기반이라,
   "동시 진짜 실패 + 동시 외부 cancel"이라는 좁은 경합 창에서 cancel 신호가 실패에 밀려 `failed` 로 오분류될
   잔여 가능성이 있다(이 PR 의 회귀는 아니며, 통상 케이스는 개선됨).

## 요약

직전 라운드 concurrency WARNING 의 핵심(두 `ExecutionCancelledError` catch 의 무조건 full `save()`)은 이번
수정으로 실제로 해소됐다 — `updateExecutionStatus` guarded UPDATE 로 전환됐고, `ExecutionCancelledError` 의
유일한 생산 지점이 `assertExecutionNotCancelled` 하나뿐이라는 저장소 현황상 이 두 catch 는 항상 이미-terminal
행을 만나 no-op 되어 `stop()` 이 쓴 타임스탬프를 절대 덮어쓰지 않는다. `ForEachExecutor`/`LoopExecutor`/Map 의
`errorPolicy` 우회 재throw 는 순차 실행 구조상 고전적 데이터 레이스를 만들지 않고, 취소 신호를 정확히
skip/continue 흡수 이전에 가로챈다. 컨테이너/Parallel 로의 가드 확장도 새로운 쓰기 경합을 만들지 않는다 — 다만
`ParallelExecutor` 의 기존 "branch-index 순서 실패 선택" 로직이 이번에 새로 등장한 `ExecutionCancelledError`
라는 경쟁자를 우선순위 없이 취급해, 진짜 노드 실패와 외부 cancel 이 서로 다른 branch 에서 거의 동시에 발생하면
`cancelled` 대신 `failed` 로 마감되는 좁은 잔여 경합이 남는다(회귀는 아니고 개선 여지). 직전 WARNING #2(shutdown
FAILED 미감지)는 이번 라운드 스코프 밖으로 plan 에 그대로 추적 중이며 조용히 유실되지 않았다.

## 위험도

LOW
