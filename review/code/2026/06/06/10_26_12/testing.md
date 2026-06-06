# Testing 관점 코드 리뷰

## 발견사항

### [WARNING] `reparkAiResumeTurn` 이 WAITING_FOR_INPUT 으로 실제 전이되는지 직접 검증 부재
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `reparkAiResumeTurn`; spec 파일 W12 test (line 5051~5115), button_click test (line 5118~5185)
- 상세: `reparkAiResumeTurn` 는 `stageDurableResumeSnapshot` + `updateExecutionStatus(WAITING_FOR_INPUT)` 를 호출한다. W12(unknown type)/button_click re-park 테스트는 "핸들러 turn 처리 미호출" 및 "terminal emit 없음" 을 가드하지만, re-park 시 DB 상태(`updateExecutionStatus`가 WAITING_FOR_INPUT 으로 실제 호출됐는지 또는 `stageDurableResumeSnapshot` 가 호출됐는지)를 명시적으로 assert 하는 케이스가 없다. `stageDurableResumeSnapshot` 의 독립 단위 테스트(line 9621~)는 존재하지만, `reparkAiResumeTurn` 와의 통합은 오직 회귀 방지적 관찰(이벤트 미발행, 핸들러 미호출)로만 커버된다. turn 이 WAITING_FOR_INPUT 으로 복귀하지 않으면 다음 slow-path rehydration 의 invariant(`execution.status === WAITING_FOR_INPUT`) 검증이 실패해 조용히 RESUME_INCOMPATIBLE_STATE 로 빠질 수 있는 운영 위험이 있다.
- 제안: W12/button_click re-park 테스트 중 하나에 `expect(mockExecutionRepo.createQueryBuilder().set).toHaveBeenCalledWith(expect.objectContaining({ status: 'waiting_for_input' }))` 또는 `updateExecutionStatus` 직접 spy assertion 을 추가한다.

### [WARNING] `finalizeAiNode` 의 `savedExecution.status === RUNNING` 단락(skip transition) 분기에 전용 단위 테스트 부재
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 6369~6380 (신규 RUNNING guard 분기)
- 상세: Phase B에서 `driveResumeDetached` 가 먼저 Execution 을 RUNNING 으로 전이한 뒤 `processAiResumeTurn` → `finalizeAiNode(COMPLETED/FAILED)` 를 호출하므로, `finalizeAiNode` 진입 시 `savedExecution.status === RUNNING` 인 케이스가 새로 생겼다. 이 분기는 `updateExecutionStatus` 호출을 건너뛰고 `nodeExecutionRepository.save(nodeExec)` 만 수행한다. 기존 end-to-end 테스트(endAiConversation, FAILED 경로)는 이 분기를 통과하지만, `updateExecutionStatus` 가 스킵됐는지(RUNNING→RUNNING 금지 assertion) 또는 `nodeExec.save` 만 호출됐는지 명시적으로 검증하지 않는다. 해당 분기의 로직이 바뀌어도(예: 실수로 else 제거) 기존 테스트가 통과할 수 있다.
- 제안: `finalizeAiNode` 를 직접 테스트하는 단위 케이스를 추가하거나, end-to-end 테스트(end-ai-conversation COMPLETED slow-path)에 `expect(mockExecutionRepo.createQueryBuilder().set).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'running' }))` assertion 을 보강한다.

