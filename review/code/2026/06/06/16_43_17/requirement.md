# 요구사항(Requirement) 리뷰

## 발견사항

### 파일 1: execution-engine.service.spec.ts (신규 테스트 블록)

---

**[INFO]** (a) sentinel 정상 unwrap 테스트 — spec §10.9 와 정합
- 위치: 테스트 케이스 (a), 라인 282~310
- 상세: spec `4-nodes/6-presentation/0-common.md §10.9` 는 `continueExecution` 이 raw formData 를 `{ type: 'form_submitted', formData }` 로 wrap 해 internal bus 에 enqueue 하고, `processFormResumeTurn` 이 `isFormSubmittedSentinel` 으로 unwrap 하는 구조를 정의한다. 테스트는 sentinel 포함 payload 를 전달해 `nodeExec.status = COMPLETED` 로 저장·`nodeOutputCache[nodeId]` 갱신을 검증한다. 구현 (`execution-engine.service.ts` L3999–4006) 과 일치.
- 제안: 현 상태 유지.

---

**[WARNING]** (b) non-sentinel warn 폴백 — warn 메시지 문자열 하드코딩 의존
- 위치: 테스트 케이스 (b), 라인 344–347
- 상세: 테스트가 `expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('sentinel 없는 폴백'))` 으로 한국어 경고 메시지 하위 문자열에 의존한다. 구현 (`execution-engine.service.ts` L4003) 은 `processFormResumeTurn — sentinel 없는 폴백 payload execution=...` 를 emit 하므로 현재 일치하지만, 메시지 개선 시 테스트가 깨진다. spec §10.9 는 sentinel 없는 경로에서 warn 을 기록하라는 행동적 규칙만 명시할 뿐 특정 문자열을 강제하지 않는다. 기능 요구사항은 충족하나, 취약한 결합.
- 제안: `expect.stringContaining` 을 문자열 리터럴보다 안정된 error code 또는 category 키워드로 교체하거나, 적어도 영문 키워드(`sentinel fallback` 등)를 구현과 테스트 양쪽에 고정해 언어 독립성 확보.

---

**[INFO]** (c-running) RUNNING → RUNNING 회피 가드 테스트
- 위치: 테스트 케이스 (c-running), 라인 352–383
- 상세: `savedExecution.status === RUNNING` 이면 `updateExecutionStatus` 를 호출하지 않고 `nodeExec.save` 만 수행한다는 로직을 검증. 구현 (`execution-engine.service.ts` L4099–4108) 과 정합. spec `§4-execution-engine.md §7.5` 의 RUNNING→WAITING 전이 전제("`드라이브 진입 시 이미 RUNNING 전이했으면 nodeExec 만 save`")와 일치.

---

**[INFO]** (c-not-running) updateExecutionStatus(RUNNING) 호출 검증
- 위치: 테스트 케이스 (c-not-running), 라인 386–420
- 상세: `savedExecution.status !== RUNNING` 이면 `updateExecutionStatus(RUNNING, nodeExec)` 가 호출되어야 한다는 스펙 흐름(`§7.5 resume sentinel transition`) 을 검증. 구현 L4104–4108 과 일치. 단, `statusCalls.toContain(ExecutionStatus.RUNNING)` 은 구현 내 다른 `RUNNING` 호출이 추가될 경우 의도치 않게 통과하는 허위 통과(false positive) 가능성 있음 — 기능 목적상 허용 범위.

---

**[INFO]** (d) nodeExec null skip 테스트
- 위치: 테스트 케이스 (d), 라인 424–453
- 상세: `nodeExecutionRepository.findOne` 이 `null` 을 반환할 때 `nodeExecutionRepository.save` 가 미호출되고 `updateExecutionStatus` 는 호출됨을 검증. 구현 L4086 (`if (nodeExec)`) 과 L4099–4108 분기와 정합.
- 주의: `updateExecutionStatus` 는 호출됐으나 `nodeExec ?? undefined` (L4107) 이 `undefined` 로 전달되므로 실질적으로 NodeExecution 저장 없이 Execution 상태만 RUNNING 으로 전환된다. 이는 nodeExec null 시 Execution 만 RUNNING 으로 전환하는 의도적 설계이며 spec 에 명시적 반례가 없어 INFO.

