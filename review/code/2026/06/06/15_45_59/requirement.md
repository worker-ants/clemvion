# 요구사항(Requirement) Review

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/test/execution-park-resume.e2e-spec.ts`
- `plan/in-progress/spec-update-exec-park-d6-rehydration-step2.md` (삭제)
- `spec/1-data-model.md`
- `spec/5-system/4-execution-engine.md`
- `spec/conventions/execution-context.md`

변경 요약: exec-park D6 full B3 — in-memory 머신(`pendingContinuations`, `firstSegmentBarriers`, `firePayload`, `runAiConversationLoop` 장수 루프, detached drive) 완전 제거. 모든 재개가 §7.5 rehydration 단일 경로로 일원화. `waitForX` park-release 일원화 + `processFormResumeTurn`/`processButtonResumeTurn`/`processAiResumeTurn` 직접 처리기 도입.

---

## 발견사항

### [WARNING] [SPEC-DRIFT] §7.5 rehydration 흐름도가 옛 `waitForX() invoke + in-memory resolver` 모델을 기술
- **위치**: `spec/5-system/4-execution-engine.md` §7.5 lines 893-896 (흐름도)
- **상세**: 흐름도 내 두 단계 —
  ```
  ├─ 해당 노드의 waitForX() 메서드를 새로 invoke
  │   (in-memory resolver 등록)
  ├─ 즉시 같은 입력을 resolver() 에 전달
  ```
  — 는 옛 `pendingContinuations` + `firePayload` polling 모델을 묘사한다. full B3 이후 구현은 `driveResumeDetached`/`driveCallStackResume` 이 `processFormResumeTurn`/`processButtonResumeTurn`/`processAiResumeTurn` 를 직접 호출하며, `waitForX` 재호출이나 in-memory resolver 등록은 더 이상 발생하지 않는다. 중첩 재개는 §907 의 `driveCallStackResume` 절에서 이미 업데이트됐으나, top-level 단일-레벨 재개의 흐름도(§893-896)는 낡았다.
- **제안**: 코드 유지 + spec 반영. `spec/5-system/4-execution-engine.md §7.5` 의 흐름도 두 단계를 `driveResumeDetached` 직접 처리기 경로(`processFormResumeTurn`/`processButtonResumeTurn`/`processAiResumeTurn`)로 대체 갱신. `project-planner` 위임.

### [WARNING] [SPEC-DRIFT] spec 상태 전이표·§12.2 "replay 중 cancel → CANCELLED" 서술이 full B3 이후 동작과 불일치
- **위치**: `spec/5-system/4-execution-engine.md` line 64 (상태 전이표 `failed→running` 행) + line 1202 (§12.2 "replay 중 사용자 cancel 도달 시 `cancelled` 로 마감")
- **상세**: spec 은 retry replay(`applyRetryLastTurn`) 중 cancel 이 도달하면 `ExecutionCancelledError` 가 코루틴에 주입돼 Execution 이 CANCELLED 로 마감된다고 명시한다. full B3 에서 `rejectPending` 경로가 제거되면서 `applyCancellation` 은 이제 `cancelParkedExecution` 만 호출한다. `cancelParkedExecution` 의 WHERE 가드는 `status = WAITING_FOR_INPUT` 이므로, RUNNING 상태의 replay 중 cancel 은 `affected:0` 으로 no-op 이 된다 (W9 테스트가 이 새 semantics 를 명시적으로 검증). 이는 spec 서술과 다르다.
- **판단**: 구현이 의도적·합리적 — RUNNING 상태의 execution 에 cancel 을 주입하는 별도 메커니즘이 사라진 대신, cancel 은 다음 park(WAITING 전이) 시점에만 효력을 갖는 clean 상태기계다. W9 테스트 주석이 이 설계를 명확히 정당화한다. 코드를 되돌리는 것이 오답.
- **제안**: 코드 유지 + spec 반영. `spec/5-system/4-execution-engine.md` line 64 상태 전이표 `failed→running` 행의 "replay 중 cancel 도달 시 `cancelled`" 서술과 §12.2 line 1202 의 동일 문구를 full B3 동작(RUNNING 중 cancel = graceful no-op, 다음 park 시점에 효력)으로 갱신. `project-planner` 위임.

### [WARNING] stale 주석 — `rehydrateAndResume` 의 detach/pendingContinuations 언급
- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` lines 1171-1178, 1180-1184
- **상세**:
  - Line 1171-1178: "resumeFromCheckpoint 는 setup 까지만 await 하고 전체 resume 구동을 **detach**" + "Rehydration launched (**drive detached**)" 라고 기술하지만, full B3 이후 `driveResumeDetached` 는 `await` 된다. 로그 메시지 `"Rehydration launched (drive detached)"` 가 misleading.
  - Line 1183: "rehydrateContext 가 생성한 in-memory context / **pendingContinuations** / config 캐시를 여기서 정리한다" — `pendingContinuations` 는 full B3 에서 제거됐으므로 주석에 잔류하면 오해를 유발한다.
