## 문서화 코드 리뷰

### 발견사항

- **[INFO]** `EXECUTION_RESUMED` 이벤트 타입에 JSDoc 없음
  - 위치: `websocket.service.ts` — `ExecutionEventType` enum
  - 상세: 새로 추가된 `EXECUTION_RESUMED` 값이 언제, 왜 발생하는지 enum 레벨 주석이 없음. 다른 값들도 주석이 없지만, 이 값은 `EXECUTION_STARTED`와 혼동될 여지가 있음 (form 재개 시에만 발생)
  - 제안: `/** Emitted when execution resumes after a Form node receives user input (not a fresh start) */` 추가

- **[INFO]** `handleExecutionStarted` 내부 guard 로직 설명 부족
  - 위치: `use-execution-events.ts:88-96`
  - 상세: `waiting_for_input` 상태에서 `execution.started` 이벤트를 받을 수 있는 이유(레거시 서버가 `EXECUTION_STARTED`를 재개 이벤트로 보내던 시절의 하위호환 guard)가 코드에 명시되어 있지 않음. 새 서버는 `execution.resumed`를 사용하지만 이 분기는 여전히 존재
  - 제안: `// Legacy fallback: older server versions emitted EXECUTION_STARTED on resume; now superseded by EXECUTION_RESUMED` 주석 추가 또는 이 분기 제거 여부 검토

- **[INFO]** `waitForFormSubmission` JSDoc의 "Transition back to RUNNING" 설명이 새 이벤트 반영 안 됨
  - 위치: `execution-engine.service.ts:377` (메서드 JSDoc)
  - 상세: 기존 JSDoc은 `"transitions back to RUNNING"` 까지만 언급하며 어떤 WebSocket 이벤트가 발생하는지 나열하지 않음. `EXECUTION_RESUMED` 이벤트가 추가되었으므로 JSDoc 업데이트 필요
  - 제안:
    ```ts
    * On resume: merges formData into node output, transitions back to RUNNING,
    * and emits {@link ExecutionEventType.EXECUTION_RESUMED} via WebSocket.
    ```

- **[INFO]** 스펙 문서(`spec/`) 업데이트 필요 여부 확인
  - 위치: `spec/` 디렉토리
  - 상세: WebSocket 이벤트 목록이 스펙에 정의되어 있다면 `execution.resumed` 항목 추가 필요. CLAUDE.md에 따르면 스펙은 항상 최신 상태를 반영해야 함
  - 제안: `spec/` 내 WebSocket 이벤트 관련 문서에 `execution.resumed` 이벤트와 페이로드 형식(`{ executionId, status: "running", timestamp }`) 추가

---

### 요약

이번 변경은 form 재개 시 `EXECUTION_STARTED` 대신 `EXECUTION_RESUMED`를 사용하도록 의미적으로 명확하게 개선한 작업이다. 코드 내 주요 주석(`// Transition back to RUNNING (resumed from form, not a fresh start)`, `handleExecutionResumed` 함수명 등)은 의도를 잘 전달하고 있어 문서화 상태는 전반적으로 양호하다. 다만 `handleExecutionStarted` 내 `waiting_for_input` guard가 왜 남아있는지, 그리고 `waitForFormSubmission` JSDoc이 새 이벤트를 반영하지 않는 점은 향후 유지보수 시 혼동 가능성이 있어 보완이 권장된다.

### 위험도

**LOW**