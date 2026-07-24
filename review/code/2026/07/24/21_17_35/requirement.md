# 요구사항(Requirement) 리뷰 결과

## 발견사항

- **[WARNING]** 신규 e2e 스펙 파일의 JSDoc 이 주장하는 취소 전파 "기전"(mechanism)이, 그 파일이 실제로 구성하는 시나리오(2노드 **선형**·非-parallel dispatch)에는 적용되지 않는다 — 독립 코드 추적으로 확인.
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:23-24`
    ```
    23| * 여기서 검증하는 것은 그 위층 — **엔진이 다음 노드로 넘어가지 않고 실행을 cancelled 로
    24| * 확정하는가**(`execution-engine.service.ts` 의 `context.abortSignal?.throwIfAborted()`).
    ```
    교차 검증: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6058` (`context.abortSignal?.throwIfAborted()`) · `:5645-5651`(NodeExecution 완료 저장) · `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:245` · `codebase/backend/src/modules/executions/executions.service.ts:732-807`(`stop()`) · `review/code/2026/07/24/20_36_21/RESOLUTION.md` §C1(35-41행).
  - 상세: 이 테스트가 만드는 워크플로는 `trigger → slow(code) → downstream(code)` 순수 선형 그래프로 `parallel` 노드가 없다. `context.abortSignal` 이 실제로 set 되는 곳은 저장소 전체에서 `containers/parallel-executor.ts:245`(parallel branch context 전용) 단 한 곳뿐임을 grep 으로 확인했다(`executions.service.ts`/`execution-context.service.ts` 어디에도 `new AbortController` 나 `abortSignal =` 대입이 없음). 따라서 이 시나리오에서 `context.abortSignal` 은 **항상 `undefined`** 이고, JSDoc 이 지목한 `:6058` 의 `throwIfAborted()` 는 확정적으로 no-op 이다.
    또한 `runExecution`/`runNodeDispatchLoop` 의 dispatch 루프(`:1634-1739`, `:4251-4454`)는 노드 사이에 Execution 의 현재(취소됐을 수 있는) DB 상태를 재조회하거나 확인하는 코드가 전혀 없다 — `assertActiveTimeWithinLimit` 는 시간 한도만 검사한다. `executeNode` 내 NodeExecution 완료 저장(`:5645-5651`, `nodeExecutionRepository.save(nodeExecution)`)도 조건 없는 무조건 저장이다. **guarded UPDATE 패턴은 오직 전체 dispatch 루프가 끝난 뒤 1회 호출되는 `updateExecutionStatus`(Execution 레벨 최종 COMPLETED 기록, `:2257`/`:4473`)에만 존재** — 이는 다운스트림 노드 B 자신의 완료 저장을 막지 못한다(B 는 마지막 노드가 아니어도 이 시점 전에 이미 저장이 끝난 상태).
    즉 RESOLUTION.md §C1 이 제시한 대안 기전("guarded UPDATE 가 동시 cancel 을 감지해 진행을 중단시킨다")도 **다운스트림 노드 자체의 완료 저장을 설명하지 못한다** — 그 가드는 Execution 레벨 최종 emit 만 skip 시킬 뿐, `nodeStatus(executionId, downstreamNodeId)` 가 왜 `completed` 가 아니라 `null`/`cancelled` 로 관측되는지는 코드상 근거가 없다. RESOLUTION 스스로도 "선형 경로에서 abortSignal 이 실제로 비어 있는지는 확인하지 않았다"고 정직하게 명시했는데, 본 리뷰가 그 미확인 사실을 **확정**(항상 비어 있음)했고, 그 결과 대안 기전 설명 역시 성립하지 않음을 추가로 확인한 것이다.
    e2e 3회 실행 + 대조군 테스트로 결과 자체(다운스트림 미도달)는 경험적으로 재현됐다는 RESOLUTION 의 기록은 신뢰할 근거가 있으나(대조군이 vacuous 가능성을 배제), **왜** 그런지에 대한 코드상 설명이 없다는 것은 이 안전 속성이 우연(타이밍/스케줄링 부수효과)에 의존할 가능성을 열어 둔다 — 파일 JSDoc 이 표방하는 "타이밍 의존 축을 단언에서 제거했기 때문에 결정적이다" 라는 주장과 정면으로 긴장 관계에 있다. 설명되지 않은 기전에 의존하는 통과는, 엔진 내부 구현(디스패치 순서·await 지점·DB 왕복 타이밍)이 나중에 리팩터링되면 조용히 깨질 수 있다.
  - 제안: RESOLUTION §C1 이 이미 "본 PR 범위 밖" 으로 defer 한 잔여 항목("선형 경로 abortSignal 배선 여부")을 실제로 규명할 것 — 계측(임시 로그/trace)으로 다운스트림 노드가 실제로 dispatch 되는지 여부부터 확인. (a) dispatch 되지 않는다면 **그 실제 gate 지점**을 찾아 JSDoc/spec 인용을 정정하고, (b) dispatch 는 되지만 다른 이유로 완료 저장이 스킵된다면 그 경로를 밝혀 인용을 정정, (c) 어느 쪽도 아니고 순수 우연(타이밍)이라면 이 e2e 의 "결정적" 주장 자체를 재검토하고 엔진에 실제 선형-경로 cancellation gate(다음 노드 dispatch 직전 Execution 상태 재확인)를 추가하는 것을 고려. 최소 조치로는 JSDoc 의 구체적 코드 인용(`context.abortSignal?.throwIfAborted()`)을 제거하고 "정확한 억제 지점은 미상, 결과(Execution=cancelled ∧ 하류 미도달)만 반복 검증됨"으로 정직하게 격하.
    (참고: 이 항목은 원 CRITICAL 리뷰어가 지적한 기전 부재를 RESOLUTION 이 "반증(실측)"으로 닫았으나, 그 반증에 사용된 대안 설명 자체가 구현과 어긋난다는 점을 새로 확인한 것 — RESOLUTION 이 이미 "C1 파생" 으로 별건 추적을 인지하고 있으므로 완전히 새로운 미추적 리스크는 아니다. 다만 JSDoc 이 이미 틀린 것으로 확인된 특정 코드 라인을 못박아 인용하고 있는 점은 그 자체로 지금 고칠 가치가 있다.)

