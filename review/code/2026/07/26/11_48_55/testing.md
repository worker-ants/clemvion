# 테스트(Testing) Review

대상: linear-cancel-mechanism 브랜치 — 선형 경로 외부 cancel 전파 가드(`assertExecutionNotCancelled`) 신설 + 회귀 유닛테스트 1건 + e2e 관측시점 고정.

리뷰 방법: 코드 정독뿐 아니라, 해당 유닛테스트 파일/엔진 파일을 임시로 뮤테이션(mutation)해 실제로 `npx jest` 를 반복 실행하며 커버리지 주장을 실측 검증했다(각 실행 후 원본으로 `cp` 복원, `git status`/`git diff --stat` 로 무결성 확인 완료). 모든 파일 경로는 절대경로.

## 발견사항

- **[CRITICAL]** `runNodeDispatchLoop`·`executeInline` 두 곳의 신규 cancel 가드는 회귀 테스트 커버리지가 **0** — 실측(뮤테이션) 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1638`(`runNodeDispatchLoop`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3729`(`executeInline`)
  - 상세: 신규 가드 `await this.assertExecutionNotCancelled(executionId)` 는 순회 루프 3곳(`runNodeDispatchLoop:1638`, `executeInline:3729`, `runExecution:4261`)에 각각 독립적으로 삽입됐다. 신규 회귀 테스트(`execution-engine.service.spec.ts:4942` "노드 1 실행 중 Execution 이 외부에서 cancelled 로 바뀌면...")는 `service.execute()` 를 호출하므로 오직 `runExecution` 경로만 태운다. 직접 뮤테이션으로 실측했다:
    - `execution-engine.service.ts:4261` 한 줄만 주석 처리 → `execution-engine.service.spec.ts` 407 테스트 중 1건 RED (기대 1회 vs 실제 3회 호출) — 정상.
    - `execution-engine.service.ts:1638` 한 줄만 주석 처리(runExecution 은 원복 상태) → 전체 스펙 파일 **407/407 GREEN**. 회귀 미검출.
    - `execution-engine.service.ts:3729` 한 줄만 주석 처리(다른 두 곳은 원복 상태) → 전체 스펙 파일 **407/407 GREEN**. 회귀 미검출.
  - `runNodeDispatchLoop` 는 폼/버튼/AI 재개(`applyContinuation` → `driveResumeAwaited`/`driveCallStackResume`) 및 `retry-turn.service.ts:575` 의 재시도 재진입이 공유하는 dispatch 루프다 — 즉 "재개(resume) 중 stop" 시나리오는 이번 PR 이 고치는 대상이면서도 결정적으로 고정되지 않았다. `executeInline` 은 Sub-Workflow 인라인 실행 루프다.
  - 추가로 정적 추적 + 실측 프로브(스크래치 테스트, 반영되지 않고 되돌림)로 확인한 부작용: `executeInline` 의 try 블록에는 `catch` 가 없고 `finally` 만 있어, 내부에서 던진 `ExecutionCancelledError` 는 그대로 (Sub-Workflow 를 호출한) 노드 handler 의 `execute()` 밖으로 전파된다. 그 상위의 `executeNode`(`execution-engine.service.ts:5705` catch)는 `isAbortError`·`ParkReleaseSignal` 만 특별 취급하고 **`ExecutionCancelledError` 는 특별 취급하지 않는다** — 기본(`stop`/`default`) 분기로 떨어져 **Sub-Workflow 컨테이너 노드의 `NodeExecution.status` 가 `failed` 로 마킹되고 `NODE_FAILED` 이벤트가 발사**된다(프로브로 직접 관측: nodeExecution save → `status:"failed"`, emitNodeEvent → `execution.node.failed`). 최상위 `Execution` 행 자체는 `runExecution` catch(4504)가 `instanceof ExecutionCancelledError` 를 잡아 최종적으로 `cancelled` 로 정확히 마감되지만(execution save 이력: `pending`→`cancelled`), **노드 단위 상태·이벤트는 failed 로 남아 최종 execution 상태(cancelled)와 모순**된다 — 타임라인 UI 에서 "실패" 로 잘못 표시될 소지. 이는 이번 PR 의 `executeInline` 가드 삽입이 노출/유발한 실제 동작이며, 어떤 유닛테스트도 이 경로(중첩 Sub-Workflow 안에서 cancel 발생)를 검증하지 않는다.
  - 제안: 최소한 `runNodeDispatchLoop`(예: `applyContinuation`/`retryTurnService.resumeGraphAfterRetry` 경유, 재개 도중 cancel) 와 `executeInline`(예: `service.executeInline()` 직접 호출 + 2노드 이상 서브그래프 + 루프 중 cancel) 각각에 대해 "하류 노드 미도달" 회귀 테스트를 추가한다. `executeInline` 케이스는 추가로 컨테이너 Workflow 노드의 `NodeExecution.status`/`NODE_FAILED` 오발사 여부까지 단언해, 위에서 관측한 상태 불일치를 고정하거나(의도된 동작이면 문서화) 수정한다.

