# 부작용(Side Effect) 리뷰 — PR3 크래시/재시작 RUNNING re-drive

대상: `execution-engine.service.ts` (recoverStuckExecutions fail→re-drive 전환),
`graph-dispatch.types.ts` (`skipExecutedNodes` 신규 파라미터), `executions.controller.ts`
(`_test/recover-stuck-executions` 신규 라우트), 관련 spec/e2e/unit 변경.

## 발견사항

- **[WARNING] 크래시 시점 mid-dispatch 였던 자식 NodeExecution RUNNING row 가 영구 orphan 으로 남는다**
  - 위치: `execution-engine.service.ts` `recoverStuckExecutions` (구 로직 제거분) / `reclaimStuckRunningExecution` / `redriveStuckExecution` / `executeNode`(`createNodeExecution`)
  - 상세: 옛 코드는 stale RUNNING Execution 을 FAILED 로 마킹하면서 **자식 RUNNING NodeExecution 도 cascade FAILED** 처리해 "claim 페어링으로 stuck 된 orphan 정리"를 명시적으로 보장했다(제거된 주석: "회수된 Execution 의 자식 RUNNING NodeExecution 도 함께 마감"). 이번 변경은 이 cascade 블록을 통째로 삭제했다. 새 경로(`redriveStuckExecution` → `rehydrateContext` → `driveStuckRedrive`)는 `execution_node_log` + `NodeExecution.status=COMPLETED` 만으로 `executedNodes`(재실행 skip 대상)를 복원하고, 크래시 시점에 아직 COMPLETED 가 아니던 노드(mid-dispatch RUNNING)는 그래프 forward 재구동 시 `executeNode`→`createNodeExecution` 으로 **완전히 새로운 NodeExecution row** 를 만들어 재실행한다(spec §7.3 "RUNNING-at-crash 노드 = at-least-once" 로 의도적으로 문서화됨). 그러나 **크래시 당시 이미 존재하던 원래 RUNNING row 자체는 어떤 코드 경로에서도 종결(FAILED/CANCELLED 등)되지 않는다** — Execution 이 COMPLETED 로 마감된 뒤에도 그 특정 노드의 옛 row 만 영구히 `status='running'` 으로 DB 에 잔존한다.
  - 영향: (1) `codebase/backend/src/modules/executions/executions.service.ts` 의 `reconcilePreParkWaitingStatus`/run-results 타임라인은 NodeExecution row 를 status 기준으로 표시하므로, 완료된 Execution 의 상세 화면에 영구히 "실행 중"으로 보이는 유령 노드 카드가 남을 수 있다. (2) `background-runs.service.ts` 의 `SUM(CASE WHEN ne.status = :runningStatus …)` 진행률 집계도 이 orphan row 를 계속 "running" 으로 카운트해 Sub-Workflow 진행률 패널이 왜곡될 수 있다. (3) 모니터링/운영 쿼리로 "RUNNING NodeExecution 개수" 를 스터크 지표로 쓰는 경우 실제와 무관하게 증가한다.
  - 근거: spec(`spec/5-system/4-execution-engine.md`) §7.1/§7.2/§7.5/Rationale 어디에도 "크래시 시점 원래 NodeExecution row 의 최종 상태" 를 명시하지 않는다 — "완료 노드 미재실행"(exactly-once)과 "RUNNING-at-crash = at-least-once 재실행" 은 문서화됐지만, **옛 row 자체가 영구 RUNNING 으로 남는다**는 trade-off는 언급이 없다. 즉 spec 이 의도한 trade-off 라기보다 리팩터링 중 놓친 회귀로 보인다.
  - 제안: `redriveStuckExecution`(또는 `driveStuckRedrive` 진입 직후)에서, re-claim 된 Execution 의 자식 `NodeExecution(status=RUNNING)` row 를 재구동 전에 명시적으로 종결(예: `status=SKIPPED`/`FAILED` + `error.code='REDRIVEN'` 등, 실제 재실행은 새 row 가 담당)하거나, 최소한 새로 생성되는 row 와 옛 row 를 연결해 UI/집계가 최신 row 만 채택하도록 정합화할 것. 최소한 spec 에 이 trade-off 를 명시적으로 기록해 "의도된 동작"인지 "회귀"인지 판정 가능하게 할 것.

