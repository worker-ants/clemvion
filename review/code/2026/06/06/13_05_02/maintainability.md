# 유지보수성(Maintainability) 리뷰

## 발견사항

### [WARNING] `driveCallStackResume` 함수가 과도하게 길고 여러 책임을 담당
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-b2b-04a2f8/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `driveCallStackResume` 메서드 (약 125줄)
- 상세: 이 메서드는 (1) 상태 전이(WAITING → RUNNING), (2) call-stack 복원, (3) innermost frame 처리, (4) bubble-up 루프, (5) top-level forward, (6) COMPLETED 마감, (7) 에러 처리를 모두 담당한다. 각 단계가 독립적인 책임이지만 하나의 메서드에 압축되어 있어, 어느 한 단계를 수정하면 다른 단계에 영향이 생길 위험이 있다.
- 제안: (1) `finalizeExecution(savedExecution, topResult)` 같은 COMPLETED 마감 헬퍼로 추출, (2) bubble-up 루프를 `bubbleUpFrames(frames, ...)` 헬퍼로 분리. `driveResumeDetached`(top-level 단일 frame)와의 구조적 유사성을 명시적으로 공유 헬퍼로 표현하면 이후 변경 시 두 경로가 drift 할 위험이 줄어든다.

### [WARNING] `driveResumeFrame` 내 innermost 분기의 중첩 깊이 과도
- 위치: `driveResumeFrame` 메서드 내 `if (opts.isInnermost)` 블록 — form/button/AI 3분기 + AI 내부 try/catch
- 상세: innermost 처리 분기가 `if/else if/else` 3단 + 그 안에 `try/catch` 를 가져 실질 중첩 깊이가 4~5이다. `'release'` vs `'await'` 파라미터의 이원 동작이 `waitForFormSubmission`/`waitForButtonInteraction` 에 이미 내재화됐음에도, 호출 지점에서 아무 인자 없이 기본값(`'await'`)을 쓰면서 그 의미가 명확하지 않다.
- 제안: innermost 블록을 `handleInnermostFrameTurn(opts, savedExecution, context, graphEdges)` 같은 전용 private 메서드로 추출해 `driveResumeFrame`의 주요 흐름(graph 세팅, pointer 계산, `runNodeDispatchLoop` 호출)이 한눈에 보이게 한다.

### [WARNING] `runNodeDispatchLoop`의 try/catch 로 `ParkReleaseSignal` 흡수 — 에러-흐름 혼재
- 위치: `execution-engine.service.ts` — `runNodeDispatchLoop` 메서드의 `try { while (...) } catch (err)` 블록
- 상세: 기존 `while` 루프를 `try/catch`로 감싸 `ParkReleaseSignal`을 `{ parked: true }` 로 변환하는 방식은 동작하지만, "예외를 제어 흐름으로 사용"하는 패턴이다. 이 패턴이 `executeNode` → `WorkflowHandler` → `executeInline` → `waitForX` 체인 전체에 걸쳐 반복(catch→re-throw 4군데)되어, 흐름을 이해하려면 모든 catch 지점을 순서대로 추적해야 한다. 특히 중첩 Workflow 노드의 `executeNode` catch에서 `ParkReleaseSignal`을 re-throw 하는 코드가 `runNodeDispatchLoop`의 catch에서 또 한 번 흡수되는 이중 처리 구조가 미래 수정자에게 혼란을 줄 수 있다.
- 제안: 이 패턴은 `ExecutionCancelledError`와 동일 전파 관용구임을 JSDoc에 명시하고, `runNodeDispatchLoop`가 `ParkReleaseSignal`을 흡수하는 근거를 한 곳(해당 catch 블록)에 응집된 주석으로 기록한다. 현재 분산된 주석들이 일부 중복 설명을 하고 있어 단일 설명 지점(SoT)을 만들고 나머지 catch에는 짧은 참조만 남기는 것이 바람직하다.

### [INFO] `NESTED_FIRE_MAX_ATTEMPTS` / `NESTED_FIRE_POLL_MS` 매직 넘버 — 상수 분리 양호하나 위치 문제
- 위치: `execution-engine.service.ts` — `resumeFromCheckpoint` 내 `if (!isAiConversation)` 블록
- 상세: `NESTED_FIRE_MAX_ATTEMPTS = 250`, `NESTED_FIRE_POLL_MS = 20`이 메서드 내부 지역 `const`로 선언되어 있다. 의미를 알 수 있어 매직 넘버 문제는 없지만, 동일 상수가 기존 top-level `firePayload` 로직에도 존재할 경우 값 불일치 리스크가 있다. 지역 상수는 메서드 외부에서 검증·공유·조정이 어렵다.
- 제안: 클래스 private static 상수 또는 모듈 상수로 이동(`FIRE_MAX_ATTEMPTS`, `FIRE_POLL_MS_NESTED`)해 기존 `firePayload` 폴링 상수와 값 일관성을 명시적으로 관리한다.

### [INFO] `snapshotCallStack` 메서드 — 명확하고 단일 책임, 양호
- 위치: `execution-engine.service.ts` — `snapshotCallStack` private 메서드 (10줄)
- 상세: 분리 자체가 잘 되어 있고, frames 얕은 복사(map + 명시적 필드 열거) 의도가 JSDoc에 명확히 기술되어 있다. 호출 지점(`stageDurableResumeSnapshot`)도 단순 위임이라 가독성이 높다.
- 제안: 없음.