- **[WARNING]** plan 문서의 "mutation 검증 완료(가드 제거 시 RED 3회)" 주장이 실측과 불일치
  - 위치: `plan/in-progress/node-cancellation-residual-signal-propagation.md:75`("mutation 검증 완료 (가드 제거 시 RED 3회 → 복원 시 GREEN 1회)")
  - 상세: 위 CRITICAL 항목에서 실측한 대로, 3곳 중 2곳(`runNodeDispatchLoop`·`executeInline`)은 가드 제거 시 스펙 파일이 전부 GREEN 으로 유지된다 — "RED 3회" 주장과 반대다. `runExecution` 1곳만 실제로 RED 를 낸다. plan 이 "3곳 모두 뮤테이션 검증됨" 이라고 기록하면 이후 세션이 이 서술을 근거로 안전하다고 오판할 수 있다(과거 유사 사례: `feedback_stale_plan_claims_and_checklist_sync`).
  - 제안: plan 문구를 실측에 맞게 정정하거나("RED 1회/3곳 중 1곳만 유닛 커버"), 위 CRITICAL 의 회귀 테스트를 추가해 실제로 3회 RED 가 되게 한 뒤 문구를 유지한다.

- **[INFO]** 신규 유닛테스트 자체는 vacuous 하지 않음 — 실측 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4942`
  - 상세: "지금까지 mock 이 ReferenceError 를 던져 엉뚱한 이유로 통과한 이력이 있다" 는 우려에 대해 직접 검증했다. (1) 원본 코드로 실행 → PASS. (2) `assertExecutionNotCancelled(executionId)` 호출 한 줄만 제거(runExecution 루프) → 동일 테스트가 `Expected: 1, Received: 3` 으로 **정확한 이유로** FAIL. (3) 원복 → 다시 PASS. mock 설정(`mockExecutionRepo.findOneBy` 를 핸들러 첫 호출 시점에 override)도 루프 순서(첫 반복에서 override 등록 → 다음 반복에서 소비)와 어긋나지 않는다. 이 테스트는 실질적인 가드다.
  - 제안: 없음(참고용 기록).

- **[INFO]** e2e 의 고정 2초 settle 은 "flaky(불안정하게 간헐 실패)" 위험은 낮으나, 회귀 미검출 가능성은 완전히 배제되지 않음
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:311`~`319` (신규 `waitUntil(nodeStatus... 'slow node A to reach a terminal status')` + `await new Promise((r) => setTimeout(r, 2_000))`)
  - 상세: 이전 버전의 결함(가드가 전혀 없어도 통과)은 `waitForTerminalStatus` 가 **Execution 행이 동기 UPDATE 되는 순간** 즉시 반환해, 노드 A 가 아직 busy-wait 중인데도 하류를 조회해버리는 관측 시점 문제였다. 수정본은 먼저 `node_execution` 테이블에서 A 가 실제 terminal(`running`/`pending` 이 아님)이 될 때까지 **폴링**(최대 60s)하므로, A 의 가변적인 busy-wait 잔여시간(최대 `INFLIGHT_WINDOW_MS`=5000ms)을 안전하게 흡수한다 — 이 부분은 고정 sleep 이 아니라 관측 기반이라 견고하다. `executions.service.ts:stop()` 을 확인한 결과 RUNNING 실행의 stop 은 `Execution` 행만 UPDATE 하고 `node_execution` 행에는 cascade 하지 않으므로(§732~792), A 의 종료 감지가 "가짜로 즉시 terminal" 로 오判되는 경로는 없다. 그 뒤에 추가된 고정 `2_000ms` 는 A 종료 후 "루프가 하류를 dispatch 할 여유" 를 주기 위한 상한이며, 하류 노드가 **존재해선 안 된다**(부재를 단언)는 방향의 테스트이므로 이 값이 짧아도 정상 코드를 오탐(false RED)시키지는 않는다 — 다만 만약 회귀로 가드가 사라진다면, DB 컨텐션 등으로 하류 INSERT 가 2초를 넘겨 이 테스트가 회귀를 놓칠 이론적 여지는 남는다(false negative 방향이지 flaky 방향은 아님). 실제 다운스트림 dispatch 는 DB 왕복 1~2회 수준(수십 ms)이라 2초는 통상 CI 부하에서도 충분한 여유로 보인다.
  - 제안: 현재로선 리스크가 낮아 필수 조치는 아니나, 상단 CRITICAL 의 유닛테스트 보강(특히 `runNodeDispatchLoop`/`executeInline`)이 결정적 방어선이므로 이 e2e 는 "관측된 계약" 백스톱 역할로 두면 충분하다.

