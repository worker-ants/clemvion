# Code Review 통합 보고서

**대상**: PR-B2b — exec-park D6 (중첩 sub-workflow call-stack 영속 + frame-by-frame 재개)
**일시**: 2026-06-06 13:05

---

## 전체 위험도

**HIGH** — 핵심 신규 로직(`driveCallStackResume`·`driveResumeFrame` 400+줄)의 단위 테스트 전면 부재 및 `resumeFromCheckpoint` callStack 분기 통합 테스트 미비가 회귀 감지 신뢰성을 현저히 저하시킨다. 아키텍처·요구사항 관점에서는 설계 의도가 명확하고 spec과 대체로 부합하나, 과도기 코드(fireNested 폴링, ParkReleaseSignal 예외-흐름 패턴)의 기술 부채가 MEDIUM 수준으로 누적된다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `driveCallStackResume` / `driveResumeFrame` / `injectInvokerOutput` 전용 단위 테스트 부재 — frame-by-frame 재진입 로직(AI/form/button 분기, parked 조기 반환, COMPLETED 마감, ParkReleaseSignal 방어) 전체가 테스트 사각지대 | `execution-engine.service.spec.ts` | `as unknown as {...}` 패턴으로 private 접근 노출 후 (1) 단일 depth AI COMPLETED; (2) 2-depth bubble-up + invoker output 주입; (3) 최내·외곽 frame parked → return; (4) RehydrationError → markExecutionCancelled; (5) ParkReleaseSignal catch 흡수 케이스 커버 |
| 2 | Testing | `resumeFromCheckpoint` callStack non-null 분기(`driveCallStackResume` 진입 경로) 통합 테스트 미비 — call-stack 버전 가드(`version > CALL_STACK_SCHEMA_VERSION` → RehydrationError)도 미커버 | `execution-engine.service.spec.ts` `Rehydration §7.5` | (a) `resumeCallStack = { version:1, frames:[...] }` → driveCallStackResume 호출 spyOn 검증; (b) `version: 999` → RESUME_INCOMPATIBLE_STATE 취소 마킹 검증 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `ExecutionEngineService` SRP 위반 심화 — `driveCallStackResume`+`driveResumeFrame` 346줄 블록이 서비스 내부에 직접 삽입되어 (1)그래프 순회, (2)상태 영속, (3)call-stack 재진입 오케스트레이션, (4)이벤트 발행, (5)에러 단말 처리가 단일 클래스에 집중 | `execution-engine.service.ts` | `NestedResumeOrchestrator` / `CallStackResumeService` 로 추출 — full B3 제거 단계 이후 착수 |
| 2 | Architecture | `ParkReleaseSignal` — 정상 상태 전이를 예외 전파로 처리하는 안티패턴. 각 레이어(WorkflowHandler·executeNode·runExecution·runNodeDispatchLoop)가 모두 `instanceof` + re-throw 강제, 새 중간 레이어 추가 시 silent 오류 위험 | `park-release-signal.ts`, `workflow.handler.ts`, `execution-engine.service.ts` | 장기: `NodeHandlerOutput`에 `{ type: 'parked' }` 유니언 반환 타입으로 전환. 단기: 모든 catch 사이트에 `isParkReleaseSignal` 타입 가드 일관 사용 + ESLint 커스텀 룰 또는 단위 테스트 계층 검증 보완 |
| 3 | Architecture / Maintainability | `driveCallStackResume` 단일 메서드에 6단계 책임(상태 전이·frame 복원·최내 처리·bubble-up·top-level forward·COMPLETED 마감·에러 처리) 집중, 240~400줄 길이 | `execution-engine.service.ts` L1085–L1411 | `finalizeCallStackResumeCompleted`, `bubbleUpFrames`, `handleInnermostFrameTurn` 헬퍼로 분리 |
| 4 | Requirement | `driveCallStackResume`가 `resumeFromCheckpoint`에서 detached(`.catch()`)로 호출 — 에러 가시성 저하, 중첩 재개 에러 발생 시 caller(worker)는 성공으로 인식, `markExecutionCancelled` 내 2차 DB 예외가 Execution을 RUNNING 잔류시킬 위험 | `execution-engine.service.ts` `resumeFromCheckpoint` | `markExecutionCancelled`/`markNodeExecutionFailed` 내부 2차 예외를 `.catch(secondaryErr => logger.error(...))` 로 suppress하거나 last-resort try-catch로 FAILED fallback 마킹; `driveCallStackResume` 에러 경로 단위 테스트 추가 |
| 5 | Requirement | `fireNested` polling 5초 한도 초과 시 payload silently drop + execution RUNNING 영구 잔류 — B3 전 과도기 설계이나 알람 부재 | `execution-engine.service.ts` resumeFromCheckpoint fireNested 블록 | polling 한도 초과 시 `RESUME_FAILED` 명시 단말 처리 또는 `RehydrationError('PENDING_REGISTRATION_TIMEOUT')` throw; B3 완료 전까지 "알려진 한계" 주석 보강 |
| 6 | Requirement | `driveCallStackResume` 진입 시 `frames.length === 0` 방어 코드 미존재 — `frames[frames.length - 1]` undefined 접근 가능 | `execution-engine.service.ts` driveCallStackResume L2259–2268 | `if (!frames.length) throw new RehydrationError('RESUME_CHECKPOINT_MISSING', 'resume_call_stack frames is empty')` 방어 가드 추가 |
| 7 | Testing | `WorkflowHandler` — `ParkReleaseSignal` re-throw 케이스 단위 테스트 없음. 분기 누락 시 `buildSubWorkflowError`로 흡수되어 잘못된 error 포트 라우팅 발생 | `workflow.handler.spec.ts` | `execute - error propagation` 블록에 `mockExecutor.executeInline.mockRejectedValue(new ParkReleaseSignal())` 후 handler reject 검증 + error 포트 미반환 확인 |
| 8 | Testing | `executeInline` `_callStack` push/pop 동작 단위 테스트 부재 — 정상·ParkReleaseSignal 예외 경로 모두 finally pop 미검증 | `execution-engine.service.spec.ts` `executeInline — Sub-Workflow parent linking` | (1) invokerNodeId 있을 때 frame push; (2) 정상 반환 후 pop; (3) 예외 시에도 finally pop 실행 검증 |
| 9 | Testing | `isParkReleaseSignal` 타입 가드 전용 spec 파일 없음 — `park-release-signal.ts` 전체 미커버 | `shared/execution-resume/park-release-signal.ts` | `park-release-signal.spec.ts` 신설: instanceof/isParkReleaseSignal true/false, null 처리 4케이스 |
| 10 | Testing | `snapshotCallStack` 버전 stamp 테스트가 하드코딩 `1`로 고정 — `CALL_STACK_SCHEMA_VERSION` 상수 drift 미감지 | `execution-engine.service.spec.ts` L9804–9808 | `toBe(1)` → `toBe(CALL_STACK_SCHEMA_VERSION)` 교체; frame 객체 레퍼런스 분리 검증 추가 |
| 11 | Documentation | `waitForFormSubmission` JSDoc의 `@todo PR-B2/B3: Strategy 패턴 추출 예정` 항목이 B3 미완료 상태에서 제거 — B3 착수 시 리마인더 소실 | `execution-engine.service.ts` waitForFormSubmission docstring | B3 완료 시점까지 `@todo` 또는 인라인 주석 "waitForX 분기 + Strategy 추출은 full B3 에서 처리(exec-park-durable-resume.md §B3)" 유지 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `RehydrationError` 메시지에 `invokerNodeId`·`executionId`·`workflowId` 등 내부 식별자 평문 포함 — API/WebSocket 경로로 클라이언트 도달 가능성 | `execution-engine.service.ts` driveCallStackResume | 클라이언트 노출 문자열은 에러 코드만, 상세 식별자는 logger.error에만 기록 |
| 2 | Security | `driveCallStackResume` 재진입 시 DB에서 읽은 `callStack.frames` 필드에 타입 검사 외 유효성 검증 없음 | `execution-engine.service.ts` driveCallStackResume | frames 각 항목의 비어있지 않음·recursionDepth 범위 방어 검증 추가 |
| 3 | Security | `fireNested` setTimeout 취소 플래그 미비 — driveCallStackResume 조기 종료 후 예약된 체인 미취소, 이론적 리소스 누수 | `execution-engine.service.ts` fireNested | `cancelled` 변수 또는 AbortController 추가; B3 제거 대상 명시 추적 |
| 4 | Security | `context.nodeId` optional — undefined 전달 시 call-stack frame push silent skip, 재개 불가 조용한 실패 | `workflow.handler.ts` L401 | `context.nodeId` undefined 시 명시적 throw 또는 경고 로그 |
| 5 | Architecture | `ExecutionContext` 공개 인터페이스에 엔진 내부 상태 필드(`_callStack`) 누적 — ISP 위반 심화 | `node-handler.interface.ts` | `HandlerContext`/`EngineExecutionContext` 분리 — 기술 부채 기록 |
| 6 | Architecture | `driveResumeFrame`이 bubble-up 루프에서 매 frame마다 `loadAndBuildGraph` 중복 호출 | `execution-engine.service.ts` driveResumeFrame | driveCallStackResume 수준 `workflowId → GraphState` 캐싱 맵 도입 |
| 7 | Architecture | `snapshotCallStack` 얕은 복사 — `ResumeCallStackFrame`에 중첩 객체 필드 추가 시 불충분 | `execution-engine.service.ts` snapshotCallStack | `structuredClone` 또는 primitive 필드만 허용 타입 제약 |
| 8 | Maintainability | `NESTED_FIRE_MAX_ATTEMPTS`·`NESTED_FIRE_POLL_MS` 가 메서드 내부 지역 const — 기존 폴링 상수와 값 불일치 리스크 | `execution-engine.service.ts` | 클래스 private static 또는 모듈 상수로 이동 |
| 9 | Maintainability | `injectInvokerOutput`에서 `contextKeyOf(context)` 두 줄 연속 중복 호출 | `execution-engine.service.ts` injectInvokerOutput | 지역 변수로 한 번만 계산 |
| 10 | Maintainability | `DriveCallStackResumeOptions`·`DriveResumeFrameOptions` 인터페이스 미정의 — opts 인라인 타입 필드 8–9개 | `execution-engine.service.ts` | 파일 상단에 전용 인터페이스 정의 |
| 11 | Maintainability | `isParkReleaseSignal` 타입 가드 export됐으나 서비스 코드에서 미사용(dead export) | `park-release-signal.ts` | `instanceof` 패턴을 타입 가드로 통일하거나 `/** @internal */` 표시 |
| 12 | Maintainability | 테스트 파일에서 인라인 타입 캐스팅 3회 이상 반복 | `execution-engine.service.spec.ts` | 테스트 파일 내 헬퍼 타입 선언 |
| 13 | Side Effect | `fireNested` 폴링 타이머(최대 5초)가 graceful shutdown 지연 가능 | `execution-engine.service.ts` fireNested | `isShuttingDown()` 체크 추가 |
| 14 | Side Effect | `driveResumeFrame`의 `lastNodeId`가 graph 물리적 마지막 노드 기준 — 조건 분기 중간 종료 시 output undefined, bubble-up 중 출력 유실 미테스트 | `execution-engine.service.ts` driveResumeFrame | undefined output downstream 안전 처리 단위 테스트 보증 |
| 15 | Testing | `driveResumeFrame` RehydrationError 엣지케이스 미커버 — `startPointer === undefined`·AI `buildRetryReentryState` 실패 | `execution-engine.service.ts` driveResumeFrame | 단위 테스트 추가 |
| 16 | SPEC-DRIFT | [SPEC-DRIFT] spec §7.5 step 2 "각 프레임의 이미 완료된 노드는 `execution_node_log`에서 seed" vs 구현의 rehydrate 단계 in-memory Set 재사용 — 기능 동등하나 문면 불일치 | `spec/5-system/4-execution-engine.md §7.5 step 2` | 코드 유지. spec 문구 갱신 (project-planner) |
| 17 | SPEC-DRIFT | [SPEC-DRIFT] spec §7.5 step 2 "executeInline 재호출" vs 구현의 `driveResumeFrame` 직접 그래프 구동 — 구현이 re-entrancy 문제 회피를 위해 더 안전한 경로 채택 | `spec/5-system/4-execution-engine.md §7.5 step 2` | 코드 유지. spec 문구 "driveResumeFrame으로 직접 구동"으로 갱신 (project-planner) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | HIGH | driveCallStackResume·driveResumeFrame 단위 테스트 전면 부재; resumeFromCheckpoint callStack 분기 통합 미비; WorkflowHandler ParkReleaseSignal re-throw 미테스트 |
| architecture | MEDIUM | SRP 위반 심화; ParkReleaseSignal 예외-흐름 안티패턴; driveCallStackResume 과도한 책임 집중; ISP 위반 |
| requirement | MEDIUM | fireNested polling silent failure; driveCallStackResume frames 방어 가드 부재; detached 호출 에러 가시성 저하; SPEC-DRIFT 2건 |
| maintainability | MEDIUM | driveCallStackResume 125줄 다책임; ParkReleaseSignal catch-rethrow 4곳 분산; 타입 가드 미사용 |
| security | LOW | 내부 식별자 에러 메시지 포함; frames 입력 검증 부재; setTimeout 취소 미비 |
| side_effect | LOW | 2차 DB 예외 에러 경계 약점; fireNested 타이머 shutdown 지연 |
| documentation | LOW | waitForFormSubmission @todo 조기 제거(B3 미완료) |
| scope | NONE | 전체 변경 범위가 plan §PR-B2b 명시 항목과 정확히 대응, 불필요한 변경 없음 |