### [INFO] `injectInvokerOutput` — `contextKeyOf(context)` 중복 호출
- 위치: `execution-engine.service.ts` — `injectInvokerOutput` 메서드 (15줄)
- 상세: `this.contextKeyOf(context)`를 두 줄 연속으로 호출한다. 결과가 동일하므로 기능 문제는 없으나, 지역 변수로 한 번만 계산하면 의도가 더 명확하다.
- 제안:
  ```ts
  const ctxKey = this.contextKeyOf(context);
  this.contextService.setStructuredOutput(ctxKey, invokerNode.id, structured);
  this.contextService.setNodeOutput(ctxKey, invokerNode.id, toEngineFlatShape(structured));
  ```

### [INFO] `driveCallStackResume`의 `opts` 객체 — 필드 8개로 인터페이스 미분리
- 위치: `execution-engine.service.ts` — `driveCallStackResume` 메서드 시그니처
- 상세: 인라인 `opts` 타입에 8개 필드가 들어있다. `driveResumeFrame`의 opts도 9개 필드로 유사하다. 두 메서드 모두 private이므로 당장의 외부 영향은 없지만, 필드가 추가될 때마다 두 곳에서 동기화가 필요하다.
- 제안: `DriveCallStackResumeOptions`, `DriveResumeFrameOptions` 인터페이스를 파일 상단에 정의하면 시그니처 가독성과 IDE 지원이 개선된다.

### [INFO] 테스트 파일 — `(context as { _callStack: unknown[] })._callStack` 타입 캐스팅 반복
- 위치: `execution-engine.service.spec.ts` — `stageDurableResumeSnapshot` 테스트 블록
- 상세: `(exNoStack as { resumeCallStack: unknown }).resumeCallStack`, `(exEmpty as { resumeCallStack: unknown }).resumeCallStack`, `(context as { _callStack: unknown[] })._callStack` 형태의 인라인 타입 캐스팅이 반복된다. 테스트 내에서만 쓰이는 헬퍼 타입이지만 패턴 반복이 3회 이상이다.
- 제안: 테스트 파일 내 짧은 타입 헬퍼(`type TestExecution = { resumeCallStack: unknown }`)를 선언해 반복 캐스팅을 줄인다.

### [INFO] `ParkReleaseSignal` — `isParkReleaseSignal` 타입 가드 미사용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-b2b-04a2f8/codebase/backend/src/shared/execution-resume/park-release-signal.ts`
- 상세: `isParkReleaseSignal` 타입 가드 함수가 export되어 있으나, 실제 서비스 코드에서는 모두 `err instanceof ParkReleaseSignal` 패턴을 직접 사용한다. 가드 함수를 내보냈지만 사용되지 않으면 dead export가 된다.
- 제안: (a) 서비스 코드의 `instanceof` 직접 패턴을 `isParkReleaseSignal`로 통일하거나, (b) 실제 사용처가 없다면 `isParkReleaseSignal`을 내부 전용(`/** @internal */`)으로 표시하거나 제거해 모듈 인터페이스를 명확히 한다.

### [INFO] `WorkflowHandler` — catch 블록의 `ParkReleaseSignal` re-throw 코드 중복
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-b2b-04a2f8/codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` — `execute` 메서드 catch 블록
- 상세: `executeInline` 호출 시와 `executeAsync` 호출 시 catch 블록이 분리되어 있고, `ParkReleaseSignal` re-throw는 `executeInline` catch에만 있다. 코드 구조상 맞지만, 나중에 `executeAsync` catch도 수정될 때 `ParkReleaseSignal` 처리가 누락될 수 있다는 오해를 살 수 있다. 주석에 "async 모드에서는 ParkReleaseSignal 불발생"임을 명시하면 혼동이 줄어든다.
- 제안: `executeAsync` catch 블록에 한 줄 주석 추가: `// ParkReleaseSignal 은 sync inline 전용 — async 모드는 별도 Execution 으로 park 불발생.`

---

## 요약

전반적으로 이번 변경(PR-B2b — 중첩 sub-workflow durable park + call-stack 추적)은 복잡한 기능을 적절히 캡슐화된 메서드들로 분해하고 있으며, 상수·타입·JSDoc 주석의 품질도 양호하다. 주요 유지보수성 우려는 두 가지다: 첫째, `driveCallStackResume`(125줄)가 6단계 이상의 책임을 단일 메서드에 보유해 수정 시 회귀 추적이 어렵고, 둘째, `ParkReleaseSignal`의 catch→re-throw 전파 체인이 4군데에 분산되어 흐름 파악에 전체 파일 스캔이 필요하다. 두 문제 모두 현재 동작에는 영향이 없으나, full B3 제거(pendingContinuations·barriers·detached 등 대규모 삭제) 단계에서 이 메서드들을 수정할 때 변경 표면이 커질 수 있어 주의가 필요하다. 나머지 발견사항(지역 상수 위치, 타입 가드 미사용, 인라인 타입 캐스팅 반복)은 소규모 polish 수준이다.

## 위험도

MEDIUM
