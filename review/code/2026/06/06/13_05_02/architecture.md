# 아키텍처(Architecture) 리뷰

## 발견사항

### [WARNING] ExecutionEngineService 단일 책임 원칙(SRP) 위반 심화
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `driveCallStackResume`, `driveResumeFrame`, `injectInvokerOutput`, `snapshotCallStack` 신규 메서드 추가
- 상세: PR-B2b 추가로 `ExecutionEngineService` 가 (1) 그래프 순회 엔진, (2) 상태 영속·스냅샷, (3) call-stack 재진입 오케스트레이션, (4) 이벤트 발행, (5) 에러 단말 처리를 모두 보유한다. 이번 변경만으로 346 줄 규모의 `driveCallStackResume`+`driveResumeFrame` 블록이 서비스 내부에 직접 삽입됐다. 기능 확장이 계속되면 이 클래스가 변경의 단일 병목이 된다.
- 제안: `driveCallStackResume` / `driveResumeFrame` 로직을 `NestedResumeOrchestrator` 또는 `CallStackResumeService` 로 추출하고, `ExecutionEngineService` 는 조율자(facade) 역할만 유지한다. `injectInvokerOutput` 과 `snapshotCallStack` 도 해당 서비스로 이관하면 레이어 경계가 명확해진다. (현 plan §PR-B2b 진행 상태 "full B3 제거" 단계 이후 리팩터링 착수가 현실적이다.)

### [WARNING] ParkReleaseSignal — 흐름 제어를 예외로 처리하는 안티패턴
- 위치: `codebase/backend/src/shared/execution-resume/park-release-signal.ts`, `workflow.handler.ts`, `execution-engine.service.ts` executeNode / runExecution catch 체인
- 상세: `ParkReleaseSignal`은 오류가 아닌 정상 상태 전이("park 신호")를 예외 전파로 구현한다. 이는 Go-to 안티패턴과 유사하게 `try/catch` 체인을 제어 흐름 도구로 오용하는 것으로, 각 계층(WorkflowHandler, executeNode, runExecution, runNodeDispatchLoop)이 모두 이 타입을 알고 `instanceof` 검사 후 re-throw 해야 한다는 강한 결합을 만든다. 새 중간 레이어가 추가될 때마다 이 패턴을 이식하지 않으면 silent 오류가 된다.
- 제안: top-level 과 동일하게 반환값(`{ parked: true }` 또는 `PARK_RELEASED` sentinel)으로 전파하는 것이 이상적이다. 중간에 `NodeHandlerOutput` 계약이 방해가 된다면, `WorkflowHandler`에 `ParkSignalOutput` 특수 포트를 추가하거나(OCP 연장), `executeInline`의 반환 타입을 `{ type: 'result', value: unknown } | { type: 'parked' }` 구분 유니언으로 변경해 예외 없이 전파하는 방식을 고려한다. 단, 이는 인터페이스 변경을 동반하므로 현 PR 범위 내 즉시 수정은 어렵다. 적어도 `isParkReleaseSignal` 타입 가드를 모든 catch 사이트에서 일관되게 사용하고, 누락 사이트를 찾을 수 있도록 eslint 커스텀 룰 또는 단위 테스트 계층 검증을 보완한다.

### [WARNING] driveCallStackResume — 레이어 책임 혼합 및 추상화 부족
- 위치: `execution-engine.service.ts` L1085–L1211 (`driveCallStackResume`)
- 상세: 이 메서드는 하나의 함수 안에서 (a) RUNNING 상태 전이, (b) call-stack frame 복원, (c) 최내/외곽/top-level 세 단계 루프, (d) DB 노드 조회(`nodeRepository.findOneBy`), (e) 에러 종류별 단말 처리, (f) COMPLETED 이벤트 발행을 모두 수행한다. 비즈니스 레이어와 데이터 레이어 오퍼레이션이 단일 메서드에 직접 혼재한다. 240줄 길이의 메서드는 단위 테스트에서 부분 경로만 검증하기 어렵다.
- 제안: (1) COMPLETED 마감 블록을 `finalizeCallStackResumeCompleted(savedExecution, topResult)` 처럼 분리, (2) bubble-up 루프를 `bubbleUpFrames(frames, innerResult, context, executedNodes)` 로 추출, (3) 최내 frame 처리를 `driveResumeFrame` 으로 이미 위임한 패턴을 일관되게 적용한다. 이렇게 하면 각 하위 메서드의 단위 테스트가 독립적으로 가능해진다.

