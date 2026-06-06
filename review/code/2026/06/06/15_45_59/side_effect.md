# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] 공유 상태 Map 완전 제거 — 의도된 설계 변경
- 위치: `execution-engine.service.ts` — `pendingContinuations` Map, `firstSegmentBarriers` Map, `resolvePending`, `rejectPending`, `armFirstSegmentBarrier`, `settleFirstSegment`, `signalParkBarrier` 모두 제거
- 상세: 이들은 인스턴스 수명 내내 살아있는 공유 인-메모리 상태였다. 제거 후 그 역할을 durable DB 영속(`resume_call_stack`, `conversation_thread`, `user_variables`) + §7.5 rehydration 단일 경로가 대체한다. 이는 의도된 full B3 변경으로 부작용이 아니다.
- 제안: 해당 없음(의도적 제거).

### [INFO] `finalizeRehydrationCleanup` 에서 `pendingContinuations.delete` 제거
- 위치: `execution-engine.service.ts`, `finalizeRehydrationCleanup` 메서드
- 상세: 기존에는 cleanup 시 `this.pendingContinuations.delete(executionId)` 를 수행했으나 Map 자체가 제거됐으므로 해당 라인도 삭제됐다. `contextService.deleteContext`와 `clearLlmDefaultConfigCache`는 그대로 유지. 누락 없음.
- 제안: 해당 없음.

### [INFO] `runExecution` finally 에서 `pendingContinuations.delete` 제거
- 위치: `execution-engine.service.ts`, `runExecution` finally 블록
- 상세: 동일하게 Map 제거에 따른 cleanup. `settleFirstSegment` 호출도 제거됐으며, 대신 "park = 세그먼트 종료" 모델로 인해 별도 settler 없이 `runExecution`이 정상 반환하면 worker가 반환한다. 누락 없음.
- 제안: 해당 없음.

### [INFO] `applyRetryLastTurn` finally 에서 `pendingContinuations.delete` 제거
- 위치: `execution-engine.service.ts`, `applyRetryLastTurn` finally 블록
- 상세: `pendingContinuations.delete(executionId)` 제거. `contextService.deleteContext`와 `clearLlmDefaultConfigCache`는 유지. 누수 없음.
- 제안: 해당 없음.

### [WARNING] `driveCallStackResume`/`driveResumeDetached` 의 `.catch` 핸들러 제거 — 예외 전파 경로 변경
- 위치: `execution-engine.service.ts`, `resumeFromCheckpoint` 내부
- 상세: 기존에는 `driveCallStackResume`과 `driveResumeDetached` 호출에 `.catch(err => this.logger.error(...))` 가 붙어 있어, 내부에서 예외가 탈출해도 `unhandledRejection` 을 방지했다. 변경 후 두 호출 모두 `await` 로 전환되고 `.catch` 가 제거됐다. 코드 주석은 "drive 는 내부 try/catch/finally 로 단말 상태를 자기 마킹하므로 예외를 worker 로 전파하지 않는다"고 설명한다. 이 전제가 깨지는 극단 케이스(DB 저장 실패 등)에서 예외가 `rehydrateAndResume` 호출자까지 전파될 수 있다. 호출자(`applyContinuation`)는 `async` 메서드이므로 `unhandledRejection` 으로 이어질 가능성이 있다. 단, `driveResumeDetached` 자체가 inner try/catch/finally 를 갖는다면 실질 위험은 낮다 — 소스를 완전히 확인할 수 없는 범위에서 경계로 표시한다.
- 제안: `rehydrateAndResume` 상위나 `applyContinuation` 에서 최종 catch 가드를 유지하거나, `driveCallStackResume`/`driveResumeDetached` 가 예외를 완전히 흡수함을 단위 테스트로 명시적 커버하는 것을 권장.

