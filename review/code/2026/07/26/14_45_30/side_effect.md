# 부작용(Side Effect) Review — linear-cancel-mechanism (4R)

## 방법론 메모

이번 라운드에 오케스트레이터가 넘긴 diff 페이로드(`_prompts/side_effect.md`)는 실제로
`review/code/2026/07/26/13_47_42/*.md`·`_routing_decision.json`(3R 리뷰 산출물이 커밋된
것) 11개뿐이며, 실제 코드 변경(커밋 `2ca6ada66` — SUMMARY W14-W18)은 diff 목록에 없다
(리뷰 changeset 이 직전 검토 코드를 제외하는 기존 패턴과 동일). 오케스트레이터가 지정한
집중 검증 대상(W14/W15/W16)이 정확히 이 커밋에 있으므로, `git show 2ca6ada66` + 현재
HEAD(`06eba6334`)의 실제 소스를 `Read`/`Grep` 으로 직접 열어 대조했다. 아래 위치 표기는
**현재 파일의 실제 줄 번호**(게이트 규약과 무관 — 이 리뷰 대상 파일들엔 게이트가 없음)다.

## W14 재검증 결과 — 해소 확인

직전 라운드(내가 3R 에서 지적) `containerCancelCheckedAtMs` Map 이 `executeBackgroundSubgraph`
경로에서 정리되지 않아 누수되던 문제는 해소됐다.

