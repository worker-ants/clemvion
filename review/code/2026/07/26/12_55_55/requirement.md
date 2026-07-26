# 요구사항(Requirement) Review — linear-cancel-mechanism (재검증 라운드)

## 맥락 요약

직전 라운드(`review/code/2026/07/26/11_48_55`)에서 낸 CRITICAL 4건(C1 `executeInline` 무력화,
C2 mutation 커버리지 0, C3 컨테이너/Parallel 범위 밖, C4 `finishedAt`/`durationMs` JSDoc-코드
모순)에 대해 `RESOLUTION.md`(commit `ff87ede27`/`107133cfd`/`a3e169317`/`12ffc45f8`)가 조치를
주장한다. 본 라운드는 그 주장을 코드 직접 대조로 검증하는 것이 최우선 임무다.

**결론**: C1·C4는 코드로 확인한 결과 실제로 해소됐다(정확한 재throw/guarded-UPDATE 로직 확인,
회귀 테스트 통과). C3는 `ForEachExecutor`/`executeContainerBody`/`executeParallelBranchBody`
경로에서는 해소됐으나, **동일 버그 클래스가 `ParallelExecutor`의 `errorPolicy: 'continue'`
경로에 그대로 남아 있다** — 이번 라운드가 `ForEachExecutor`의 `skip`/`continue` 흡수를 정확히
고쳤음에도, 구조적으로 동일한 `ParallelExecutor`의 `continue` 정책은 고치지 않았다. 이는 새로
발견된 CRITICAL이다.

## C1/C3/C4 재검증 상세

### C1 — `executeInline`/`WorkflowHandler` 재throw: **해소 확인**

- `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts:184-198` — catch 블록이
  `ParkReleaseSignal`(184-186)에 이어 `if (err instanceof ExecutionCancelledError) { throw err; }`
  (195-197)를 `buildSubWorkflowError` 호출(198) **이전에** 배치했다. `ExecutionCancelledError`
  가 error 포트로 흡수되지 않고 엔진(`runExecution`/`runNodeDispatchLoop`)까지 재throw 된다.
- `workflow-errors.ts`의 `@internal` JSDoc도 `workflow.handler.ts`를 sanctioned 예외로 갱신.
- 회귀 테스트: `workflow.handler.spec.ts:737-773`
  (`describe('execute - ExecutionCancelledError re-throw (§2.3 node-boundary cancel guard)')`,
  2건 — "error 포트로 라우팅되지 않고 re-throw", "error 포트 결과가 반환되지 않는다").
