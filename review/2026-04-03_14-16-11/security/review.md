## 보안 코드 리뷰 결과

---

### 발견사항

#### 파일 1: `websocket.service.ts`

- **[INFO]** 새로운 이벤트 타입 `EXECUTION_RESUMED` 추가
  - 위치: enum `ExecutionEventType`
  - 상세: 단순 enum 값 추가로 보안 취약점 없음. 기존 이벤트 타입 구조와 일관성 유지됨.
  - 제안: 없음

---

#### 파일 2: `execution-engine.service.ts`

- **[WARNING]** `continueExecution` 메서드에 인가(Authorization) 검증 없음
  - 위치: `continueExecution()` 메서드 전체
  - 상세: `executionId`만 알면 누구든 대기 중인 폼 실행을 재개할 수 있음. 이 메서드를 호출하는 상위 레이어(WebSocket handler 또는 REST endpoint)에서 호출자가 해당 execution의 소유자인지 검증해야 하지만, 이 서비스 레이어에서는 검증이 전혀 없음. 다른 사용자의 폼 실행을 악의적으로 재개하거나 임의 데이터를 주입할 수 있음.
  - 제안: 컨트롤러/게이트웨이 레이어에서 `execution.executedBy === currentUserId` 검증 강제화, 또는 메서드 시그니처에 `requestingUserId` 파라미터 추가 후 내부 검증

- **[WARNING]** `formData` 입력값 검증 없음
  - 위치: `continueExecution(executionId: string, formData?: unknown)` → `waitForFormSubmission` 내 `submittedData: formData`
  - 상세: `formData`가 `unknown` 타입으로 받아져 DB에 그대로 저장됨 (`nodeExec.outputData = updatedOutput`). 크기 제한이나 스키마 검증 없이 임의의 대용량 객체나 중첩 구조를 저장할 수 있어 DB 저장 용량 남용(Payload Flooding) 가능성 있음.
  - 제안: 폼 노드의 `node.config`에 정의된 필드 스키마에 맞춰 `formData`를 검증하고, 최대 크기(예: 1MB) 제한 추가

- **[WARNING]** `node.config?.timeout` 값 검증 없음
  - 위치: `waitForFormSubmission()` 내 `const timeoutMs = ((node.config?.timeout as number) ?? 1800) * 1000;`
  - 상세: 악의적 워크플로우 설계자가 `timeout`을 매우 큰 값(예: `Number.MAX_SAFE_INTEGER`)으로 설정하면 메모리에 `pendingContinuations` 엔트리가 사실상 영구 유지됨. 또는 0이나 음수로 설정 시 즉시 타임아웃 되어 폼 기능 무력화 가능.
  - 제안: `Math.max(60, Math.min(timeout, 86400))` 등으로 범위 제한 적용 (최소 1분, 최대 24시간)

- **[INFO]** 에러 메시지에 내부 스택 트레이스 포함
  - 위치: `runExecution()` catch 블록 내 `stack: error instanceof Error ? error.stack : undefined`
  - 상세: `savedExecution.error.stack`이 DB에 저장되고 클라이언트에 노출될 경우 내부 구조 정보 누출 가능. 현재 코드만으로는 클라이언트 전달 여부 확인 불가하나 잠재적 위험.
  - 제안: 스택 트레이스는 서버 로그에만 기록하고, DB 저장 및 API 응답에서는 제외

- **[INFO]** `recoverStuckExecutions`에서 민감 정보 로그 노출 없음 — 양호

---

#### 파일 3: `use-execution-events.ts`

- **[WARNING]** WebSocket 이벤트 페이로드 타입 단언(Type Assertion) 사용으로 런타임 검증 없음
  - 위치: `handleExecutionResumed`, `handleExecutionStarted` 등 모든 핸들러
  - 상세: `data as { executionId?: string }` 형태의 단순 타입 단언만 사용. 서버가 악의적으로 변조되거나 MitM 공격 시 예상치 못한 페이로드가 들어올 경우 프론트엔드 상태 오염 가능. 특히 `handleWaitingForInput`에서 `waitingNodeId`를 검증 없이 상태에 저장.
  - 제안: zod 등의 런타임 스키마 검증 라이브러리로 페이로드 검증 추가

- **[WARNING]** `useExecutionStore.getState()` 직접 호출 — 경쟁 조건(Race Condition) 가능성
  - 위치: `handleExecutionStarted` 내 `const { status: currentStatus } = useExecutionStore.getState()`
  - 상세: WebSocket 이벤트 핸들러가 동시에 여러 번 호출될 경우, 상태 읽기와 쓰기 사이의 경쟁 조건으로 인해 `resumeFromForm`과 `startExecution`이 예상치 않게 동시 실행될 수 있음. 기존의 `execution.started` 이벤트 가드 로직도 상태 일관성 측면에서 취약.
  - 제안: Zustand의 `setState` 내에서 atomic하게 처리하거나, 이벤트 처리를 직렬화하는 큐 메커니즘 도입

- **[INFO]** `handleExecutionResumed`가 페이로드를 사용하지 않음
  - 위치: `const handleExecutionResumed = useCallback(() => { resumeFromForm(); }, [resumeFromForm])`
  - 상세: 서버에서 `{ status: ExecutionStatus.RUNNING }`을 보내지만 프론트엔드에서 무시됨. 보안 취약점은 아니나, 향후 페이로드 검증 로직 추가 시 일관성 유지 필요.
  - 제안: 명시적으로 `(_data: unknown) =>` 시그니처 추가하여 의도 명확화

---

### 요약

이번 변경은 Form 노드 일시정지/재개 기능을 위한 `EXECUTION_RESUMED` 이벤트 타입 추가와 프론트엔드 핸들러 바인딩으로, 기능 범위는 좁고 구현 방향은 적절합니다. 그러나 **가장 큰 보안 리스크는 `continueExecution` 메서드의 인가 검증 누락**으로, 호출 레이어(WebSocket 게이트웨이 또는 REST 컨트롤러)에서 해당 execution의 소유자인지 반드시 확인해야 합니다. 그 외 `formData` 입력값 검증 부재와 타임아웃 값의 범위 미제한은 서비스 남용 벡터가 될 수 있으며, 프론트엔드의 WebSocket 페이로드 런타임 검증 부재는 방어적 프로그래밍 관점에서 보강이 필요합니다.

---

### 위험도

**MEDIUM**