---

## 발견 없는 에이전트

- **scope**: 7개 파일 모두 plan §PR-B2b 범위 내, 불필요한 변경 없음.

---

## 권장 조치사항

1. **[필수 — Critical #1]** `driveCallStackResume`·`driveResumeFrame` 단위 테스트 신설 (최소 6케이스: 단일 depth AI COMPLETED, 2-depth bubble-up, 최내·외곽 parked 반환, RehydrationError → markExecutionCancelled, ParkReleaseSignal catch 흡수)
2. **[필수 — Critical #2]** `resumeFromCheckpoint` callStack non-null 분기 통합 테스트 추가 — driveCallStackResume 호출 spyOn 검증 + 버전 가드(version:999) RESUME_INCOMPATIBLE_STATE 검증
3. **[필수 — WARNING #7]** `workflow.handler.spec.ts`에 ParkReleaseSignal re-throw 케이스 추가
4. **[필수 — WARNING #8]** `executeInline` `_callStack` push/pop 단위 테스트 — 정상·예외 경로 finally pop 검증
5. **[필수 — WARNING #9]** `park-release-signal.spec.ts` 신설 — instanceof/타입가드 4케이스
6. **[권장 — WARNING #10]** `snapshotCallStack` 테스트의 하드코딩 `1` → `CALL_STACK_SCHEMA_VERSION` 상수 참조 교체
7. **[권장 — WARNING #6]** `driveCallStackResume` 진입 시 `frames.length === 0` 방어 가드 추가
8. **[권장 — WARNING #4·#5]** `markExecutionCancelled` 2차 예외 suppress 패턴 추가; fireNested 타임아웃 시 FAILED 단말 처리
9. **[권장 — WARNING #11]** `waitForFormSubmission` @todo B3 리마인더 주석 복원
10. **[SPEC-DRIFT — INFO #16·#17]** `spec/5-system/4-execution-engine.md §7.5 step 2` 두 군데 문구 갱신 (project-planner 위임)
11. **[기술 부채 — 중기]** full B3 제거 단계에서: `NestedResumeOrchestrator` 추출, `ParkReleaseSignal` 반환값 패턴으로 전환, `HandlerContext`/`EngineExecutionContext` 인터페이스 분리, fireNested 폴링 제거

---

## 라우터 결정

라우터 사용 (`routing=done`).

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외**: 6명

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | router 선별 제외 |
| dependency | router 선별 제외 |
| database | router 선별 제외 |
| concurrency | router 선별 제외 |
| api_contract | router 선별 제외 |
| user_guide_sync | router 선별 제외 |