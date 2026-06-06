# Architecture Review — exec-park D6 full B3

## 발견사항

### [INFO] 아키텍처 방향 — in-memory 상태 머신 제거는 올바른 결정
- 위치: `execution-engine.service.ts` 전체 (Map 제거 구간)
- 상세: `pendingContinuations` Map + `firstSegmentBarriers` Map + `armFirstSegmentBarrier`/`settleFirstSegment`/`signalParkBarrier` + `firePayload` 폴링 스케줄러 + `runAiConversationLoop` 장수 루프 + detached 코루틴 모델을 일거에 제거한 것은 SOLID 의 단일 책임(SRP) 관점에서 매우 긍정적이다. 이 in-memory 상태 머신은 본질적으로 "BullMQ 큐 + DB WAITING 행"과 동일한 역할을 이중 수행하던 구조였고, 그로 인해 fast-path/slow-path 분기·폴링·배리어라는 3개의 추가 추상화 레이어가 필요했다.
- 제안: 현재 방향 유지.

### [INFO] 단일 재개 경로 일원화 — 결합도 감소
- 위치: `applyContinuation` (~line 944), `runExecutionFromQueue` (~line 3059)
- 상세: 이전 구조에서 `applyContinuation` 은 fast-path(in-memory resolver hit) / slow-path(rehydration) 두 갈래를 가졌고, `runExecutionFromQueue` 는 `armFirstSegmentBarrier` → detached `runExecution` → `await settled` 삼중 패턴이었다. 변경 후 두 메서드 모두 단일 경로(rehydration / direct `await runExecution`)로 단순화됐다. 이는 결합도 감소와 테스트 가능성 향상에 직접 기여한다.
- 제안: 현재 방향 유지.

### [WARNING] `driveCallStackResume`/`driveResumeFrame` — 명시적 인터페이스가 없는 암묵적 호출 계약
- 위치: `execution-engine.service.ts` (변경된 `resumeFromCheckpoint` 구간, driveResumeDetached 구간)
- 상세: `processFormResumeTurn` / `processButtonResumeTurn` / `processAiResumeTurn` 세 처리기는 `driveResumeFrame`(중첩)과 `driveResumeDetached`(top-level) 두 caller 가 각각 호출하는 구조다. 처리기 시그니처가 private 메서드로 타입만 보장되며, "frame 처리기가 PARK_RELEASED 를 반환하면 세그먼트 종료" 라는 계약이 인터페이스나 타입 레벨에서 표현되지 않고 주석과 Symbol 반환값으로만 표현된다. `ParkSignal` 타입은 선언됐지만 처리기 간 반환 타입 합집합이 명시적 discriminated union 없이 `void | ParkSignal` 혼용으로 관리된다. 이는 향후 처리기 추가 시 계약 위반을 컴파일 타임에 잡기 어렵다.
- 제안: `ProcessTurnResult = void | ParkSignal` 을 named type alias 로 분리하고, 세 처리기가 `Promise<ProcessTurnResult>` 를 명시 반환하도록 통일하면 인터페이스 분리(ISP) 측면에서 명확해진다.

### [WARNING] `processFormResumeTurn` 내 상태 전이 분기 — SRP 미세 위반
- 위치: `execution-engine.service.ts` `processFormResumeTurn` 내 `updateExecutionStatus` 조건 분기 구간
- 상세: 변경 후 `processFormResumeTurn` 은 `savedExecution.status === ExecutionStatus.RUNNING` 여부를 직접 검사해 `nodeExecutionRepository.save` 와 `updateExecutionStatus` 두 경로를 분기한다. 이 분기는 "재개 드라이브가 이미 RUNNING 전이를 했으므로 중복 전이 방지" 라는 caller-side 사전조건에 의존하는 것으로, 처리기 자신이 caller 의 상태 전이 시퀀스를 알고 방어해야 하는 암묵적 결합이다. `finalizeAiNode` 에도 동일 가드가 "대칭"으로 존재한다고 주석에 기술돼 있어, 동일 패턴이 두 처리기에 복제(DRY 위반)된다.
- 제안: `updateExecutionStatus` 에 "이미 target 상태면 no-op" 멱등 가드를 추가하거나, "RUNNING 전이가 완료됐음"을 처리기에 명시적 파라미터(`alreadyRunning: boolean`)로 전달해 내부 분기 지식을 제거한다. 후자가 의존성 역전(DIP) 측면에서 더 명확하다.

### [INFO] `driveCallStackResume` — 레이어 책임 분리 양호
- 위치: `execution-engine.service.ts` `driveCallStackResume`
- 상세: frame-by-frame 재진입 로직(`driveCallStackResume` → innermost frame 처리 → bubble-up → top-level forward)이 `executeInline` 재호출 없이 별도 드라이버로 분리된 것은 레이어 책임 분리 관점에서 올바르다. `executeInline` 은 fresh 실행 초기화(callStack push/pop, 재귀 깊이 증분, DB 조회) 책임을 가지며, 재진입은 이미 영속된 스냅샷을 구동하는 다른 책임이다. 두 경로를 분리한 것은 SRP 준수이다.
- 제안: 현재 방향 유지.

### [INFO] `ParkMode` 타입 제거 — 좋은 안티패턴 제거
- 위치: `execution-engine.service.ts` line 1118 삭제
- 상세: `ParkMode = 'await' | 'release'` 는 `waitForFormSubmission` / `waitForButtonInteraction` / `waitForAiConversation` 세 메서드가 "fresh park" 와 "resume 재진입" 두 역할을 하나의 메서드에서 분기 처리하던 안티패턴(Feature Envy + 분기 기반 다형성)이었다. 이를 제거하고 `waitForFormSubmission` 은 park 전용, `processFormResumeTurn` 은 재개 전용으로 분리한 것은 개방-폐쇄(OCP)와 단일 책임(SRP) 원칙 모두에 부합한다.
- 제안: 현재 방향 유지.