- **[INFO] `_test/recover-stuck-executions` 라우트는 `NODE_ENV` 게이팅 + 전역 `JwtAuthGuard` 는 통과하지만 role 제약이 없다**
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts` (`triggerStuckRecoveryForTest`)
  - 상세: 새 POST 라우트는 인증된 사용자라면 workspace/role 무관하게 (viewer 포함) 전체 인스턴스 대상 `recoverStuckExecutions()` 전체 스캔을 트리거할 수 있다. `NODE_ENV !== 'test'` 시 404 로 완전히 숨기므로 production 노출은 없고, `@ApiExcludeEndpoint()` 로 swagger 문서에서도 제외되어 있어 실질 위험은 낮다. 다만 e2e 환경이 병렬 실행되는 경우 다른 워크스페이스/테스트의 stale RUNNING Execution 까지 함께 재구동 대상이 될 수 있다(전역 스캔은 기존 `recoverStuckExecutions` 도 동일하게 갖던 특성이라 신규 회귀는 아님).
  - 제안: 특별한 조치는 불필요. 다만 e2e 테스트 병렬화 시 다른 테스트의 stale row 를 건드릴 가능성을 인지하고 있을 것.

- **[INFO] `rehydrateContext` 시그니처 `waitingNodeExec: NodeExecution → NodeExecution | null` 확장, `EngineDriver` 인터페이스는 미갱신**
  - 위치: `execution-engine.service.ts:1178` (구현) vs `engine-driver.interface.ts:128-131` (`RetryEngineDriver.rehydrateContext`)
  - 상세: 구현체는 `waitingNodeExec: NodeExecution | null` 로 null 을 허용하도록 넓혔으나, `RetryEngineDriver` 인터페이스 선언은 여전히 `waitingNodeExec: NodeExecution`(non-null) 이다. TS 메서드 문법의 bivariant 매개변수 검사로 컴파일은 통과하지만, 인터페이스만 보고 호출하는 다른 소비자(`retry-turn.service.ts`) 입장에서는 "null 을 넘겨도 되는 case B 전용 신규 용도"가 계약에 드러나지 않는다. 실제 호출자는 현재 `execution-engine.service.ts` 자기 자신(`redriveStuckExecution`, `super`/`this` 직접 호출)과 `retry-turn.service.ts`(항상 non-null `spawnedRow`) 뿐이라 즉각적 런타임 영향은 없다.
  - 제안: `RetryEngineDriver.rehydrateContext` 시그니처도 `NodeExecution | null` 로 맞춰 인터페이스-구현 계약을 명시적으로 동기화할 것(현재는 인터페이스가 실제보다 더 좁아 오해 소지).

- **[INFO] `NodeDispatchLoopParams.skipExecutedNodes` 신규 optional 필드 — 기존 호출자 영향 없음 확인**
  - 위치: `graph-dispatch.types.ts`, `execution-engine.service.ts` (`runNodeDispatchLoop` 기존 2개 호출부: `driveResumeAwaited`/`resumeGraphAfterRetry` 경로 추정)
  - 상세: 기존 2개 호출부는 `skipExecutedNodes` 를 전달하지 않아 `undefined`(falsy) 로 남고, 신규 가드(`if (params.skipExecutedNodes && executedNodes.has(nodeId))`)는 비활성 상태를 유지한다 — 기존 cycle 재실행(pointer 되감기) 경로에 영향 없음을 코드로 확인. 순수 additive 변경.
  - 제안: 없음 — 정상.

- **[INFO] fire-and-forget re-drive 루프의 unhandled rejection 방어 확인**
  - 위치: `execution-engine.service.ts` `recoverStuckExecutions` — `for (const executionId of reclaimedIds) { void this.redriveStuckExecution(executionId).catch(...) }`
  - 상세: 각 재구동을 `void` + `.catch` 로 감싸 unhandled promise rejection 을 방지하고 있고, `redriveStuckExecution` 내부도 모든 예외를 `markExecutionCancelled` 로 in-band 단말 처리하도록 설계되어 있어 이중 방어(catch 블록은 desc 상 "reject 하지 않으나 방어적")다. 적절하다.
  - 제안: 없음 — 정상.

- **[INFO] boot-lock 은 재구동 완료를 기다리지 않고 즉시 해제됨(fire-and-forget) — 설계상 의도, 재확인**
  - 위치: `recoverStuckExecutions` — `reclaimedIds` 처리 loop 뒤 `finally` 에서 바로 `releaseLock`
  - 상세: `started_at` 원자 re-claim 으로 각 row 의 소유권을 이미 이전했으므로(re-picking 방지), lock 을 곧바로 풀어도 다른 인스턴스가 같은 row 를 다시 잡지 않는다는 주석 근거가 코드와 일치한다. 정상 설계.

## 요약

이번 변경은 `recoverStuckExecutions` 의 "stale RUNNING 일괄 FAILED 마킹" 을 "started_at 원자 re-claim + rehydration 기반 제어된 re-drive" 로 전환하는 핵심 동작 변화이며, 원자성(re-claim UPDATE...RETURNING)·lock 관리·fire-and-forget 예외 격리·`skipExecutedNodes` 신규 optional 파라미터의 하위 호환성은 모두 코드로 검증되어 안전하게 구현되어 있다. 다만 옛 코드에 있던 "회수된 Execution 의 자식 RUNNING NodeExecution 을 cascade FAILED 처리" 로직이 대체 없이 제거되어, 크래시 시점 mid-dispatch 였던 노드의 원래 NodeExecution row 가 재구동 후에도 영구히 `RUNNING` 으로 DB 에 잔존하는 회귀 가능성이 있다 — 이는 run-results 타임라인 UI 와 background-run 진행률 집계(`SUM(status=running)`) 양쪈에 사용자가 체감할 수 있는 왜곡을 일으킬 수 있고, spec 에도 이 trade-off 가 명시적으로 문서화되어 있지 않다. 그 외 인터페이스(`EngineDriver.rehydrateContext`)와 구현 시그니처 간의 nullable 불일치는 즉각적 위험은 낮으나 계약 문서 동기화가 필요하다.

## 위험도

MEDIUM
