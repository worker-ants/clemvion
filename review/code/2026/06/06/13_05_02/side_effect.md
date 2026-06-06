# 부작용(Side Effect) Review

## 발견사항

### [INFO] `ExecutionContext` 공개 인터페이스에 `_callStack` 필드 추가
- 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` L192–L664 (새 필드)
- 상세: `ExecutionContext` 는 모든 핸들러가 매개변수로 받는 공개 인터페이스다. `_callStack?: ResumeCallStackFrame[]` 추가는 기존 핸들러 코드의 동작에는 영향 없으나(optional), `ExecutionContext` 를 직접 생성/클론하는 테스트 픽스처·mock 이 컴파일 후 새 필드를 인식하지 못할 경우 `as unknown` 캐스팅 없이 타입 단언하면 컴파일 오류가 생길 수 있다.
- 제안: 기존 테스트 픽스처에서 `ExecutionContext` 를 완전 객체 리터럴로 생성하는 위치를 체크하고, 신규 optional 필드 부재가 `strictNullChecks` 환경에서 문제 없는지 확인. (현재 PR 범위 내에서 이미 `as unknown` 패턴으로 처리됨 — 무해.)

### [INFO] `InlineExecutionOptions` 공개 인터페이스에 `invokerNodeId` 필드 추가
- 위치: `codebase/backend/src/nodes/core/workflow-executor.interface.ts` L30–L105
- 상세: `WorkflowExecutor.executeInline` 의 인터페이스 계약에 `invokerNodeId?: string` 이 추가됐다. optional 이므로 기존 호출자(테스트 픽스처 등)는 전달하지 않아도 컴파일 통과. 단, `invokerNodeId` 를 미전달하면 `executeInline` 내부에서 `_callStack` push 를 건너뜀(의도된 동작 — 배경 body 등 비-Workflow-노드 경로). 기존 Workflow 노드 이외의 `executeInline` 호출자(예: Background executor 등)가 이를 의도치 않게 생략할 경우 call-stack 추적이 누락된다.
- 제안: 주의사항 충분히 주석화되어 있음. INFO 수준 — Background body 경로는 spec §3.2 상 blocking 금지라 추적 불필요가 맞다.

### [INFO] `context._callStack` 는 실행 도중 공유 참조로 변이됨
- 위치: `execution-engine.service.ts` — `executeInline` push/pop 패턴 + `driveCallStackResume` 내 `context._callStack = frames.map(f => ({...f}))`
- 상세: `driveCallStackResume` 재진입 시 `context._callStack` 을 `frames.map(f => ({...f}))` 얕은 복사로 교체한다. 이는 이전 call-stack 참조를 덮어쓰는 **의도된 상태 변경**이지만, 동일 `context` 객체를 공유하는 병렬 분기(Parallel executor)가 있다면 교체 시점에 다른 분기가 읽는 `_callStack` 이 바뀔 수 있다. 그러나 spec §3.2 상 컨테이너 body blocking 이 금지돼 있고, `driveCallStackResume` 는 detached 단일 재개 드라이브에서만 호출되므로, 병렬 분기와 충돌하는 실제 경로는 존재하지 않는다.
- 제안: 현 구조 상 안전. `_executedNodes` 와 동일 패턴으로 문서화 유지.

### [INFO] `savedExecution` 객체의 in-place 변이 (outputData, finishedAt, durationMs)
- 위치: `execution-engine.service.ts` — `driveCallStackResume` 내 COMPLETED 마감 블록 (L1184–L1190 기준)
- 상세: `driveCallStackResume` 가 COMPLETED 마감 시 `savedExecution.outputData`, `savedExecution.finishedAt`, `savedExecution.durationMs` 를 **in-place 변이** 후 `save()` 한다. 이 패턴은 기존 `runExecution`/`driveResumeDetached` 의 COMPLETED 마감과 동일한 방식이므로 일관성 있는 의도된 부작용이다.
- 제안: 일관성 확보됨. 특이사항 없음.

### [WARNING] `driveCallStackResume` 는 detached(`.catch`만) 로 호출되어 에러 경계가 in-band 단말 처리뿐
- 위치: `execution-engine.service.ts` — `resumeFromCheckpoint` 내 `driveCallStackResume(...).catch(err => logger.error(...))`
- 상세: `driveCallStackResume` 는 `catch` 핸들러에서 `RehydrationError` → `markExecutionCancelled`, 그 외 → `finalizeResumedExecutionOutcome` 로 단말 처리한다. 그런데 `markExecutionCancelled`/`markNodeExecutionFailed` 자체가 DB I/O를 throw할 수 있고, 그 경우 에러가 `.catch` 체인 밖으로 누출된다. 또한 `finally { this.finalizeRehydrationCleanup(executionId) }` 는 in-memory 상태 정리를 보장하나, DB 마감 실패 시 Execution 이 `RUNNING` 상태로 영원히 잔류할 위험이 있다.
- 제안: `markExecutionCancelled`/`markNodeExecutionFailed` 내부에서 발생하는 2차 예외를 `.catch(secondaryErr => logger.error(...))` 패턴으로 suppress 하거나, 별도 "last-resort" try-catch 로 Execution 을 `FAILED` 로 fallback 마킹하는 방어 로직 추가 검토.

### [INFO] `ParkReleaseSignal extends Error` 는 `instanceof` 판단에 의존
- 위치: `codebase/backend/src/shared/execution-resume/park-release-signal.ts`
- 상세: 복수 컴파일 컨텍스트(예: ts-jest 트랜스파일 경계, bundler 분리)에서 `instanceof` 가 false 를 반환할 수 있는 알려진 JS 패턴이 있다. 현재 프로젝트가 Node.js 단일 런타임에서 NestJS 모듈 방식으로 실행되므로 실질적인 리스크는 없다. `isParkReleaseSignal` 타입 가드가 별도 제공돼 추가 안전망 역할을 한다. 현재 코드는 `instanceof` 를 일관되게 사용 중이며 가드는 활용되지 않는다 — 두 경로 중 하나로 통일하는 것이 바람직하다.
- 제안: INFO 수준. 필요 시 `err.name === 'ParkReleaseSignal'` 폴백을 `isParkReleaseSignal` 가드 내에 추가해 두면 미래 번들 경계 이슈를 방어할 수 있다.

### [INFO] `fireNested` 의 `setTimeout` 폴링은 최대 5초 동안 in-memory 타이머를 유지
- 위치: `execution-engine.service.ts` — `resumeFromCheckpoint` 내 `fireNested` 클로저 (NESTED_FIRE_MAX_ATTEMPTS=250, NESTED_FIRE_POLL_MS=20ms → 5초)
- 상세: `isAiConversation === false` 인 중첩 form/button 재개 경로에서 `pendingContinuations` 등록을 기다리는 polling 타이머가 최대 250회(5초) 등록된다. 타이머 실행 중 Node.js 프로세스가 graceful shutdown 에 진입하면 이 타이머들이 shutdown 을 지연시킬 수 있다. `ShutdownStateService` 를 통해 shutdown 신호가 도착하면 폴링을 조기 종료하는 가드는 현재 없다.
- 제안: `fireNested` 시작 전 `this.shutdownStateService.isShuttingDown()` 체크를 추가하거나, `attemptsLeft <= 0` 분기와 함께 shutdown 조건도 함께 점검하면 graceful shutdown 신뢰도가 향상된다. (Medium 우선순위)

### [INFO] `driveResumeFrame` 에서 `lastNodeId` 는 graph 의 물리적 마지막 노드 기준
- 위치: `execution-engine.service.ts` — `driveResumeFrame` 끝 `const lastNodeId = sortedNodeIds[sortedNodeIds.length - 1]`
- 상세: frame 의 output 을 `sortedNodeIds` 마지막 노드의 `nodeOutputCache` 에서 가져온다. 그런데 실제 그래프 순회 종료 시점에 따라 마지막 실행 노드가 graph 의 물리적 마지막 노드와 다를 수 있다(예: 조건 분기로 중간 종료). 이 경우 `output` 이 `undefined` 가 되고, 상위 `injectInvokerOutput` 이 `{ result: undefined }` 를 주입한다. 기존 `driveResumeDetached` 도 동일 패턴을 사용하므로 의도된 동작으로 보이나, bubble-up 중 출력 유실 케이스가 명시적으로 테스트되지 않았다.
- 제안: 분기 종료 시 실제 실행된 마지막 노드 ID 를 추적해 반환하거나, 현재 방식의 `undefined` output 이 downstream 에서 안전하게 처리됨을 단위 테스트로 보증하는 것을 권장. (INFO 수준)

### [INFO] `snapshotCallStack` 의 얕은 복사는 `recursionDepth` 가 primitive 이므로 안전
- 위치: `execution-engine.service.ts` — `snapshotCallStack` 내 `stack.map(f => ({ workflowId: f.workflowId, invokerNodeId: f.invokerNodeId, recursionDepth: f.recursionDepth }))`
- 상세: 테스트에서 확인된 바(`frames` 레퍼런스 비동일성 검증) 와 같이 frames 를 새 배열로 복사하므로, 이후 `context._callStack.pop()` 변이가 DB 영속 결과에 영향을 미치지 않는다. 의도된 격리가 정확히 구현되어 있다.
- 제안: 특이사항 없음.

---

## 요약

이번 변경(PR-B2b 중간 단계 — call-stack 추적·영속 + `ParkReleaseSignal` unwind + `driveCallStackResume`/`driveResumeFrame` 재개)은 부작용 관점에서 전반적으로 의도된 상태 변경을 명확히 구분하고 있다. `ExecutionContext._callStack` 의 push/pop 은 `executeInline` 의 try-finally 로 스코프가 보장되고, `snapshotCallStack` 의 얕은 복사가 DB 영속 후 in-memory pop 과 격리를 확보한다. `ParkReleaseSignal` 는 `ExecutionCancelledError` 와 동형 전파 패턴으로 각 계층에서 명시적으로 재throw 되어 error-policy 오적용을 방지한다. 주의가 필요한 지점은 (1) `driveCallStackResume` 내 2차 DB 예외가 Execution 을 비단말 상태로 잔류시킬 수 있는 에러 경계 약점, (2) `fireNested` 폴링 타이머가 graceful shutdown 을 최대 5초 지연시킬 수 있는 점이다 — 두 항목 모두 WARNING/INFO 수준이며 현재 기능 정확성을 즉각 훼손하지는 않는다.

---

## 위험도

LOW
