## Side Effect 코드 리뷰

### 발견사항

---

**파일 1: `executions.ts`**

- **[INFO]** 신규 파일로 기존 코드에 대한 Breaking Change 없음
  - 위치: 전체 파일
  - 상세: `executionsApi.getById`는 `apiClient.get`을 위임하는 thin wrapper로, 자체적인 상태 변경이나 부작용 없음. `apiClient` 싱글톤 의존은 있으나 이는 설계 의도에 부합함.
  - 제안: 이상 없음

---

**파일 2: `use-execution-events.test.ts`**

- **[WARNING]** 모듈 수준 `mockClient` 객체가 테스트 간 공유됨
  - 위치: `const mockClient = { ... }` (최상단 선언)
  - 상세: `beforeEach`에서 `vi.clearAllMocks()`로 mock 함수들은 초기화되지만, `mockClient` 객체 자체는 모듈 스코프에서 공유됨. `isConnected`, `waitForConnect`의 기본 구현이 `mockClient` 선언부에 직접 정의되어 있어, 특정 테스트에서 이를 `mockImplementation`으로 교체하면 `mockRestore` 없이 다음 테스트에 영향을 줄 수 있음. `clearAllMocks`는 구현을 복원하지 않음(`resetAllMocks`와 다름).
  - 제안: `vi.clearAllMocks()` → `vi.resetAllMocks()`로 교체하거나, 혹은 각 테스트 후 `mockImplementation` 복원 추가. 또는 `beforeEach`에서 `mockClient`의 기본 구현을 명시적으로 재설정:
    ```ts
    mockClient.isConnected.mockReturnValue(true);
    mockClient.waitForConnect.mockResolvedValue(undefined);
    ```

- **[WARNING]** `useExecutionStore` 전역 상태가 테스트 간 불완전하게 초기화될 수 있음
  - 위치: `beforeEach` → `useExecutionStore.setState(...)`
  - 상세: `setState`는 partial merge이므로, store에 `beforeEach`에서 나열되지 않은 필드(예: 향후 추가될 필드)가 있다면 이전 테스트의 값이 남아있을 수 있음. 현재는 문제 없으나 store 확장 시 잠재적 부작용.
  - 제안: `useExecutionStore.setState({...}, true)` (두 번째 인수 `true`는 Zustand에서 replace 모드)를 사용하여 완전 교체 보장.

- **[INFO]** `act` import가 선언되어 있으나 사용되지 않음
  - 위치: `import { renderHook, act, waitFor }` (2번 라인)
  - 상세: Dead import. 린트 경고 발생 가능.
  - 제안: `act` 제거.

- **[INFO]** `handles cancelled execution from poll` 테스트의 기대값이 구현 가정에 의존
  - 위치: 해당 `it` 블록
  - 상세: `cancelled` 상태를 `failed`로 처리하는 것이 명시적 스펙인지 확인 필요. 향후 `cancelled` 상태가 별도로 처리되도록 구현이 변경되면 테스트가 잘못된 방향으로 고정될 수 있음.
  - 제안: 테스트 설명에 의도("cancelled는 failed로 매핑") 명시 또는 별도 상태 추가 고려.

---

**파일 3: `ws-client.test.ts`**

- **[CRITICAL]** `mockSocket`이 모듈 스코프 공유 객체이면서 `connected` 프로퍼티를 직접 변조
  - 위치: `mockSocket.connected = true` / `mockSocket.connected = false` (여러 테스트)
  - 상세: `vi.clearAllMocks()`는 mock 함수는 초기화하지만 `connected`와 같은 일반 프로퍼티는 초기화하지 않음. `beforeEach`에서 `mockSocket.connected = false`로 수동 리셋하고 있어 현재는 동작하지만, 테스트 실행 순서 변경이나 병렬 실행 시 상태 오염 가능성이 있음. 특히 `skips connect if already connected` 테스트에서 `connected = true`로 설정 후 다음 테스트에 영향을 주는 구조.
  - 제안: `beforeEach`의 `mockSocket.connected = false` 리셋은 현재도 있으나, 모든 `mockSocket` 프로퍼티를 안전하게 초기화하는 factory 패턴 고려:
    ```ts
    let mockSocket: typeof createMockSocket extends () => infer R ? R : never;
    const createMockSocket = () => ({ connected: false, on: vi.fn(), ... });
    beforeEach(() => { mockSocket = createMockSocket(); mockIo.mockReturnValue(mockSocket); });
    ```

