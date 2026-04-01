### 발견사항

- **[WARNING]** `ExecutionData.status`에 `"cancelled"` 상태 존재하나 테스트에서 `"failed"`로 매핑
  - 위치: `executions.ts:21`, `use-execution-events.test.ts:196`
  - 상세: API 응답 타입은 `"cancelled"`를 유효한 상태로 정의하지만, 테스트 케이스 "handles cancelled execution from poll"에서 `cancelled` 응답이 store에 `"failed"`로 저장되기를 기대함. 이는 의도적인 매핑인지, 아니면 `"cancelled"` 상태를 store에서 별도 처리해야 하는지 계약이 불명확함.
  - 제안: `ExecutionData.status`에서 `"cancelled"`와 `"failed"`의 의미적 차이를 명확히 하고, 매핑 로직을 문서화하거나 store에 `"cancelled"` 상태를 추가

- **[WARNING]** `NodeExecutionData`에 `"waiting_for_input"` 상태가 존재하나 이벤트 핸들러 테스트에서 누락
  - 위치: `executions.ts:7`, `use-execution-events.test.ts:69-79`
  - 상세: 타입 정의에는 `"waiting_for_input"` 상태가 있으나, 이벤트 바인딩 테스트에서 `execution.node.waiting_for_input` 이벤트 핸들러가 검증되지 않음. 상태 전환이 API 응답에는 존재하지만 WebSocket 이벤트로는 표현되지 않는다면 계약 불일치 가능성 있음.
  - 제안: `waiting_for_input` 상태에 대응하는 WebSocket 이벤트 핸들러가 없는지 명시적으로 확인하고, 없다면 해당 상태는 폴링 전용임을 문서화

- **[INFO]** `nodeExecutions` 배열에 `id`, `executionId`, `startedAt`, `finishedAt`, `retryCount` 필드가 타입에는 있으나 테스트 mock 응답에서 생략
  - 위치: `use-execution-events.test.ts:99-116`
  - 상세: 테스트 mock 데이터가 실제 API 응답의 필수 필드 일부를 포함하지 않음. API가 항상 전체 필드를 반환한다면 테스트 픽스처가 실제 응답과 괴리가 있음.
  - 제안: 테스트 mock 데이터를 실제 API 스키마에 맞게 완성하거나, 선택적 필드는 타입에서 `?` 표시로 명시

- **[INFO]** REST 엔드포인트가 `GET /executions/:id` 하나만 정의됨
  - 위치: `executions.ts:30-31`
  - 상세: 목록 조회(`GET /executions`), 취소(`DELETE/POST /executions/:id/cancel`) 등 관련 엔드포인트가 없음. 현재 구현 범위인지, 미구현 상태인지 불명확.
  - 제안: 의도적으로 폴링 전용 최소 API라면 주석으로 범위를 명시

---

### 요약

`executions.ts`의 타입 계약은 전반적으로 명확하고 REST 원칙을 따르고 있으나, `cancelled` 상태가 API 응답 타입에는 독립 값으로 존재하면서 클라이언트 store에서는 `failed`로 흡수되는 묵시적 매핑이 가장 큰 계약 불명확점이다. 또한 `NodeExecutionData`의 `waiting_for_input` 상태가 WebSocket 이벤트 계약에 반영되지 않아 상태 동기화 경로가 일관되지 않을 가능성이 있다. 인증은 WebSocket 연결 시 토큰을 전달하는 방식으로 구현되어 있으며, REST API는 `apiClient`를 통해 공통 인증을 위임하고 있어 별도 이슈는 없다.

### 위험도
**MEDIUM**