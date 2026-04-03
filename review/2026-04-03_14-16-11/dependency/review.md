## 의존성 코드 리뷰

### 발견사항

- **[INFO]** 새로운 외부 패키지 의존성 없음
  - 위치: 전체 변경 파일
  - 상세: 이번 변경은 기존 내부 모듈과 타입만 활용. `ExecutionEventType.EXECUTION_RESUMED` 추가, `resumeFromForm` 액션 연결 등 모두 이미 존재하는 모듈 내에서 처리됨.
  - 제안: 해당 없음

- **[INFO]** 내부 의존성 방향 적절
  - 위치: `execution-engine.service.ts` → `websocket.service.ts`
  - 상세: `WebsocketService`는 `forwardRef`로 주입되어 있으며, `EXECUTION_RESUMED` enum 값이 `websocket.service.ts`에 선언되고 `execution-engine.service.ts`에서 import하는 단방향 흐름을 유지함. 순환 의존성 위험 없음.
  - 제안: 해당 없음

- **[INFO]** 프론트엔드 내부 의존성 흐름 적절
  - 위치: `use-execution-events.ts` → `execution-store`
  - 상세: `resumeFromForm`은 이미 `useExecutionStore`에서 제공되는 액션이며, 새로운 import 없이 기존 구조에서 구조분해로 추가됨. `useExecutionStore.getState()` 직접 호출 방식은 기존 파일 내 패턴과 일관됨.
  - 제안: 해당 없음

- **[WARNING]** `handleExecutionStarted` 내 `useExecutionStore.getState()` 직접 호출
  - 위치: `use-execution-events.ts`, `handleExecutionStarted` 콜백 내부
  - 상세: WebSocket 이벤트 핸들러 안에서 store의 최신 상태를 읽기 위해 `useExecutionStore.getState()`를 직접 호출하는 패턴이 사용됨. 이는 파일 내 기존 패턴과 일관되나, `execution.started`와 `execution.resumed`가 동시에 도달했을 때의 race condition 가능성이 있음. 서버가 `EXECUTION_RESUMED`를 별도로 emit하므로 `execution.started`에서 상태 체크로 분기하는 현재 로직은 중복 처리 경로를 만듦.
  - 제안: `execution.started` 핸들러에서 상태 분기 로직을 제거하고, `execution.resumed` 이벤트만으로 `resumeFromForm()`을 처리하는 단일 책임 구조로 정리하는 것이 의존성 관계를 더 명확하게 유지함.

### 요약

이번 변경은 새로운 외부 패키지 의존성을 전혀 추가하지 않으며, 기존 내부 모듈 구조(`WebsocketService` enum, `execution-store` 액션)를 올바르게 확장한다. 백엔드는 `ExecutionEventType` enum에 `EXECUTION_RESUMED`를 추가하고 이를 적절한 위치에서 emit하며, 프론트엔드는 해당 이벤트를 수신해 `resumeFromForm` 액션으로 연결하는 흐름이 내부 의존성 방향에 부합한다. 다만 `execution.started` 핸들러에 상태 분기 로직이 추가되어, `execution.started`와 `execution.resumed` 두 이벤트 모두 `resumeFromForm()`으로 이어질 수 있는 중복 경로가 생긴 점은 경미한 구조적 우려 사항이다.

### 위험도

**LOW**