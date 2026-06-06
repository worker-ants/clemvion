# 보안(Security) 리뷰 결과

## 발견사항

### [INFO] 에러 메시지에 내부 ID 노출 — RehydrationError / logger.error
- 위치: `execution-engine.service.ts` — `driveCallStackResume`, `driveResumeFrame` 내 `RehydrationError` 생성 및 `logger.error` 호출부
- 상세: `RehydrationError` 메시지에 `invokerNodeId`, `executionId`, `startNode.id`, `workflowId` 등 내부 식별자가 평문으로 포함된다. 예시: `` `중첩 재개 invoker 노드 ${invokerNodeId} 정의 부재 (execution=${executionId})` ``. 이 에러는 `markExecutionCancelled`를 통해 DB에 기록되고, 경우에 따라 WebSocket 이벤트 또는 API 응답으로 클라이언트에 전파될 수 있다. 내부 노드 ID·실행 ID가 외부 노출될 경우 공격자가 객체 참조 구조를 파악하는 데 활용될 수 있다.
- 제안: 클라이언트에 노출되는 에러 메시지와 서버 내부 로그를 분리한다. `markExecutionCancelled`에 전달하는 문자열은 에러 코드(`RESUME_CHECKPOINT_MISSING` 등)만 사용하고, 상세 식별자는 서버 로그(logger)에만 기록한다. `buildSubWorkflowError`의 `truncateForErrorDetails` 패턴을 참고한다.

### [INFO] `context._callStack` 프레임에 대한 입력 검증 부재 — snapshotCallStack / driveCallStackResume
- 위치: `execution-engine.service.ts` — `snapshotCallStack`, `driveCallStackResume` 내 `callStack.frames` 사용부
- 상세: `snapshotCallStack`은 `context._callStack`을 DB에 영속할 때 `workflowId`, `invokerNodeId`, `recursionDepth` 세 필드만 얕은 복사로 직렬화한다. 이 구조는 엔진 내부에서만 생성되므로 외부 입력 경로가 없어 인젝션 위험은 낮다. 그러나 `driveCallStackResume` 재진입 시 DB에서 읽어 온 `callStack.frames`의 각 필드(`workflowId`, `invokerNodeId`)에 대해 문자열 타입 검사 외 유효성 검증이 없다. 롤링 배포 중 손상된 행이나 비정상 데이터가 있을 경우 `nodeRepository.findOneBy({id: invokerNodeId})`가 의도하지 않은 노드를 반환할 수 있다.
- 제안: `driveCallStackResume` 진입 시 `frames` 배열의 각 항목에 대해 `workflowId`, `invokerNodeId`가 비어있지 않은 문자열인지, `recursionDepth`가 0 이상 허용 한도 이하인지 방어 검증을 추가한다. 유효하지 않으면 `RESUME_INCOMPATIBLE_STATE`로 조기 종료한다.

### [INFO] `NESTED_FIRE_MAX_ATTEMPTS` 폴링 타이머 누수 가능성 — driveCallStackResume fireNested
- 위치: `execution-engine.service.ts` — `driveCallStackResume` 내 `fireNested` setTimeout 폴링 블록 (L1029–1044)
- 상세: `driveCallStackResume`가 form/button 재개 경로에서 `setTimeout` 재귀 폴링(`NESTED_FIRE_MAX_ATTEMPTS=250`, 20ms 간격 = 최대 5초)을 실행한다. `driveCallStackResume` 자체가 에러로 조기 종료되더라도 이미 예약된 `setTimeout` 체인은 취소되지 않는다. `attemptsLeft <= 0` 시 `this.resolvePending`을 호출하지 않고 warn 만 남기고 종료하므로, 해당 실행이 종료된 후 뒤늦게 `resolvePending`이 호출되어 다른 실행과 키 충돌이 발생할 가능성이 낮지만 이론적으로 존재한다.
- 제안: `fireNested` 내부에 취소 플래그(`cancelled` 변수) 또는 `AbortController`를 두어 `driveCallStackResume` finally 블록에서 폴링을 중단할 수 있도록 한다. 또는 B3 단계에서 `pendingContinuations` 기반 인프라 전체를 제거할 계획이므로 해당 폴링 로직도 같이 제거 대상으로 명시적으로 추적한다.

### [INFO] ParkReleaseSignal 메시지에 내부 정보 포함
- 위치: `codebase/backend/src/shared/execution-resume/park-release-signal.ts` L21
- 상세: `ParkReleaseSignal`의 `super` 메시지 `'Nested sub-workflow blocking node parked (durable release)'`는 서버 내부 아키텍처 설명이다. 이 에러가 최상위 `driveCallStackResume` catch에서 `return`으로 흡수되므로 외부에 직접 노출되지는 않는다. 다만 미래에 일반 에러 핸들러가 이 메시지를 로그 이상의 경로(API 에러 응답 등)로 전파할 경우 내부 구조 노출 가능성이 있다.
- 제안: `ParkReleaseSignal`은 sentinel 용도이므로 메시지를 짧고 불투명하게(`'park'` 또는 빈 문자열)로 유지하거나, 코드 리뷰 등에서 이 타입이 외부 노출 경로에 도달하지 않음을 명시적으로 검증한다.

### [INFO] `invokerNodeId: context.nodeId` — undefined 전달 가능성 무시
- 위치: `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` L401 (`invokerNodeId: context.nodeId`)
- 상세: `context.nodeId`는 인터페이스 정의상 optional(`?`)이다. 엔진이 dispatch 직전 항상 주입하지만 직접 단위 테스트나 비정상 호출 경로에서는 `undefined`가 될 수 있다. `invokerNodeId`가 `undefined`일 경우 `executeInline`에서 call-stack frame이 push되지 않아(`pushedCallStackFrame = false`) 중첩 park 발생 시 `resume_call_stack`에 해당 frame이 빠져 재개 불가 상태(`RESUME_CHECKPOINT_MISSING`)로 조용히 실패할 수 있다.
- 제안: `WorkflowHandler.execute`의 sync mode 진입 시 `context.nodeId`가 `undefined`이면 명시적으로 에러를 throw하거나 경고 로그를 남겨 조용한 실패를 방지한다. 또는 `executeInline` 내에서 `invokerNodeId`가 없을 때 call-stack frame 미삽입을 warn 수준으로 기록한다.

## 요약

이번 변경(PR-B2b — exec-park D6 중첩 sub-workflow call-stack 영속)은 실행 엔진 내부 상태 기계의 확장이며, 외부 입력 직접 처리 경로나 인증/인가 계층 변경을 포함하지 않는다. SQL 인젝션, XSS, 커맨드 인젝션, 하드코딩된 시크릿, 암호화 알고리즘 문제는 발견되지 않았다. 주요 보안 관심사는 내부 식별자(executionId, nodeId, workflowId)가 에러 메시지 및 로그에 포함되어 API/WebSocket 경로를 통해 클라이언트에 도달할 가능성이며, 이는 OWASP A05(보안 구성 오류) 및 A09(보안 로깅 실패) 범주에 해당한다. `driveCallStackResume`의 setTimeout 폴링 취소 미처리는 이론적 리소스 누수 가능성이 있으나 현 단계(B3 제거 전)에서는 낮은 위험도다. 전반적으로 기능 목적에 비해 보안 노출 면적이 작고, 발견된 항목은 INFO 수준이다.

## 위험도

LOW
