# Cross-Spec 일관성 검토 결과

**검토 모드**: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/4-execution-engine.md, diff-base=origin/main)
**Target**: `spec/5-system/4-execution-engine.md` + 구현 diff (`execution-engine.service.ts`, `execution-engine.service.spec.ts`, `node-handler.interface.ts`)

---

## 발견사항

### 발견사항 1
- **[WARNING]** spec §7.5 / §4.x 구현 상태 배너가 "PR-B2 후속 커밋에서 구현 예정" 으로 남아 있으나, 이번 diff 가 이미 구현
  - target 위치: `spec/5-system/4-execution-engine.md` §4.x 구현 메모(line 406), §7.5 구현 상태 note(line 905)
  - 충돌 대상: 구현 diff (`driveCallStackResume`, `driveResumeFrame`, `injectInvokerOutput`, `stageDurableResumeSnapshot` 확장, `executeInline` park-release, `runNodeDispatchLoop` ParkReleaseSignal catch)
  - 상세: spec §4.x 배너는 "PR-B2b(중첩 sub-workflow D6 + full B3) **미적용**" 으로 선언하고, §7.5 note 는 "재귀 재진입 로직·park 시 call-stack stage 는 PR-B2 후속 커밋에서 구현" 으로 적혀 있다. 그러나 이번 diff 가 정확히 그 로직을 구현했다: `driveCallStackResume`(§7.5 재귀 재진입), `stageDurableResumeSnapshot` 의 `snapshotCallStack`(park 시 stage), `executeInline` 의 `waitForX('release')` + `ParkReleaseSignal` throw (park-release). plan의 `exec-park-durable-resume.md §PR-B2b 진행 상태` 에도 8a/8c/8d 가 체크된 것이 확인된다. spec 의 "미구현" 표식이 구현 사실을 반영하지 못해 spec-impl 사이에 단방향 불일치가 생겼다.
  - 제안: `spec/5-system/4-execution-engine.md` §4.x 배너("PR-B2b 미적용" → 적용 완료) + §7.5 구현 상태 note("PR-B2 후속 커밋에서 구현" → 구현 완료) 를 완료형으로 갱신. plan `exec-park-durable-resume.md §PR-B2b 진행 상태` 의 남은 체크리스트("spec flip") 항목 수행. project-planner 위임.

