### 발견사항

---

**[WARNING] `waitForFormSubmission` 메서드가 너무 많은 책임을 가짐**
- 위치: `execution-engine.service.ts`, `waitForFormSubmission` 메서드
- 상세: 단일 메서드가 상태 전환, DB 업데이트(execution + nodeExecution), WS 이벤트 emit, Promise 대기, 출력 병합, 재개 상태 전환까지 7가지 이상의 책임을 수행함. 메서드 길이도 약 70줄로 과도함.
- 제안: `transitionToWaiting()`, `mergeFormOutput()`, `transitionToResumed()` 등으로 단계별 분리

---

**[WARNING] `runExecution` catch 블록 내 취소/실패 처리 로직 중복**
- 위치: `execution-engine.service.ts:305-341`
- 상세: `ExecutionCancelledError` 처리 블록과 일반 실패 처리 블록이 `finishedAt`, `durationMs` 계산, `executionRepository.save`, `websocketService.emitExecutionEvent` 호출을 각각 중복 포함함.
- 제안: `finalizeExecution(execution, status, error?)` 헬퍼 메서드로 추출

---

**[WARNING] `handleSubmitForm`이 인증된 사용자 검증 없이 임의 실행 재개를 허용**
- 위치: `websocket.gateway.ts:156-182`
- 상세: `@ConnectedSocket()` 파라미터를 받지 않아 요청한 소켓이 해당 `executionId` 채널을 구독 중인지 확인하지 않음. 인증된 다른 사용자가 타인의 execution을 재개할 수 있음. 이는 유지보수 시 보안 회귀를 유발할 수 있는 구조적 취약점임.
- 제안: `@ConnectedSocket() client: Socket` 파라미터를 추가하고, `this.subscriptions.get(client.id)?.has(\`execution:${data.executionId}\`)` 검증 로직 삽입

---

**[WARNING] `renderField`가 독립 함수로 추출되었으나 컴포넌트 계층 외부에 위치**
- 위치: `run-results-drawer.tsx`, `renderField` 함수
- 상세: `renderField`는 JSX를 반환하는 함수임에도 React 컴포넌트가 아닌 일반 함수로 정의되어 있어, React DevTools에서 추적되지 않고 `key` 경고 관리가 어려움. `select`/`radio` 케이스에서 `field.options`가 없을 경우 빈 렌더링으로 조용히 실패함.
- 제안: `FormFieldInput` 컴포넌트로 전환하거나, `options` 필수 여부를 타입 레벨에서 구분

---

**[WARNING] 폴링과 WebSocket 이벤트에서 프레젠테이션 노드 결과 수집 로직 중복**
- 위치: `use-execution-events.ts:123-158` (handleNodeCompleted) vs `use-execution-events.ts:210-228` (pollExecutionStatus 내부)
- 상세: `PRESENTATION_TYPES.has(outputType)` 확인 후 `addNodeResult` 호출하는 패턴이 두 곳에 동일하게 구현됨. 타입 추가/변경 시 두 곳 모두 수정해야 함.
- 제안: `tryAddPresentationResult(nodeId, outputData)` 헬퍼 함수로 추출

---

**[WARNING] `waiting_for_input` 상태의 폴링 종료 조건 불명확**
- 위치: `use-execution-events.ts:242-255`
- 상세: `waiting_for_input` 상태에서 `return false`로 폴링을 계속하지만, 사용자가 폼을 제출하여 실행이 재개된 후 폴링이 다시 `running`을 감지하는 로직이 명시적으로 없음. `pauseForForm` 호출 후 폼을 제출하면 폴링이 다음 주기에 자연스럽게 `running`을 받지만, 이 흐름이 코드에 문서화되지 않아 유지보수 시 혼란을 줄 수 있음.
- 제안: 해당 `return false` 라인에 "폴링 유지 — 폼 제출 후 다음 폴링에서 running/completed 전환 감지" 주석 추가

---

**[INFO] `ExecutionCancelledError`가 모듈 수준에서 파일 내부에 정의됨**
- 위치: `execution-engine.service.ts:66-71`
- 상세: 파일 상단의 클래스 선언이 `export` 없이 정의되어 있어 테스트에서 직접 참조 불가. 에러 타입 테스트 작성 시 `instanceof` 체크를 검증하기 어려움.
- 제안: 별도 파일(`execution-errors.ts`)로 export하거나, 최소한 `export`를 추가

---

**[INFO] `waitingFormConfig` 타입이 `unknown`으로 너무 광범위함**
- 위치: `execution-store.ts:40`
- 상세: `waitingFormConfig: unknown`은 `DynamicFormUI`가 기대하는 `{ fields: FormField[], title?: string, ... }` 구조와 괴리가 있음. 프론트엔드에서 이미 `FormField` 인터페이스가 정의되어 있으므로, store 타입과 동기화되지 않음.
- 제안: `FormConfig` 인터페이스를 공유 타입으로 추출하여 store와 컴포넌트에서 동일하게 사용

---

**[INFO] `#EC4899` 하드코딩된 색상값**
- 위치: `run-results-drawer.tsx`, `HistoryEntry` 컴포넌트
- 상세: `text-[#EC4899]`가 직접 삽입되어 있어 디자인 토큰 변경 시 누락될 수 있음.
- 제안: CSS 변수 또는 Tailwind 커스텀 컬러 토큰으로 추출

---

**[INFO] `continueExecution` / `cancelWaitingExecution` 메서드명이 비대칭**
- 위치: `execution-engine.service.ts:390-408`
- 상세: `continue-` 접두사와 `cancel-` 접두사가 혼용됨. `resumeExecution` / `cancelExecution`처럼 일관된 동사 쌍이 더 명확함.
- 제안: `continueExecution` → `resumeExecution`으로 rename (Gateway, 테스트 포함 일괄 변경)

---

### 요약

이번 변경은 Form 노드 기반 실행 일시정지/재개 기능을 구현한 것으로, 전반적인 설계 방향(백엔드 Promise 기반 continuation, 프론트엔드 store 상태 분리, WebSocket/폴링 이중화)은 합리적이다. 그러나 `waitForFormSubmission` 메서드의 과도한 책임 집중, 폴링·이벤트 핸들러 간 결과 수집 로직 중복, WebSocket 핸들러에서 소유권 검증 누락이 주요 유지보수성 위험이다. `unknown` 타입의 과도한 사용과 하드코딩된 값들은 타입 안전성과 디자인 일관성을 해친다. 전반적으로 **Warning 수준의 이슈 3건을 우선 해결**하면 중장기 유지보수성이 크게 개선될 것이다.

### 위험도

**MEDIUM**