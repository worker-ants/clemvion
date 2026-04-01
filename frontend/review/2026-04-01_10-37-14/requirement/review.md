### 발견사항

**[WARNING] `executionsApi`에 실행 목록 조회 및 취소 API 누락**
- 위치: `executions.ts` - `executionsApi` 객체
- 상세: `getById`만 구현되어 있으나, 워크플로우 실행 이력 조회(`list`), 실행 취소(`cancel`) 등 일반적으로 필요한 엔드포인트가 없음. `ExecutionData`의 `status`에 `"cancelled"`가 정의되어 있어 취소 기능이 존재하는 것으로 보이나 API가 없음.
- 제안: 스펙 문서에서 필요 엔드포인트를 확인하여 `list`, `cancel` 등 추가

**[WARNING] `cancelled` 상태를 `failed`로 처리하는 의도 불명확**
- 위치: `use-execution-events.test.ts:167` - `handles cancelled execution from poll`
- 상세: 테스트가 `cancelled` 상태 응답 시 store의 `status`가 `"failed"`가 되길 기대함. 취소(cancelled)와 실패(failed)는 의미상 다른 상태인데, 이를 동일하게 처리하는 것이 비즈니스 요구사항인지 아니면 구현 편의상 처리인지 불명확함.
- 제안: `execution-store`에 `"cancelled"` 상태를 별도로 추가하거나, 의도적인 병합이라면 주석으로 근거 명시

**[WARNING] `useExecutionEvents` 테스트에서 WebSocket 이벤트 핸들러 동작 검증 누락**
- 위치: `use-execution-events.test.ts` 전반
- 상세: `binds all event handlers` 테스트는 핸들러 등록 여부만 확인하고, 실제 이벤트 수신 시 store 상태 업데이트가 올바른지 검증하는 테스트가 없음. `execution.started`, `execution.node.started` 등 이벤트 핸들러의 실제 동작은 전혀 테스트되지 않음.
- 제안: `mockClient.on`의 mock 구현을 통해 이벤트 발생 시뮬레이션 후 store 상태 변화 검증 추가

**[WARNING] `waiting_for_input` 노드 상태에 대한 테스트 없음**
- 위치: `use-execution-events.test.ts`
- 상세: `NodeExecutionData.status`에 `"waiting_for_input"` 이 정의되어 있으나, 이 상태의 노드가 poll 결과에 포함될 때 store가 어떻게 처리하는지 테스트가 없음.
- 제안: `waiting_for_input` 상태의 nodeExecution이 포함된 poll 응답 처리 테스트 추가

**[INFO] `ws-client.test.ts`에서 `on`/`off` 이벤트 핸들러 동작 테스트 부재**
- 위치: `ws-client.test.ts`
- 상세: `on`, `off` 메서드가 `createWsClient`의 인터페이스에 포함되지만, 이 메서드들이 실제로 socket의 이벤트를 올바르게 바인딩/해제하는지 검증하는 테스트가 없음.
- 제안: `on`/`off` 호출 시 `mockSocket.on`/`mockSocket.off`가 올바른 인자로 호출되는지 검증하는 테스트 추가

**[INFO] `NodeExecutionData.error`와 `ExecutionData.error` 타입 불일치**
- 위치: `executions.ts:11`, `executions.ts:22`
- 상세: `NodeExecutionData.error`는 `{ message?: string } | null`, `ExecutionData.error`는 `{ message?: string; stack?: string } | null`. 노드 에러에 `stack`이 없는 것이 의도적인 스펙 차이인지 확인 필요.
- 제안: 스펙 문서 확인 후 일관성 유지 또는 의도적 차이라면 주석으로 명시

**[INFO] `act` import 미사용**
- 위치: `use-execution-events.test.ts:2`
- 상세: `import { ..., act, ... }` 에서 `act`가 import되었으나 테스트 코드 내 사용처 없음.
- 제안: 미사용 import 제거

---

### 요약

`executions.ts`는 단순 조회 API만 구현되어 있어 취소 등 상호작용 기능이 스펙에 존재할 경우 미완성 상태임. 테스트 코드는 WebSocket 클라이언트의 연결/구독/정리 생명주기와 poll 기반 상태 동기화를 잘 커버하고 있으나, WebSocket 이벤트 핸들러의 실제 동작(이벤트 수신 → store 업데이트)에 대한 검증이 전무하여 핵심 실시간 기능의 회귀를 감지하기 어려운 상태임. `cancelled` 상태의 `failed` 처리 매핑은 의도 명확화가 필요하며, `waiting_for_input` 같은 특수 상태에 대한 테스트도 보완이 필요함.

### 위험도

**MEDIUM**