### [WARNING] `flushResumeDrive(200ms)` 실제 타이머 의존 — jest 기본 타임아웃(5000ms) 대비 누적 부담
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` line 84~86, line 5159~5165
- 상세: `flushResumeDrive` 는 `setTimeout(resolve, ms)` 로 구현돼 있고 기본값 200ms, button_click × 22 루프 테스트(line 5159)는 `flushResumeDrive(40)` × 22 = 880ms, W4 인터리빙 테스트(3회 button_click × 200ms + ai_message 200ms = 800ms), processAiResumeTurn 디스패치 describe 블록의 ai_message/form_submitted/W12/button_click 테스트들도 각 200ms 씩 소비한다. 전체 describe 내 누적이 jest 기본 5000ms 타임아웃에 근접할 수 있다. 주석에 "CI 고부하 환경에서도 40ms 는 false-negative 관측"이라 언급돼 200ms 로 상향됐는데, 이는 환경에 따라 flaky 해질 수 있음을 인정하는 것이다. `jest.config.ts` 에 `testTimeout` 설정이 없으므로 기본 5000ms 가 적용된다.
- 제안: `jest.config.ts` 에 `testTimeout: 15000` 을 추가하거나, 해당 describe 블록 상단에 `jest.setTimeout(15000)` 를 선언해 실제 타이머 의존 테스트의 타임아웃 실패를 방지한다. 혹은 `jest.useFakeTimers()` + `jest.advanceTimersByTime()` 으로 전환해 CI 실시간 의존을 제거하되, `detached drive` 의 실제 `setTimeout` 도 fake 타이머로 제어해야 하므로 리팩터링 범위가 크다 — 단기에는 `testTimeout` 상향이 현실적이다.

### [INFO] `isAiConversation` 조건부 `firePayload` 스킵 분기 — 비-AI(form/button) 경로가 여전히 `firePayload` 를 사용하는지 회귀 가드 없음
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 1868~1870 (신규 `if (!isAiConversation)` 분기)
- 상세: Phase B에서 AI conversation 재개는 `firePayload` 를 스킵하고 `driveResumeDetached` 가 `opts.payload` 를 직접 `processAiResumeTurn` 에 forward 하는 구조다. 기존 form/button 재개는 여전히 `firePayload` 를 통한 pending 주입을 사용한다. 현재 form/button 테스트들(§4.x 가드 line 3303, 3936)은 `flushResumeDrive` 를 사용해 실제 `firePayload` 타이머가 구동된 후 assertion 하므로 이 경로가 아직 동작함을 간접 검증한다. 그러나 "AI 일 때 `firePayload` 를 스킵하는지"(AI 케이스에서 `setTimeout` 호출 횟수 == 0)를 명시적으로 가드하는 테스트는 없다. 이 분기가 실수로 제거되면 AI resume 에서 `pending` 미등록으로 `FIRE_PAYLOAD_MAX_ATTEMPTS` 소진 warn 이 남겠지만, 기능 자체는 `driveResumeDetached` 직접 전달로 동작해 warn 만 로그에 쌓이는 silent degradation 이 발생한다.
- 제안: AI resume 테스트 중 하나에 `expect(setTimeout).not.toHaveBeenCalledWith(expect.any(Function), 0)` (또는 `setTimeout` spy) assertion 을 추가하거나, `applyContinuation` AI 재개 경로에 "warn 없음" assertion(firePayload warn 문자열 부재)을 가드한다.

### [INFO] `resume-call-stack.types.spec.ts` 미존재 — 이전 review(03_03_22) 이월 항목 미완
- 위치: `/codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts`
- 상세: 이전 리뷰(03_03_22) W4 에서 "타입 단위테스트는 stage/rehydrate 로직과 함께 추가" 로 이월됐다. 현재 커밋에서 `processAiResumeTurn` (단발 turn 처리기)가 추가됐으나 `resume-call-stack.types.ts` 는 여전히 런타임 로직 없는 순수 타입 파일이라 단위 테스트 대상이 없는 상태가 계속된다. `CALL_STACK_SCHEMA_VERSION` 상수는 추가됐으나 버전 가드·파싱·frames 유효성 검증 로직이 아직 미구현이므로 현 시점 테스트 추가 부담은 없다. plan PR-B2 구현 완료 시 `conversation-thread.types.spec.ts` 패턴 대로 추가해야 한다.
- 제안: PR-B2 행위 구현(중첩 rehydration, `stageResumeCallStack`)이 완료되는 커밋에서 `resume-call-stack.types.spec.ts` 추가 — null/frames 손상/version 불일치/lossless round-trip/참조 분리 케이스 포함.

### [INFO] `executions.service.spec.ts` mock execution 에 `resumeCallStack: null` 미반영 — 이전 review 이월 항목 미완
- 위치: `/codebase/backend/src/modules/executions/entities/execution.entity.ts` + `executions.service.spec.ts`
- 상세: 이전 리뷰(03_03_22) W5 에서 "rehydration 로직 추가 커밋과 함께"로 이월됐고, 현재 커밋에서도 `resumeCallStack` 을 읽는 서비스 로직이 없으므로 즉각 위험은 없다. 그러나 `conversationThread`, `userVariables` 도 동일 패턴으로 mock 에 추가됐어야 할 것들이 선례적으로 추가된 상황에서 `resumeCallStack` 만 누락된 상태가 지속된다.
- 제안: mock execution 헬퍼에 `resumeCallStack: null` 추가(이전 리뷰 W5 지속 이월).

### [INFO] `W11 form_submitted` 테스트 — `describe` 이름이 `processAiResumeTurn dispatch` 로 변경됐으나 `W11` 레이블 유지
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` line 4908
- 상세: describe 이름이 `waitForAiConversation dispatch` 에서 `processAiResumeTurn dispatch` 로 업데이트됐고, 내부 주석도 Phase B 동작 방식으로 갱신됐다. 기존 SUMMARY의 W11/W12 번호가 그대로 유지돼 가독성 연속성을 유지한다. 코드 의도가 명확하다.
- 제안: 문제 없음 — 단순 문서 정합성 확인.

---

## 요약

이번 커밋의 핵심 변경은 AI 멀티턴 park-release 전환(`waitForAiConversation('release')` + `processAiResumeTurn` 단발 turn 처리기 도입)이며, 이에 맞게 spec 테스트 파일도 대규모 리팩터링됐다. `armSlowPathResume` 헬퍼와 `flushResumeDrive` 를 도입해 Phase B slow-path 구조를 정확히 모델링한 것은 테스트 설계 측면에서 긍정적이다. 신규 테스트들(§4.x resolver 미잔류, processAiResumeTurn dispatch, button_click × 22 cap 부재 회귀, slow-path worker detach, Multi-turn + _resumeCheckpoint 재구성 경로)이 새 행동을 잘 커버한다. 그러나 `reparkAiResumeTurn` 이 WAITING_FOR_INPUT 으로 실제 전이되는지 DB 상태 단언이 없고, `finalizeAiNode` 의 RUNNING 단락 분기에 직접 unit test 가 없으며, 실제 타이머(200ms × n) 기반 테스트가 jest 기본 5000ms 타임아웃 대비 누적 부담을 유발할 수 있다는 세 가지 점이 주된 위험이다. 이전 리뷰(03_03_22)의 이월 항목(W4 resume-call-stack.spec, W5 mock, W6 e2e round-trip)은 여전히 미완으로 plan 추적 중이다.

## 위험도

LOW

STATUS: DONE