### [WARNING] `runExecutionFromQueue` 에서 detached `.catch` → `try/await/catch` 전환 — `failFirstSegmentSetup` 비동기화
- 위치: `execution-engine.service.ts`, `runExecutionFromQueue`
- 상세: 기존에는 `this.runExecution(...).catch(...)` 내부에서 `void this.failFirstSegmentSetup(...)` (fire-and-forget)을 호출했다. 변경 후에는 `try { await this.runExecution(...) } catch { ... await this.failFirstSegmentSetup(...) }` 구조로 전환됐다. `failFirstSegmentSetup` 의 `await` 전환은 올바른 변경이나, `runExecution` setup 단계 throw 가 이제 `runExecutionFromQueue` caller(BullMQ worker `process()`) 로 예외를 전파한다. 기존에는 `.catch` 내부에서 처리되어 job 은 정상 ack 됐으나, `catch` 블록에서 `await this.failFirstSegmentSetup` 자체가 예외를 throw 하면 worker `process()` 까지 전파돼 job 이 fail/retry 될 수 있다. `failFirstSegmentSetup` 내부 예외 처리 여부 확인 필요.
- 제안: `catch` 블록 내 `failFirstSegmentSetup` 호출에 `.catch(e => this.logger.error(...))` 를 붙여 2차 예외 누출을 방어하거나, `failFirstSegmentSetup` 자체에서 예외를 완전히 흡수함을 확인.

### [INFO] `ParkMode` 타입 제거 및 `waitForFormSubmission` / `waitForAiConversation` / `waitForButtonInteraction` 시그니처 변경
- 위치: `execution-engine.service.ts` — `parkMode: ParkMode` 파라미터 제거
- 상세: 기존 `waitForFormSubmission(savedExecution, executionId, node, context, parkMode='await')` 형태에서 `parkMode` 파라미터가 제거됐다. 이 메서드들은 `private` 이므로 외부 API 변경은 없다. 내부 호출 측(`runNodeDispatchLoop`, `resumeFromCheckpoint`, `driveResumeFrame`)도 동시에 수정돼 `'release'` 인자가 제거됐다. 내부 일관성은 유지된다.
- 제안: 해당 없음.

### [INFO] `processFormResumeTurn` 신규 추가 — 새 private 메서드, DB 조회 포함
- 위치: `execution-engine.service.ts`
- 상세: 신규 private 메서드 `processFormResumeTurn` 이 `nodeExecutionRepository.findOne` DB 조회를 수행한다. 기존 `waitForFormSubmission('await')` 경로는 `nodeExec` 를 파라미터로 받았으나, 새 메서드는 직접 DB에서 조회한다. 이는 의도된 변경이며(awaiter 제거 후 nodeExec context 가 사라짐), 부작용은 없다. 단, `findOne` 실패 시(DB 오류) nodeExec 가 null 이 되어 이하 로직이 null 체크 분기로 처리된다 — 이 경우 `NodeExecution` COMPLETED 마킹이 누락될 수 있다. 이는 기존 `waitForFormSubmission('await')` 에서 nodeExec 가 null 인 경우와 동일 처리 경로.
- 제안: `findOne` 결과가 null 인 경우 경고 로그를 추가하면 운영 가시성 향상.

### [INFO] `savedExecution.resumeCallStack = null` 설정 — 공유 객체 변이
- 위치: `execution-engine.service.ts`, terminal 완료 분기 및 `handleExecutionError`
- 상세: `savedExecution` 객체에 `resumeCallStack = null` 을 설정한 뒤 `executionRepository.save(savedExecution)` 를 호출한다. `savedExecution` 은 rehydration 경로에서 로드된 객체이므로 공유 참조 위험이 없다(rehydration 이 매번 신규 로드). 의도된 변경으로 부작용 없음.
- 제안: 해당 없음.

### [INFO] `driveResumeDetached` 에서 `graphEdges` 파라미터 제거
- 위치: `execution-engine.service.ts`, `driveResumeDetached` opts
- 상세: `graphState` 구조 분해에서 `graphEdges` 가 제거됐다. 호출 측에서도 해당 필드를 넘기지 않는 것으로 일관성이 유지돼야 한다. `waitForButtonInteraction` 이 `processButtonResumeTurn` 으로 교체되면서 `graphEdges` 가 불필요해진 것과 연동되는 변경. 내부 일관성 확인이 필요하지만, 타입 시스템이 컴파일 타임에 잡으므로 실질 위험은 낮다.
- 제안: 해당 없음(타입 체크 커버).

