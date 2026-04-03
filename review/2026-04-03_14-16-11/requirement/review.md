### 발견사항

- **[WARNING]** `handleExecutionStarted`의 중복 처리 로직과 `handleExecutionResumed`의 역할 분리 불완전
  - 위치: `use-execution-events.ts:88-99`
  - 상세: 백엔드는 이제 `execution.resumed` 이벤트를 별도로 발행하는데, `handleExecutionStarted`에서 여전히 `waiting_for_input` 상태를 감지하여 `resumeFromForm()`을 호출하는 방어 로직이 남아있음. 정상 흐름에서 `execution.started`는 재개 시 더 이상 발행되지 않으므로, 이 분기는 실제로는 도달하지 않는 dead code에 가깝지만, 이벤트 순서 보장이 없는 환경에서 혼란을 줄 수 있음
  - 제안: `handleExecutionStarted`에서 `waiting_for_input` 분기 제거 후, `handleExecutionResumed`에만 재개 로직을 집중시킬 것. 혹은 명시적인 주석으로 레이스 컨디션 방어 의도를 문서화할 것

- **[WARNING]** `resumeFromForm` 함수의 구현이 리뷰 범위에 없어 동작 검증 불가
  - 위치: `use-execution-events.ts:101-103`
  - 상세: `resumeFromForm()`이 `execution-store`에서 어떻게 구현되어 있는지 확인되지 않음. 특히 `waiting_for_input` 상태의 form 노드 결과(`nodeResults`)와 `nodeStatuses`를 보존하면서 실행 상태만 `running`으로 전환하는지 보장이 필요함. 이 함수가 상태를 잘못 초기화하면 사용자가 입력한 폼 데이터가 UI에서 사라질 수 있음
  - 제안: `execution-store.ts`에서 `resumeFromForm` 구현 확인 및 해당 로직에 대한 단위 테스트 추가

- **[WARNING]** 폴링 로직이 `execution.resumed` 이벤트를 처리하지 않음
  - 위치: `use-execution-events.ts:330-380` (pollExecutionStatus 함수)
  - 상세: REST 폴링으로 `running` 상태를 감지할 경우 `resumeFromForm()`이 호출되지 않음. 폴링에서는 `waiting_for_input` → `running` 전환을 별도로 감지하지 않아서, WebSocket이 연결 불안정하거나 `execution.resumed` 이벤트가 유실된 경우 UI가 계속 폼 입력 대기 상태에 머무를 수 있음
  - 제안: `pollExecutionStatus`에서 이전 상태가 `waiting_for_input`이었고 현재 상태가 `running`인 경우 `resumeFromForm()` 호출 추가

- **[INFO]** `ExecutionEventType.EXECUTION_RESUMED` 열거형 추가에 따른 프론트엔드 타입 정의 일관성
  - 위치: `websocket.service.ts:5`, `use-execution-events.ts:101`
  - 상세: 백엔드의 이벤트 타입과 프론트엔드의 문자열 리터럴(`"execution.resumed"`)이 분리되어 있어, 이후 이벤트명 변경 시 동기화 누락 위험이 있음. 현재는 일치하므로 기능 상 문제없음
  - 제안: 프론트엔드에도 이벤트 타입 상수를 정의하거나, 타입 생성 도구로 백엔드 열거형을 공유하는 방안 검토

---

### 요약

이번 변경의 핵심 의도(`execution.started` 재사용 → `execution.resumed` 분리)는 올바르게 구현되었으며, 백엔드와 프론트엔드가 대체로 일관성 있게 연동되어 있다. 다만 `handleExecutionStarted`에 남아있는 `waiting_for_input` 분기 코드가 `handleExecutionResumed`와 책임이 중복되어 코드 의도를 흐리고, 폴링 경로에서 `RUNNING` 재전환 감지가 누락되어 WebSocket 유실 시 UI가 폼 대기 상태에 고착될 수 있다. `resumeFromForm` store 구현에 대한 테스트 커버리지 확보가 필요하다.

### 위험도

**MEDIUM**