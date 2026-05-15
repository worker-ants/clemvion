### 발견사항

- **[INFO]** `execution.started` 이벤트 핸들러 내부에서 store 상태를 직접 읽는 방식
  - 위치: `use-execution-events.ts`, `handleExecutionStarted` 콜백
  - 상세: `useExecutionStore.getState()`를 이벤트 핸들러 내부에서 직접 호출하여 현재 상태를 확인하는 방식은 기능적으로 문제없지만, 이미 별도의 `execution.resumed` 이벤트와 핸들러(`handleExecutionResumed`)가 추가되어 있음에도 불구하고 `execution.started` 핸들러에 `waiting_for_input` 가드 로직이 중복 존재함. 백엔드가 이미 resumed/started를 구분하여 올바른 이벤트를 emit하므로, `handleExecutionStarted` 내부의 가드 조건은 불필요한 방어 코드임.
  - 제안: `handleExecutionStarted`에서 `waiting_for_input` 가드 및 `resumeFromForm()` 분기를 제거하고, `handleExecutionResumed`에만 resume 로직을 집중시켜 단일 책임을 유지.

- **[INFO]** `useEffect` 의존성 배열에 `resumeFromForm` 누락
  - 위치: `use-execution-events.ts`, `useEffect` deps 배열 (라인 449 근방)
  - 상세: `handleExecutionResumed`가 deps에 추가되었으나, `resumeFromForm` 자체는 deps 배열에 없음. `handleExecutionResumed`가 클로저로 `resumeFromForm`을 캡처하므로 실질적 문제는 없지만, exhaustive-deps lint 규칙에 걸릴 수 있음.
  - 제안: `resumeFromForm`을 deps 배열에 추가하거나, eslint-disable 주석으로 의도를 명시.

- **[INFO]** `EXECUTION_RESUMED` 이벤트의 payload 의미 일관성
  - 위치: `execution-engine.service.ts:458~465`, `websocket.service.ts`
  - 상세: `EXECUTION_RESUMED` 이벤트의 payload가 `{ status: ExecutionStatus.RUNNING }`인데, 프론트엔드의 `handleExecutionResumed`는 payload를 아예 무시하고 `resumeFromForm()`만 호출함. 이벤트 설계 상 payload가 무의미하게 전달되는 구조.
  - 제안: 해당 이벤트 payload에 `resumedFromNodeId` 등 프론트엔드에서 활용 가능한 정보를 포함시키거나, 프론트엔드 핸들러가 payload를 받아 처리하도록 개선하면 향후 확장성이 높아짐.

---

### 요약

이번 변경의 핵심 목적인 **form 재개 시 `execution.started` 이벤트를 `execution.resumed`로 분리**하는 결정은 아키텍처적으로 올바른 방향이다. 백엔드의 이벤트 타입 분리(`EXECUTION_STARTED` vs `EXECUTION_RESUMED`)와 프론트엔드의 별도 핸들러 등록은 SRP와 명확한 이벤트 시맨틱을 잘 반영한다. 다만, 분리된 이벤트가 이미 존재함에도 `handleExecutionStarted` 내부에 `waiting_for_input` 가드 로직이 남아 있어 이중 방어가 존재하며, 이는 이벤트 계약의 명확성을 희석시킨다. 전체적으로 결합도와 레이어 경계는 적절히 유지되고 있으며, 변경 범위가 최소화되어 위험도는 낮다.

### 위험도

LOW