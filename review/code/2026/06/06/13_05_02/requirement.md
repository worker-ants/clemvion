# 요구사항(Requirement) Review — exec-park PR-B2b (D6 call-stack stage + nested resume)

**대상 파일**: execution-engine.service.ts, execution-engine.service.spec.ts, node-handler.interface.ts, workflow-executor.interface.ts, workflow.handler.ts, park-release-signal.ts, plan/in-progress/exec-park-durable-resume.md

---

## 발견사항

### [INFO] [SPEC-DRIFT] spec §7.5 step 2 — "execution_node_log DB seed" vs 구현의 in-memory `executedNodes` 재사용
- **위치**: `driveResumeFrame` (L2414–2420), spec §7.5 step 2
- **상세**: spec §7.5 재귀 재진입 step 2 는 "각 프레임의 이미 완료된 노드는 `execution_node_log`에서 seed 해 미재실행" 이라 기술한다. 그러나 구현은 `driveCallStackResume` 가 `context._executedNodes`(이미 `rehydrateContext` 에서 `execution_node_log` 로 채워진 Set)를 그대로 `driveResumeFrame` 에 전달해 `reachable` 에 합산한다. 이는 DB를 직접 재조회하지 않고 이미 rehydrate 단계에서 채워진 Set 를 전달하는 방식으로, 기능적으로 동등하다 — `rehydrateContext` 가 `execution_node_log` 기반으로 Set 을 구성하므로. 단 spec 문면은 "각 프레임별" DB seed 를 암시하는 반면, 코드는 실행 전체에 걸쳐 단일 Set 을 공유한다.
- **제안**: 코드 유지. spec §7.5 step 2 의 "각 프레임의 이미 완료된 노드는 `execution_node_log`에서 seed 해" 문구를 "rehydrate 단계에서 execution_node_log 를 통해 구성된 `_executedNodes` Set 를 공유한다"로 보다 정확하게 기술 → spec 갱신(project-planner). (`spec/5-system/4-execution-engine.md §7.5 step 2`)

### [WARNING] `driveCallStackResume` 가 detached + `.catch()` 로 호출됨 — 에러 가시성 저하
- **위치**: `resumeFromCheckpoint` L1860–1876 (diff L999–1056), `driveCallStackResume` L2257–2202
- **상세**: `resumeFromCheckpoint` 는 `this.driveCallStackResume(…).catch(err => logger.error(…))` 로 detached 호출한다. 이는 top-level `driveResumeDetached` 와 동일한 패턴으로, worker 에 에러를 전파할 수 없어 in-band 단말 처리(markExecutionCancelled)가 내부에서 이루어진다. 그러나 `driveCallStackResume` catch 블록이 이미 `markExecutionCancelled` 와 `markNodeExecutionFailed` 를 호출하고 있어 에러 처리가 두 곳으로 분산된다. 특히, detach 후 `resumeFromCheckpoint` 는 즉시 반환하므로, 중첩 재개 에러가 발생해도 caller(worker)는 성공으로 인식한다. 이는 plan 에서 의도된 동작("detach 호출 — 에러를 worker 로 전파할 수 없어 in-band 단말 처리")이나 `driveResumeDetached` 와 동일 패턴임을 명확히 해야 한다.
- **제안**: 현재는 plan 명시 의도. `driveCallStackResume` 가 `markExecutionCancelled` 를 올바르게 호출하는지 추가 단위 테스트(RehydrationError 경로)를 권장한다. 현재 테스트는 stage 2건만 신규 추가됐고, `driveCallStackResume`/`driveResumeFrame` 의 에러 경로를 커버하는 테스트가 없다.

