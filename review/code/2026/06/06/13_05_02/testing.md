# 테스트(Testing) Review — exec-park D6 (PR-B2b)

## 발견사항

### [CRITICAL] driveCallStackResume / driveResumeFrame / injectInvokerOutput 전용 단위 테스트 부재
- 위치: `execution-engine.service.spec.ts` 전체
- 상세: PR-B2b 의 핵심 신규 public·private 메서드 3개(`driveCallStackResume`, `driveResumeFrame`, `injectInvokerOutput`)에 대한 독립 단위 테스트가 없다. 현재 추가된 테스트 2건은 `stageDurableResumeSnapshot` + `snapshotCallStack` 직렬화 계층만 검증하며, 실제 frame-by-frame 재진입 로직(최내 frame→bubble-up→top-level COMPLETED 경로)은 단위 수준에서 전혀 커버되지 않는다. `driveCallStackResume`은 400+줄에 달하는 고복잡도 비동기 로직이고, 재개 경로 분기(AI/form/button, parked 조기 반환, COMPLETED 마감, ParkReleaseSignal 방어)가 전부 테스트 사각지대다.
- 제안: `driveCallStackResume`·`driveResumeFrame`의 private 접근을 `as unknown as { ... }` 패턴(기존 spec 파일 내 `ctxSubject()`, `svcAny` 패턴 그대로)으로 노출해 최소 아래 케이스를 커버한다: (1) 단일 depth frame — AI turn 처리 후 COMPLETED; (2) 2-depth frame — bubble-up + invoker output 주입 후 COMPLETED; (3) 최내 frame parked → 즉시 return(parked: true); (4) 외곽 frame parked → 즉시 return; (5) RehydrationError(RESUME_CHECKPOINT_MISSING) — markExecutionCancelled; (6) ParkReleaseSignal 방어(catch 흡수 후 return).

---

### [CRITICAL] resumeFromCheckpoint 의 callStack 분기 — rehydration 경로 테스트 미비
- 위치: `execution-engine.service.spec.ts` `Rehydration — §7.5 Resume after Restart` describe 블록
- 상세: `resumeFromCheckpoint`(= `rehydrateAndResume`)에서 `savedExecution.resumeCallStack`이 non-null일 때 `driveCallStackResume` 분기로 진입하는 경로가 통합 테스트로 검증되지 않는다. 기존 Rehydration 테스트들(`RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`, `processAiResumeTurn` 재진입)은 모두 `resumeCallStack = null`(top-level) 가정하에 작성됐다. call-stack 버전 가드(`callStack.version > CALL_STACK_SCHEMA_VERSION` → `RehydrationError`)도 테스트되지 않는다.
- 제안: `Rehydration — §7.5` 블록 안에 다음 케이스를 추가한다: (a) `savedExecution.resumeCallStack = { version: 1, frames: [{ workflowId: 'sub-wf', invokerNodeId: 'n-wf', recursionDepth: 1 }] }` → `driveCallStackResume` 호출 확인(spyOn); (b) `version: 999`(미래 버전) → `RESUME_INCOMPATIBLE_STATE` 취소 마킹 확인.

---

### [WARNING] WorkflowHandler — ParkReleaseSignal re-throw 케이스 테스트 없음
- 위치: `workflow.handler.spec.ts` `execute - error propagation` describe 블록
- 상세: `workflow.handler.ts`에 추가된 `if (err instanceof ParkReleaseSignal) throw err` 분기는 `workflow.handler.spec.ts`에서 전혀 검증되지 않는다. 현재 spec 파일에 `ParkReleaseSignal` import 조차 없다. 이 분기가 누락되면 `ParkReleaseSignal`이 `buildSubWorkflowError`로 흡수돼 잘못된 error 포트 라우팅이 발생하며, 단위 테스트로 잡을 수 있는 회귀임에도 커버가 없다.
- 제안: `execute - error propagation` 블록에 아래 케이스를 추가한다: `executeInline이 ParkReleaseSignal을 throw할 때 handler가 동일 에러를 re-throw한다(error 포트로 흡수하지 않는다)` — `mockExecutor.executeInline.mockRejectedValue(new ParkReleaseSignal())` 후 `handler.execute()` 가 reject됨을 검증 + 반환값이 `error` 포트 객체가 아님을 확인.

---

### [WARNING] executeInline _callStack push/pop 동작 — 단위 테스트 부재
- 위치: `execution-engine.service.spec.ts` `executeInline — Sub-Workflow parent linking` describe 블록
- 상세: `executeInline`이 `invokerNodeId` 전달 시 `context._callStack`에 frame을 push하고, finally에서 pop하는 동작이 단위 테스트로 검증되지 않는다. 특히 finally pop은 ParkReleaseSignal 전파 경로(예외 unwind)에서도 실행돼야 하는데, 정상 경로·예외 경로 모두 테스트 사각지대다.
- 제안: 기존 `executeInline — Sub-Workflow parent linking` 블록에 추가: (1) `invokerNodeId` 있을 때 `context._callStack`에 정확한 frame이 push됨; (2) 정상 반환 후 `_callStack`이 원상 복원(pop)됨; (3) executeInline 예외 시에도(ParkReleaseSignal 포함) finally pop이 실행됨.

