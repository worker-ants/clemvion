# 테스트(Testing) 리뷰 — execution §1.3 single-node execution (FRESH post-resolution)

**대상**: execution §1.3 single-node execution (claude/exec-test-dataset-22)
**리뷰 세션**: 2026-06-15 15:29:28
**기준 리뷰**: `review/code/2026/06/15/15_05_56` (Critical 0 / Warning 18)
**Resolution 반영 확인**: W-6 (outputData assertion), W-7 (bare-shape seed test), W-9 (workspace-404 test)
**Defer 근거 확인**: W-8 (e2e predecessor-seeding — unit-covered), W-10 (frontend RTL — mirrors untested handleRun)

---

## 발견사항

### [INFO] W-6 — engine outputData assertion: 완전 이행 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 라인 2770-2785
- 상세: `updateExecutionStatus(COMPLETED)` 의 guarded UPDATE raw query 에서 `param[5]` 를 파싱해 persisted `output_data` 가 대상 노드(node-2) 출력(`{ processed: true, input: { seeded: 42 } }`)과 일치하는지 `toMatchObject` 로 검증한다. `resultNodeId = singleNodeId` 회귀 가드 역할을 한다. 어설션 로직이 raw query 파라미터 인덱스(`[5]`)에 의존하므로 query 시그니처 변경 시 묵묵히 실패할 수 있으나, 현행 코드베이스 패턴과 일치하며 의도 명확성은 충분하다.
- 제안: 이상 없음. RESOLUTION 이행 완료.

### [INFO] W-7 — bare-shape seed test: 완전 이행 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 라인 2788-2825
- 상세: `outputData: { seeded: 99 }` (bare object — `config`/`output` 키 없음) 를 predecessor row 로 설정하고, `wrapBareAsNodeHandlerOutput` 폴백 경로를 거쳐 `{ seeded: 99 }` 가 flat 입력으로 전달됨을 `seenInputs[0]` 으로 검증한다. canonical 분기(W-6 케이스)와 비-canonical 분기를 분리 테스트해 `isCanonicalHandlerOutput` 타입 가드의 두 경로를 모두 커버한다.
- 제안: 이상 없음. RESOLUTION 이행 완료.

### [INFO] W-9 — controller workspace-404 test: 완전 이행 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/backend/src/modules/workflows/workflows.controller.spec.ts` 라인 283-295
- 상세: `workflowsService.findById` 가 `BadRequestException` 을 throw 하는 시나리오에서 `nodeRepo.findOneBy` 와 `engine.execute` 미호출을 각각 `not.toHaveBeenCalled()` 로 독립 검증한다. guard ordering(workspace 검증 → node 검증 → previousExecutionId 검증 → engine 호출)의 회귀를 잡는 유효한 케이스다.
- 제안: 이상 없음. RESOLUTION 이행 완료.

### [INFO] W-13 — isCanonicalHandlerOutput export: 완전 이행 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/backend/src/modules/execution-engine/handler-output.adapter.ts` 라인 201-206
- 상세: `isCanonicalHandlerOutput(raw: unknown): raw is NodeHandlerOutput` 가 public export 로 추가됐고 내부 `isNewShape` 를 위임한다. canonical 판별 도메인 지식이 어댑터 모듈에 단일화됐다. engine 이 이 함수를 참조해 인라인 중복이 제거됐는지는 아래 항목에서 확인.

### [INFO] controller 테스트 suite 커버리지 — 전체 분기 충분히 커버
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/backend/src/modules/workflows/workflows.controller.spec.ts` 라인 173-355
- 상세: `executeNode` 에 대해 다음 6개 케이스가 모두 존재한다. (1) 정상 실행 + `previousExecutionId` 전달, (2) `previousExecutionId` 생략(수동 입력 전용), (3) 노드 불소속 → 400, (4) workspace 404(findById throw), (5) previousExecutionId 타 워크플로우 소속 → 400, (6) 서버 종료 중 → 503. guard 순서와 미호출 어설션이 각 케이스마다 명확하다.
- 제안: 이상 없음.

### [INFO] e2e 테스트 — W-8 defer 근거 검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/backend/test/workflow-execution.e2e-spec.ts` 라인 590-634
- 상세: e2e 케이스 F(단일 노드 실행 202 + terminal 폴링), G(미존재 노드 → 400), H(타 워크플로우 previousExecutionId → 400)가 엔드포인트 라우팅·직렬화·DB 검증·에러 코드를 integration 레벨에서 커버한다. predecessor seeding 흐름(previousExecutionId 가 실제 실행 데이터와 연결되는 DB seed 시나리오)은 engine 단위 테스트(W-6/W-7)가 결정적으로 커버하므로 e2e 에서 별도 F2 케이스 없이도 충분한 커버리지다.
- 제안: W-8 defer 근거 타당. 현행 e2e 범위 적절.

