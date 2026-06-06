# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] spec/5-system/4-execution-engine.md §7.4 라우팅 원칙 표 — `pendingContinuations` 잔류 문구
- 위치: `spec/5-system/4-execution-engine.md` §7.4 Worker 동작 행 — `라우팅 원칙` 셀
- 상세: 라우팅 원칙 셀 본문에 "자기 인스턴스의 `pendingContinuations` 에 키가 있어도 마찬가지 — 옛 pub/sub 시대의 ..." 라는 문구가 남아 있다. 같은 파일에서 Worker 동작 행은 full B3 제거로 갱신됐지만, 바로 위 라우팅 원칙 셀은 `pendingContinuations` 를 현재 시제로 언급하고 있어 논리적 불일치를 준다.
- 제안: 라우팅 원칙 셀에서 `pendingContinuations` 조건을 삭제하거나, "옛 fast-path(pendingContinuations)는 full B3 에서 제거됨 — BullMQ enqueue 원칙만 유효" 로 명시 갱신.

### [INFO] execution-engine.service.ts — 제거된 `driveResumeDetached` `.catch()` 에 대한 오류 전파 문서 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-b2b-04a2f8/codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, diff `resumeFromCheckpoint` 내부 `driveCallStackResume` 호출 변경부 (옛 `.catch()` 제거)
- 상세: 이전 코드는 `.catch((err) => { this.logger.error(...) })` 로 탈출 예외를 잡고 JSDoc 이 그 동작을 설명했다. full B3 전환 후 `await` 로 바뀌면서 `.catch()` 핸들러가 제거됐는데, "drive 는 내부 try/catch/finally 로 단말 상태를 자기 마킹하므로 예외를 worker 로 전파하지 않는다" 는 설명이 인라인 주석으로만 남고, 예외가 진짜로 빠져나올 경우 어떻게 되는지(worker 가 BullMQ retry 트리거) 에 대한 문서는 없다. 이 부분은 운영 담당자가 이해해야 할 장애 시나리오다.
- 제안: 해당 `await this.driveResumeDetached(...)` / `await this.driveCallStackResume(...)` 호출부 인라인 주석에 "극단 케이스에서 드라이브가 예외를 전파할 경우 BullMQ 가 `RESUME_BULLMQ_ATTEMPTS` 횟수만큼 재시도하고 Dead-letter 처리(§7.4)됨" 문구를 추가.

### [INFO] `processFormResumeTurn` / `processButtonResumeTurn` — JSDoc 비대칭
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-b2b-04a2f8/codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `processFormResumeTurn` 신설 (diff `+  private async processFormResumeTurn`)
- 상세: `processFormResumeTurn` 에는 상세 JSDoc(§7.5 rehydration 목적, 처리 흐름 나열)이 추가됐다. 반면 diff 범위에서 `processButtonResumeTurn` 에 상응하는 JSDoc 추가 여부가 확인되지 않는다(diff 에 신설 본문이 보이지 않음 — 기존 함수 시그니처 변경만 노출됨). 공개적으로 의도가 대칭인 두 처리기에 문서 수준 차이가 생기면 유지보수자 혼선의 원인이 된다.
- 제안: `processButtonResumeTurn` 에도 `processFormResumeTurn` 과 동일 수준의 JSDoc(§7.5 rehydration 역할, payload 처리 흐름, 호출 주체)을 추가.

### [INFO] `waitForFormSubmission` / `waitForButtonInteraction` / `waitForAiConversation` JSDoc — parkMode 매개변수 제거 후 일부 @param / @returns 잔류 가능성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-b2b-04a2f8/codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `waitForFormSubmission` 변경부 (diff `- parkMode: ParkMode = 'await'`, 갱신된 JSDoc)
- 상세: `waitForFormSubmission` 의 JSDoc 은 diff 에서 갱신됐음이 확인된다. 그러나 `waitForButtonInteraction` / `waitForAiConversation` 의 JSDoc 내 `@param parkMode` / `'await'`·`'release'` 관련 서술이 같은 방식으로 정리됐는지 diff 범위에서 명시적으로 확인되지 않는다(`-    parkMode: ParkMode = 'await'` 제거 패턴은 여러 곳에서 나타남). 낡은 @param 이 남으면 오해를 유발한다.
- 제안: `waitForButtonInteraction` / `waitForAiConversation` JSDoc 의 `@param parkMode`, `@todo full B3 에서` 항목이 실제 제거됐는지 확인하고, 잔류 시 함께 정리.

