## 성능 코드 리뷰

### 발견사항

---

**[INFO]** `handleExecutionStarted` 내 동기적 상태 읽기 패턴
- 위치: `use-execution-events.ts`, `handleExecutionStarted` 콜백
- 상세: `useExecutionStore.getState()`를 직접 호출하는 방식은 올바른 패턴이나, 동일 패턴이 `handleNodeStarted`, `handleNodeCompleted`, `handleNodeFailed`, `pollExecutionStatus` 등 여러 곳에서 반복됨. 변경된 코드 자체는 문제없으나 기존 코드와 일관성 있게 유지되고 있음.
- 제안: 현재 구조 유지 (zustand getState() 패턴은 성능상 적합)

---

**[INFO]** `EXECUTION_RESUMED` 이벤트 추가로 인한 WebSocket 이벤트 바인딩 증가
- 위치: `use-execution-events.ts`, useEffect 내 `client.on/off` 섹션
- 상세: 이벤트 핸들러 1개 추가 (`execution.resumed`)는 성능 영향 미미. cleanup에서도 정상 해제되고 있어 메모리 누수 없음.
- 제안: 현재 구현 적절

---

**[INFO]** `handleExecutionStarted`의 이중 역할 — dead code 잔존 가능성
- 위치: `use-execution-events.ts`, `handleExecutionStarted` 콜백 내 `waiting_for_input` 분기
- 상세: 백엔드가 이제 `EXECUTION_RESUMED` 이벤트를 별도로 emit하므로, `handleExecutionStarted` 내의 `waiting_for_input` 가드 분기는 실질적으로 도달하지 않는 경로가 됨. 새 `execution.resumed` 이벤트가 항상 먼저 처리되기 때문. 코드는 무해하지만 불필요한 상태 읽기(`useExecutionStore.getState()`)가 매 `execution.started` 이벤트마다 실행됨.
- 제안: 백엔드가 form resume 시 `execution.started`를 더 이상 emit하지 않는다면 해당 가드 분기 제거 가능. 그렇지 않다면 현재 구조 유지 필요 (방어 코드로서 의미 있음)

---

**[INFO]** `waitForFormSubmission`의 `setTimeout` 메모리 참조
- 위치: `execution-engine.service.ts`, `waitForFormSubmission` 메서드
- 상세: 기존 코드의 이슈이나, `setTimeout` 내 클로저가 `pendingContinuations` Map을 참조하고 있어 타임아웃 기간(기본 30분) 동안 해당 클로저가 GC되지 않음. 실행이 정상 완료되면 타이머는 이미 삭제된 키를 체크하고 조용히 종료되므로 실제 누수는 없음. 단, 대규모 병렬 실행 시 수백 개의 타이머가 동시에 활성화될 수 있음.
- 제안: `clearTimeout` 핸들러를 `pendingContinuations`에 함께 저장하여 `continueExecution`/`cancelWaitingExecution` 호출 시 명시적으로 정리하는 것이 더 안전:
  ```typescript
  private readonly pendingContinuations = new Map<string, {
    nodeId: string;
    resolve: (data?: unknown) => void;
    reject: (err: Error) => void;
    timeoutHandle: ReturnType<typeof setTimeout>; // 추가
  }>();
  ```

---

### 요약

이번 변경은 `EXECUTION_RESUMED` 이벤트 타입을 추가하고 form 재개 시 잘못된 이벤트(`EXECUTION_STARTED`) 대신 올바른 이벤트를 발행하도록 수정한 것으로, 성능 관점에서는 전반적으로 문제가 없다. 신규 이벤트 바인딩은 정상적으로 cleanup되며, 상태 분기 로직도 경량하다. 단, `handleExecutionStarted` 내 `waiting_for_input` 가드 분기가 실질적으로 dead code가 될 수 있어 코드 명확성 측면에서 검토가 필요하고, `waitForFormSubmission`의 장기 실행 타이머(최대 30분)가 대규모 병렬 실행 환경에서는 타이머 핸들을 명시적으로 정리하는 방향으로 개선될 여지가 있다.

### 위험도

**LOW**