### [INFO] 테스트 파일 — `pendingContinuations` 직접 조작 제거
- 위치: `execution-engine.service.spec.ts` — `getPendings` 헬퍼 전체 제거, 관련 `pendings.set/clear/has/get` 코드 제거
- 상세: 테스트가 내부 `pendingContinuations` Map 을 직접 조작하던 패턴이 모두 `jest.spyOn(service, 'rehydrateAndResume').mockResolvedValue(undefined)` 로 교체됐다. 각 spy 가 `mockRestore()` 를 호출해 테스트 간 오염이 없다. 의도된 변경.
- 제안: 해당 없음.

### [INFO] 테스트 — W9 시나리오 의미론 반전 (cancel 중 replay → no-op)
- 위치: `execution-engine.service.spec.ts`, `applyRetryLastTurn` 블록 W9 테스트
- 상세: 기존 W9 는 "replay 중 cancel → Execution CANCELLED"를 단언했으나, 변경 후 "replay 중 cancel → graceful no-op, replay 완결 후 COMPLETED"로 의미론이 반전됐다. 이는 구현 변경(RUNNING 중 `cancelParkedExecution` 의 WAITING 가드 miss → affected:0)과 일치한다. 테스트 자체의 부작용은 없다.
- 제안: 해당 없음(의도된 의미론 변경 반영).

### [INFO] e2e 테스트 신규 추가 — DB 직접 쿼리
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts`
- 상세: 신규 테스트가 `db.query('SELECT status, resume_call_stack FROM execution WHERE id = $1', [executionId])` 로 DB 를 직접 조회한다. 이는 e2e 패턴으로 허용된 범위다. 테스트가 새 workflow/execution 레코드를 생성하지만 테스트 격리(전용 DB 또는 afterAll cleanup) 여부는 기존 e2e 하네스에 의존한다. 기존 테스트들과 동일 패턴이므로 부작용 없음.
- 제안: 해당 없음.

### [INFO] spec/plan 파일 변경 — 코드 부작용 없음
- 위치: `spec/1-data-model.md`, `spec/5-system/4-execution-engine.md`, `spec/conventions/execution-context.md`, `plan/in-progress/spec-update-exec-park-d6-rehydration-step2.md` (삭제)
- 상세: 순수 문서 변경(구현 완료 상태로 업데이트) 및 plan 파일 삭제. 런타임 부작용 없음.
- 제안: 해당 없음.

---

## 요약

이번 변경(exec-park D6 full B3)의 핵심은 인스턴스 수명 공유 상태(`pendingContinuations` Map, `firstSegmentBarriers` Map 및 관련 메서드 군)를 **완전 제거**하고 §7.5 rehydration 단일 경로로 일원화한 것이다. 상태 제거 자체는 의도된 설계로 의도치 않은 부작용에 해당하지 않는다. 주목할 점은 두 가지다: 첫째, `driveCallStackResume`/`driveResumeDetached` 의 `.catch` 래퍼가 제거되어 내부 예외가 caller 로 전파될 수 있는 경로가 생겼다 — 메서드 내부 try/catch/finally 의 완전 흡수 전제가 유지되어야 한다. 둘째, `runExecutionFromQueue` 에서 setup 단계 예외 처리가 fire-and-forget → `await` 로 전환됐으므로 `failFirstSegmentSetup` 자체 예외 가드 여부를 확인해야 한다. 두 항목 모두 기존 코드 주석("drive 는 내부 try/catch/finally 로 자기 마킹")이 전제를 명시하고 있어 실질 위험은 낮지만, 전제 위반 시 `unhandledRejection` 또는 BullMQ job fail/retry 로 이어질 수 있으므로 방어적 catch 보강을 권장한다.

---

## 위험도

LOW