### [INFO] 테스트 구조 — private 상태 직접 접근 관용 패턴 정리
- 위치: `execution-engine.service.spec.ts` (getPendings 헬퍼 제거, pendingContinuations 직접 조작 제거)
- 상세: 이전 테스트는 `pendingContinuations` Map 을 `as unknown as {...}` 로 직접 접근해 테스트 더블을 수동 구성하는 패턴이 광범위하게 사용됐다. 이는 구현 세부사항에 결합된 취성 테스트(brittle test) 패턴이다. 변경 후 `rehydrateAndResume` 을 `jest.spyOn` 으로 스텁하는 패턴으로 교체됐는데, 이는 여전히 `as unknown as` 캐스팅이 필요하지만 public/protected 경계에 가까운 메서드를 스텁하므로 상대적으로 나은 구조다.
- 제안: 중장기적으로 `rehydrateAndResume` 을 테스트 가능성을 위해 `protected` 로 승격하거나, 별도 `ResumeOrchestrator` 클래스로 추출해 DI 경계를 명확히 하면 `as unknown as` 없이 테스트 가능해진다.

### [INFO] W9 테스트 시맨틱 변경 — 아키텍처 결정의 테스트 반영
- 위치: `execution-engine.service.spec.ts` W9 블록 (~line 967)
- 상세: `replay turn(RUNNING) 중 도달한 cancel 은 graceful no-op` 으로 시맨틱이 변경된 것은, "cancel 이 DB WAITING 행을 마킹하는 단일 경로" 라는 아키텍처 결정의 자연스러운 귀결이다. 이전 구조에서는 in-memory pending reject 로 즉각 CANCELLED 가 가능했으나, durable 경로에서는 RUNNING 중 UPDATE affected:0 → no-op 이 올바른 동작이다. 이 시맨틱 변경은 아키텍처 결정과 정합하며, 테스트가 이를 명확히 문서화한다.
- 제안: W4 테스트 삭제(in-memory cancel race 제거)에 대응하는 통합 테스트(RUNNING 중 cancel → 다음 park 시 CANCELLED)가 e2e 또는 integration 레벨에 존재하는지 확인 권장.

### [INFO] E2E 테스트 — 중첩 cold rehydration 검증
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` (~line 2047)
- 상세: 중첩 sub-workflow form park → cold rehydration resume 을 `resume_call_stack` DB 컬럼 직접 검증으로 커버하는 e2e 케이스가 추가됐다. 특히 frame 수, `workflowId`, `invokerNodeId` 까지 검증하고, 완료 후 `resume_call_stack = NULL` 정리도 검증하는 것은 아키텍처 불변식을 외부 가시 계약 수준에서 보증하는 좋은 패턴이다.
- 제안: 현재 방향 유지.

### [INFO] Spec 갱신 — 구현 완료 상태 반영
- 위치: `spec/5-system/4-execution-engine.md`, `spec/1-data-model.md`, `spec/conventions/execution-context.md`
- 상세: spec 이 구현 완료 상태를 정확히 반영했고, 과도기 서술(잠정 잔존 머신)이 제거됐다. `_callStack` 필드가 `execution-context.md` 에 내부 필드로 등록됐고, `resume_call_stack` 컬럼 설명이 구현 상태로 갱신됐다. Spec-impl 정합 측면에서 이번 변경 셋이 가장 깔끔하게 동기화됐다.
- 제안: 삭제된 `plan/in-progress/spec-update-exec-park-d6-rehydration-step2.md` 의 제안 사항(W2 SPEC-DRIFT: direct-drive vs executeInline 재호출)이 `spec/5-system/4-execution-engine.md` Rationale 에 직접 반영됐음을 확인 — 올바른 처리.

## 요약

이번 변경은 `ExecutionEngineService` 에 존재하던 "in-memory continuation 상태 머신(`pendingContinuations` + `firstSegmentBarriers` + 폴링 스케줄러 + detached 코루틴)"을 완전히 제거하고, park = 세그먼트 종료 + 재개 = §7.5 rehydration 단일 경로로 일원화한 대형 아키텍처 리팩토링이다. SOLID 관점에서 보면, 이전 구조는 `waitForFormSubmission` 같은 메서드가 fresh park 와 resume 재진입이라는 두 책임을 `ParkMode` 분기로 수행하고(SRP 위반), fast-path/slow-path 이중 재개 경로가 테스트 격리를 어렵게 했으며(DIP 약화), 폴링 스케줄러와 배리어가 응집도 낮은 결합을 만들었다. 변경 후 각 처리기(`processFormResumeTurn`/`processButtonResumeTurn`/`processAiResumeTurn`)는 단일 책임을 갖고, `driveCallStackResume`/`driveResumeFrame` 이 frame-by-frame 재진입을 담당하며, worker 는 단순 `await runExecution` 으로 park 를 기다린다. 구조적으로 완성도 높은 전환이며, 남은 경미한 우려사항은 처리기 반환 타입 명시화(WARNING 1)와 `updateExecutionStatus` 중복 분기 패턴(WARNING 2)으로 향후 처리기가 늘어날 경우에 대비한 예방적 개선이다.

## 위험도

LOW
