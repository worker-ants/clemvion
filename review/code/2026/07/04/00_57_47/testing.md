# 테스트(Testing) 리뷰 — PR3 크래시 RUNNING 세그먼트 re-drive

대상: `execution-engine.service.ts`/`.spec.ts`, `graph-dispatch.types.ts`, `executions.controller.ts`, 신규 e2e `execution-crash-redrive.e2e-spec.ts`, plan 문서 2건, consistency SUMMARY.

## 발견사항

- **[WARNING]** `driveStuckRedrive` 자체에 대한 unit 테스트 부재 — COMPLETED 마감/park/에러(finalizeResumedExecutionOutcome) 3개 분기 모두 미검증
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2712-2882` (`driveStuckRedrive`), `execution-engine.service.spec.ts:1153-1246` (`redriveStuckExecution` describe 블록)
  - 상세: `redriveStuckExecution` 의 unit 테스트 3개는 전부 `driveStuckRedrive` 를 `jest.spyOn(...).mockResolvedValue(undefined)` 로 스텁 처리해 호출 여부만 확인한다. 그 결과 `driveStuckRedrive` 내부의 핵심 로직 — (1) `seedInitialReachability` + `executedNodes` propagate 로 frontier 를 여는 reachability 계산, (2) `dispatchResult.parked` 시 조기 return(WAITING 유지), (3) 정상 완료 시 `outputData`/`finishedAt`/`durationMs` 설정 후 `updateExecutionStatus(COMPLETED)` + `emitExecution`, (4) catch 블록의 `finalizeResumedExecutionOutcome` 위임 — 이 전부 unit 레벨에서 한 번도 실행되지 않는다. 이 로직은 신규 e2e 시나리오(`execution-crash-redrive.e2e-spec.ts`) 단 1개로만 간접 커버되며, park 분기와 non-RehydrationError catch 분기는 e2e 에서도 다루지 않는다(e2e 시나리오는 항상 완료 경로만 검증).
  - 제안: `driveStuckRedrive` 를 대상으로 하는 별도 `describe` 를 추가해 (a) `dispatchResult.parked=true` 시 `updateExecutionStatus`/`emitExecution` 이 호출되지 않는지, (b) 완료 시 `outputData`/`durationMs` 계산과 COMPLETED 전이·이벤트 emit, (c) `runNodeDispatchLoop` 가 던지는 에러가 `finalizeResumedExecutionOutcome` 으로 위임되는지를 각각 mock 기반으로 직접 검증.

- **[WARNING]** `runNodeDispatchLoop` 의 `skipExecutedNodes` 가드에 대한 직접 unit 테스트 부재
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1436-1444`, `types/graph-dispatch.types.ts:82-91`
  - 상세: `skipExecutedNodes` 는 §7.3 exactly-once 보장의 핵심 가드(완료 노드 재실행 방지)이자, 문서(`spec-draft-crash-running-redrive.md`)가 명시적으로 강조하는 계약이다. 그런데 `grep` 결과 이 옵션이 `true` 로 전달돼 "이미 executedNodes 에 있는 노드가 실제로 skip 되고 pointer 가 증가하는지" 를 검증하는 unit 테스트가 코드베이스 어디에도 없다 — `redriveStuckExecution`/`driveStuckRedrive` 테스트들이 모두 `driveStuckRedrive` 자체를 스텁 처리하기 때문에 `runNodeDispatchLoop` 호출까지 도달하지 않는다. 유일한 검증은 신규 e2e 1건(정상 케이스만, cycle/재진입 노드 없음)이다. `skipExecutedNodes` 미전달 시(기본 경로) cycle 재실행이 보존돼야 한다는 회귀 조건도 unit 으로 가드되지 않는다.
  - 제안: `runNodeDispatchLoop` 를 직접 호출하는 unit 테스트를 추가해 (i) `skipExecutedNodes:true` + `executedNodes` 에 포함된 노드 → dispatch 안 되고 pointer 만 증가, (ii) `skipExecutedNodes` 미전달(false) + 동일 조건 → 정상 dispatch(cycle 재실행 보존) 두 케이스를 대조 검증.