`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의
`executeBackgroundSubgraph` `finally` 블록(6941-6952행)에 다음이 추가됨:

```ts
this.contextService.deleteContext(bgKey);
// ai-review W14 (2026-07-26) — ...
this.containerCancelCheckedAtMs.delete(job.executionId);
```

성공/park/cancel/그 외 예외 어느 분기를 거치든 `finally` 는 항상 실행되므로 background
본문이 어떤 경로로 종료되든 키가 정리된다. `Map.delete` 는 존재하지 않는 키에 대해 no-op
이라 멱등이고, 3R 리뷰(concurrency.md)가 제안했던 대칭(부모가 먼저 지운 뒤 background 가
나중에 지워도 correctness 영향 없음, 스로틀 캐시 미스 1회 정도)과 정확히 일치하는
구현이다. 회귀 테스트(`execution-engine.service.spec.ts:3739` 부근, W14/W18 코멘트)도
`containerCancelCheckedAtMs.set(executionId, ...)` 를 먼저 시뮬레이션한 뒤
`executeBackgroundSubgraph` 호출 후 `has(executionId)` 가 `false` 임을 직접 단언한다.
**더 이상 다루지 않는다.**

## W16 재검증 결과 — 해소 확인, REST 소비자 영향 없음

`RetryTurnService.failRetryExecution`(`retry-turn.service.ts:636-669`)의
`execution.error` DB 저장이 `!isCancelled` 로 가드됐다(647-654행):

```ts
if (!isCancelled) {
  execution.error = { message: errMessage };
}
```

**(b) REST 응답 소비자 영향 확인**: `execution` 은 이 함수 진입 전 `applyRetryLastTurn`
(280행 부근)에서 `this.executionRepository.findOneBy({ id: executionId })` 로 갓 조회한
row 다. 이 지점은 Execution 이 처음으로 terminal(FAILED/CANCELLED) 로 전이되는 유일한
지점이라(주석 "Execution 을 FAILED 또는 CANCELLED 로 마감") `execution.error` 가 이전에
이미 채워져 있었을 가능성은 없다 — 즉 "가드 이전 값이 stale 하게 남는" 시나리오는 아니다.
또한 `!isCancelled` 로 아예 대입을 스킵해도 `execution.error` 는 undefined 인 채 저장되고,
`executions.service.ts:840` 의 `toExecutionDto` 가 `error: execution.error ?? null` 로
null-coalesce 하므로 REST 응답 shape 은 항상 `{ message?: string } | null` 로 동일하다
(frontend `codebase/frontend/src/lib/api/executions.ts:28,55` 도 이미 이 타입으로
선언돼 있음 — nullable 은 기존부터 있던 계약). 이는 기존에 이미 존재하던
`finalizeCancelledExecution`(runExecution/재개 경로, execution-engine.service.ts:4568-4581)
이 취소 시 `error` 필드를 아예 설정하지 않는 패턴과 동일한 shape 이므로, frontend 는 이미
"취소된 Execution 의 error 가 null" 인 경우를 처리하고 있어야 한다(그렇지 않았다면 이번
수정 이전에도 이미 깨져 있었을 것). WS emit 쪽은 이번 수정 전부터 `!isCancelled` 로
이미 안전했다(`retry-turn.service.ts:659-668`). **새로운 side effect 없음.**

## 신규 발견 — W15 재throw 가 남기는 "터미널 이벤트 부재" (WARNING)

- **[WARNING]** `executeNode` 의 W15 재throw(`ExecutionCancelledError`)가 `runContainer`
  (W9)의 선례를 그대로 복제했지만, 두 경로의 전제가 달라 Sub-Workflow 노드 자신의
  `NodeExecution` row 가 **영구히 RUNNING 상태로 남고 어떤 terminal 이벤트도 발행되지
  않는다** — 같은 함수 안 `isAbortError` 분기가 지키는 "타임라인이 running 에 영구
  잔류하지 않도록 terminal 이벤트를 반드시 발행한다"는 문서화된 불변식을 어긴다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    — `executeNode` catch 블록. 대조 대상 3개 분기가 같은 catch 안에 나란히 있다:
    - `isAbortError(err)` 분기(5765-5793행) — `nodeExecution.status = CANCELLED`,
      `finishedAt` 설정, `save()`, `NODE_CANCELLED` emit **을 모두 수행한 뒤** re-throw.
      바로 위 주석(5763-5764행): "타임라인이 running 에 영구 잔류하지 않도록 terminal
      이벤트를 반드시 발행한다."
    - `ParkReleaseSignal` 분기(5801-5803행) — 아무것도 안 하고 즉시 re-throw. 단, 이건
      의도적이다(주석: "이 invoker Workflow 노드의 NodeExecution 은 RUNNING 으로
      잔류하고... 재개 시 `driveCallStackResume` 가 executeNode 우회로 frame 을
      재진입한다" — 즉 나중에 재개되어 다른 경로가 마무리한다는 전제).
    - **신규 `ExecutionCancelledError` 분기(5805-5814행)** — `ParkReleaseSignal` 과
      **동일하게** 아무 저장·emit 없이 즉시 re-throw. 그러나 취소는 park 과 달리
      **재개되지 않는다** — Execution 은 이 예외가 `runExecution`/`runNodeDispatchLoop`
      까지 전파되면 `finalizeCancelledExecution`(4568-4581행)로 **CANCELLED 종결**되고,
      이 헬퍼는 top-level `Execution` row 만 갱신할 뿐 자식 `NodeExecution` row 를
      건드리지 않는다(직접 확인). `cancelParkedExecution`(935-977행)이 bulk 로
      `NodeExecutionStatus.WAITING_FOR_INPUT` → `CANCELLED` 전이시키는 것과 같은
      사후 정리가 `RUNNING` row 에는 없다(`failOrphanRunningNodeExecutions`(3112-3130행)·
      `finalizeStalledExhausted`(3151-3199행)는 **크래시/스톨 재배달** 전용 cascade 이지
      cooperative-cancel 전용 cascade 가 아니다). 즉 이 Sub-Workflow 노드의 row 는
      어떤 경로로도 다시 방문되지 않는다.
  - 재현 경로: 이 분기는 Sub-Workflow(`type: 'workflow'`) 노드가 자기 자신의
    `executeInline`(재귀) 안에서 §2.3 가드로 취소를 관측 →
    `workflow.handler.ts:195-197` 의 C1 재throw → 그 호출은 `executeWithRetry` 를 거쳐
    `executeNode` 자신의 try 블록 **안**에서 발생한 예외로 취급된다(로컬 catch 없음) —
    이 재귀 구조는 Sub-Workflow 노드에만 있다(security.md 3R 분석과 합치, 직접 코드
    확인 완료). 컨테이너(`runContainer`, W9)는 전제가 다르다 — 주석(7595-7599행)이
    명시하듯 "Container-level failure happens AFTER executeNode has already marked
    the container as COMPLETED" — 컨테이너 자신의 `NodeExecution` 은 **이미 COMPLETED**
    상태이므로 W9 의 재throw 는 이미-terminal 인 그 값을 그대로 둘 뿐이다. Sub-Workflow
    는 이 전제가 없다 — `createNodeExecution`(8188-8203행)이 디스패치 시작 시 `RUNNING`
    으로 **딱 한 번** save 하고, W15 분기는 그 이후 어떤 save/emit 도 하지 않는다.
  - 테스트 증거(트리비얼 통과 확인): `execution-engine.service.spec.ts:5745`
    ("Sub-Workflow(workflow) 노드에서 ExecutionCancelledError 가 발생하면 FAILED 로
    오분류하거나 NODE_FAILED 를 emit 하지 않는다 (W15)")의 유일한 status 단언
    (5773-5774행)은 `expect(ne?.status).not.toBe(NodeExecutionStatus.FAILED)` 뿐이다.
    `lastNodeExecSave`(5457-5461행)는 `mockNodeExecutionRepo.save.mock.calls` 중
    해당 nodeId 의 **마지막** 호출을 반환하는데, W15 분기가 재throw 전에 `save()` 를
    전혀 호출하지 않으므로 반환되는 것은 `createNodeExecution` 이 디스패치 시작 시
    저장한 **`RUNNING` 상태 그 자체**다 — `not.toBe(FAILED)` 는 실제 종결 여부와
    무관하게 항상 참이 되는 vacuous 단언이라, `NODE_CANCELLED`/`finishedAt` 이
    설정됐는지는 이 테스트가 전혀 검증하지 못한다.
  - 영향: 데이터 손상·보안 노출·워크플로 hang(전체 Execution 은 정확히 CANCELLED 로
    마감되고 `shutdownState.unregisterInFlight`(5920행)도 `finally` 로 항상 실행돼
    in-flight 추적 자체는 새지 않음)은 없다. 다만 (1) 이 특정 `NodeExecution` row 는
    DB 에 `status='running'`, `finishedAt=null` 로 영구 고정되고, (2) frontend
    `apply-execution-snapshot.ts` 는 execution-level `cancelled` 를 `failExecution()`
    으로 처리하지만 이는 `__execution__` sentinel 만 세팅할 뿐(execution-store.ts:736-754)
    개별 `nodeStatuses` 항목은 건드리지 않는다 — 같은 파일 65-105행의 per-node 루프가
    snapshot 의 `ne.status`(=`"running"`)를 그대로 반영하므로, 실행 상세 타임라인에서
    이 Sub-Workflow 노드 카드가 **영구히 "Running"(spinner)으로 표시**된다. 즉 이번
    수정은 W15 가 고치려던 결함(오분류 FAILED + 내부 message 노출)을 없애는 대신, 같은
    함수가 방금 전 분기(`isAbortError`)에서 스스로 명시한 "terminal 이벤트 필수" 불변식을
    어기는 새로운(더 미묘한) 결함으로 대체했다.
  - 제안: `isAbortError` 분기와 대칭으로, W15 재throw 전에
    `nodeExecution.status = NodeExecutionStatus.CANCELLED; nodeExecution.finishedAt = ...;
    await this.nodeExecutionRepository.save(nodeExecution);` + `NODE_CANCELLED` emit 을
    추가한다(내부 executionId 포함 message 는 `errorEnvelope` 에 담지 않도록 W9/보안
    분석과 동일하게 sanitize). 회귀 테스트를 "저장된 마지막 row 의 status 가
    `CANCELLED` 이고 `finishedAt` 이 설정되며 `NODE_CANCELLED` 가 emit 된다"로
    직접 단언하도록 강화(현재의 `not.toBe(FAILED)` 는 vacuous).

## 요약

W14(Background `containerCancelCheckedAtMs` Map 누수)는 `executeBackgroundSubgraph`
의 `finally` 에 `delete(job.executionId)` 가 추가되고 전용 회귀 테스트로 고정되어 완전히
해소됐다. W16(`RetryTurnService.failRetryExecution` 의 취소 시 `execution.error` 무조건
저장)도 `!isCancelled` 가드로 해소됐고, DB 저장을 스킵해도 REST 응답 DTO 가 이미
`error ?? null` 로 null-coalesce 하며 그 필드가 이미 처음부터 nullable 계약이었기 때문에
REST 소비자에 새로운 영향은 없다. 다만 W15(`executeNode` generic catch 의 `ExecutionCancelledError`
우회 재throw)는 `runContainer`(W9)의 재throw 패턴을 그대로 복제했으나, 전제(컨테이너는
재throw 시점에 이미 COMPLETED, Sub-Workflow 는 여전히 RUNNING)가 달라 Sub-Workflow
노드 자신의 `NodeExecution` row 가 영구 RUNNING 으로 남고 어떤 terminal 이벤트도 발행되지
않는 결함을 새로 만들었다 — 같은 함수의 `isAbortError` 분기가 명시한 "terminal 이벤트
필수" 불변식 위반이며, 신규 회귀 테스트의 단언이 vacuous 해 이 갭이 커버리지에 잡히지
않았다. Execution 전체의 최종 상태(CANCELLED)나 in-flight 추적(`shutdownState`)에는
영향이 없어 심각도는 CRITICAL 이 아니지만, DB/타임라인 감사기록의 정확성을 해치는 실질
결함이라 WARNING 으로 분류한다.

## 위험도

MEDIUM