- **[WARNING]** `resetWsClient` 함수가 프로덕션 코드에 노출된 테스트 전용 API
  - 위치: `import { createWsClient, getWsClient, resetWsClient } from "../ws-client"`
  - 상세: 싱글톤 초기화를 위한 `resetWsClient`가 프로덕션 코드에서 export되면 외부 코드에서 의도치 않게 싱글톤을 리셋할 수 있음. 이는 전역 WebSocket 연결 상태에 대한 부작용 노출.
  - 제안: `resetWsClient`를 테스트 환경에서만 노출하도록 처리:
    ```ts
    // ws-client.ts
    export const resetWsClient = process.env.NODE_ENV === 'test' 
      ? () => { ... } 
      : undefined;
    ```
    또는 vitest의 `vi.stubModule`로 싱글톤을 우회.

- **[WARNING]** `waitForConnect` reject 테스트에서 `connect` 미호출 시나리오가 실제 구현 로직과 결합도가 높음
  - 위치: `"rejects if socket not initialized"` 테스트
  - 상세: 이 테스트는 `connect()` 없이 `waitForConnect()`를 호출하면 "Socket not initialized" 에러를 기대함. 구현이 변경되어 에러 메시지가 달라지면 테스트 실패. 에러 메시지 문자열 하드코딩은 취약한 결합.
  - 제안: 특정 메시지 대신 에러 타입이나 에러 발생 여부만 확인:
    ```ts
    await expect(client.waitForConnect()).rejects.toThrow(); // 또는 커스텀 에러 클래스
    ```

- **[INFO]** `disconnects on reset` 테스트에서 `connect`이 실제로 socket을 초기화하는지 확인 불명확
  - 위치: `"disconnects on reset"` 테스트
  - 상세: `client.connect("token")` 호출 후 `mockSocket.disconnect`가 호출되는지 테스트하는데, `mockIo`가 `mockSocket`을 반환하도록 설정되어 있어 현재는 동작. 그러나 `vi.clearAllMocks()` 후 `mockIo`의 반환값이 리셋되므로 `resetWsClient()` 이후 테스트에서 `mockIo`가 다시 `mockSocket`을 반환한다는 보장이 있는지 확인 필요. (`vi.mock`의 factory는 재실행되지 않음 — 현재는 문제없음)
  - 제안: 이상 없음 (INFO 수준)

---

### 요약

**`executions.ts`**는 신규 파일로 부작용이 없음. 테스트 파일들에서 공통적으로 발견되는 핵심 이슈는 **모듈 스코프에서 공유되는 mock 객체의 상태 오염 위험**이다. `ws-client.test.ts`의 `mockSocket.connected` 직접 변조와 `use-execution-events.test.ts`의 `vi.clearAllMocks()` 한계는 실행 순서 의존성을 만든다. 또한 `resetWsClient`의 프로덕션 코드 노출은 전역 WebSocket 연결에 대한 의도치 않은 부작용 경로가 될 수 있어 격리 처리가 권장된다. Zustand store의 partial `setState` 사용도 향후 필드 추가 시 잠재적 누수 지점이 될 수 있다.

### 위험도

**LOW** (현재 테스트 환경에서는 정상 동작하나, 테스트 확장 및 병렬화 시 MEDIUM으로 상승 가능)