- **[WARNING]** `redriveStuckExecution` catch 블록의 non-RehydrationError 분기 미테스트
  - 위치: `execution-engine.service.ts:2762-2777` (else 분기 — `markExecutionCancelled(executionId, 'RESUME_CHECKPOINT_MISSING')` + `logger.error`), `execution-engine.service.spec.ts:1228-1244`
  - 상세: 테스트는 `rehydrateSpy.mockRejectedValueOnce(new RehydrationError(...))` 케이스만 검증한다. `RehydrationError` 가 아닌 일반 `Error`(예: DB 연결 오류, `loadAndBuildGraph` 실패)가 발생했을 때도 동일하게 `markExecutionCancelled(executionId, 'RESUME_CHECKPOINT_MISSING')` 로 수렴하는지 확인하는 테스트가 없다. 두 분기의 실제 동작(호출 인자)이 같더라도, 분기 조건(`err instanceof RehydrationError`)과 로깅 경로가 다르므로 회귀 시 이 else 경로만 조용히 깨질 수 있다.
  - 제안: `loadAndBuildGraph` 또는 `rehydrateContext` 가 일반 `Error` 를 던지는 케이스를 추가해 `cancelSpy` 가 여전히 `'RESUME_CHECKPOINT_MISSING'` 으로 호출되는지, `driveSpy` 가 호출되지 않는지 검증.

- **[WARNING]** `redriveStuckExecution` — `findOneBy` 가 `null`/`undefined` 반환(execution 부재)하는 케이스 미테스트
  - 위치: `execution-engine.service.ts:2727-2735` (`if (!savedExecution || savedExecution.status !== ExecutionStatus.RUNNING)`), `execution-engine.service.spec.ts:1213-1224`
  - 상세: 복합 조건의 두 분기 중 `savedExecution.status !== RUNNING`(CANCELLED) 만 테스트되고, `!savedExecution`(row 자체가 없음 — 예: 동시 삭제·오래된 stale id) 케이스는 다루지 않는다. 로그 메시지도 `savedExecution?.status ?? 'absent'` 로 별도 분기 처리돼 있어 이 경로가 실제로 실행되는지 확인되지 않은 채 남아있다.
  - 제안: `mockExecutionRepo.findOneBy.mockResolvedValueOnce(null)` 케이스를 추가해 `rehydrateSpy`/`driveSpy` 모두 호출되지 않음을 검증.

