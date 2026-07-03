# 테스트(Testing) 리뷰 — PR3 크래시 RUNNING 세그먼트 re-drive (fresh, resolution 반영 후)

대상 커밋 범위: `96cc99f07`(spec) → `11c7b2ff5`(feat) → `15c0bd036`(e2e 안정화) → `4b3a25a3a`(ai-review resolution). diff base: `origin/main`.

본 리뷰는 직전 세션(`review/code/2026/07/04/00_57_47`)에서 지적된 6개 테스트 갭 —
(1) `driveStuckRedrive` COMPLETED/park/error 3분기 unit 부재, (2) `runNodeDispatchLoop
skipExecutedNodes` 직접 unit 부재, (3) `redriveStuckExecution` 비-RehydrationError catch
분기 미테스트, (4) `redriveStuckExecution` execution 부재(`findOneBy null`) 미테스트,
(5) 컨트롤러 `triggerStuckRecoveryForTest` NODE_ENV/플래그 게이팅(404) 미테스트, (6, 문서화)
`failOrphanRunningNodeExecutions` cascade — 가 해소됐는지 fresh 로 재검증한다.

## 검증 방법

- `git diff origin/main..HEAD` 로 실제 추가된 테스트 코드를 직접 읽고 대응하는 구현 코드(§행)와 대조.
- `npx jest src/modules/execution-engine/execution-engine.service.spec.ts` → 345 tests 전부 통과 확인.
- `npx jest src/modules/executions/executions.controller.spec.ts` → 13 tests 전부 통과 확인.

## 발견사항

- **[INFO]** 직전 갭 6건 중 5건은 실제 unit 테스트로, 1건(skipExecutedNodes 종단 검증)은 계획대로 e2e 로 해소 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
    - `driveStuckRedrive (PR3 case B drive)` describe (COMPLETED emit / park 조기반환 / 예외→`finalizeResumedExecutionOutcome`) — 3 케이스 모두 `runNodeDispatchLoop`/`updateExecutionStatus`/`emitExecution`/`finalizeSpy` 를 직접 spy 해 각 분기의 호출 인자까지 검증(예: `skipExecutedNodes: true, pointer: 0` 어서션).
    - `redriveStuckExecution (PR3 case B)` describe 에 execution 부재(`findOneBy` → `null`) 케이스와 "setup 이 비-RehydrationError 로 실패해도 RESUME_CHECKPOINT_MISSING terminal" 케이스가 각각 추가되어 `cancelSpy`/`driveSpy` 호출 여부까지 확인.
    - `failOrphanRunningNodeExecutions (PR3 orphan cascade)` describe 신설 — `NodeExecution` UPDATE 의 `set`/`where`/`andWhere` 인자를 정확히 검증.
  - 위치: `codebase/backend/src/modules/executions/executions.controller.spec.ts` `triggerStuckRecoveryForTest (test-only gating)` describe — 정상(`NODE_ENV=test && E2E_TEST_HOOKS=1`) / `NODE_ENV` 오설정 / 플래그 미설정 3-case, 각각 `runStuckRecoveryScan` 호출 여부와 `NotFoundException` 을 검증. `afterEach` 로 `process.env` 원복 처리도 확인됨(다른 스펙 파일 오염 없음 — jest worker 격리로도 이중 안전).
  - 상세: 전부 실행 결과 345/13 테스트 그린. `skipExecutedNodes` 자체의 "완료 노드 skip + pointer 증가" 로직은 unit 으로 직접 exercise 되지 않고 `driveStuckRedrive` 테스트에서도 `runNodeDispatchLoop` 를 spy(진짜 호출은 `mockResolvedValue`로 대체)하므로 실제 `runNodeDispatchLoop` 본문은 unit 커버리지 밖이다. 이 갭은 RESOLUTION.md W6 에 "graphState full-mock 비용 과다 → e2e 대체"로 명시적으로 defer 됐고, `execution-crash-redrive.e2e-spec.ts` 가 완료 prefix(trigger·codeA) row 수 불변을 실측(`nodeExecRowCount` 스냅샷 비교)해 종단으로 이 가드를 검증한다 — 타당한 트레이드오프로 판단.
  - 제안: 조치 불요(확인 완료). 신규 회귀 없음.

- **[INFO]** (잔존, 조치 대상 아님) 개별 `redriveStuckExecution` 실패의 타 execution 격리 테스트는 이번 라운드에서도 미추가
  - 위치: `execution-engine.service.ts` `recoverStuckExecutions` 의 `for (const executionId of reclaimedIds) { void this.redriveStuckExecution(...).catch(...) }` (약 L2657 부근), `execution-engine.service.spec.ts` `recoverStuckExecutions` describe
  - 상세: 직전 리뷰의 INFO 항목("복수 id 중 하나 실패해도 나머지 진행 + `recoverStuckExecutions()` 자체는 reject 안 함")은 이번 fix 대상(SUMMARY W1~W10) 목록에 없었고 실제로 추가되지 않았다. 로직 자체(`.catch` 로 개별 실패를 흡수)는 육안 검토로 명확히 안전하나, 회귀 테스트는 부재.
  - 제안: 우선순위 낮음. `redriveSpy.mockRejectedValueOnce(new Error('boom'))` 로 첫 id 실패 시 두 번째 id 의 `redriveSpy` 호출과 `recoverStuckExecutions()` 자체의 정상 resolve 를 가드하는 테스트를 향후 추가하면 좋음 — 이번 PR 을 막을 사유는 아님.

