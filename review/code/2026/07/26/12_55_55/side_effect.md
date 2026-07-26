# 부작용(Side Effect) Review — linear-cancel-mechanism (2026-07-26 12:55:55)

대상: `assertExecutionNotCancelled` §2.3 노드 경계 cancel 가드의 컨테이너/Parallel 확장(C3) +
`executeInline` 재throw(C1) + guarded-UPDATE 전환(C4) + `emitCancellationEvent` 통일(W3) +
Background 본문 graceful 종료(W2). 직전 라운드(`review/code/2026/07/26/11_48_55`) WARNING 2건
(W2·W3)의 해소 여부 검증 + 컨테이너/Parallel 확장이 새 부작용(중복 emit·이벤트 순서·상태
오분류)을 만드는지 실제 소스 직접 추적으로 판단했다.

## 발견사항

- **[INFO]** (검증 완료 — 해소됨) **W2 재확인: `executeBackgroundSubgraph` 가 `ExecutionCancelledError` 를 graceful 하게 흡수한다.**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6881`–`6891` (`else if (err instanceof ExecutionCancelledError)` 분기, `throw` 없이 `logger.debug` 만).
  - 상세: 실제 소스를 직접 Read 로 열어 확인했다. `ParkReleaseSignal` 분기와 대칭으로 재throw 하지 않으므로 `executeBackgroundSubgraph` 프라미스가 정상 resolve 되고, 호출자 `BackgroundExecutionProcessor.process()`(`codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:61-70`)는 `catch` 블록(72-84행: `notifyOnFailure` admin 알림 + `throw err` → BullMQ 재시도)에 도달하지 않는다. 허위 `background_failed` 알림·BullMQ 재시도 모두 사라짐 — SUMMARY W2 가 지목한 부작용이 실제로 해소됐다.
  - 참고(부작용 아님, 사전 확립된 선례): graceful 흡수의 결과로 `process()` 는 `safeEmitRunCompleted(data, 'completed', ...)` 를 호출한다(`background-execution.processor.ts:70`) — `background:run:<id>` 채널의 `execution.background_run.completed` 이벤트가 `status:'completed'` 로 나간다(취소인데 "완료"로 보임). 다만 이는 **바로 위 `ParkReleaseSignal` 분기가 이미 취하고 있던 동일한 패턴**(park 도 swallow 후 동일하게 `'completed'` 로 emit)이라 이번 PR 이 새로 만든 비일관은 아니다. `BackgroundRunEventType` 의 status 유니온이 `'completed'|'failed'` 뿐이라 별도 `'cancelled'` 값이 없는 기존 스키마 제약.

- **[INFO]** (검증 완료 — 해소됨) **W3 재확인: 두 catch 가 `emitCancellationEvent` 로 통일돼 `cancelledBy` 계약을 지킨다.**
  - 위치: `execution-engine.service.ts:2630`-`2637`(`finalizeResumedExecutionOutcome`) · `:4530`-`4537`(`runExecution`) — 둘 다 `updateExecutionStatus(...)` 후 `emitCancellationEvent(executionId, { cancelledBy: 'user', logContext: '...' })` 호출.
  - 상세: `emitCancellationEvent` 헬퍼(`:964`-`989`)를 직접 열어 확인 — `cancelledBy: 'user'|'system'|'timeout'` 닫힌 3값 union 을 payload `result.cancelledBy` 로 실어 보내고, 기존 4개 취소 경로(`cancelParkedExecution` 등)와 동일한 형태다. `spec/5-system/6-websocket-protocol.md:179` 계약(=W3 지적)이 이제 두 catch 에서도 채워진다 — 해소 확인.

- **[WARNING]** **컨테이너(ForEach/Loop/Map) 취소가 기존 `runContainer` catch-all 에 흡수되어 노드 레벨 상태가 오분류된다 — 신규 노출된 부작용.**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7530`-`7568` (`runContainer` 의 `catch (err)` 블록, 특히 `:7541`-`7543` `nodeExec.status = NodeExecutionStatus.FAILED` 와 `:7551`-`7566` `NODE_FAILED` emit). 트리거 지점은 `:6480`(`executeContainerBody` 상단의 신규 `assertExecutionNotCancelled` 호출, diff 상 신규 코드).
  - 상세: `executeContainerBody` 안에 새로 추가된 §2.3 가드(`:6480`)가 아이템 경계에서 `ExecutionCancelledError` 를 throw 하면, 이 예외는 `foreachExecutor.execute`/`loopExecutor.execute` 를 거쳐(둘 다 이 에러를 특별 취급 없이 그대로 전파 — `foreach-executor.ts` 는 C3 로 명시 재throw, `loop-executor.ts` 는 애초에 per-iteration try/catch 가 없어 무수정 전파) `runContainerInner` → `runContainer` 의 catch 로 도달한다. 이 catch 는 **이번 PR 이 손대지 않은 기존 코드**로, 컨테이너 자신의 `NodeExecution` row(= `executeNode` 가 핸들러 초기 반환 성공 시 이미 COMPLETED 로 마킹해 둔 것 — catch 상단 주석이 명시)를 **무조건 `FAILED`** 로 덮어쓰고, `error: message`(= `ExecutionCancelledError.message`, 예: `"Execution exec-1 cancelled externally"`)를 실어 `NodeEventType.NODE_FAILED` 를 emit 한 뒤 `throw err;` 로 재전파한다. 재전파된 에러는 결국 최상위 `runExecution`/`finalizeResumedExecutionOutcome` catch 에 도달해 Execution 전체는 올바르게 `cancelled` 로 종결되지만(§2.3 계약 자체는 지켜짐), **그 사이 컨테이너 노드 자신은 DB 에 `FAILED` 로 영속되고 클라이언트는 `NODE_FAILED`(에러 메시지 "cancelled externally") 를 먼저, `EXECUTION_CANCELLED` 를 그 다음에 받는다** — 실행은 "취소됨"인데 그 안의 ForEach/Loop/Map 노드는 "실패"로 표시되는 감사 로그·UI 불일치다. 이 catch 는 Parallel 경로(`runParallel`, `:7302`)에는 대응하는 wrapper 가 없어(직접 호출, try/catch 미포장) 이 문제가 발생하지 않는다 — **컨테이너 계열(ForEach/Loop/Map)에만 국한**.
  - 왜 "새 부작용"인가: 이 PR 이전에는 `executeContainerBody` 가 `ExecutionCancelledError` 를 던질 방법이 없었으므로(§2.3 가드가 컨테이너 범위 밖이었음) 이 catch 에는 항상 "진짜" 핸들러/검증 오류만 도달했고, `FAILED` 로 마킹하는 것이 정확했다. 이번 PR 이 §2.3 을 컨테이너로 확장하면서 **취소도 이 catch 로 흘러들어가게 만들었는데, catch 자체는 `instanceof ExecutionCancelledError` 로 분기하도록 갱신되지 않았다** — `WorkflowHandler`(C1)·`ForEachExecutor`(C3 foreach-executor.ts)에는 정확히 이 패턴(재throw 전에 흡수 여부 분기)의 수정이 들어갔는데, 같은 라운드에서 `runContainer` 만 빠졌다.
  - 회귀 테스트 커버리지 확인: `execution-engine.service.spec.ts:9950`-`10032` 의 신규 C3 회귀 테스트("노드 경계가 아니라 아이템 경계에서 외부 cancel...")를 직접 읽었다 — `bodyCalls === 1` 과 `execution.cancelled` WS emit 만 단언하고, 컨테이너 자신의 `NodeExecution.status` 나 `NODE_FAILED` emit 여부(부재 확인)는 검증하지 않는다. 즉 이 오분류는 **이번 세션이 추가한 회귀 테스트로도 검출되지 않는 사각지대**다.
  - 제안: `runContainer` 의 catch 상단에 `if (err instanceof ExecutionCancelledError) { throw err; }` (또는 `nodeExec.status = NodeExecutionStatus.CANCELLED` 로 마킹하고 `NODE_FAILED` 대신 emit 을 생략/별도 처리) 를 추가해 `WorkflowHandler`/`ForEachExecutor` 와 동일한 패턴으로 취소를 일반 실패와 분리할 것. 회귀 테스트에 "취소 시 컨테이너 노드 자신의 `NodeExecution.status` 가 `FAILED` 로 남지 않는다 + `NODE_FAILED` 가 emit 되지 않는다" 단언을 추가.