- 실측: `npx jest workflow.handler.spec.ts` 포함 3-파일 배치 실행 477/477 PASS(아래 "재현 테스트
  실행" 참조).

### C3 — 컨테이너/Parallel 반복 가드: **부분 해소 — Parallel `errorPolicy:'continue'` 잔존**

**해소된 부분**:
- `execution-engine.service.ts:6480`(`executeContainerBody` 상단, 아이템 경계마다) ·
  `:7120`(`executeParallelBranchBody`의 노드 루프 안, 노드 경계마다) 양쪽에
  `await this.assertExecutionNotCancelled(executionId)` 배치 확인.
- `foreach-executor.ts:99-101` — `catch` 블록에서 `errorPolicy` switch(105행) **이전**에
  `if (err instanceof ExecutionCancelledError) throw err;`를 둬 `skip`/`continue` 가 취소를
  "아이템 실패"로 흡수하지 못하게 정확히 차단. `map` 노드 타입도 같은
  `ForEachExecutor.execute`를 재사용(execution-engine.service.ts:7664)하므로 동일하게 보호됨.
- `loop-executor.ts:76-80`의 "코드 변경 불요" 판단은 **직접 추적으로 검증**: `execution-engine
  .service.ts:7585-7595`의 `runIter`가 `executeContainerBody`를 그대로 호출하고,
  `LoopExecutor.execute`(loop-executor.ts:81-116)는 반복마다 `executeBody`를 감싸는
  per-iteration try/catch가 없어 `finally`(itemContext/loopContext 복원)를 그대로 통과해
  예외가 손상 없이 전파된다 — 판단이 맞다.
- 회귀 테스트: `execution-engine.service.spec.ts:9950`(ForEach 아이템 경계) ·
  `:11719`(Parallel 브랜치 노드 경계) · `foreach-executor.spec.ts:100-202`
  (`describe.each(['stop','skip','continue'])`) — 전부 vacuous 아님(실제 호출 횟수/미호출
  단언, `bodyCalls`/`seen` 배열 검증). 재실행 결과 15/15, 477/477 전부 PASS.

**미해소 — 새 CRITICAL (아래 발견사항 참조)**: `ParallelExecutor.execute()`가
`errorPolicy: 'continue'`일 때 branch에서 올라온 실패(= `ExecutionCancelledError` 포함
**모든** 실패)를 `throw` 하지 않고 `failures[]`로만 수집해 반환하는데
(`parallel-executor.ts:277-289`), 호출부 `runParallel`(execution-engine.service.ts:7418-7498)
은 그 `parallelResult.failures`를 **한 번도 읽지 않는다**(`grep`으로 저장소 전체에서 `.failures`
참조 0건 확인) — `ForEachExecutor`에 적용한 것과 동일한 "errorPolicy 우회 재throw" 가드가
`ParallelExecutor`에는 없다.

### C4 — `finishedAt`/`durationMs` 보존 (guarded UPDATE 전환): **해소 확인**

- `execution-engine.service.ts:4524-4538`(`runExecution` catch) ·
  `:2619-2638`(`finalizeResumedExecutionOutcome`) 양쪽 모두 무조건 `save()` 대신
  `this.updateExecutionStatus(savedExecution, ExecutionStatus.CANCELLED)` 호출로 전환.
- `updateExecutionStatus`(`:7959-8033`)의 M-3 guarded UPDATE는
  `WHERE id=$1 AND status IN ('pending','running','waiting_for_input')` 가드를 쓴다
  (`:8013-8014`) — DB 행이 이미 `stop()`이 커밋한 `cancelled`(terminal)면 0행 매칭 → no-op →
  `persisted=false` 반환. 두 catch가 계산한 `finishedAt = savedExecution.finishedAt ?? new
  Date()`(stale in-memory 스냅샷 기준 fallback)는 이 no-op으로 **실제로 DB에 쓰이지 않으므로**
  `stop()`이 쓴 원래 값이 그대로 보존된다 — JSDoc(`:7843-7845`)의 주장이 실제로 성립.
- `emitCancellationEvent(..., { cancelledBy: 'user', ... })`(`:964-985`)로 통일해 W3
  (`cancelledBy` 계약 누락)도 함께 해소.
- 실측 재실행: `execution-engine.service.spec.ts`의 관련 describe(`선형 경로 외부 cancel
  전파`, `재개 중 외부 cancel 관측...`) 포함 전체 스위트 477/477 PASS.

## 발견사항

### [CRITICAL] `ParallelExecutor`의 `errorPolicy: 'continue'`가 `ExecutionCancelledError`를 흡수 — C3 가 고친 것과 동일한 버그 클래스가 Parallel 콤비네이터에 남아 있다

- 위치:
  - `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:277-289`
    (`errorPolicy`별 분기 — `'stop'`과 `'cancel-others-on-fail'`만 `failures.length > 0`을
    검사해 throw 하고, `'continue'`는 아무 분기도 없이 `:289`에서 그대로
    `return { settled, failures, clampedConcurrency }`)
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7418-7498`
    (`runParallel` — `parallelResult`를 `:7418`에서 받은 뒤 `.failures`/`.settled`를 저장소
    전체에서 한 번도 읽지 않고, `:7457-7461`에서 무조건 `_selectedPort: ['done']` +
    `branchResults`로 `nodeOutputCache`를 덮어쓰고, `:7482-7497`에서 `done` 포트 + 각 branch의
    `exitNodeIds`로 reachability를 전파한다)
  - 대조(정확히 고친 선례): `codebase/backend/src/modules/execution-engine/containers
    /foreach-executor.ts:91-101`(`errorPolicy` switch 이전에 `ExecutionCancelledError`를
    무조건 재throw)
  - spec 근거: `spec/4-nodes/1-logic/10-parallel.md:24`("`continue` = 모든 분기 종료 대기 후
    실패 정보 수집"), `:123`/`:166`("`errorPolicy='continue'` 모드에서 실패한 분기의 에러
    정보"를 `output.branches[i].error`에 반영) — `continue`는 스키마상 유효한 기본 fallback
    값이다(`errorHandling.policy`의 `skip_node`/`use_default_output`/`route_to_error_port` →
    `continue` 매핑, `execution-engine.service.ts:7373-7379`).
- 상세: `executeParallelBranchBody`(`:7120`)의 §2.3 가드는 브랜치 안의 **모든 노드**에 정확히
  도달한다(C3가 주장하는 대로). 문제는 그 가드가 던진 `ExecutionCancelledError`가
  `runBranch` 콜백 밖으로 나가 `Promise.allSettled`에 `rejected`로 잡힌 뒤(`parallel-
  executor.ts:247-256`), `errorPolicy: 'continue'`(또는 `errorHandling.policy`가
  `skip_node`/`use_default_output`/`route_to_error_port`로 fallback 매핑되는 경우)에서는
  **그 어떤 분기도 이를 다시 throw 하지 않는다는 점**이다. `ParallelExecutor.execute()`는
  "실패를 모아서 반환하되 throw 하지 않는다"는 계약을 **의도적으로**
  구현했고(`parallel-executor.spec.ts:200-222` "collects failures without throwing"이 이
  계약을 잠금) — 이 자체는 버그가 아니라 `continue` 정책의 정의다. 버그는 **호출부**가 반환된
  `failures`를 검사하지 않는다는 것이다: `runParallel`은 `parallelResult`를 받고도 실패
  유무와 무관하게 항상 Parallel 노드를 "성공적으로 완료"한 것처럼 `done` 포트를 활성화한다.
  `ForEachExecutor`가 정확히 이 문제를 `errorPolicy` switch **이전**에 `ExecutionCancelledError`
  전용 우회 재throw로 막았던 것과 달리(foreach-executor.ts:99-101), `ParallelExecutor`에는
  대응하는 우회가 없다.

  **실측 blast radius(코드 추적으로 확인, 과장 방지를 위해 명시)**: top-level 배치 루프
  (`runExecution`/`runNodeDispatchLoop`)는 매 `while` 반복 최상단에서
  `assertExecutionNotCancelled`를 호출하므로(`:4268`, `:1638`), Parallel 노드 뒤에 다른
  top-level 노드(예: Merge)가 있으면 그 다음 루프 순회에서 가드가 다시 걸려 **추가 top-level
  노드 dispatch는 대부분 막힌다** — 이는 이 PR 전체가 인정하는 "노드 경계 사이 최대 1개
  in-flight" 허용 오차와 동일한 수준이다. 그러나 다음 두 가지는 그 보호막 밖이다:
  (1) Parallel 자신의 `NodeExecution`/`context.nodeOutputCache`/`structuredOutputCache`가
  취소된 상태를 반영하지 못하고 `_selectedPort:['done']` + (일부 브랜치는 잘려서 비어있는)
  `branches[]`로 **거짓 성공**을 기록한다 — run-results 타임라인·`$node["parallel-1"].output`
  expression에 그대로 노출된다. (2) **Parallel이 그래프의 최종(top-level) 노드인 경우** —
  흔한 패턴("두 채널로 동시 알림 후 종료")— `pointer`가 loop 종료 조건에 도달해 버려 다음
  `assertExecutionNotCancelled` 호출 자체가 없다. 이 경우 최종 Execution 행 상태는
  `updateExecutionStatus`의 M-3 guarded UPDATE(`status IN (비-terminal)`)가 이미 `cancelled`인
  행에 대해 no-op하므로 안전하게 보존되지만(C4가 고친 것과 동일한 방어선), Parallel 노드
  **자신의** 출력/NodeExecution 상태는 여전히 거짓 `done`으로 남는다.
- 제안: `ForEachExecutor`와 동일한 패턴을 `ParallelExecutor.execute()`에 적용한다 —
  `errorPolicy`별 분기(`:277-287`) **이전**에
  ```ts
  const cancellation = failures.find(
    (f) => f.error instanceof ExecutionCancelledError,
  );
  if (cancellation) throw cancellation.error;
  ```
  를 추가해 취소는 `errorPolicy`와 무관하게 항상 전파되게 한다(`cancel-others-on-fail`은
  이미 우연히 안전하다 — `rootCause` 선택 로직이 `.name !== 'AbortError'`인 첫 실패를 골라
  `ExecutionCancelledError.name`이 `'AbortError'`가 아니므로 그대로 던져진다. 다만 명시적
  우선순위 처리로 통일하는 편이 named-check 우연 의존을 없앤다). `parallel-executor.spec.ts`
  에 `errorPolicy: 'continue'`/`'cancel-others-on-fail'` 각각에 대해 "브랜치가
  `ExecutionCancelledError`를 던지면 `errorPolicy`와 무관하게 즉시 재throw"하는
  `describe.each` 회귀 테스트를 `foreach-executor.spec.ts`의 선례와 대칭으로 추가할 것.

### [WARNING] C4의 "stop이 쓴 `finishedAt`/`durationMs` 보존" 동작을 직접 검증하는 회귀 테스트가 없다

- 위치: `execution-engine.service.spec.ts:5042-5069`(`선형 경로 외부 cancel 전파`) ·
  `:6154-6189`(`재개 중 외부 cancel 관측...`) — 두 테스트 모두 `mockHandler.execute` 호출
  횟수와 `emitExecutionEvent`가 `'execution.cancelled'`/`{status:'cancelled'}`로 호출됐는지만
  단언한다. `result.cancelledBy`(W3 계약) 값이나 DB에 실제로 쓰인
  `finishedAt`/`durationMs`(C4가 고친 핵심 주장)를 검증하는 단언은 어디에도 없다.
- 상세: 코드 자체는 위에서 직접 추적해 정확함을 확인했다(`updateExecutionStatus`의 guarded
  UPDATE가 이미-terminal 행에 대해 no-op). 그러나 이 두 catch를 다시 무조건 `save()`로
  되돌리는 회귀가 발생해도 현재 테스트 스위트는 **잡아내지 못한다** — 호출 횟수/이벤트 타입만
  보고 페이로드 세부·DB write 파라미터를 보지 않기 때문이다. `RESOLUTION.md`의 mutation
  검증 표(7개 지점)에도 이 catch-conversion 자체를 겨냥한 항목이 없다.
- 제안: 두 테스트 중 하나에 `mockExecutionRepo.query`(guarded UPDATE 호출)의 파라미터를
  단언(예: 최초 `findOneBy`가 반환한 `finishedAt`이 그대로 쿼리 파라미터에 실리는지, 혹은
  이미 terminal이므로 query가 아예 매칭 0행으로 no-op임을 확인) + `emitExecutionEvent`
  payload에 `result: { cancelledBy: 'user' }`가 포함되는지 추가.

### [INFO] `LoopExecutor` 자체에는 취소 관련 전용 단위 테스트가 없다

- 위치: `codebase/backend/src/modules/execution-engine/containers/loop-executor.ts`
  (spec 파일 자체가 없음 — `ls containers/`에 `loop-executor.spec.ts` 부재).
- 상세: "코드 변경 불요" 판단은 위에서 직접 추적으로 검증했고 현재 맞다. 다만 이 무변경 판단을
  지키는 안전망은 엔진 레벨 통합 테스트(`executeContainerBody`를 통한 간접 커버리지)뿐이며,
  향후 누군가 `LoopExecutor.execute`에 `executeBody`를 감싸는 per-iteration try/catch를
  추가하면(예: 향후 `errorPolicy` 기능 확장) `ForEachExecutor`가 겪었던 것과 동일한 흡수
  버그가 조용히 재도입될 수 있다. 코드 수정 요구는 아니다.
- 제안: 필수는 아니나, `LoopExecutor.execute`에 "`executeBody`가 `ExecutionCancelledError`를
  던지면 그대로 전파된다" 전용 단위 테스트를 추가하면 이 불변식이 회귀 시에도 잠긴다.

## 재현 테스트 실행 (본 라운드 직접 실측)

- `npx jest execution-engine.service.spec.ts workflow.handler.spec.ts foreach-executor.spec.ts
  --silent` → **Test Suites: 3 passed, 3 total / Tests: 477 passed, 477 total**.
- `npx jest containers/foreach-executor.spec.ts` → 15/15 PASS.
- 코드 읽기 중 `git status`/`git diff`에서 일시적으로 `execution-engine.service.ts:7120`
  (`assertExecutionNotCancelled` 주석 처리, `// MUTATED-OUT: ...`)과
  `workflow.handler.ts:195-197`(`// MUTATED-OUT-C1`)이 관측됐다 — 동시에 실행 중이던 별도
  jest 프로세스(`ps aux`로 확인, PID 22491, 같은 3-파일 대상)가 mutation 검증을 수행하며
  cp로 원복하는 과정의 스냅샷이었다. 재확인 시 `git status --short`는 clean(추적 대상 변경
  없음)했고, 본 리뷰의 모든 코드 인용은 이 mutation 사이클과 무관한 안정 상태에서 재확인한
  것이다. PR 코드 자체의 결함이 아니라 병행 프로세스로 인한 순간적 관측이므로 별도 발견사항으로
  세지 않는다.

## 요약

직전 라운드 CRITICAL 4건 중 C1(`executeInline` 재throw)과 C4(`finishedAt`/`durationMs` 보존)는
코드 직접 대조로 완전히 해소됐음을 확인했다(정확한 위치·정확한 guarded-UPDATE 의미론·통과하는
회귀 테스트). C3(컨테이너/Parallel 가드)는 `ForEachExecutor`(foreach/map 공용)에는 정확히
적용됐으나, **구조적으로 동일한 `ParallelExecutor`의 `errorPolicy: 'continue'`(스키마 기본
fallback 값)에는 동일한 우회 가드가 빠져 있다** — `assertExecutionNotCancelled`가 브랜치
안에서 정확히 던지는데도 `ParallelExecutor.execute()`가 `continue` 정책일 때 그 실패를 조용히
삼키고, 호출부가 반환값의 `failures`를 전혀 읽지 않아 Parallel 노드가 취소 이후에도 `done`
포트로 "성공" 처리된다. top-level 다음 노드 dispatch는 대개 다음 루프 반복의 가드로 막히지만,
Parallel 자신의 출력/NodeExecution 상태 오염과, Parallel이 그래프 최종 노드인 흔한 패턴에서는
보호가 없다 — 이번 PR이 명시적으로 고친 것과 동일한 버그 클래스의 잔존이므로 CRITICAL로 판정한다.

## 위험도

CRITICAL