- **[WARNING]** `ExecutionsController.triggerStuckRecoveryForTest` — NODE_ENV 게이팅(404) 미테스트
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:205-215`, `codebase/backend/src/modules/executions/executions.controller.spec.ts` (grep 결과 0건)
  - 상세: 이 엔드포인트는 "`NODE_ENV !== 'test'` 이면 반드시 404 를 던져 프로덕션에 노출되지 않는다" 는 것이 유일한 안전장치이자 PR 설명에서 강조하는 불변식이다. 그런데 `executions.controller.spec.ts` 에 이 엔드포인트 관련 테스트가 전혀 없고, 신규 e2e 테스트는 `NODE_ENV=test` 환경에서만 실행되므로 (구조상 항상 통과하는) 정상 분기만 실행하며 404 분기는 어떤 테스트 스위트에서도 실행되지 않는다. 즉 이 엔드포인트의 핵심 보안/안전 경계("프로덕션 표면 아님")를 검증하는 자동화 테스트가 프로젝트 전체에 하나도 없다.
  - 제안: `executions.controller.spec.ts` 에 `process.env.NODE_ENV` 를 `'production'`(또는 `undefined`) 으로 바꿔 `NotFoundException` 이 던져지고 `executionEngineService.runStuckRecoveryScan` 이 호출되지 않는지 검증하는 unit 테스트를 추가. (`NODE_ENV` mutate 시 `afterEach` 로 원복 필수 — 다른 테스트 오염 방지.)

- **[INFO]** e2e 테스트의 `output_data` 문자열 포함 검증(`toContain('redriven')`) 은 다소 느슨함
  - 위치: `codebase/backend/test/execution-crash-redrive.e2e-spec.ts:762-764`
  - 상세: `JSON.stringify(codeRow?.output_data ?? {})` 로 직렬화 후 `.toContain('redriven')` 로 판정하는데, 이는 값이 정확히 `{ redriven: true }` 형태인지, 혹은 우연히 다른 필드에 `"redriven"` 문자열이 섞여 있는지(예: 에러 메시지 필드)까지는 구분하지 못한다. 실질적 실패 시나리오는 낮지만(코드 노드가 명시적으로 `return { redriven: true }` 반환), 더 엄격하게는 `output_data.redriven === true` 로 파싱해 검증하는 편이 의도를 더 명확히 표현한다.
  - 제안: `JSON.parse` 후 `expect((codeRow?.output_data as { redriven?: boolean }).redriven).toBe(true)` 형태로 강화 고려(필수는 아님).

- **[INFO]** `recoverStuckExecutions` 의 `for (const executionId of reclaimedIds) { void this.redriveStuckExecution(...).catch(...) }` fire-and-forget 패턴에 대한 "복수 id 병렬 처리" 자체는 검증되나(`redriveSpy` 2회 호출 확인), 개별 `redriveStuckExecution` 실패가 다른 id 의 재구동을 막지 않는지(격리)는 별도로 테스트되지 않음
  - 위치: `execution-engine.service.ts:2657-2666`, `execution-engine.service.spec.ts:1043-1074`
  - 상세: 현재 테스트는 `redriveSpy` 를 통째로 mock 하므로 이 catch 블록(로깅만 하고 다른 id 진행에 영향 없음)이 실제로 실행되지 않는다. `redriveSpy.mockRejectedValueOnce` 로 첫 번째 id 실패를 주입해도 두 번째 id 의 `redriveSpy` 호출이 이뤄지는지, 그리고 `recoverStuckExecutions` 자체가 reject 하지 않는지(로그만 남기고 정상 반환) 확인하는 테스트가 없다.
  - 제안: `redriveSpy.mockRejectedValueOnce(new Error('boom'))` 케이스를 추가해 다른 id 의 재구동이 계속 진행되고 `recoverStuckExecutions()` 호출 자체는 정상 resolve 됨을 가드.

## 요약

새 unit 테스트들은 `recoverStuckExecutions`(re-claim 전환)과 `redriveStuckExecution`(setup 분기)의 표면 동작을 잘 커버하고, 옛 fail-only 동작에 대한 명시적 회귀 가드(status=FAILED/WORKER_HEARTBEAT_TIMEOUT 미사용, WAITING_FOR_INPUT 배제)도 견고하게 유지되어 가독성과 회귀 방지 측면에서 우수하다. 다만 실제 그래프 재구동을 수행하는 `driveStuckRedrive` 와 그 안에서 완료 노드 재실행을 막는 `runNodeDispatchLoop skipExecutedNodes` 가드는 unit 레벨에서 전부 mock/spy 로 우회되어, 이 PR 의 핵심 정합성 계약(exactly-once 완료 노드, park 유지, COMPLETED 마감, 에러 시 terminal 처리)이 단 1개의 e2e happy-path 시나리오로만 커버된다. e2e 는 완료 경로만 다루므로 park 재진입·비-RehydrationError 예외·개별 re-drive 실패 격리는 어떤 테스트로도 검증되지 않는 커버리지 갭이다. 또한 `_test/recover-stuck-executions` 엔드포인트의 유일한 안전장치인 NODE_ENV 게이팅은 코드베이스 전체에서 한 번도 실행되지 않는 미검증 분기다. 이들은 CRITICAL 수준의 버그를 즉시 시사하지는 않지만, 동시성/상태전이 변경 이력(이 프로젝트 메모리에 기록된 "동시성 변경엔 e2e 필수" 교훈)에 비추어 park/에러 분기에 대한 최소 unit 보강이 필요하다.

## 위험도

MEDIUM