### [WARNING] `fireNested` polling 메커니즘 — form/button 중첩 재개 시 `pendingContinuations` 등록 경쟁 조건
- **위치**: `resumeFromCheckpoint` L1842–1858 (diff ~L1021–1038)
- **상세**: form/button 중첩 재개 시, `driveCallStackResume` 가 비동기 detach 로 시작하기 전에 `fireNested` polling (`setTimeout` 250×20ms = 최대 5초)을 `setTimeout(0)` 으로 arm 한다. 이 polling 은 `pendingContinuations` 에 entry 가 생길 때까지 대기하며, `driveResumeFrame` 의 `waitForFormSubmission('await')` 가 pending 을 등록해야 resolve 된다. 이 패턴은 in-memory 의존(`pendingContinuations`)을 유지하는 "B3 전" 과도기 설계로 plan 에 명시돼 있다. 그러나 5초(250×20ms) 한도 내에서 `waitForFormSubmission` 가 pending 을 등록하지 않으면 payload 가 silently drop 되고(`logger.warn`만 남김), execution 이 영구 RUNNING 상태로 잔류한다.
- **제안**: 현재는 B3 제거 전 의도된 과도기 설계. 그러나 polling 한도 초과 시 RUNNING 잔류 문제는 monitoring/알람 부재 — `logger.warn` 후 execution 을 `RESUME_FAILED` 로 마킹하거나, B3 완료 시 이 경로를 완전히 제거하는 방향을 추천. B3 제거 전까지 **알려진 한계**로 주석 보강 권장.

### [WARNING] `driveCallStackResume`: `frames.length === 0` 방어 코드 미존재
- **위치**: `driveCallStackResume` L2259–2268 (diff ~L1092–1101)
- **상세**: 호출 직전 `resumeFromCheckpoint` 에서 `callStack.frames.length` 가 truthy 일 때만 진입하므로 정상 경로에서는 `frames.length === 0` 이 불가하다. 그러나 `driveCallStackResume` 자체는 `frames[frames.length - 1]` (innermost) 를 바로 읽으며, 가드 없이 undefined 접근이 가능하다. 현재 호출 계약상 안전하나, 함수 시그니처가 `frames` 의 비어있지 않음을 요구하는 점이 명시되지 않아 향후 오용 가능.
- **제안**: `if (!frames.length) throw new RehydrationError('RESUME_CHECKPOINT_MISSING', 'resume_call_stack frames is empty')` 방어 가드 추가.

### [INFO] `WorkflowHandler.invokerNodeId` 가 `context.nodeId`(optional) 에 의존
- **위치**: `workflow.handler.ts` L161, `node-handler.interface.ts` L1683
- **상세**: `context.nodeId` 는 `string | undefined`(핸들러 직접 unit test 용 생략 허용). `WorkflowHandler` 가 `invokerNodeId: context.nodeId` 로 전달하면 엔진이 `options.invokerNodeId !== undefined` 로 push 여부를 결정하므로, `nodeId` 미주입 환경에서는 callStack frame push 가 silent skip 된다. 프로덕션에서는 `executeNode` 가 항상 `context.nodeId` 를 주입하므로 문제 없으나, 통합 테스트에서 `nodeId` 누락 시 call-stack 이 영속되지 않아 재개 불가 케이스가 silent 하게 발생할 수 있다.
- **제안**: `WorkflowHandler` 에 `if (!context.nodeId) throw new Error('invokerNodeId(context.nodeId) missing — call-stack push 불가')` 방어 추가 또는 테스트 fixture 에 `nodeId` 항상 주입 가이드 문서화.

### [INFO] [SPEC-DRIFT] spec §7.5 "재귀 재진입" 서술 vs 구현의 "frame-by-frame pointer 기반"
- **위치**: spec §7.5 step 2 ("executeInline 재호출"), 구현 `driveCallStackResume` + `driveResumeFrame`
- **상세**: spec step 2 는 "각 프레임의 invokerNodeId까지 전진한 뒤 executeInline 을 재호출해 해당 sub-workflow 프레임으로 내려간다"고 기술한다. 그러나 구현은 `executeInline` 을 재호출하지 않고, `driveResumeFrame` 이 각 프레임의 그래프를 `loadAndBuildGraph + runNodeDispatchLoop` 로 직접 구동한다. 이는 spec 의 "executeInline 재호출" 보다 효율적·안전한 구현(executeInline 재호출 시 call-stack push 가 다시 발생하는 re-entrancy 문제를 회피)이다. spec 이 구현 수단("executeInline 재호출")을 의도보다 구체적으로 기술한 케이스.
- **제안**: 코드 유지. spec §7.5 step 2 의 "executeInline 을 재호출해" 문구를 "해당 sub-workflow 의 그래프를 직접 구동해(driveResumeFrame)"로 갱신 → spec 갱신(project-planner). (`spec/5-system/4-execution-engine.md §7.5 step 2`)