- **[INFO]** **`updateExecutionStatus` 의 `true/false` 반환 계약을 두 catch 가 의도적으로 무시한다 — 근거는 검증되나 향후 복제 시 실효성 소실 위험.**
  - 위치: `execution-engine.service.ts:2630`, `:4530` (반환값을 캡처하지 않고 바로 다음 줄에서 `emitCancellationEvent` 무조건 호출) vs `updateExecutionStatus` 자신의 JSDoc(`:7952`-`7956`): "`false` 는 else 분기에서만 발생... 호출부는 이때 terminal emit 을 skip 해 이벤트 이중 발행/terminal status 전복을 막아야 한다 (M-3)". 같은 파일의 다른 호출부(`:2259`, `:3348`, `:4487` 등)는 실제로 `const completed = await updateExecutionStatus(...); if (completed) { emit }` 패턴을 지킨다.
  - 상세: 두 catch 옆 주석(`:4520`-`4523`)이 "`stop()` 이 RUNNING/PENDING 경로에서는 이벤트를 쏘지 않으므로 여기가 유일한 알림 지점 — no-op 여부와 무관하게 항상 발행한다" 고 명시적으로 근거를 댄다. `codebase/backend/src/modules/executions/executions.service.ts:780`-`792`(`stop()` 의 RUNNING/PENDING guarded UPDATE)를 직접 확인했다 — 이 경로는 실제로 emit 을 하지 않는다(WAITING_FOR_INPUT 경로만 `cancelParkedExecution` 이 emit). 즉 **오늘 시점 근거는 사실**이고 버그가 아니다. 다만 이 파일은 이미 W8(노드 경계 가드 3중 복제로 1곳 누락 사고)로 "복제 시 지역적 예외가 소실된다"는 교훈이 기록돼 있다 — 이 두 catch 를 향후 유사 위치로 복제할 때 "always emit" 근거(즉 "이 경로만 유일한 알림 지점"이라는 전제)가 함께 복제되지 않으면 진짜 중복 emit 이 생길 수 있다. 코드에 남기려면 근거 주석 옆에 `completed` 값을 캡처해 최소 로그(`if (!completed) this.logger.debug('이미 terminal — stop() 이 emit 안 하는 경로라 그래도 emit')`) 형태로 명시하는 편이 향후 유지보수자에게 더 안전.
  - 제안: 필수 수정은 아님(현재 동작은 정확). 주석·로그로 "M-3 예외" 임을 코드 레벨에서 한 번 더 명시할 것을 권장.

