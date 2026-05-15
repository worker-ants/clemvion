## 발견사항

### [INFO] `waitForFormSubmission` 메서드 JSDoc 불완전
- **위치**: `execution-engine.service.ts` - `waitForFormSubmission` 메서드
- **상세**: JSDoc이 작성되어 있으나 `@param`, `@returns`, `@throws` 태그가 누락되어 있음. `ExecutionCancelledError`가 throw될 수 있음에 대한 문서 없음.
- **제안**:
  ```ts
  /**
   * Pause execution at a Form node and wait for the user to submit form data.
   * @param savedExecution - The persisted Execution entity
   * @param executionId - UUID of the current execution
   * @param node - The Form node causing the pause
   * @param context - Current execution context
   * @throws {ExecutionCancelledError} When cancelWaitingExecution() is called
   */
  ```

### [INFO] `continueExecution` / `cancelWaitingExecution` JSDoc에 예외 명세 누락
- **위치**: `execution-engine.service.ts` L350 근처
- **상세**: `continueExecution`이 throw하는 `Error('No pending continuation...')`에 대한 `@throws` 문서 없음.
- **제안**: `@throws {Error} If no pending continuation exists for the given executionId` 추가

### [INFO] `POST /executions/:id/continue` API 엔드포인트 스펙 문서 미반영
- **위치**: `spec/3-workflow-editor/3-execution.md` §9 API 표
- **상세**: 스펙의 §9 API 표에 `POST /api/executions/:id/continue` 엔드포인트가 추가되지 않음. REST 경유 폼 제출 경로가 명세되지 않아 개발자/소비자가 인지하기 어려움.
- **제안**: §9에 다음 행 추가:
  ```md
  | POST | /api/executions/:id/continue | Form 노드에 사용자 입력 제출 (REST 대안) |
  ```

### [INFO] `ExecutionCancelledError` 클래스 문서 없음
- **위치**: `execution-engine.service.ts` L63
- **상세**: 클래스 선언 바로 위에 어떤 맥락에서, 왜 별도 에러 클래스가 필요한지 설명 없음.
- **제안**:
  ```ts
  /**
   * Thrown when an execution is explicitly cancelled while awaiting Form input.
   * Distinguishes intentional cancellation from unexpected failures so the engine
   * can mark status as CANCELLED instead of FAILED.
   */
  class ExecutionCancelledError extends Error {
  ```

### [INFO] `PRESENTATION_TYPES` 상수 목적 주석 없음
- **위치**: `use-execution-events.ts` L22
- **상세**: Set 리터럴만 있고 왜 이 6개 타입이 결과 히스토리에 추가되어야 하는지 설명 없음.
- **제안**:
  ```ts
  // Node types whose outputs are surfaced in the Run Results Drawer history.
  // Must stay in sync with the PRESENTATION_TYPES defined in the backend handler registry.
  const PRESENTATION_TYPES = new Set([...]);
  ```

### [INFO] `waitingFormConfig: unknown` 타입에 인라인 주석 보완 필요
- **위치**: `execution-store.ts` L39, `ExecutionState` 인터페이스
- **상세**: `unknown` 타입을 사용하는 이유나 실제 런타임 구조에 대한 힌트가 없어 소비자가 as-casting 패턴을 유추해야 함.
- **제안**:
  ```ts
  /**
   * Form node waiting state.
   * waitingFormConfig mirrors the formConfig field from the node's output
   * (see FormHandler output schema). Typed as unknown because the schema is
   * defined in the backend and consumed via DynamicFormUI in the drawer.
   */
  waitingNodeId: string | null;
  waitingFormConfig: unknown;
  ```

### [INFO] `spec/4-nodes/6-presentation-nodes.md` §8.6 Form 항목 업데이트 불충분
- **위치**: `spec/4-nodes/6-presentation-nodes.md` §8 서두 텍스트만 수정됨
- **상세**: 서두 문장은 "채팅형 히스토리 항목"으로 변경되었으나, 하위 §8.6 Form 렌더링 상세(폼 UI → 제출 후 키-값 전환)가 새 히스토리 UI 맥락으로 갱신되지 않았을 가능성 있음 (diff truncation으로 확인 불가).
- **제안**: §8.6 Form 항목이 "탭" 대신 "히스토리 항목" 기준 언어를 사용하는지 확인 및 수정.

### [INFO] `DynamicFormUI` / `renderField` 함수에 JSDoc 없음
- **위치**: `run-results-drawer.tsx` `DynamicFormUI` 컴포넌트
- **상대적 중요도 낮음** — 내부 컴포넌트이지만, `formConfig`의 기대 구조와 `onSubmit` 콜백 계약이 문서화되어 있지 않음.
- **제안**: props 인터페이스 위에 간단한 주석으로 formConfig가 백엔드 FormHandler 출력의 `formConfig` 필드임을 명시.

---

## 요약

이번 변경은 Form 노드 실행 일시정지/재개 기능이라는 핵심 플로우를 추가하며, 스펙 문서(`3-execution.md`, `6-presentation-nodes.md`)도 함께 업데이트되어 전반적인 문서화 의식이 높다. 다만 새로 추가된 REST 엔드포인트(`POST /executions/:id/continue`)가 스펙 §9 API 표에 누락된 것이 가장 실질적인 갭이며, 나머지는 `@throws` 명세 누락, 내부 타입 힌트 부재 등 경미한 수준이다. 구현 코드에 이미 적절한 한국어/영문 혼용 인라인 주석이 포함되어 있고, 복잡한 `waitForFormSubmission` 로직에 단계별 설명이 달려 있어 가독성은 양호하다.

---

## 위험도

**LOW**