- **[INFO]** 위 항목과 별개로, plan 파일 3종(`node-cancellation-inflight-followups.md` 완료 이동, `node-cancellation-infrastructure.md` dangling 링크 3곳 수정, `node-cancellation-residual-signal-propagation.md` 신설)과 `spec/conventions/node-cancellation.md` 의 `pending_plans`/§6 표 갱신은 서로 line-level 로 일치한다 — `spec-status-lifecycle` 가드 규칙 (b)(c) 충족, dangling 링크 잔존 0 확인(grep). RESOLUTION.md 의 조치 서술과 실제 diff 가 어긋나는 지점 없음.
  - 위치: `spec/conventions/node-cancellation.md`(§6 표, `pending_plans`), `plan/complete/node-cancellation-infrastructure.md:70,83,90`, `plan/in-progress/node-cancellation-residual-signal-propagation.md`.

- **[INFO]** 세 번째 테스트("취소된 실행은 재-stop 을 거부한다")의 단언(재-stop → 400)은 `codebase/backend/src/modules/executions/executions.service.ts:741-750` 의 `BadRequestException({code:'INVALID_STATE', ...})` 분기 및 `executions.controller.ts:119-141` 의 `@HttpCode(HttpStatus.OK)`(첫 stop 200) 와 정확히 일치 — 코드 대조로 확인, spec §2.3 서술과도 부합.

- **[INFO]** 헬퍼 함수(`registerAndLogin`, `createTeamWorkspace`, `uniqueEmail`, `uniqueName`, `createDbClient`) 시그니처·인자 순서가 `test/helpers/{auth,db}.ts` 실제 export 와 정확히 일치. TODO/FIXME/HACK/XXX 주석 없음. `nodeStatus`/`getStatus`/`waitUntil` 의 null/빈 문자열 경로 모두 명시적으로 처리됨(엣지 케이스 결함 없음).

## 요약

핵심 코드 변경(신규 e2e `node-cancellation-propagation.e2e-spec.ts`)은 spec `node-cancellation.md` §5(AbortError 분류·cancelled 확정)·§2.3(사용자 cancel API 계약)과 관찰 가능한 계약(Execution 이 `cancelled` 로 확정 + 재-stop 400) 수준에서는 코드와 정확히 부합하며, RESOLUTION.md 가 기록한 경험적 검증(e2e 3회 green + vacuity 배제 대조군)도 신뢰할 근거가 있다. 다만 그 테스트가 "왜 통과하는가"를 설명하는 JSDoc 의 구체적 기전 인용(`context.abortSignal?.throwIfAborted()`)과 RESOLUTION §C1 의 대안 설명("guarded UPDATE")은 독립 코드 추적 결과 이 테스트가 실제로 구성하는 선형(非-parallel) 시나리오에 적용되지 않는 것으로 확인됐다 — `context.abortSignal` 은 이 경로에서 항상 `undefined`, 다운스트림 노드의 완료 저장은 Execution 취소 여부와 무관하게 무조건 실행된다. 팀이 이미 이 불확실성을 인지하고 별건으로 defer 했다는 점에서 신규 미추적 리스크는 아니나, 커밋된 테스트 파일의 JSDoc 이 틀린 것으로 확인된 특정 코드 라인을 사실처럼 인용하고 있는 점, 그리고 안전 속성이 설명되지 않은 기전에 의존한다는 점은 후속 확인이 필요한 실질적 미결 사항이다. plan/spec 문서 갱신(dangling 링크 정정, 잔여 추적 plan 신설, status 되돌림)은 모두 line-level 로 일관되며 결함 없음.

## 위험도

LOW
