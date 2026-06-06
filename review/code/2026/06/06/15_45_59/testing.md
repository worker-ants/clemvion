# Testing Review — exec-park D6 full B3

## 발견사항

### **[WARNING]** `processFormResumeTurn` 신규 메서드 — 단위 테스트 부재
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `processFormResumeTurn`
- 상세: `processFormResumeTurn` 은 옛 `waitForFormSubmission('await')` 경로를 대체하는 핵심 신규 메서드이다. sentinel unwrap, 필드 화이트리스트, structured/flat output 갱신, NodeExecution COMPLETED 영속, RUNNING→RUNNING 조건 분기(`savedExecution.status === ExecutionStatus.RUNNING` 가드)를 모두 담당한다. 그러나 spec 파일에서 이 메서드를 직접 구동하는 단위 테스트는 존재하지 않는다. `applyContinuation` 테스트에서는 `rehydrateAndResume` 을 spy 로 목킹해 호출만 검증하고, 통합 테스트는 전체 경로를 통해 간접 검증한다. **`savedExecution.status !== RUNNING` 분기(첫 번째 `else` 경로)** 가 단독으로 커버되는 테스트가 없다.
- 제안: `processFormResumeTurn` 을 직접 spyOn/invoke 하는 단위 테스트 추가. 특히 (a) sentinel 정상 경로, (b) non-sentinel 폴백 warn 경로, (c) `status === RUNNING` vs `status !== RUNNING` 분기, (d) `nodeExec` null 시 save 스킵 경로를 각각 커버.

### **[WARNING]** `driveCallStackResume` / `driveResumeFrame` — 단위 테스트 부재
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `driveCallStackResume`, `driveResumeFrame`
- 상세: exec-park D6 의 핵심 신규 로직 `driveCallStackResume`(frame-by-frame bubble-up) 과 `driveResumeFrame`(개별 프레임 구동)은 `.spec.ts` 파일 diff 에 직접 대응하는 단위 테스트가 없다. e2e 테스트(`execution-park-resume.e2e-spec.ts`)의 신규 중첩 sub-workflow 케이스가 전체 경로를 종단 검증하지만, 버전 가드(`CALL_STACK_SCHEMA_VERSION` 초과 → `RESUME_INCOMPATIBLE_STATE`), frames 가 0인 경우, `injectInvokerOutput` 실패, bubble-up 도중 fresh park 발생 등의 엣지 케이스는 e2e 레벨에서 커버하기 어렵다.
- 제안: `driveCallStackResume` 을 private 직접 접근(`as unknown as`) 방식으로 unit-구동하는 describe 블록을 추가. 버전 가드, 단일 프레임, 다중 프레임 bubble-up, 중간 re-park 케이스를 포함.

### **[WARNING]** `driveCallStackResume` 중 AI re-park 시 bubble-up 경로 미검증
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `driveCallStackResume` AI 분기
- 상세: spec §7.5 step 2-a는 최내 프레임에서 AI turn 처리 후 `processAiResumeTurn` 이 `PARK_RELEASED` 반환 시 bubble-up 없이 세그먼트가 종료돼야 한다고 서술한다. 이 경로(AI re-park 시 외곽 frame 이 forward 되지 않음)는 현재 spec 테스트에서 직접 검증되지 않는다. 통합 테스트 W5 (`processAiResumeTurn` 방어 가드)는 메서드를 단독으로 구동하지만 중첩 call-stack 맥락은 아니다.
- 제안: `driveCallStackResume` 에 중첩 AI 노드 케이스를 추가. `processAiResumeTurn` 이 `PARK_RELEASED` 반환 시 `runNodeDispatchLoop` 가 호출되지 않아야 함을 expect.

### **[WARNING]** `applyCancellation` 동작 변경 — 삭제된 테스트가 새 semantics 를 완전히 대체하지 못함
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 1248행 주변
- 상세: `applyCancellation — pendingContinuations 에 항목 있으면 rejectPending 경로` 테스트가 삭제됐다(diff -W12). 새 semantics(`WAITING_FOR_INPUT` 가드로 멱등 DB UPDATE)는 `affected: 0` 시 graceful no-op 인지 명시적으로 검증하는 테스트가 없다. 현재 남아있는 테스트는 `createQueryBuilder` 가 호출됨만 확인한다.
- 제안: (a) `affected: 0` 반환 시 예외 없이 완료됨 확인 테스트, (b) `affected: 1` 반환 시 NodeExecution 상태 갱신 확인 테스트를 추가.

### **[WARNING]** `runExecutionFromQueue` setup throw 경로 — `failFirstSegmentSetup` 호출 커버리지 부재
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `runExecutionFromQueue` try/catch
- 상세: 변경 후 `runExecutionFromQueue` 는 `await this.runExecution(...)` 를 try/catch 로 감싸고, 실패 시 `await this.failFirstSegmentSetup(executionId, error)` 를 호출한다. 이 setup throw → `failFirstSegmentSetup` 경로는 단위 테스트에서 검증되지 않는다. 새 `runExecution 을 직접 await 하고 park 후 worker 가 반환한다` 테스트는 정상 경로만 검증한다.
- 제안: `runExecution` 을 spy 로 `mockRejectedValueOnce` 처리해 `failFirstSegmentSetup` 이 호출되는지 확인하는 테스트 추가.