---

### [WARNING] isParkReleaseSignal 타입가드 — 테스트 없음
- 위치: `codebase/backend/src/shared/execution-resume/park-release-signal.ts` / 대응 spec 파일 없음
- 상세: `park-release-signal.ts`에 export된 `isParkReleaseSignal` 타입가드에 대한 unit spec 파일이 없다. 신규 shared 파일에 spec이 전혀 없으며, `ParkReleaseSignal` 생성자의 `name` 설정(`this.name = 'ParkReleaseSignal'`)도 `instanceof` 체인과의 정합성 관점에서 검증되지 않는다.
- 제안: `park-release-signal.spec.ts`를 신설해: (1) `new ParkReleaseSignal() instanceof ParkReleaseSignal === true`; (2) `isParkReleaseSignal(new ParkReleaseSignal()) === true`; (3) `isParkReleaseSignal(new Error()) === false`; (4) `isParkReleaseSignal(null) === false`.

---

### [WARNING] snapshotCallStack — frames 얕은 복사 격리 검증이 단일 케이스에 한정
- 위치: `execution-engine.service.spec.ts` L9804-9808
- 상세: 현재 "frames가 원본 배열과 레퍼런스 분리"를 검증하나, 각 frame 객체 자체의 얕은 복사(frame 내부 필드가 다른 객체 참조인 경우)는 검증되지 않는다. 또한 `CALL_STACK_SCHEMA_VERSION` 상수 변경 시 버전 stamp가 자동으로 갱신되는지 — 즉 테스트가 상수에 의존하지 않고 하드코딩 `1`로 고정돼 상수 drift를 감지하지 못하는 문제가 있다.
- 제안: `toBe(1)` 대신 `toBe(CALL_STACK_SCHEMA_VERSION)`으로 교체해 상수와 stamp 동기화를 자동 검증. frame 객체 얕은 복사 검증(각 frame의 필드 값이 동일하되 객체 레퍼런스가 다름)도 추가.

---

### [INFO] driveResumeFrame의 RehydrationError 엣지케이스 — 커버리지 갭
- 위치: `execution-engine.service.ts` `driveResumeFrame` 메서드 내 `startPointer === undefined` 분기, `buildRetryReentryState` 실패 분기
- 상세: `driveResumeFrame`에서 `sortedIndexMap.get(startNode.id) === undefined` 케이스(`RESUME_CHECKPOINT_MISSING`)와, AI 노드의 `buildRetryReentryState` 실패 시 `RESUME_INCOMPATIBLE_STATE` throw 케이스가 단위 테스트로 커버되지 않는다. 이들은 롤링 배포나 그래프 편집 후 재개 시 실제 발생 가능한 경로다.

---

### [INFO] NESTED_FIRE_MAX_ATTEMPTS polling 로직 — 타이머 기반 단위 테스트 부재
- 위치: `execution-engine.service.ts` L1030-1046 (`fireNested` setTimeout 체인)
- 상세: `driveCallStackResume`의 form/button 중첩 재개 경로에서 `pendingContinuations` 미등록 polling(최대 250회 × 20ms = 5초)이 도입됐으나, 이 polling이 한도 도달 시 warn 로그를 출력하고 조용히 종료되는 동작, 또는 정상 resolve 동작이 테스트되지 않는다. Jest의 `useFakeTimers`로 검증 가능하다.

---

## 요약

이번 PR-B2b는 중첩 sub-workflow blocking park의 durable 영속(`stageDurableResumeSnapshot` + `snapshotCallStack`) 계층에 대해 명확하고 의도를 잘 표현한 2건의 단위 테스트를 추가했으며, 기존 rehydration 테스트들은 top-level 경로에 대해 충분한 커버리지를 유지하고 있다. 그러나 PR의 핵심 신규 로직인 `driveCallStackResume`·`driveResumeFrame`(400+줄, frame-by-frame 재진입)은 단위 테스트가 전혀 없고, `resumeFromCheckpoint`의 callStack 비-null 분기도 통합 수준에서 미커버 상태다. `WorkflowHandler`의 `ParkReleaseSignal` re-throw와 `executeInline`의 callStack push/pop도 테스트 사각지대다. plan에 "full B3 제거·e2e·REVIEW WORKFLOW 남음"으로 명기된 만큼 현 차수가 과도기임을 감안하더라도, D6 재개 핵심 경로의 단위 테스트 부재는 회귀 감지 신뢰성을 현저히 낮춘다.

## 위험도

HIGH
