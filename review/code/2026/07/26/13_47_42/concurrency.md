# 동시성(Concurrency) 리뷰

집중 검증 대상: 이번 라운드가 새로 도입한 `containerCancelCheckedAtMs` Map 기반 시간 스로틀
(`CONTAINER_CANCEL_CHECK_THROTTLE_MS = 250`)과 `ParallelExecutor`의 취소 우회 재throw.
(이전 라운드에서 이미 검증된 §2.3 가드 확장·`executeInline` 재throw·`ForEachExecutor`/
`ParallelExecutor` errorPolicy 우회 로직 자체는 재론하지 않음.)

## 발견사항

- **[WARNING]** `containerCancelCheckedAtMs` Map 엔트리가 **background subgraph 경로에서 정리되지 않아 누수된다**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6848`(`executeBackgroundSubgraph`), 특히 `:6930`-`:6934`(해당 함수의 `finally` 블록)
  - 상세:
    - Map 정리는 현재 두 지점뿐이다 — `finalizeRehydrationCleanup`(`:2667`-`:2671`, 실제 delete 는 `:2670`)과 `runExecution`의 `finally`(`:4537`-`:4545`, 실제 delete 는 `:4544`). 이 두 지점을 호출하는 모든 세그먼트-드라이브 함수(`runExecution`·`driveResumeAwaited`(`:2311`-`:2313`)·`driveCallStackResume`(`:2474`-`:2476`)·`driveStuckRedrive`(`:3379`-`:3381`)·park 계열 cancel 함수들)는 자기 세그먼트 종료 시 정확히 이 Map 을 정리한다 — (a)의 park/resume, 크래시 re-drive 경로는 누수가 없음을 확인했다.
    - 그러나 `executeBackgroundSubgraph`(BullMQ `BackgroundExecutionProcessor`가 호출, fire-and-forget)는 부모와 **동일한 `executionId`**를 공유하면서(주석 `:6849`-`:6853`, spec `spec/4-nodes/1-logic/12-background.md:94` 명시) `executeInline`을 호출하고, 그 안에서 컨테이너 노드(ForEach/Loop/Map)가 있으면 `runContainer` → `executeContainerBody`(`:6515`에서 `{ throttle: true }`로 `assertExecutionNotCancelled` 호출)를 거쳐 **동일 Map 키(`executionId`)에 `set()`한다**. 그런데 `executeBackgroundSubgraph`의 `finally`(`:6930`-`:6934`)는 `bgKey` 전용 `contextService.deleteContext(bgKey)`만 정리하고, `containerCancelCheckedAtMs.delete(executionId)`는 어디에도 없다. `BackgroundExecutionProcessor.process()`(`codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:50`-`:85`)도 성공/실패/재시도 어느 분기에서도 이 Map 을 건드리지 않는다.
    - 부모 세그먼트(`runExecution` 등)는 Background 노드에서 `scheduleBackgroundBody`로 큐 등록만 하고 **await 하지 않은 채 계속 진행**하므로, 부모 세그먼트의 `finally`가 먼저 `containerCancelCheckedAtMs.delete(executionId)`를 실행한 **이후에** background job 이 컨테이너 아이템 경계에서 그 키를 다시 `set()`할 수 있다 — 이후 아무도 그 키를 지우지 않는다.
    - spec 자체가 이 조합을 실사용 시나리오로 명시한다: `spec/4-nodes/1-logic/12-background.md:326` — "본문이 Loop / ForEach 를 포함하면 수백 NodeExecution 으로 확장 가능". 즉 W10 스로틀이 최적화하려던 바로 그 대상(대량 아이템 컨테이너)이 background 본문에서도 성립하는데, 그 경로만 cleanup 대상에서 빠졌다.
    - 영향은 execution 1건당 엔트리 1개(작은 string+number)이므로 즉각적 위험은 낮지만, 프로세스 재시작 전까지 executionId 재사용이 없어 **무제한 누적**되고(장기 가동 서버에서 background+container 조합이 반복되면 계속 증가), `:536`-`:538` JSDoc 이 명시한 "execution 종료 지점에서 반드시 delete 한다"는 불변식이 이 경로에서 성립하지 않는다.
    - 테스트 커버리지: `grep -rn "containerCancelCheckedAtMs" **/*.spec.ts` 0건. W10 스로틀 자체의 동작(`execution-engine.service.spec.ts`, 커밋 `10b27c320`)은 테스트됐지만, 정리(cleanup) 불변식을 background 경로에서 검증하는 테스트는 없다.
  - 제안: `executeBackgroundSubgraph`의 `finally`(`:6930`-`:6934`)에 `this.containerCancelCheckedAtMs.delete(job.executionId)`를 추가한다. 단, **부모 세그먼트와 executionId 를 공유**하므로 부모 세그먼트가 아직 실행 중일 때 background job 이 먼저 끝나며 delete 하면, 부모의 다음 컨테이너 아이템 체크가 스로틀 캐시 미스로 1회 더 DB 조회하는 정도의 부작용만 있고 correctness 문제는 없다(스로틀은 순수 최적화이므로 안전). 반대로 부모가 먼저 끝나 delete 한 뒤 background 가 나중에 `set()`하는 현재 시퀀스와 대칭이 맞다. `finalizeRehydrationCleanup`을 재사용하면(해당 함수가 `contextService.deleteContext(executionId)`도 호출하는데 이는 background 전용 `bgKey`와 다른 키라 안전) 한 곳에서 일관되게 관리할 수 있다.

- **[INFO]** 스로틀은 "시간 기반"이라 아이템이 매우 빠르게(I/O 없이) 처리되는 컨테이너에서는 취소 관측까지 **아이템 개수 기준으로는 무제한**일 수 있다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6504`-`:6515`(`executeContainerBody` 호출부 주석·호출), `:7895`-`:7902`(JSDoc 트레이드오프 서술)
  - 상세: JSDoc(`:543`-`:548`, `:7895`-`:7902`)은 지연을 "최대 250ms"로 프레이밍하고 §5 best-effort 계약(§2.3 "다음 노드 경계에서 판정", `spec/conventions/node-cancellation.md:59`)에 기대 수용 가능하다고 정리하는데, 이는 (c) 질문에 대해 타당한 논거다 — 이미 §2.3 자체가 in-flight abort 를 Planned 로 남겨두고 노드 경계 판정을 공식 계약으로 삼고 있어, 그 경계 판정 빈도를 아이템마다에서 250ms마다로 낮추는 것은 같은 계약 등급 안의 트레이드오프다. 다만 "250ms"는 시간 상한이지 **아이템 개수 상한이 아니다** — 순수 계산/조건 분기처럼 각 아이템이 수 ms 이내로 끝나는 컨테이너(외부 I/O 노드가 없는 본문)라면, 취소 후에도 250ms 동안 수십~수백 개 아이템이 계속 dispatch 될 수 있다. 원래 이 PR 이 고치려던 결함("취소 후에도 하류가 무제한 계속 dispatch")과 같은 모양의 문제가 시간으로 유계화된 축소판으로 재도입되는 셈이다. 다만 각 아이템 실행 자체가 NodeExecution INSERT + Execution 이벤트 emit 을 수반해 실무적으로 ms 단위가 아니라는 JSDoc 의 전제(`:7885`-`:7887`)가 대체로 유효하므로 심각도는 낮다.
  - 제안: 필수 수정은 아니나, 시간 스로틀과 별개로 "N 아이템마다 최소 1회는 강제 조회"하는 카운트 기반 하이브리드 캡을 추가하면 최악의 경우(초저지연 아이템)에도 부수효과 개수 상한을 명시적으로 보장할 수 있다. 현재도 무해하다고 판단되면 이 트레이드오프를 SoT 문서(`plan/in-progress/node-cancellation-residual-signal-propagation.md`)에 "시간 상한이지 카운트 상한 아님"으로 명시해 두는 것을 권장.

- **[INFO]** 동일 executionId 를 공유하는 동시 컨텍스트(Parallel 브랜치·중첩 컨테이너·background 본문)가 `containerCancelCheckedAtMs`를 공유하는 것은 의도된 설계이며 경쟁 조건은 없다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7904`-`:7932`(`assertExecutionNotCancelled`)
  - 상세: (b) 질문에 대한 답. Node.js 는 단일 스레드이고 `Map.get`/`Map.set`은 각각 원자적 동기 연산이며, 두 연산 사이에 `await`(DB 조회, `:7918`)가 끼어 있다. 따라서 두 concurrent 호출(예: Parallel 의 두 브랜치, 또는 Parallel 브랜치와 background 본문)이 거의 동시에 진입하면 **둘 다 `lastCheckedAt` 미갱신 상태를 관측해 중복으로 실제 DB 조회를 수행**할 수 있다(스로틀 윈도 시작 시점의 "thundering herd") — 그러나 이는 데이터 손상이나 lost-update 가 아니라 단순히 최적화가 완전히 적용되지 못하는 드문 경우일 뿐이고, 최종적으로 `set()`은 마지막에 완료된 호출의 `Date.now()`로 수렴한다. 키가 `executionId`(컨테이너/브랜치별이 아님) 하나뿐이라 서로 다른 컨테이너·브랜치·background 본문이 스로틀 상태를 공유하는 것도 의도된 설계다 — 모두 같은 Execution row 의 취소 여부를 확인하는 것이므로 공유가 정확성을 해치지 않고 오히려 전체 DB 조회 횟수를 더 줄인다.

- **[INFO]** `ParallelExecutor`의 취소 우회 재throw 는 `Promise.allSettled` 완료 이후에만 실행되어 경쟁이 없다
  - 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:212`-`:284`
  - 상세: (d) 질문에 대한 답. `await Promise.allSettled(...)`(`:212`-`:259`)이 완료된 뒤에야 `failures` 배열 구성(`:261`-`:271`)과 `cancellation` 탐색·재throw(`:273`-`:284`)가 동기적으로(중간에 `await` 없이) 실행되므로, 새로 추가된 재throw 로직 자체가 브랜치 처리와 경합할 여지는 없다. 다만 기존부터 있던 특성으로, `pLimit(effectiveConcurrency)`가 `branchCount`보다 작으면 한 브랜치가 취소를 관측해 조기 실패해도 **아직 큐잉된 나머지 브랜치들은 취소와 무관하게 자기 차례가 올 때까지 실행된다**(각자 자신의 노드/아이템 경계에서 독립적으로 취소를 관측할 뿐, `cancelController`는 `errorPolicy==='cancel-others-on-fail'`일 때만 다른 브랜치를 능동적으로 abort 시킨다). 이는 이번 diff 가 만든 회귀가 아니라 `Promise.allSettled` + `p-limit` 설계의 기존 특성이므로 별도 조치를 요구하지는 않으나, 위 스로틀 지연과 결합하면 취소 관측까지의 실질 지연이 "브랜치 대기열 + 250ms" 로 누적될 수 있다는 점은 참고할 만하다.

## 요약

이번 diff 의 핵심 신규 동시성 표면은 `containerCancelCheckedAtMs` Map 기반 시간 스로틀과 `ParallelExecutor`의 취소 우회 재throw다. 후자는 `Promise.allSettled` 완료 후 동기 처리라 경쟁이 없고(정보성), 스로틀의 Map 공유(브랜치·중첩 컨테이너 간)도 의도된 설계로 correctness 문제가 없다. 250ms 시간 스로틀이 취소 관측을 최대 250ms 늦추는 것은 §2.3/§5 best-effort 계약과 일관돼 수용 가능하나, 아이템이 매우 빠른 컨테이너에서는 "시간 상한 ≠ 아이템 개수 상한"이라는 잔여 리스크가 있다(INFO). 실제 확인된 결함은 **`executeBackgroundSubgraph`(fire-and-forget, 부모와 executionId 공유) 경로가 Map 정리 대상에서 빠져 있다는 것**이다 — park/resume·크래시 re-drive 등 다른 모든 세그먼트 종료 경로는 `finalizeRehydrationCleanup` 또는 `runExecution`의 `finally`로 정확히 정리되지만, background 본문(스펙이 명시하는 "Loop/ForEach 포함 수백 NodeExecution" 시나리오의 당사자)만 빠져 있어 실행당 1개씩 영구 누수된다. 개별 영향은 작지만(작은 Map 엔트리, 실행당 1개) JSDoc 이 명시한 "반드시 delete" 불변식을 어기고 테스트 커버리지도 0이므로 WARNING 으로 분류한다.

## 위험도

MEDIUM