- **[INFO]** `ExecutionCancelledError` 신규 message 파라미터(`workflow-errors.ts`)에 대한 전용 유닛테스트 없음
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts:321`(`constructor(message = 'Execution cancelled while waiting for input')`)
  - 상세: `workflow-errors.spec.ts` 에 `ExecutionCancelledError` 관련 케이스가 0건이다(grep 확인). 기존 두 호출부(`retry-turn.service.spec.ts:479`, `execution-engine.service.spec.ts` 15325/15857 인근)는 전부 기본 메시지(무인자 생성자)만 사용해 하위호환은 실질적으로 보존되지만, 신규 `assertExecutionNotCancelled` 가 넘기는 커스텀 메시지(`Execution ${executionId} cancelled externally`)가 실제로 클래스에 반영되는지, 그리고 `instanceof` 분류가 메시지와 무관하게 동작하는지를 직접 단언하는 테스트는 없다. 위험도는 낮다(생성자 로직이 단순).
  - 제안: 우선순위 낮음. 굳이 추가한다면 `new ExecutionCancelledError('foo').message === 'foo'` 수준의 1줄이면 충분.

- **[INFO]** `assertExecutionNotCancelled` 의 docstring 주장("이미 terminal 인 행을 다시 마킹하지 않으므로 stop 이 쓴 finishedAt/durationMs 가 보존된다")이 `runExecution` 경로에서는 실측상 정확하지 않음 — 테스트로 고정돼 있지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7796`(`assertExecutionNotCancelled` JSDoc) vs. 실제 소비처 `execution-engine.service.ts:4504`(`runExecution` catch 의 `ExecutionCancelledError` 분기)
  - 상세: 프로브로 확인한 결과, `runExecution` 의 catch 는 `ExecutionCancelledError` 를 잡으면 **무조건** `savedExecution.finishedAt = new Date()` / `durationMs` 재계산 후 `executionRepository.save()` 를 다시 호출한다(재저장 시 mock 상 `finishedAt`/`durationMs` 필드가 새로 생성됨을 관측). 즉 "이미 terminal 인 행을 다시 마킹하지 않는다" 는 docstring 의 문구는 이 소비처 기준으로는 성립하지 않는다(값 자체는 stop() 이 쓴 것과 근접하겠지만 "보존"이 아니라 "재계산 후 덮어쓰기"다). 신규 테스트는 이 지점을 전혀 단언하지 않는다(오직 handler 호출 횟수만 확인).
  - 제안: 테스트 관점에서는 우선순위가 높지 않지만(값의 실질적 차이는 통상 수십 ms), docstring 문구가 실제 소비 코드 경로와 어긋나므로 "보존" 주장을 제거하거나, 재저장을 스킵하는 가드(`if already CANCELLED, skip`)를 추가하고 그 스킵 동작을 테스트로 고정하는 편이 문서와 코드의 정합을 맞춘다. (correctness 이슈 성격이 강해 backend/architecture 리뷰어와 교차 확인 권장.)

## 요약

새로 추가된 단일 유닛테스트(`execution-engine.service.spec.ts` "선형 경로 외부 cancel 전파")는 실측(가드 제거→RED, 원복→GREEN)으로 확인했을 때 vacuous 하지 않고 정확한 이유로 통과/실패하는 견실한 회귀 가드다. e2e 의 2초 settle 도 관측 기반 폴링(노드 A 실제 종료 대기)을 앞세운 뒤에 붙은 여유값이라 false-RED 유발 가능성은 낮다. 그러나 이번 PR 이 동일한 가드 코드(`assertExecutionNotCancelled`)를 3개의 독립된 순회 루프에 각각 삽입했음에도 회귀 테스트는 1곳(`runExecution`)만 덮으며, 나머지 2곳(`runNodeDispatchLoop`=재개/재시도 dispatch, `executeInline`=Sub-Workflow 인라인 dispatch)은 실측 뮤테이션 결과 **전체 스펙이 무변화(GREEN)** — 즉 가드가 통째로 사라져도 현재 테스트 스위트로는 검출 불가능하다. 더 나아가 `executeInline` 쪽은 정적 추적 + 프로브로, cancel 이 Sub-Workflow 노드를 거쳐 전파될 때 컨테이너 노드가 `failed`+`NODE_FAILED` 로 잘못 마킹되는 실제 동작 불일치까지 드러났다. plan 문서의 "가드 제거 시 RED 3회" 서술도 이 실측과 어긋나 즉시 정정이 필요하다. 종합하면 테스트 품질(정확성) 자체는 양호하지만 **커버리지 범위가 변경 표면의 1/3만 방어**하고 있어 회귀 위험이 실질적으로 남아 있다.

## 위험도

HIGH
