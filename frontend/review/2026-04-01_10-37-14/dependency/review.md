## 의존성 코드 리뷰 결과

### 발견사항

- **[INFO]** `executionsApi` 내부 모듈 의존성 구조 적절
  - 위치: `executions.ts:1`
  - 상세: `apiClient`를 `./client`에서 import하는 단일 내부 의존성. 외부 패키지 추가 없음.
  - 제안: 현 구조 유지

- **[INFO]** 테스트에서 `@testing-library/react` 의존 확인 필요
  - 위치: `use-execution-events.test.ts:2`
  - 상세: `renderHook`, `act`, `waitFor`를 `@testing-library/react`에서 import. `act`는 import되어 있지만 테스트 코드에서 실제로 사용되지 않음.
  - 제안: 미사용 import 제거 (`act` 삭제)

- **[INFO]** `socket.io-client` 모킹 방식이 모듈 호이스팅에 의존
  - 위치: `ws-client.test.ts:4~14`
  - 상세: `vi.mock`은 hoisting되므로 `mockSocket`이 `vi.mock` 호출 이전에 선언되어 있어도 동작하지만, Vitest에서 이 패턴은 클로저 변수 참조 이슈가 생길 수 있음. 현재 `mockSocket`은 `const`로 객체 참조를 유지하므로 문제없음.
  - 제안: 현 패턴 유지 가능, 단 `vi.hoisted()`를 활용하면 명시성이 높아짐

- **[WARNING]** `ws-client.test.ts`에서 `resetWsClient` import — 테스트 전용 export 여부 불명확
  - 위치: `ws-client.test.ts:18`
  - 상세: `resetWsClient`는 프로덕션 코드에 테스트 편의를 위한 함수가 노출되어 있을 가능성이 있음. 프로덕션 번들에 포함되면 불필요한 API surface가 됨.
  - 제안: `resetWsClient`가 테스트 전용이라면 `if (process.env.NODE_ENV === 'test')` 가드 또는 별도 테스트 유틸 파일로 분리 검토

- **[INFO]** `use-execution-events.test.ts`에서 `../../api/executions` mock 구성이 런타임 의존성과 일치
  - 위치: `use-execution-events.test.ts:29~34`
  - 상세: `executionsApi.getById`를 정확히 mock하고 있어 실제 모듈 구조와 일치. 의존성 계약이 잘 유지됨.
  - 제안: 현 구조 유지

- **[INFO]** 신규 외부 의존성 없음
  - 위치: 전체 파일
  - 상세: 3개 파일 모두 기존 의존성(`socket.io-client`, `@testing-library/react`, `vitest`, 내부 모듈)만 사용. `package.json` 변경 불필요.
  - 제안: 해당 없음

---

### 요약

3개 파일 모두 신규 외부 의존성을 추가하지 않으며, 기존 내부 모듈 구조(`apiClient`, `executionStore`, `wsClient`)와의 의존 관계가 명확하고 단방향으로 유지되고 있습니다. 주요 지적 사항은 `act` 미사용 import 제거와 `resetWsClient`의 프로덕션 번들 노출 가능성이며, 나머지는 의존성 관점에서 적절히 구성되어 있습니다.

### 위험도
**LOW**