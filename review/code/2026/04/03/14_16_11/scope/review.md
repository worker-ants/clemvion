## 발견사항

### 파일 1: `websocket.service.ts`
- **[INFO]** `EXECUTION_RESUMED` enum 값 추가
  - 위치: `ExecutionEventType` enum
  - 상세: Form 재개 시 `EXECUTION_STARTED` 대신 구분된 이벤트를 발행하기 위한 의도된 변경. 범위 내.

### 파일 2: `execution-engine.service.ts`
- **[INFO]** `EXECUTION_STARTED` → `EXECUTION_RESUMED` 교체 + 주석 추가
  - 위치: `waitForFormSubmission()` 내 458번째 줄 근방
  - 상세: 의미적으로 정확한 교체. 주석(`// resumed from form, not a fresh start`)은 이 변경의 맥락을 명확히 하므로 적절.

### 파일 3: `use-execution-events.ts`
- **[WARNING]** `handleExecutionStarted` 내 상태 기반 분기 로직 — 범위 경계
  - 위치: `handleExecutionStarted` 콜백 내 `waiting_for_input` 상태 체크
  - 상세: `execution.resumed` 이벤트 핸들러를 별도로 추가했음에도, `handleExecutionStarted` 내에 `waiting_for_input` 상태 guard가 남아 있음. `execution.resumed` 이벤트가 정상 발행된다면 이 guard는 불필요한 방어 로직. 단, 하위 호환성(구버전 서버 대응) 목적이라면 의도된 것일 수 있음.
  - 제안: 이 guard가 의도적 방어 코드라면 주석으로 명시할 것. 불필요하다면 제거하여 로직 단순화.

- **[INFO]** `execution.disconnect` 이벤트 cleanup에 `handleExecutionResumed` 추가
  - 위치: cleanup 반환 함수 및 의존성 배열
  - 상세: 신규 핸들러 등록/해제가 대칭적으로 처리됨. 범위 내.

---

## 요약

변경의 핵심 의도는 Form 노드 재개 시 `execution.started` 대신 `execution.resumed` 이벤트를 사용하여 프론트엔드가 실행 상태를 초기화하지 않도록 구분하는 것이다. 백엔드(enum 추가, 이벤트 타입 교체)와 프론트엔드(신규 핸들러 등록) 모두 해당 의도에 집중된 최소한의 변경이며, 무관한 리팩토링이나 기능 확장은 없다. 다만 `handleExecutionStarted` 내의 `waiting_for_input` 상태 guard는 `execution.resumed` 도입으로 중복 가능성이 있어 의도 명시가 필요하다.

## 위험도

**LOW**