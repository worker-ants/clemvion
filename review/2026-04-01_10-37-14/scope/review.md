### 발견사항

---

**파일 1: `executions.ts`**

이슈 없음. 인터페이스 정의와 단일 API 메서드로 명확하게 범위가 제한되어 있습니다.

---

**파일 2: `use-execution-events.test.ts`**

- **[WARNING]** 사용되지 않는 `act` 임포트
  - 위치: line 3 — `import { renderHook, act, waitFor }`
  - 상세: `act`가 임포트되었으나 테스트 코드 어디에서도 사용되지 않습니다. 불필요한 임포트가 실제 변경사항과 함께 포함되어 있습니다.
  - 제안: `act` 제거 → `import { renderHook, waitFor } from "@testing-library/react"`

- **[INFO]** `"unsubscribes and removes handlers on cleanup"` 테스트에서 `connect` 이벤트 핸들러 이중 등록 검증 누락
  - 위치: line 128–143
  - 상세: 구현체(`use-execution-events.ts`)는 `connect` 이벤트에 `onConnect`와 `onReconnect` 두 핸들러를 등록하고 cleanup에서 둘 다 제거합니다. 테스트는 `mockClient.off`가 호출되었다는 것만 확인하고 두 번 호출되었는지(각 핸들러에 대해) 검증하지 않습니다. 버그를 숨길 수 있는 불완전한 검증입니다.
  - 제안: `expect(mockClient.off).toHaveBeenCalledWith("connect", expect.any(Function))`이 두 번 호출되었는지 확인하거나, 최소한 `connect` 이벤트에 대해 off가 호출되었는지 명시적으로 검증.

---

**파일 3: `ws-client.test.ts`**

- **[INFO]** `resetWsClient`가 테스트 격리 목적으로 production 모듈에서 export됨
  - 위치: `ws-client.ts` line 111–116, 테스트 line 18
  - 상세: `resetWsClient`는 테스트 전용 기능으로, 싱글톤 내부 상태를 외부에서 리셋합니다. 프로덕션 코드에서 실제로 호출될 이유가 없는 API가 public으로 노출된 것입니다. 테스트가 이 함수를 요구하도록 설계된 점은 production API 설계에 영향을 준 것으로 볼 수 있습니다.
  - 제안: 허용 가능한 패턴이나, `@internal` 또는 `@visibleForTesting` 주석으로 의도를 명시하거나, 테스트 환경에서만 접근 가능하도록 고려.

- **[INFO]** `"skips connect if already connected"` 테스트는 구현의 두 번째 분기(`socket` 존재하지만 `connected = false`인 경우 disconnect 후 재연결)를 커버하지 않음
  - 위치: line 52–59
  - 상세: 범위 초과는 아니지만 커버리지 공백입니다.
  - 제안: 기존 소켓이 있으나 연결 해제된 경우에 대한 테스트 추가 고려.

---

### 요약

세 파일 모두 의도된 범위 내에서 작성되었습니다. 가장 명확한 범위 이탈은 `use-execution-events.test.ts`의 미사용 `act` 임포트(WARNING)이며, 이는 즉시 제거되어야 합니다. `cleanup` 테스트의 `connect` 핸들러 검증 불완전성과 `resetWsClient`의 public export 노출은 경계선상의 설계 결정으로, 기능적으로 문제를 일으키지는 않지만 향후 유지보수 관점에서 주의가 필요합니다. 전반적으로 범위 준수 수준은 양호합니다.

### 위험도

**LOW**