### [INFO] spec/conventions/execution-context.md — `_callStack` 항목과 spec §7.5 cross-link 완결
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-b2b-04a2f8/spec/conventions/execution-context.md`, diff `+ - \`_callStack?: ResumeCallStackFrame[]\`` 추가
- 상세: `_callStack` 항목이 신설됐고 `execution-engine §7.5` cross-link 가 포함됐다. 양호하지만, `ResumeCallStackFrame` 타입 자체가 어느 파일에 선언됐는지(코드 위치 또는 spec 본문 내 타입 정의)에 대한 참조가 없다. 향후 검색자가 타입 정의를 찾기 어렵다.
- 제안: `_callStack` 항목에 `ResumeCallStackFrame` 의 선언 위치(예: `execution-engine.service.ts` 또는 별도 타입 파일 경로)를 괄호 주석으로 추가.

### [INFO] plan/in-progress/spec-update-exec-park-d6-rehydration-step2.md 삭제 — CHANGELOG 미기록
- 위치: diff 파일 4, `plan/in-progress/spec-update-exec-park-d6-rehydration-step2.md` 삭제
- 상세: SPEC-DRIFT INFO #16 / #17 추적 plan 문서가 삭제됐다. spec 갱신이 완료 커밋에 반영됐다면 해당 파일을 `plan/complete/` 로 이동하는 것이 프로젝트 라이프사이클 규약이나(`.claude/docs/plan-lifecycle.md`), 본 diff 에서는 단순 삭제로 처리됐다. 라이프사이클 아카이브 흔적이 없다.
- 제안: SPEC-DRIFT 해소가 완료됐음을 명시하는 plan 완료 이동 커밋을 별도 수행하거나, 삭제가 의도적이라면 완료 아카이브 이동 생략 이유를 주석으로 남길 것.

### [INFO] e2e 테스트 파일 헤더 주석 — 기존 describe 블록 설명 문구 미갱신
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-b2b-04a2f8/codebase/backend/test/execution-park-resume.e2e-spec.ts`, describe 블록 헤더 `(e2e, PR-B1)`
- 상세: 신규 e2e 테스트가 추가된 describe 블록의 제목이 여전히 `(e2e, PR-B1)` 로 표기돼 있다. 이번에 추가된 테스트는 PR-B2b(exec-park D6)의 중첩 sub-workflow 재개를 검증한다. 블록 제목이 PR-B1 한정으로 읽히면 신규 테스트의 목적이 오인될 수 있다.
- 제안: describe 블록 제목을 `'Execution park → cold rehydration resume (e2e, PR-B1 / PR-B2b)'` 또는 별도 describe 블록으로 분리해 범위를 명확히.

## 요약

이번 변경은 exec-park D6 full B3 완성(in-memory 머신 완전 제거)에 따른 대규모 리팩터링으로, 코드 내 인라인 주석과 spec 문서 양쪽이 비교적 충실하게 갱신됐다. 특히 `execution-engine.service.ts` 의 삭제된 함수들(`pendingContinuations`, `firstSegmentBarriers`, `armFirstSegmentBarrier`, `signalParkBarrier`, `resolvePending`, `rejectPending`, `runAiConversationLoop`)에는 제거 이유와 대체 경로를 명시한 인라인 블록 주석이 배치됐고, spec 문서(`spec/1-data-model.md`, `spec/5-system/4-execution-engine.md`, `spec/conventions/execution-context.md`)도 구현 완료 상태에 맞게 갱신됐다. 주요 문서화 갭은: (1) `spec/5-system/4-execution-engine.md` §7.4 라우팅 원칙 셀의 `pendingContinuations` 잔류 문구, (2) 신설 `processButtonResumeTurn` 에 대한 JSDoc 미확인, (3) e2e describe 블록 제목이 PR-B1 한정으로 읽히는 점, (4) 삭제된 plan 문서의 라이프사이클 아카이브 미처리 — 네 항목이다. 모두 운영·유지보수 시 혼선을 유발할 수 있는 INFO 수준이며, 아키텍처 안전성에는 영향을 주지 않는다.

## 위험도

LOW

STATUS: SUCCESS