### [INFO] ExecutionContext에 엔진 내부 상태 필드 누적 — 인터페이스 비대화
- 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` — `_callStack` 필드 추가
- 상세: `ExecutionContext`는 핸들러 공개 계약 인터페이스이지만, `_executedNodes`, `_contextKey`, `_callStack` 등 `_` prefix 엔진 내부 필드가 계속 추가된다. 인터페이스 분리 원칙(ISP) 관점에서, 핸들러가 전혀 읽지 않는 필드들이 핸들러 공개 계약에 포함되는 것은 계약 오염이다.
- 제안: `ExecutionContext` 를 `HandlerContext`(핸들러가 읽는 공개 계약)와 `EngineExecutionContext extends HandlerContext`(엔진 전용 내부 상태)로 분리한다. 엔진은 `EngineExecutionContext`로 작동하고, 핸들러에게는 `HandlerContext`만 노출한다. 이는 인터페이스 계층 리팩터링이므로 현 PR 범위는 아니지만, `_callStack` 추가가 이 문제를 한 단계 더 심화시키는 시점임을 기록한다.

### [INFO] driveResumeFrame — loadAndBuildGraph 매 frame 마다 중복 호출
- 위치: `execution-engine.service.ts` `driveResumeFrame` L1238
- 상세: bubble-up 루프에서 외곽 frame 마다 `driveResumeFrame`이 호출되고, 내부에서 `loadAndBuildGraph(opts.workflowId)` 를 반복 수행한다. 동일 workflowId 를 가진 frame 이 여러 개인 경우(재귀 또는 같은 워크플로를 연달아 호출하는 구조) DB + 정렬 연산이 중복 발생한다.
- 제안: `driveCallStackResume` 수준에서 `workflowId → GraphState` 캐싱 맵을 유지하거나, `loadAndBuildGraph` 자체에 단일 실행 스코프(call 내 메모이제이션)를 도입한다. 현재 재귀 깊이 cap(10)이 있어 폭발적 호출은 없지만, 중첩 깊이가 커질수록 latency 영향이 선형 증가한다.

### [INFO] snapshotCallStack의 얕은 복사 범위
- 위치: `execution-engine.service.ts` `snapshotCallStack` L1613–L1624
- 상세: `snapshotCallStack`은 각 frame을 `{workflowId, invokerNodeId, recursionDepth}` 로 복사해 `_callStack` 원본과 참조를 분리한다. 단위 테스트(파일 1)에서도 이 분리를 명시적으로 검증하고 있어 의도는 명확하다. 다만 `ResumeCallStackFrame`에 중첩 객체 필드가 추가될 경우 얕은 복사가 충분하지 않을 수 있다.
- 제안: `structuredClone(f)` 또는 명시적 deep copy 유틸을 사용하거나, `ResumeCallStackFrame`을 순수 primitive 필드(string, number)만 허용하는 제약을 타입 레벨에서 강제한다(`Record<string, string | number>` 제약 또는 Zod 스키마 활용). 현재 구조는 문제없으나 향후 확장에 대한 방어 기록이 필요하다.

### [INFO] 폴링 기반 중첩 재개(fireNested) — 매직 상수와 타이밍 의존
- 위치: `execution-engine.service.ts` `resumeFromCheckpoint` L1029–1046 (`fireNested` 클로저)
- 상세: `NESTED_FIRE_MAX_ATTEMPTS = 250`, `NESTED_FIRE_POLL_MS = 20` (총 5초) 은 `pendingContinuations` 등록을 기다리는 폴링이다. 이는 B3 전이라 in-memory 머신 의존이 잔존하는 과도기 코드임이 주석으로 명시되어 있으나, 현재 PR 범위의 코드로는 폴링 한도 도달 시 silently drop 한다(`logger.warn` 만 발행). 이 경로는 full B3 제거 후 사라질 임시 코드이지만, 제거 전까지는 장애 없는 silent data loss 가 발생할 수 있다.
- 제안: B3 제거 전까지 폴링 타임아웃 시 execution을 `FAILED`로 명시 단말 처리하거나, `RehydrationError('PENDING_REGISTRATION_TIMEOUT')` 를 throw 해 caller 가 in-band 처리하도록 한다. 또는 `driveCallStackResume` 에서 `await + Promise` 로 등록 대기를 명확히 분리해 타이밍 의존성을 제거한다.

### [INFO] WorkflowHandler — ParkReleaseSignal import 위치
- 위치: `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` L6
- 상세: `WorkflowHandler`는 `nodes/flow/workflow` 레이어에 있는 핸들러인데, `execution-engine` 내부 신호(`ParkReleaseSignal`)를 알아야 한다. `ParkReleaseSignal`이 `shared/execution-resume`에 분리된 것은 올바른 결정이지만, 노드 핸들러 레이어가 실행 엔진의 내부 제어 신호를 `instanceof` 검사하게 되는 결합이 발생한다.
- 제안: 현재 `shared/` 위치는 적절하다. 다만 장기적으로 `NodeHandlerOutput`에 `parkSignal?: symbol` 같은 공식 필드를 추가하고, 핸들러는 이 필드를 반환하면 엔진이 `ParkReleaseSignal` throw 를 담당하도록 설계를 역전시키면 핸들러가 엔진 내부 신호 타입에 의존하지 않아도 된다.

---

## 요약

PR-B2b(exec-park D6)는 중첩 sub-workflow blocking durable 재개라는 복잡한 문제를 `ParkReleaseSignal` throw 전파 + `ResumeCallStack` 영속 + frame-by-frame `driveCallStackResume` 재진입으로 해결하는 구조를 도입했다. 전체 설계 방향(선형 call-stack 가정·과도기 in-memory 머신 최소 의존·버전 가드)은 합리적이며 spec 제약(컨테이너 body blocking 금지로 call-stack이 선형임)을 잘 반영한다. 주요 아키텍처 우려는 (1) 예외를 정상 흐름 제어에 사용하는 `ParkReleaseSignal` 패턴이 레이어마다 `instanceof` + re-throw를 강제해 결합도를 높인다는 점, (2) `ExecutionEngineService`에 책임이 계속 집중되고 있다는 점, (3) `ExecutionContext` 인터페이스에 엔진 내부 상태가 누적되는 ISP 위반이다. 이 세 가지는 full B3 제거 이후 구조적 리팩터링 타이밍에 함께 다루어야 할 기술 부채다. 현 PR 단계(B3 전 과도기)의 코드 품질과 의도 명시는 충분하며, 단위 테스트가 핵심 경계(얕은 복사 분리, NULL 명시 재설정)를 검증하고 있다.

## 위험도

MEDIUM

STATUS: SUCCESS