- **제안**: 두 주석을 현행 구현에 맞게 정정한다. "drive detached" → "drive awaited" 로 정정, `pendingContinuations` 언급 제거. 로그 메시지도 `"Rehydration launched"` 또는 `"Rehydration completed setup — drive started"` 로 수정 권장.

### [INFO] `driveResumeDetached` 가 이제 await 됐으므로 내부 catch 에서 throw 가 발생하면 outer 로 전파됨
- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `resumeFromCheckpoint` → `driveResumeDetached` await 체인
- **상세**: 이전에는 `driveResumeDetached(...).catch(...)` 로 fire-and-forget 했으므로 내부 catch 에서 다시 throw 되도 `unhandledRejection` 에 그쳤다. 이제 `await` 로 바뀌어, `markExecutionCancelled`·`markNodeExecutionFailed`·`finalizeRehydrationCleanup` 등이 DB 실패로 throw 하면 `rehydrateAndResume` 의 outer catch 가 이를 `RESUME_FAILED` 로 처리하게 된다. 이는 사실상 더 안전한 동작(unhandledRejection 제거)이며, outer catch 의 흐름이 이 경우를 올바르게 처리한다(line 1208-1218). 기능 완전성 관점에서 개선 사항이다.

### [INFO] `driveResumeDetached` 주석 "detached" 이름 vs 실제 await 동작 불일치 (메서드명)
- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 메서드 이름 `driveResumeDetached`
- **상세**: 메서드명 자체가 "Detached" 를 포함하지만 이제 await 된다. 오해 소지는 있으나, 메서드명 변경은 광범위한 리팩토링이 필요하고 기능 자체에 영향은 없다. 기술 부채로 기록.

### [INFO] e2e 테스트의 `resume_call_stack.frames[0].workflowId` 검증 — `subWorkflowId` 참조
- **위치**: `codebase/backend/test/execution-park-resume.e2e-spec.ts` line 2140
- **상세**: `callStack?.frames?.[0]?.workflowId` 를 `subWorkflowId` 와 비교한다. spec §7.5 의 call-stack 구조에서 `frames[0]` 은 outermost frame (= top-level 에서 첫 번째 진입한 sub-workflow 프레임)이고 `frames[frames.length-1]` 이 innermost 다. 이 테스트는 단일 중첩 깊이라 둘이 동일하지만, 다중 중첩 시 `frames[0]`이 subWorkflowId 여야 한다는 가정이 frame 순서에 의존한다. 현재 단일 중첩 케이스에서 정확하다.

### [INFO] `spec-update-exec-park-d6-rehydration-step2.md` 플랜 파일 삭제 — 반영 여부 확인 필요
- **위치**: 삭제된 `plan/in-progress/spec-update-exec-park-d6-rehydration-step2.md`
- **상세**: 이 플랜은 spec §7.5 step 2 의 `executeInline 재호출` vs `driveResumeFrame 직접 구동` SPEC-DRIFT 를 `spec/5-system/4-execution-engine.md §7.5` 에 반영하도록 `project-planner` 에게 위임하는 내용이었다. 현재 diff 를 보면 해당 spec 의 §7.5 step 2(lines 910-915)가 `driveCallStackResume`/`driveResumeFrame` 직접 구동으로 이미 갱신됐으며, Rationale 에 "direct-drive vs executeInline 재호출 (W2 SPEC-DRIFT)" 도 추가됐다. 플랜 삭제가 반영 완료를 의미한다면 정상이다.

---

## 요약

exec-park D6 full B3 변경은 in-memory 코루틴 머신을 완전히 제거하고 §7.5 rehydration 단일 경로로 일원화한다는 설계 목표를 코드 레벨에서 완전하게 달성했다. 테스트는 새 semantics(`pendingContinuations` 제거, `processX` 직접 처리기 경유, `rehydrateAndResume` 항상 slow-path, `cancelParkedExecution` 단일 취소 경로)를 정확하게 검증한다. 주요 비즈니스 로직(park-release 일원화, bounded 메모리, 중첩 driveCallStackResume frame-by-frame rehydration)은 코드와 업데이트된 spec 이 일치한다.

발견된 이슈는 두 가지 SPEC-DRIFT(§7.5 흐름도의 옛 `waitForX` 경로 잔류 + 상태 전이표·§12.2 의 "replay cancel → CANCELLED" 서술)와 stale 주석(rehydrateAndResume 의 "detach" 언급 + `pendingContinuations` 잔류 언급)이다. 전자는 spec 갱신이 필요하고, 후자는 코드 주석 정정으로 해소된다. 삭제 전 `.catch()` 구현 대비 `await` 전환으로 내부 예외가 outer catch 에 도달 가능해진 것은 실제로 더 안전한 동작이다.

---

## 위험도

LOW — 핵심 기능 구현과 spec 업데이트는 정합적이다. 발견된 WARNING 은 코드 버그가 아니라 spec 문서 갱신 누락(SPEC-DRIFT)이며, stale 주석은 가독성/유지보수 이슈다.