### 발견사항 2
- **[WARNING]** `ExecutionContext._callStack` 필드가 `spec/conventions/execution-context.md` 원칙 4 목록에 미등록
  - target 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` 에 `_callStack?: ResumeCallStackFrame[]` 추가 (diff)
  - 충돌 대상: `spec/conventions/execution-context.md` §원칙 4 선례 목록(line 59): `_executedNodes`, `_resumeState`, `_retryState`, `_contextKey`
  - 상세: 원칙 4 는 "핸들러가 읽지 않고 엔진 순회·라우팅에만 쓰이는 상태는 `_`-prefix 엔진 내부 필드" 로 두는 규약이며, 기존 예시를 선례로 열거한다. `_callStack` 은 이 규약에 완전히 부합하는 신규 필드이나(핸들러 비소비, exec-park D6 내부 추적용), 선례 목록에 등록되지 않아 spec 의 정보가 불완전하다. 직접 모순은 아니나, 다음 필드 추가자가 원칙 4 적용 범위를 오해할 소지가 있다.
  - 제안: `spec/conventions/execution-context.md` §원칙 4 선례 목록에 `_callStack` 추가(exec-park D6 중첩 호출 체인 추적, `resume-call-stack.types.ts`). project-planner 위임.

### 발견사항 3
- **[WARNING]** `spec/1-data-model.md §2.13 Execution` 의 `resume_call_stack` 컬럼 행 구현 상태 표식이 아직 "설계 확정, park stage·재귀 재진입 로직 구현 예정" 수준
  - target 위치: `spec/1-data-model.md` line 467 (`resume_call_stack` 컬럼 행)
  - 충돌 대상: 구현 diff — `stageDurableResumeSnapshot` 내 `snapshotCallStack` 이 `Execution.resume_call_stack` 에 실제로 write, `resumeFromCheckpoint` 가 읽어 `driveCallStackResume` 분기
  - 상세: `spec/1-data-model.md` 의 `resume_call_stack` 행은 컬럼 정의 자체는 정확하나, 해당 컬럼이 이미 이번 diff 로 실제 park 시 stage/read 가 구현됐음을 반영하지 않는다. `plan/exec-park-durable-resume.md` L211 도 "spec flip(남음)" 으로 명시해 spec 갱신이 후행 단계임을 인정하고 있다.
  - 제안: `spec/1-data-model.md §2.13` `resume_call_stack` 컬럼 설명의 구현 상태 보조 주석("V087·타입·`CALL_STACK_SCHEMA_VERSION` 영속 매체는 추가됨 = 설계 확정. park 시 stage 와 §7.5 재귀 재진입 로직은 PR-B2 후속 커밋에서 구현") 을 완료형으로 갱신. project-planner 위임.

### 발견사항 4
- **[INFO]** `spec/5-system/4-execution-engine.md` §7.4 Worker 동작 행의 `pendingContinuations` in-memory 머신 잠정 잔존 서술이 이번 diff 의 실제 동작과 부분적으로 불일치
  - target 위치: `spec/5-system/4-execution-engine.md` §7.4 Worker 동작 (line ~829)
  - 충돌 대상: 구현 diff 중 `resumeFromCheckpoint` 가 `callStack != null` 시 `setTimeout(fireNested, ...)` 로 `pendingContinuations`에 여전히 의존하는 것(중첩 form/button firePayload 경로)
  - 상세: 이번 diff 는 중첩 sub-workflow blocking 을 `driveCallStackResume` 경로로 구현했지만, plan `exec-park-durable-resume.md §PR-B2b 진행 상태` 에서 "full B3 제거(남음)" 로 명시한 것처럼 `pendingContinuations`/`firePayload` 는 아직 잔존한다. spec §7.4 Worker 동작 행의 "worker-side fast-path 제거" 서술은 B3 완료 시점 기준으로 기술된 최종 상태다. 현재 구현은 중간 상태이므로 spec 과 일치하지 않는 부분이 있으나, plan 에 명시된 의도된 과도기다. 직접 모순은 아니나 spec 독자에게 혼동을 줄 수 있다.
  - 제안: spec flip(B3 완료 후) 시 §7.4 Worker 동작 행을 갱신. 현재는 plan `exec-park-durable-resume.md §PR-B2b 진행 상태`의 "spec flip(남음)" 항목으로 이미 추적 중이므로 추가 조치 불요.

### 발견사항 5
- **[INFO]** `spec/5-system/4-execution-engine.md` §7.5 중첩 재개 절차 step 2 "executedNodes DB(execution_node_log)에서 seed" 서술과 실제 구현의 차이
  - target 위치: `spec/5-system/4-execution-engine.md` §7.5 line 910 ("각 프레임의 이미 완료된 노드는 `execution_node_log` 에서 seed 해 미재실행")
  - 충돌 대상: 구현 diff `driveResumeFrame` — `opts.executedNodes` 를 caller(`driveCallStackResume`) 가 누적해서 전달, DB seed 없이 `for (const nid of opts.executedNodes) reachable.add(nid)` 로 직접 주입
  - 상세: spec §7.5 는 "각 프레임의 이미 완료된 노드는 `execution_node_log` (같은 executionId 타임라인)에서 seed" 라고 명시한다. 실제 구현은 in-memory `executedNodes` Set 을 bubble-up 루프에서 누적 전달한다. 동일 Execution 내에서 `executedNodes` 가 완전히 유지되는 전제라면 등가이나, crash-restart 후 `driveCallStackResume` 로 진입하는 경우 `executedNodes` 가 새 context 에서 빈 Set 으로 시작해 완료 노드가 재실행될 수 있다. plan 에서도 "각 프레임 executedNodes 를 DB(execution_node_log)에서 seed" 를 설계 요소로 언급(L123)하지만 이번 diff 에는 미구현이다.
  - 제안: 추후 spec에서 "DB seed vs in-memory누적 중 어느 쪽이 SoT인가"를 명확히 결정. 현 구현(in-memory 누적)이 crash-restart 시나리오에서 완료 노드 재실행을 야기할 수 있는지 별도 검토 권장. spec 수정 전 plan `exec-park-durable-resume.md` 에 이 갭을 todo 항목으로 기록 권장. 현재 `full B3 제거` 단계에서 재검토 필요.

---

## 요약

이번 PR-B2b diff 는 `spec/5-system/4-execution-engine.md` 의 exec-park D6 설계안(`driveCallStackResume`, `driveResumeFrame`, `injectInvokerOutput`, `executeInline` park-release, `stageDurableResumeSnapshot` 확장)을 충실히 구현했다. 데이터 모델(`Execution.resume_call_stack` V087), API 계약(`CALL_STACK_SCHEMA_VERSION` 버전 가드), 상태 전이(`WAITING_FOR_INPUT → RUNNING → COMPLETED/park`) 모두 spec 정의와 일치한다. 주된 불일치는 spec 의 구현 상태 표식이 아직 "미구현/예정" 으로 남아 실제 구현 완료를 반영하지 않는 **spec-behind-impl** 상황이며, 이는 plan `exec-park-durable-resume.md`의 "spec flip(남음, project-planner)" 항목으로 이미 추적 중이다. `ExecutionContext._callStack` 필드가 conventions/execution-context.md 원칙 4 목록에 미등록된 점과, spec §7.5 의 "executedNodes DB seed" 서술과 실제 in-memory 누적 구현의 잠재적 차이(crash-restart 완전성)가 주목할 WARNING이다.

---

## 위험도

LOW