---

**[WARNING]** W3 테스트 — `driveCallStackResume` 의 시그니처 타입 불일치 위험
- 위치: W3 테스트, 라인 468–492 (`DriveW3Subject` 타입)
- 상세: `DriveW3Subject.driveCallStackResume` 의 `opts.callStack` 타입이 `{ version: number; frames: unknown[] }` 로 정의됐으나, 실제 구현 (`execution-engine.service.ts` L2063–2076) 의 `ResumeCallStack` 타입은 `{ version: number; frames: ResumeCallFrame[] }` 이다. 테스트에서 `unknown[]` 로 선언해 타입 안전성이 낮아진다. 런타임에 테스트가 통과해도 시그니처 변경 시 silent type mismatch 발생 가능.
- 제안: 공개 타입 `ResumeCallStack` 을 import 해 `DriveW3Subject` 에 적용. `as unknown as DriveW3Subject` cast 를 줄이는 방향.

---

**[WARNING]** W3 테스트 — `driveResumeFrame` 반환 타입 미검증
- 위치: W3 테스트, 라인 638–689
- 상세: `driveResumeFrame` 가 `{ parked: true, output: undefined }` 를 반환하면 `driveCallStackResume` 가 `runNodeDispatchLoop` 를 호출하지 않는다는 것이 핵심 불변식이다. 테스트는 `dispatchSpy.not.toHaveBeenCalled()` 를 통해 이를 검증하지만, `finalizeRehydrationCleanup` 와 `updateExecutionStatus` mock 이 `driveCallStackResume` 내부의 `try` 외부(호출자 레벨)에도 있어 `driveCallStackResume` 가 내부적으로 어떤 정리를 하는지 추적이 약하다. 기능 목적은 충족하나, 에러 경로(`frames.length === 0`) 는 별도 테스트가 없어 경계값 미커버.
- 제안: 빈 frames(length 0) 케이스 테스트 추가 권장 (현재 `RESUME_CHECKPOINT_MISSING` throw 를 검증하는 테스트 없음).

---

**[INFO]** W5 테스트 — `runExecutionFromQueue` catch → `failFirstSegmentSetup` 경로
- 위치: W5 테스트, 라인 693–727
- 상세: `runExecution` throw 시 `failFirstSegmentSetup` 가 호출된다는 것을 spy 로 직접 검증. 구현 L2858–2880 의 try/catch 흐름과 정합. 기능 완전성 충족.

---

**[INFO]** W6 테스트 — `rehydrateAndResume` outer catch 흡수
- 위치: W6 테스트, 라인 730–792
- 상세: `resumeFromCheckpoint` throw 가 `rehydrateAndResume` 의 outer catch 에 흡수돼 호출자에 전파되지 않는다는 것을 검증. 구현 L1178–1218 의 catch 블록과 정합. `resolves.toBeUndefined()` assertion 이 적절.
- 미묘한 사항: W6 테스트가 `resumeFromCheckpoint` 를 spy 로 mock 해 throw 시키는데, 실제 구현에서는 `driveResumeDetached` / `driveCallStackResume` 가 내부적으로 예외를 흡수하도록 설계됐으므로 outer catch 도달 경로는 pre-drive(invariant 검증, rehydrateContext) 단계 오류 뿐이다. 테스트는 `resumeFromCheckpoint` 자체를 mock 해 throw 하므로 실제 pre-drive 경로가 아닌 중간 함수 level 에서 throw 를 시뮬레이션. 구현 의도와는 다소 다른 경로지만 outer catch 의 흡수 행동 자체는 검증됨.

---

