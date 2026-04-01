## 유지보수성 코드 리뷰

---

### 발견사항

#### 파일 1: `executions.ts`

- **[INFO]** 인라인 에러 타입이 중복 정의됨
  - 위치: `NodeExecutionData.error`, `ExecutionData.error`
  - 상세: `{ message?: string }` 및 `{ message?: string; stack?: string }` 형태의 에러 타입이 각 인터페이스에 인라인으로 선언되어 있음. 향후 필드 추가 시 각각 수정 필요.
  - 제안: 공유 타입 추출 — `type ExecutionError = { message?: string; stack?: string }` 후 두 인터페이스 모두에서 재사용.

- **[INFO]** status 유니온 타입 중복
  - 위치: `NodeExecutionData.status`, `ExecutionData.status`
  - 상세: 노드와 실행의 상태값이 별개 유니온으로 선언되어 있음. 타입명 없이 인라인 선언이라 문서화 및 재사용 어려움.
  - 제안: `type NodeExecutionStatus = "pending" | "running" | ...`, `type ExecutionStatus = "pending" | "running" | ...`으로 추출.

---

#### 파일 2: `use-execution-events.test.ts`

- **[WARNING]** `act` import 미사용
  - 위치: 2번째 줄 — `import { renderHook, act, waitFor }`
  - 상세: `act`가 import되었으나 테스트 코드 어디에서도 사용되지 않음. 불필요한 import는 코드 노이즈를 유발하고 향후 유지보수 시 혼란 야기.
  - 제안: `act` import 제거.

- **[INFO]** `mockGetById` 응답 객체가 테스트마다 반복
  - 위치: `beforeEach` + 각 `it` 블록 내 `mockGetById.mockResolvedValue(...)` 호출들
  - 상세: `nodeExecutions` 배열 포함 응답 구조가 여러 테스트에서 유사하게 반복됨. 픽스처 팩토리 함수 없이 리터럴로 작성되어 구조 변경 시 다수 수정 필요.
  - 제안: `createMockExecution(overrides)` 헬퍼 함수로 공통 구조 추출.

- **[INFO]** `cancelled` → `failed` 매핑에 대한 설명 없음
  - 위치: "handles cancelled execution from poll" 테스트
  - 상세: `status: "cancelled"`를 poll 받았을 때 store가 `"failed"`로 설정되는 것을 검증하나, 이 비직관적인 매핑에 대한 주석이 없어 의도 파악이 어려움.
  - 제안: 테스트 또는 구현부에 매핑 이유 주석 추가.

---

#### 파일 3: `ws-client.test.ts`

- **[WARNING]** `mockSocket`이 모듈 레벨 단일 객체로 공유됨
  - 위치: 상단 `const mockSocket = { ... }` 선언
  - 상세: `beforeEach`에서 `vi.clearAllMocks()`와 `mockSocket.connected = false`만 리셋하지만, `mockSocket` 참조 자체는 공유됨. `mockSocket.once.mockImplementation` 등 일부 테스트가 상태를 남기면 후속 테스트에 영향 가능.
  - 제안: 각 테스트 전에 `mockSocket`의 전체 상태를 명시적으로 리셋하거나, `beforeEach`에서 `Object.assign(mockSocket, { connected: false })`로 확실히 초기화.

- **[INFO]** "creates a client with all required methods" 테스트가 구현 세부사항에 결합
  - 위치: `createWsClient` 첫 번째 `it`
  - 상세: 메서드 존재 여부를 일일이 `toBeDefined()`로 검증하는 방식은 인터페이스 변경 시 테스트를 그대로 복붙 수정하게 만드는 경직된 구조.
  - 제안: 인터페이스 타입을 활용한 타입 체크나 실제 동작 테스트로 대체하거나, 메서드 목록을 배열로 관리.

- **[INFO]** 타임아웃 없는 `waitForConnect` 대기 테스트
  - 위치: "waits for connect event if not yet connected"
  - 상세: `setTimeout(() => callback(), 10)` 방식으로 connect 이벤트를 시뮬레이션하나, 실제 구현에 타임아웃 로직이 없다면 영원히 대기할 수 있는 케이스가 테스트되지 않음.
  - 제안: 타임아웃 거부 케이스를 테스트하는 `it` 추가 검토.

---

### 요약

세 파일 전반적으로 유지보수성 수준은 양호하다. `executions.ts`는 소규모 파일이지만 인라인 타입 중복이 향후 확장성을 저해할 수 있으며, 테스트 파일들은 구조가 명확하고 케이스 커버리지도 충분하다. 다만 `use-execution-events.test.ts`의 미사용 `act` import와 반복되는 목 데이터 리터럴은 가벼운 기술 부채이고, `ws-client.test.ts`의 공유 `mockSocket` 상태 관리는 테스트 간 격리를 약화시킬 수 있어 주의가 필요하다. 전체적으로 critical한 유지보수성 문제는 없으나 타입 추출과 테스트 픽스처 관리 개선이 권장된다.

### 위험도

**LOW**