- **[INFO]** **Parallel `errorPolicy:'stop'` 의 `failures[0]` 우선순위 선택이 `ExecutionCancelledError` 를 특별 취급하지 않는다 — 좁은 레이스.**
  - 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:277`-`279` (`if (errorPolicy === 'stop' && failures.length > 0) { throw failures[0].error; }`).
  - 상세: `executeParallelBranchBody`(`execution-engine.service.ts:7120`)의 신규 §2.3 가드가 브랜치 안에서 `ExecutionCancelledError` 를 던지면, `ParallelExecutor.execute` 는 이를 다른 브랜치의 genuine 실패와 동일하게 `failures[]` 배열에 담고 **branch index 순으로 첫 번째** 실패를 던진다. 이 PR 이전엔 브랜치가 취소를 던질 방법이 없어 `failures[0]` 이 항상 "진짜" 오류였는데, 이제는 "Stop 버튼을 누른 순간과 다른 브랜치의 진짜 버그가 같은 노드 경계 체크 윈도우에서 동시에 실패"하는 좁은 레이스에서 어느 쪽이 index 0 이냐에 따라 Execution 이 `cancelled` 대신 `failed`(또는 그 반대로 진짜 버그가 취소 뒤에 가려짐)로 오분류될 수 있다. `errorPolicy:'cancel-others-on-fail'` 은 이미 `.find(f => f.error.name !== 'AbortError')` 로 root-cause 를 우선하므로 이 문제가 없다(`ExecutionCancelledError.name` 은 `'AbortError'` 가 아니므로 정상적으로 root-cause 후보가 됨, 직접 확인).
  - 제안: 발생 확률이 낮고(동일 노드 경계 tick 에서 서로 다른 브랜치가 동시에 별개 사유로 실패해야 함) 이번 PR 의 핵심 계약(§2.3 은 "노드 경계마다 관측", not "즉시 preempt")과 직접 충돌하지 않으므로 즉시 수정 필수는 아니다. 다만 `'stop'` 정책도 `cancel-others-on-fail` 과 동일하게 `ExecutionCancelledError` 를 우선 채택하도록 `failures.find(f => f.error instanceof ExecutionCancelledError) ?? failures[0]` 형태로 바꾸는 것을 후속 검토로 남길 만하다.

- **[INFO]** **`ExecutionCancelledError` 생성자 시그니처가 무인자 → 옵션 `message` 로 확장됐다 — 하위 호환 유지, 저장소 전체 2개 호출부 확인.**
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts:327`(`constructor(message = 'Execution cancelled while waiting for input')`).
  - 상세: 기존 `new ExecutionCancelledError()` 호출은 동일 기본 메시지를 그대로 받으므로 하위 호환이 유지된다. `assertExecutionNotCancelled`(신규, `:7858`)만 커스텀 메시지를 넘기는 유일한 새 호출부다. `instanceof` 기반 분류만 쓰이므로 메시지 문자열 변화가 판정 로직에 영향을 주지 않음을 확인했다.