**[WARNING]** W7 테스트 — `error` 로그 메시지 키워드 의존
- 위치: W7 테스트, 라인 827–829
- 상세: `expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('secondary error'))` 가 구현 L2871–2876 의 `failFirstSegmentSetup secondary error for ${executionId}:` 문자열에 의존. spec 은 secondary 실패를 `logger.error` 로 흡수한다는 행동을 요구하지만 특정 메시지 형식을 강제하지 않는다. (b) 와 동일한 취약한 메시지 결합.
- 제안: (b) 와 마찬가지로 안정적인 식별자(오류 코드 등)로 교체하거나 현 수준 유지.

---

### 파일 2: execution-engine.service.ts (프로덕션 코드 변경)

---

**[INFO]** 로그 메시지 변경 — "launched (drive detached)" → "completed (drive awaited)"
- 위치: 라인 1168–1176 diff
- 상세: 이전 주석·로그는 "resume 구동 launch(비동기 detach) 시점"이라 설명했으나, exec-park D6 full B3 이후 `resumeFromCheckpoint` 가 드라이브를 완전히 await 하므로 실제 의미가 "구동 완료 시점"으로 바뀌었다. 새 로그 `Rehydration completed (drive awaited)` 와 주석이 이를 정확히 반영. spec `§4-execution-engine.md §7.5` 의 "drive 는 내부 try/catch/finally 로 단말 상태를 자기 마킹하므로 예외를 worker 로 전파하지 않는다" 설명과 일치.

---

**[INFO]** catch 블록 주석 변경
- 위치: 라인 1179–1184 diff
- 상세: 이전 주석이 "launch 이전 throw 만 catch" 라고 설명했으나, 신규 주석은 "드라이브가 예외를 완전 흡수하므로 pre-check 단계 throw 만 도달"로 수정. `driveResumeDetached` L2030–2048 와 `driveCallStackResume` L2063ff 의 내부 catch 가 실제로 예외를 흡수하므로 올바른 설명. 기능적 변경 없음, 주석 정확도 개선.

---

**[WARNING]** `failFirstSegmentSetup` catch 추가 — W7 방어 로직
- 위치: 라인 2863–2904 diff (`runExecutionFromQueue`)
- 상세: `failFirstSegmentSetup` 자체가 throw 할 경우 BullMQ worker 레벨로 에러가 전파돼 동일 continuation 이 이중 재시도되는 버그를 방어. `.catch()` 로 secondary error 를 `logger.error` 로 흡수. 설계 의도 명확하고 올바른 방향. spec `§4-execution-engine.md §Rationale "Durable Continuation"` 에서 이중 실행을 방지하는 불변식 보존과 일치.
- 주의: `failFirstSegmentSetup` 가 DB 실패로 throw 하는 경우 Execution row 가 FAILED 마킹되지 않는 운영 리스크가 있으나, BullMQ retry(`RESUME_BULLMQ_ATTEMPTS`) 가 재시도를 담당하므로 best-effort 처리가 적절. 단, secondary error 로그에 executionId 외 error code 가 없어 운영 관측성이 약간 낮음(INFO 수준).

---

### 파일 3: plan/in-progress/exec-park-durable-resume.md

---

**[INFO]** 체크박스 갱신 — full B3 제거 / e2e / spec flip 완료 표시
- 위치: diff 전체
- 상세: `[ ]` → `[x]` 전환이 완료된 작업(full B3 제거, dockerized e2e 176 pass, spec flip)을 정확히 반영. 잔여 항목(PR-B2a follow-up, umbrella 잔여, doc polish)은 `[ ]` 유지. 차수 메모가 7+ commits, 690+ unit pass, 176 e2e pass, ai-review 2회 기록을 담음. plan 파일 변경은 기능 구현과 독립적 추적 문서이므로 코드 정합성 직접 영향 없음.

---