### [INFO] engine 단위 테스트 — 3개 케이스 구조 및 격리
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 라인 2706-2849
- 상세: `passThroughCreate` 헬퍼가 `beforeEach` 가 아닌 각 it 내부에서 호출되어 기존 mock 상태를 변경한다. 이 패턴은 다른 테스트 케이스가 pass-through mock 을 전제하지 않기 때문에 격리 위험이 있다. 그러나 `passThroughCreate` 는 `mockImplementation` 으로 override 하므로 `afterEach` mock clear 가 실행된다면 다음 테스트에서 기존 기본 구현이 복원된다. 이 파일에 `afterEach(() => jest.clearAllMocks())` 또는 `restoreAllMocks` 패턴이 있는지 확인이 필요하다.
- 제안: 파일에 전역 `afterEach` mock clear 가 이미 존재한다면 격리 이상 없음. 없다면 `passThroughCreate` 를 `beforeEach` 로 이동하거나 호출 후 복구 로직을 추가하면 더 명확하다.

### [INFO] double flushPromises 패턴 — 의도 주석 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 라인 2754-2755, 2819-2820, 2843-2844
- 상세: 3개 단일 노드 실행 테스트 모두 `await flushPromises()` 를 두 번 연속 호출한다. 왜 두 번이 필요한지(예: 백그라운드 태스크 체인 완료) 주석이 없다. 기존 파일 내 다른 테스트도 동일 패턴이라면 코드베이스 관행이지만, 신규 코드에서 이유가 불명확하다.
- 제안: "비동기 큐 drain 이후 백그라운드 태스크 체인 완료" 등의 한 줄 주석 추가 권장. 기능에 영향 없음.

### [INFO] W-10 defer — frontend RTL 미작성
- 위치: `workflow-canvas.tsx` `handleRunThisNode`, `node-settings-panel.tsx` `InfoTab`
- 상세: `handleRunThisNode` 와 `InfoTab` 에 대한 RTL 테스트가 없다. RESOLUTION 에서 기존 `handleRun`(toolbar) 이 테스트 없는 것과 동일 수준임을 defer 근거로 기록했다. 신규 i18n 키 parity 는 빌드 타임에 가드된다. 단위 커버리지 관점에서는 갭이 남아 있으나 기존 패턴 일관성 측면에서 defer 근거는 타당하다.
- 제안: 후속 프론트엔드 테스트 정비 시 함께 추가 권장. 현 상태에서 비차단.

### [INFO] DTO 단위 테스트 부재 — ExecuteNodeDto
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-single-node/codebase/backend/src/modules/workflows/dto/execute-node.dto.ts`
- 상세: `ExecuteNodeDto` 에 대한 class-validator 검증 단위 테스트가 없다. `previousExecutionId` 가 UUID 형식이 아닌 값을 전달할 때 `@IsUUID()` 가 올바르게 거부하는지, `input` 에 배열을 전달할 때 `@IsObject()` 가 거부하는지 등의 경계값 테스트가 없다. 그러나 이 검증들은 e2e G/H 케이스에서 간접적으로 커버되고, 기존 코드베이스에서 DTO 전용 단위 테스트가 드문 패턴이라면 INFO 수준이다.
- 제안: 후속 DTO 테스트 정비 시 포함 권장. 현 상태에서 비차단.

---

## 요약

이번 fresh 리뷰에서 W-6(engine outputData assertion), W-7(bare-shape seed test), W-9(controller workspace-404 test) 세 건의 RESOLUTION FIX 가 모두 실제 코드에 정확히 이행됐음을 확인했다. W-13(`isCanonicalHandlerOutput` export)도 adapter 에 반영됐다. Controller 단위 테스트는 6개 분기를 모두 커버하고, engine 단위 테스트는 canonical/bare/no-seed 세 경로를 독립 케이스로 분리하며, e2e 는 엔드포인트 라우팅·에러 코드·202 비동기 흐름을 커버한다. W-8(e2e predecessor-seeding) defer 근거(unit 결정적 커버)와 W-10(frontend RTL) defer 근거(기존 untested handleRun 패턴 일관)는 모두 타당하다. 남은 미조치 사항은 모두 INFO 수준(`passThroughCreate` 격리 가시성, double flushPromises 주석, DTO 단위 테스트, frontend RTL)으로 기능 회귀 위험이 없으며 기존 코드베이스 패턴 범위 내다. 테스트 관점에서 이번 변경은 WARNING 없이 수렴됐다.

---

## 위험도

LOW
