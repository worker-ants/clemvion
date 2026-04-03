### 발견사항

- **[INFO]** 새로운 WebSocket 이벤트 타입 `execution.resumed` 추가
  - 위치: `websocket.service.ts` - `ExecutionEventType` enum
  - 상세: 기존 `execution.started` 이벤트를 재사용하던 방식에서 분리된 전용 이벤트로 명확화. 추가(additive) 변경이므로 기존 클라이언트에 breaking change 없음.
  - 제안: 이벤트 페이로드 스키마(`{ status: ExecutionStatus }`)가 다른 이벤트와 일관성을 유지하고 있어 적절함.

- **[INFO]** 프론트엔드 `handleExecutionStarted`의 하위 호환 처리
  - 위치: `use-execution-events.ts:88-97`
  - 상세: `waiting_for_input` 상태 가드가 추가되었으나, 이는 `execution.resumed` 이벤트 도입 이전 레거시 동작(started로 resumed를 처리하던 방식)에 대한 방어 코드. `execution.resumed` 이벤트가 정상 수신되면 이 경로는 실질적으로 비활성화됨.
  - 제안: 향후 레거시 guard 코드 제거 가능 여부 주석으로 명시 권장.

- **[WARNING]** `execution.started` 이벤트의 역할 중의성
  - 위치: `use-execution-events.ts:88-97`
  - 상세: `execution.started` 핸들러 내부에서 `waiting_for_input` 상태를 감지해 `resumeFromForm()`을 호출하는 로직이 존재함. 이는 `execution.started`와 `execution.resumed` 두 이벤트가 같은 상황을 처리하는 중복 경로를 만든다. 서버가 항상 `execution.resumed`를 발행하면 이 분기는 dead code가 되며, 혼란을 줄 수 있음.
  - 제안: 서버 측 보장(`execution.resumed` 항상 발행)을 확인 후, `handleExecutionStarted`의 `waiting_for_input` 분기를 제거하여 단일 책임 원칙 준수.

---

### 요약

이번 변경은 WebSocket 이벤트 계약에서 `execution.started`가 "재개"와 "신규 시작" 두 의미를 혼용하던 모호함을 `execution.resumed` 이벤트 분리를 통해 명확히 개선한 것이다. 순수 추가(additive) 변경으로 기존 클라이언트 호환성을 유지하며, 페이로드 구조도 기존 이벤트와 일관성을 유지한다. 다만 프론트엔드 `handleExecutionStarted`에 남겨진 `waiting_for_input` 분기가 `handleExecutionResumed`와 중복 역할을 하는 dead code 가능성이 있어 정리가 필요하다.

### 위험도
LOW