### [INFO] `ParkReleaseSignal` re-throw 경로의 테스트 커버리지 부재
- **위치**: `workflow.handler.ts` catch, `execution-engine.service.ts` `executeNode` catch(L7562), `runExecution` catch(L3993), `runNodeDispatchLoop` catch(L987–991)
- **상세**: `ParkReleaseSignal` 의 re-throw chain (`WorkflowHandler → executeNode → runExecution/runNodeDispatchLoop`) 은 unit 테스트에서 커버되지 않는다. `workflow.handler.spec.ts` 에 `ParkReleaseSignal` 관련 테스트 케이스가 없고, `execution-engine.service.spec.ts` 신규 추가 2건은 `stageDurableResumeSnapshot` 만 검증한다. plan 에 "dockerized e2e(남음)"로 기록돼 있어 E2E 검증 예정이나, 현재 단위 수준에서 gap 이 있다.
- **제안**: `workflow.handler.spec.ts` 에 "executeInline 이 ParkReleaseSignal throw 시 re-throw 하는지", `execution-engine.service.spec.ts` 에 "중첩 blocking 노드 park 시 `runNodeDispatchLoop` 가 `{parked: true}` 반환하는지" 단위 테스트 추가.

### [INFO] `snapshotCallStack` 의 shallow copy — 중첩 frame 객체의 깊은 field 변이 위험 없음
- **위치**: `snapshotCallStack` (L9605–9616, diff ~L9502–9515), 테스트 L88–91
- **상세**: `stack.map((f) => ({ workflowId: f.workflowId, invokerNodeId: f.invokerNodeId, recursionDepth: f.recursionDepth }))` 는 각 frame 의 3개 primitive 필드를 명시 복사하므로 사실상 deep copy 와 동등하다(모두 `string | number`). 테스트의 `not.toBe(context._callStack)` 검증도 올바르다.

### [INFO] spec §7.5 step 3 "inner 그래프 완료 시 프레임을 pop" 서술 vs 구현
- **위치**: spec §7.5 step 3, `driveCallStackResume` bubble-up loop
- **상세**: spec 은 "inner 그래프 완료 시 프레임을 pop 해 부모 그래프를 잇고" 라 표현하나, 구현에서는 실제 배열 pop 없이 `frames.slice(0, i+1)` 로 context._callStack 을 갱신하며 순회한다. 의미는 동일하나 "pop" 이라는 용어가 다를 뿐이다. spec 문면의 "pop" 이 자료구조 pop 을 강제하는 것은 아니므로 구현이 틀린 것은 아니나, spec 독자가 혼동할 수 있다.

---

## 요약

PR-B2b(exec-park D6) 의 핵심 기능인 (1) `stageDurableResumeSnapshot` 의 call-stack 영속, (2) `context._callStack` push/pop 추적, (3) `ParkReleaseSignal` throw 전파, (4) `driveCallStackResume` + `driveResumeFrame` 의 frame-by-frame 재진입, (5) `injectInvokerOutput` 의 `output.result` wrapping 은 plan §PR-B2b 구현 설계 명세와 부합하며 기능적으로 완전하다. spec §7.5 의 "재귀 재진입" 절차와 버전 가드·에러 코드(`RESUME_INCOMPATIBLE_STATE`/`RESUME_CHECKPOINT_MISSING`)도 코드와 일치한다. 주요 우려사항은 (a) form/button 중첩 재개 시 `fireNested` polling 5초 한도 초과 시 execution 이 RUNNING 잔류하는 silent failure 가능성(B3 완료 전까지 알려진 과도기 한계), (b) `driveCallStackResume`의 `frames.length === 0` 방어 부재, (c) `ParkReleaseSignal` re-throw chain 의 단위 테스트 부재이다. spec fidelity 관점에서는 코드가 spec 의 의도보다 개선된 구현(executeInline 재호출 대신 직접 구동, DB 재조회 대신 in-memory Set 재사용)을 채택한 SPEC-DRIFT 2건이 확인되며, spec 갱신이 필요하다.

## 위험도

MEDIUM

---

*관련 spec 문서*:
- `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` §7.5 (step 2, step 3)
- `/Volumes/project/private/clemvion/spec/1-data-model.md` §2.13 (resume_call_stack 컬럼)
- `/Volumes/project/private/clemvion/plan/in-progress/exec-park-durable-resume.md` §PR-B2b 구현 설계