## 요약

W2(Background 본문 graceful 종료)와 W3(`emitCancellationEvent` 통일)는 실제 소스를 직접 열어
검증한 결과 **모두 해소됐다** — 허위 `background_failed` 알림·BullMQ 재시도가 사라졌고, 두 catch
모두 `cancelledBy` 계약을 채운다. 컨테이너/Parallel 로 확장된 §2.3 가드 자체는 Execution 레벨
종결(전체 `cancelled` 확정)에 있어서는 정확하게 동작한다. 다만 확장 과정에서 **컨테이너
(ForEach/Loop/Map) 전용의 기존 `runContainer` catch-all 이 새로 흘러들어오는
`ExecutionCancelledError` 를 일반 실패와 구분하지 못해**, 컨테이너 자신의 `NodeExecution` 이
`FAILED` 로 오분류되고 `NODE_FAILED` 이벤트가 스퓨리어스하게 emit 되는 신규 노출 부작용을
발견했다(이번 세션의 신규 회귀 테스트로도 검출되지 않는 사각지대). `WorkflowHandler`(C1)와
`ForEachExecutor`(C3 foreach-executor.ts)에는 동일 패턴의 수정이 정확히 들어갔는데
`runContainer` 만 빠졌다는 점에서, "같은 클래스의 결함을 여러 지점에 반복 적용해야 하는" 이
PR 의 구조적 위험(W8 이 이미 지적한 3중 복제 패턴)이 재현된 사례로 보인다. 그 외 Parallel 의
`errorPolicy:'stop'` 브랜치 실패 우선순위 레이스와 `updateExecutionStatus` 반환값 무시는 현재
근거상 정확하지만 향후 복제 시 취약한 지점으로 INFO 기록해 둔다.

## 위험도

MEDIUM