- **[INFO]** (잔존, 조치 대상 아님) e2e `output_data` 검증이 문자열 `toContain` 방식으로 다소 느슨함
  - 위치: `codebase/backend/test/execution-crash-redrive.e2e-spec.ts:268` (`expect(JSON.stringify(codeRow?.output_data ?? {})).toContain('redriven')`)
  - 상세: 직전 리뷰에서 지적된 그대로 남아있음(이번 fix 스코프 밖). 실패 시나리오 가능성은 낮으나(고정 code 노드 반환값), `JSON.parse` 후 `.redriven === true` 형태로 강화하면 의도가 더 명확해짐.
  - 제안: 선택적 개선. 차단 사유 아님.

- **[INFO]** `redriveStuckExecution` 의 라우팅 컨텍스트 재등록(`registerExecutionRouting`) best-effort 분기는 case B 전용 unit 으로 직접 검증되지 않음
  - 위치: `execution-engine.service.ts` `redriveStuckExecution` 내 `if (savedExecution.triggerId && savedExecution.workflowId) { try { ... registerExecutionRouting ... } catch {...} }`, `execution-engine.service.spec.ts` `redriveStuckExecution (PR3 case B)` describe
  - 상세: 이 로직은 case A(`driveResumeAwaited`)와 동일 패턴을 재사용하며, 프로젝트 전체적으로 `registerExecutionRouting` 호출 패턴 자체는 다른 describe 블록들(L3011 등)에서 이미 광범위하게 검증된다. case B 전용 mock(`mockExecutionRepo.findOneBy` 반환 객체)에는 `triggerId`/`workflowId` 가 없어(`wf1`만 존재, `triggerId` 미설정) 이 분기 자체가 case B 테스트에서 실행되지 않는 채로 통과한다. 신규 로직이 아니라 재사용이므로 리스크는 낮음.
  - 제안: 선택적. `redriveStuckExecution` 성공 케이스의 mock execution 에 `triggerId` 를 추가해 `registerExecutionRouting` 호출까지 확인하면 완전성이 높아지나 필수는 아님.

## 회귀 테스트 검증

- 옛 `recoverStuckExecutions` fail-only 동작(`status=FAILED`, `WORKER_HEARTBEAT_TIMEOUT`, 06 C-2 cascade 구조)에 대한 명시적 회귀 가드(`setArg.status`/`error` undefined 검증, `flat` 문자열에 `'failed'`/`'FAILED'`/`'WORKER_HEARTBEAT_TIMEOUT'` 미포함 검증)는 그대로 유지·강화됐고, `WAITING_FOR_INPUT` 배제 가드도 유지됨 — 모두 실행 확인.
- 옛 06 C-2 cascade 테스트(구 `recoverStuckExecutions` 내부에서 cascade FAILED 검증하던 것)는 `failOrphanRunningNodeExecutions` 전용 describe 로 이동해 동등하게 재현됨(`redriveStuckExecution` happy-path 테스트가 `orphanSpy` 호출을 별도 확인).
- 컨트롤러 기존 테스트(13개, `continueExecution`/`stop` 등)는 신규 `runStuckRecoveryScan` mock 추가에도 영향 없이 통과.

## Mock 적절성 / 테스트 격리

- `redriveStuckExecution`/`driveStuckRedrive` 테스트는 인접 private 메서드(`rehydrateContext`, `loadAndBuildGraph`, `markExecutionCancelled`, `runNodeDispatchLoop`, `updateExecutionStatus`, `finalizeResumedExecutionOutcome`, `finalizeRehydrationCleanup`, `eventEmitter.emitExecution`)를 개별 spy 로 격리해 각 유닛의 책임 경계를 명확히 분리 — 과도한 whitebox 성격은 있으나 이 서비스의 기존 테스트 스타일과 일관되고, `afterEach(() => jest.restoreAllMocks())` 로 스파이 누수 방지.
- 컨트롤러 `NODE_ENV`/`E2E_TEST_HOOKS` 환경변수 mutate 테스트는 `afterEach` 원복 처리가 되어 있어 동일 파일 내 후속 테스트(`stop` 등)에 영향 없음 확인.

## 요약

직전 세션에서 지적된 6개 테스트 갭(driveStuckRedrive 3분기, redrive execution-부재, redrive 비-RehydrationError, failOrphan cascade, controller 게이팅 404, skipExecutedNodes 종단검증) 모두 실제 코드 diff 대조와 테스트 실행(345 + 13 tests 전부 통과)으로 해소가 확인됐다. skipExecutedNodes 는 unit 직접화 대신 e2e(완료 row 수 불변 실측)로 대체됐는데, 이는 RESOLUTION 에 근거가 명시돼 있고 실제로 동시성/상태전이 코드는 e2e 필수라는 프로젝트 교훈과도 부합하는 합리적 선택이다. 남은 잔존 항목(개별 redrive 실패 격리 unit 부재, e2e output_data 검증 느슨함, routing 재등록 case B 미검증)은 모두 이번 fix 스코프 밖의 저위험 INFO 로, 신규 회귀나 커버리지 공백을 시사하지 않는다. 전체적으로 테스트 커버리지는 이제 충분한 수준이다.

## 위험도

NONE