### **[INFO]** W4 테스트 삭제 — cancel-during-replay 새 semantics 의 단위 보완 가능
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` W4 삭제 주석
- 상세: 옛 W4(`cancel 이 replay turn 에 도달하면 CANCELLED 마감, downstream skip`) 테스트가 삭제됐고 W9 테스트가 새 semantics(RUNNING 중 cancel 은 graceful no-op, replay 완결)를 검증한다. 그러나 W4 주석은 "새 semantics 는 W9 가 커버한다"고 명시하므로 회귀 보호는 유지된다. 보완으로 `applyCancellation` 이 실제로 `affected: 0` 을 반환할 때(RUNNING → cancelParkedExecution skip) 실행 상태가 바뀌지 않음을 assert 하는 단위 레벨 확인이 있으면 더 명확하다.
- 제안: 선택적. 기존 `cancelParkedExecution` 단위 테스트에 `affected: 0` 경로 추가.

### **[INFO]** `processButtonResumeTurn` — 페이로드 null/undefined 시 동작 커버 미흡
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` W5 describe
- 상세: 변경된 W5 `stale button_click → graceful re-park` 테스트는 buttonId 가 긴 문자열/null/숫자인 경우를 루프로 검증한다. 그러나 `processButtonResumeTurn` 자체가 payload 의 `buttonId` 를 어떻게 처리하는지(포트 라우팅, warn 로그)는 `processAiResumeTurn` 쪽에 집중되고, `processButtonResumeTurn` 직접 단위 테스트는 diff 에 보이지 않는다.
- 제안: 기존 button 통합 테스트가 충분하면 낮은 우선순위. `processButtonResumeTurn` 의 portId null, 빈 string 등 경계값 단위 테스트를 선택적으로 추가.

### **[INFO]** `finalizeRehydrationCleanup` — `pendingContinuations.delete` 제거 후 회귀 가드 미존재
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `finalizeRehydrationCleanup`
- 상세: 해당 메서드에서 `this.pendingContinuations.delete(executionId)` 라인이 제거됐다. `contextService.deleteContext` + `clearLlmDefaultConfigCache` 만 남는다. 이 변경이 기존 cleanup 테스트를 무효화하지 않는지 확인이 필요하지만, diff 에서 관련 단위 테스트 변경이 보이지 않아 암묵적으로 통과되고 있다고 판단된다.
- 제안: `finalizeRehydrationCleanup` 이 `contextService.deleteContext` 와 `clearLlmDefaultConfigCache` 를 호출함을 검증하는 테스트가 있는지 확인. 없으면 추가.

### **[INFO]** e2e 테스트 타임아웃 90s — CI 환경 안정성
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` 2193행 `}, 90_000)`
- 상세: 신규 중첩 sub-workflow 케이스가 90초 타임아웃으로 추가됐다. 기존 케이스는 60초다. 중첩 createWorkflow + saveCanvas × 2 + park poll + cold rehydration poll 을 포함해 90초 설정이 합리적이나, `poll` 함수의 최대 대기 시간이 타임아웃보다 짧은지 확인이 필요하다. 타임아웃 초과 시 Jest 가 해당 테스트를 silent hang 으로 처리할 위험이 있다.
- 제안: `poll` 함수의 max retries × interval 합산이 90s 보다 충분히 짧은지 확인. 필요 시 `poll` 에 maxMs 파라미터 전달.

### **[INFO]** Mock 일관성 — `rehydrateSpy.mockRestore()` 개별 호출 패턴
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 1134, 1173, 1251행
- 상세: `applyContinuation` 관련 테스트들이 `jest.spyOn(...).mockResolvedValue(undefined)` 후 각 테스트 말미에 `mockRestore()` 를 수동 호출한다. `afterEach` 에서 `jest.restoreAllMocks()` 가 이미 설정되어 있다면 중복이지만 해롭지 않다. 설정돼 있지 않으면 spy 가 다른 테스트에 누출될 위험이 있다.
- 제안: `beforeEach`/`afterEach` 레벨에서 `jest.restoreAllMocks()` 가 실행되는지 확인. 그렇지 않다면 누출 방어가 각 테스트의 `mockRestore()` 에 의존하게 되어 취약하다.

---

## 요약

exec-park D6 full B3 구현에 대응하는 테스트 변경은 전반적으로 방향이 올바르다. 옛 `pendingContinuations`/`firstSegmentBarriers` 기반 테스트가 삭제되고 `rehydrateAndResume` spy + 직접 처리기 spy 패턴으로 교체됐으며, W5·W9·완결 가드(makeCompletionGuard) 테스트가 새 semantics 를 반영해 갱신됐다. e2e 레벨에서 중첩 sub-workflow 종단 시나리오가 추가된 점도 긍정적이다. 그러나 `processFormResumeTurn`, `driveCallStackResume`/`driveResumeFrame` 등 핵심 신규 메서드의 직접 단위 테스트가 부재하고, `applyCancellation` 의 `affected: 0` graceful no-op 경로, `runExecutionFromQueue` setup throw → `failFirstSegmentSetup` 경로, `processButtonResumeTurn` 경계값 처리가 충분히 커버되지 않는다. 이 갭들은 운영 중 예외 상황(cancel 타이밍 race, DB save 부분 실패, 중첩 버전 불일치)에서 회귀를 탐지하지 못할 위험이 있다.

## 위험도

MEDIUM
