# 부작용(Side Effect) Review — review/code/2026/07/26/13_47_42

## W9 검증 결과: 해소 확인

직전 라운드 지적(`runContainer` catch 가 취소를 FAILED 로 오분류 + 내부 message 를
`NODE_FAILED` 로 WS 방출)은 해소됐다.

`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `runContainer`
(현재 라인 7565 `catch (err) {` 직후, 7574-7576):

```ts
if (err instanceof ExecutionCancelledError) {
  throw err;
}
```

일반 catch-all(NodeExecution FAILED 저장 + `NODE_FAILED` emit, 7577- 이하)보다 **먼저**
배치돼 있어, `ExecutionCancelledError` 는 FAILED 마킹/emit 을 거치지 않고 즉시 재throw 된다.
`execution-engine.service.spec.ts` 의 W9 회귀 테스트("아이템 경계 취소가 컨테이너 노드를
FAILED 로 오분류하거나 NODE_FAILED 를 emit 하지 않는다")가 `mockNodeExecutionRepo.save`
호출 인자와 `mockWebsocketService.emitNodeEvent` 미호출을 직접 단언하는 것도 확인했다. 이
항목은 더 이상 다루지 않는다.

## 발견사항

- **[WARNING]** `containerCancelCheckedAtMs` 스로틀 Map 이 `executeBackgroundSubgraph` 경로에서 누수된다 — JSDoc 이 "누수 방지" 로 명시한 정리 지점 목록에서 이 경로가 빠짐
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — Map 필드 선언부 JSDoc(534-540 부근, "**누수 방지**: execution 종료 지점(`finalizeRehydrationCleanup`, `runExecution` catch/finally)에서 반드시 `delete` 한다"), 실제 삭제 호출부 `finalizeRehydrationCleanup`(2667-2671)·`runExecution` finally(4540-4544), 그리고 삭제가 빠진 `executeBackgroundSubgraph` finally(6930-6934)
  - 상세: `assertExecutionNotCancelled(executionId, { throttle: true })` 는 `executeContainerBody` 호출부(6515)에서만 쓰이는데, `executeContainerBody` 는 `runContainer`→`runContainerInner` 를 거쳐 ForEach/Loop/Map 본문 반복마다 호출된다. 이 컨테이너 dispatch 는 `executeInline` 의 노드 루프(3857 부근, `dispatchKind === 'container'` 분기)를 통해서도 도달하고, `executeInline` 은 **Background 노드 본문**(`executeBackgroundSubgraph` → `this.executeInline(job.workflowId, ...)`, 6879-6886)의 실행 경로이기도 하다. Background 본문은 부모와 **동일한 `executionId`** 를 공유한다(코드 주석 자체가 "본문은 메인과 동일한 executionId 를 ... 공유" 라고 명시, 6777-6779). `spec/4-nodes/1-logic/12-background.md` 도 컨테이너(Loop/ForEach/Map/Parallel)가 다른 컨테이너와 마찬가지로 본문 서브그래프에 올 수 있다고 서술해, "Background 본문 안에 ForEach" 구성은 실제로 가능한 워크플로다.
    이 경우 `containerCancelCheckedAtMs.set(executionId, Date.now())` 항목이 생기는데, `executeBackgroundSubgraph` 의 `finally`(6930-6934)는 `contextService.deleteContext(bgKey)` 만 수행하고 `containerCancelCheckedAtMs.delete(executionId)` 를 호출하지 않는다. Background 작업은 BullMQ 큐를 통한 fire-and-forget 실행이라, 보통 메인 흐름의 `runExecution` 이 이미 자신의 `finally` 를 마치고 반환(및 그 시점에 같은 키를 이미 `delete` 했거나, 애초에 컨테이너를 안 써서 없었던 상태)한 **이후**에 Background 본문이 실행되는 타이밍이 흔하다 — 이 경우 Background 본문이 새로 만든 `containerCancelCheckedAtMs` 엔트리를 지울 코드가 이후로 전혀 없다. `finalizeRehydrationCleanup` 은 재개/rehydration 종결 지점에서만 호출되고 Background 종료 지점에서는 호출되지 않는다.
    같은 필드의 JSDoc 바로 위 문단(2660-2662, 사전 존재 주석)은 `contextService`/`clearLlmDefaultConfigCache` 에 대해 "background 본문의 bgKey resolver/context 는 `executeBackgroundSubgraph` finally 가 독립 정리" 라고 정확히 구분해 두었는데, `containerCancelCheckedAtMs` 는 bgKey 가 아니라 부모와 공유하는 `executionId` 를 키로 쓰면서도 그 독립 정리 대응이 없다 — 설계자가 명시적으로 고려한 "완전한 정리 지점 목록"에서 실제로 누락된 사례다. `plan/in-progress/node-cancellation-residual-signal-propagation.md` §"트레이드오프 — 아이템 경계 cancel 가드 스로틀 (W10)" 도 동일하게 두 지점만 나열한다.
    결과적으로 Background 노드 본문에 컨테이너를 쓰는 워크플로가 반복 실행될 때마다 (executionId 는 매번 새로 생성되는 고유값이므로) `containerCancelCheckedAtMs` 에 회수되지 않는 엔트리가 하나씩 쌓인다 — 장기 가동 중인 단일 인스턴스(NestJS 싱글턴 서비스) 프로세스 메모리에서 무한 성장하는 누수다. 엔트리 자체는 작지만(UUID 문자열 키 + 숫자 값), 프로세스 재시작 전까지 회수되지 않는다는 점에서 명시된 "누수 방지" 설계 의도에 반한다.
  - 제안: `executeBackgroundSubgraph` 의 `finally` 블록에 `this.containerCancelCheckedAtMs.delete(job.executionId)` 를 추가하거나(단, 부모 flow 가 아직 진행 중이면 부모 쪽 스로틀 baseline 도 함께 지워지는 부작용을 감안해야 함), 혹은 `finalizeRehydrationCleanup` 과 유사하게 Background 전용 정리 헬퍼를 두어 이 키를 명시적으로 정리한다. 이미 `containerCancelCheckedAtMs` JSDoc 이 "정리 지점" 을 열거하는 방식 자체가 신규 종료 지점 추가 시 놓치기 쉬우므로, `segmentStartMs` 처럼 상태 전이 기반(자기-정리) 설계로 전환하는 대안도 고려할 만하다(다만 이건 유지보수성 관점 제안이라 이 리뷰 범위 밖으로 남긴다).

- **[INFO]** 컨테이너 취소 스로틀 캐시가 "최근 조회 여부"만 기억하고 "직전 결과"는 기억하지 않아, 동시 실행 중인 형제 컨테이너(예: Parallel 의 서로 다른 브랜치에 각각 있는 ForEach)가 실제 취소 확정 이후에도 스로틀 창 나머지 시간(최대 250ms) 동안 한 번 더 아이템을 dispatch 할 수 있다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `assertExecutionNotCancelled` (7904-7932), 특히 캐시-히트 조기 `return`(7908-7916)과 실제 조회 후 타임스탬프 갱신(7918-7924)의 순서
  - 상세: `containerCancelCheckedAtMs` 는 `executionId` 단일 키로, 그 실행에 속한 **모든** 컨테이너 호출 프레임(중첩 컨테이너·Parallel 의 서로 다른 브랜치에 각각 있는 독립 컨테이너 등)이 공유한다. 실제 DB 조회가 `CANCELLED` 를 발견해 throw 하기 직전에도 타임스탬프는 갱신되므로(7922-7924 가 7925 의 상태 분기보다 먼저 실행), 그 순간 다른 컨테이너 호출 프레임이 같은 실행 ID 로 스로틀 체크를 하면 "최근에 확인됨" 으로 판단해 실제 조회 없이 그냥 통과(=취소 아님으로 간주)한다 — 취소가 이미 확정된 뒤인데도. 다만 이 캐시가 취소 확정 이후 새로 갱신되는 일은 없으므로(그 콜사이트는 throw 로 죽는다) 지연은 스로틀 window(250ms) 를 넘지 않고, `node-cancellation-residual-signal-propagation.md` §"왜 무해한가" 가 명시한 "수백 ms 지연은 best-effort 계약상 무해" 라는 전제와 정성적으로 다르지 않다. 다만 그 문서의 트레이드오프 설명은 "아이템 수에 선형 비례하는 지연" 만 논하고 "형제 컨테이너 간 공유 캐시로 인한 관측 지연" 이라는 이 구체적 메커니즘은 언급하지 않는다 — 문서 갱신 시 참고할 만하다는 점만 남긴다(코드 결함으로 판단하지는 않음).

## 요약

W9(컨테이너 catch-all 의 취소 오분류·`NODE_FAILED` 오발행)은 `runContainer` catch 최상단의
`instanceof ExecutionCancelledError` 재throw 로 확실히 해소됐고, mutation 검증까지 뒷받침하는
회귀 테스트가 붙어 있다. Parallel(C5)·헬퍼 추출(W12)·타임스탬프 오더링 등 이번에 새로 도입된
로직 자체는 기존 상태·이벤트 계약을 깨지 않는다(`Promise.allSettled` 이후에 취소-우선순위
판정이 들어가 abort-others 로직과 충돌하지 않고, `finalizeCancelledExecution` 추출은
behavior-preserving). 다만 W10 에서 새로 도입한 컨테이너 아이템-경계 스로틀 상태
(`containerCancelCheckedAtMs`)는 설계자가 "누수 방지" 로 명시한 두 정리 지점
(`finalizeRehydrationCleanup`, `runExecution` catch/finally) 이 Background 노드 본문
실행 경로(`executeBackgroundSubgraph`)를 놓치고 있어, Background 본문에 컨테이너를 포함한
워크플로가 반복 실행될 때마다 회수되지 않는 in-memory Map 엔트리가 누적되는 실질적 누수가
있다. 이는 실행 상태 오분류나 이벤트 중복/누락으로 이어지지는 않지만(스로틀은 순수 최적화이고
correctness 에는 영향 없다는 설계 의도 자체는 맞다), 장기 가동 프로세스의 메모리를 무한정
소비한다는 점에서 "Map 누수 없음" 이라는 코드 자체의 명시적 주장을 반증한다.

## 위험도

LOW