**[SPEC-DRIFT]** spec §7.5 의 `resume_call_stack` 구현 상태 메모가 "미구현" 상태로 잔류
- 위치: `spec/5-system/4-execution-engine.md` L914 (구현 상태 주석)
- 상세: spec L914 에 `"park 시 stage 와 §7.5 재귀 재진입 로직은 PR-B2 후속 커밋에서 구현 — 그 전까지 컬럼은 NULL 유지, 중첩 blocking 은 기존 동작"` 이라고 표기되어 있으나, plan 파일의 차수 메모에 따르면 full B3 제거(commit `2dbb31b6`)와 dockerized e2e(commit `247f5cb5`)가 완료됐다. `driveCallStackResume` 구현이 실제로 `resume_call_stack` 재귀 재진입을 수행한다. spec 의 "미구현" 상태 메모는 낡았다 — 코드가 완성된 상태이며 spec 갱신 누락.
  - 해결: 코드 되돌리기가 아닌 spec 반영. `spec/5-system/4-execution-engine.md` L910–914 의 "구현 상태(2026-06-06)" 주석을 "구현 완료 (PR-B2b `2dbb31b6`+`247f5cb5`)" 로 갱신 필요. `project-planner` 위임.

---

**[SPEC-DRIFT]** spec §4.x "PR-B2b(중첩 sub-workflow D6 + full B3) 미적용" 상태 메모 잔류
- 위치: `spec/5-system/4-execution-engine.md` L415, L417 구현 메모
- 상세: spec L415 에 `"PR-B2b(중첩 sub-workflow D6 + full B3) 미적용"` 상태 표시가 남아 있으나, plan에 따르면 full B3 제거가 완료됐다. 코드에서 `pendingContinuations`, `firstSegmentBarriers`, `firePayload` 등이 제거됐고(L726 주석이 제거 완료를 언급), `runExecutionFromQueue` 가 `await runExecution` 직접 호출로 전환됐다. 해당 메모들은 "PR-B2b 완료 시점 기준" 이라는 단서가 있었으나, 이제 완료된 만큼 과도기 메모는 낡았다.
  - 해결: spec 갱신 누락. spec L415 / L417 구현 메모의 "PR-B2b 미적용" 표현 및 과도기 설명을 완료형으로 flip. `project-planner` 위임.

---

**[INFO]** spec §7.5 `driveResumeDetached` JSDoc 주석 "void 로(detach) 호출" 잔존
- 위치: `spec/5-system/4-execution-engine.md` 및 서비스 파일 L1815 JSDoc
- 상세: plan 의 "잔여 doc polish" 섹션에서 `driveResumeDetached` JSDoc "void 로(detach) 호출" → "worker 직접 await" 정정이 비차단 항목으로 분리 처리됨. 이는 plan 이 이미 인지하고 후속 PR 로 분리한 사항이므로 현재 리뷰 범위에서는 INFO.

---

## 요약

세 파일의 변경사항은 exec-park D6 full B3 완료를 반영하는 단위 테스트 보강(4 케이스 processFormResumeTurn + W3/W5/W6/W7 보완), `rehydrateAndResume` 주석 정확도 개선, `failFirstSegmentSetup` secondary error 흡수 방어 코드, plan 체크박스 갱신으로 구성된다. 프로덕션 코드 변경(파일 2)은 기능 완전성 측면에서 올바르고, `failFirstSegmentSetup` catch 추가는 BullMQ 이중 재시도 방지라는 명확한 불변식을 보호한다. 테스트(파일 1)는 4개 핵심 경로를 모두 커버하며 spec §10.9 sentinel, §7.5 RUNNING 가드, nodeExec null 처리를 검증한다. 주요 위험은 (b)/(W7) 테스트의 한국어/영어 하드코딩 메시지 의존(취약한 결합), W3 의 `driveCallStackResume` 빈 frames 경계값 미커버, 그리고 spec 의 "PR-B2b 미적용/미구현" 메모가 완료된 구현과 불일치하는 SPEC-DRIFT 두 건이다. SPEC-DRIFT 는 코드 버그가 아니라 spec 갱신 누락이므로 코드 되돌리기가 아닌 `project-planner` 위임으로 해결한다.

## 위험도

LOW
