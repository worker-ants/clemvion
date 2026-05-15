### 발견사항

- **[WARNING]** `handleExecutionStarted`에 `execution.resumed` 이벤트 처리 로직의 잔재가 남아있음
  - 위치: `use-execution-events.ts`, `handleExecutionStarted` 콜백 (라인 88–97)
  - 상세: `execution.started` 핸들러 내부에서 `currentStatus === "waiting_for_input"` 체크 후 `resumeFromForm()`을 호출하는 분기가 존재함. 이제 `execution.resumed` 이벤트와 전용 `handleExecutionResumed` 핸들러가 추가되었으므로, 이 guard 로직은 불필요한 이중 처리이며 의도를 흐림. 백엔드가 `EXECUTION_RESUMED`를 올바르게 emit하므로 이 분기는 dead code에 준함.
  - 제안: `handleExecutionStarted`에서 `waiting_for_input` guard를 제거하고, `resumeFromForm` 의존성도 제거. 오직 `handleExecutionResumed`만 resume 로직을 담당하도록 단일 책임 유지.

- **[INFO]** `handleExecutionStarted` 내 `useExecutionStore.getState()` 직접 호출
  - 위치: `use-execution-events.ts`, 라인 92
  - 상세: 콜백 내부에서 store state를 직접 읽기 위해 `useExecutionStore.getState()`를 호출하는 패턴이 다른 핸들러들과 일관성이 없음. 이미 위의 WARNING이 해소되면 자동으로 제거됨.
  - 제안: WARNING 해소 시 함께 정리.

- **[INFO]** `EXECUTION_RESUMED` 이벤트 페이로드와 핸들러 간 타입 불일치
  - 위치: `execution-engine.service.ts` 라인 471, `use-execution-events.ts` `handleExecutionResumed`
  - 상세: 백엔드는 `{ status: ExecutionStatus.RUNNING }`을 페이로드로 전송하지만, 프론트엔드 `handleExecutionResumed`는 `() => { resumeFromForm(); }` 로 데이터를 완전히 무시함. 현재는 문제없으나, 향후 페이로드 구조가 확장될 경우 타입 계약이 문서화되지 않아 혼란을 줄 수 있음.
  - 제안: `handleExecutionResumed`의 시그니처를 `(data: unknown) => void`로 명시하거나, 최소한 주석으로 페이로드 구조를 문서화.

---

### 요약

이번 변경의 핵심인 `EXECUTION_RESUMED` 이벤트 도입은 의도가 명확하고 백엔드/프론트엔드 간 역할 분리도 적절하다. 다만 `handleExecutionStarted` 내부에 resume 처리 분기가 잔존하면서 `execution.started`와 `execution.resumed` 두 곳에서 동일한 `resumeFromForm()`이 호출될 수 있어 단일 책임 원칙을 위반하고 있다. 이 guard를 제거하면 각 이벤트 핸들러의 역할이 명확해지고 향후 디버깅도 수월해진다.

### 위험도
LOW