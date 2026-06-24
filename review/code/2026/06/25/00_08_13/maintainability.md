# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 3: interaction.service.ts — getStatus 메서드

- **[WARNING]** `getStatus` 메서드 내부 waiting 표면 복원 로직이 인라인으로 장황하다
  - 위치: `getStatus()` 내 `if (execution.status === ExecutionStatus.WAITING_FOR_INPUT)` 블록 (약 45줄)
  - 상세: `outputData` 구조 파싱, `interactionType` 검증, `buttonConfig` structured/legacy 분기, `context` 조립이 하나의 if 블록 안에 몰려 있다. 메서드가 단일 책임(상태 조회 응답 구성)을 넘어 "노드 outputData 파싱·context 변환"이라는 다른 책임까지 직접 담고 있어, 향후 `form` / `ai_conversation` 등 타입이 늘어날 때 분기가 더 복잡해진다.
  - 제안: 해당 블록을 `private resolveWaitingContext(nodeExec: NodeExecution): { currentNode, context }` 같은 별도 private 메서드로 추출하면 `getStatus`의 가독성이 향상되고 개별 로직 단위 테스트도 용이해진다.

- **[WARNING]** `it` 변수명이 컨텍스트가 너무 좁다
  - 위치: `interaction.service.ts` 내 `getStatus` — `const it = meta.interactionType ?? null;`
  - 상세: `it`는 `interactionType`의 단축형이지만, 단일 문자에 가까운 약어라 코드 스캔 시 의미가 즉각 파악되지 않는다. 한 줄 아래에서 `const interactionType = it === ...`로 재확인해야 의미가 드러나는 구조.
  - 제안: `it` 대신 `rawInteractionType`이나 즉시 `interactionType` 상수로 통합해 중간 변수를 제거한다.

- **[INFO]** `structured` 타입 단언 cast가 인라인으로 선언되어 있다
  - 위치: `const structured = out as { config?: { buttonConfig?: ... }; buttonConfig?: ... };`
  - 상세: 캐스트 타입이 길어서 흐름을 끊는다. legacy flat / structured 분기를 한 줄 주석(`// structured 우선, legacy fallback`) 옆에 헬퍼 함수 또는 타입 alias로 분리하면 의도가 더 명확해진다.
  - 제안: `type ButtonConfigShape = { config?: { buttonConfig?: { buttons?: unknown } }; buttonConfig?: { buttons?: unknown } }` 를 파일 상단에 선언하거나, 헬퍼 `extractButtonConfig(out: unknown)` 으로 추출한다.

- **[INFO]** `seq: 0` 매직 넘버
  - 위치: `getStatus()` 반환부 `seq: 0`
  - 상세: `0`이 placeholder임을 주석으로 설명하고 있지만, `SSE_SEQ_PLACEHOLDER = 0` 같은 named constant로 의도를 코드 자체에 표현하면 더 명확하다. 현재는 주석 없이 숫자만 보면 의미 불명.
  - 제안: `const SSE_SEQ_PLACEHOLDER = 0;` 파일 상단 상수로 추출하거나, 최소한 `seq: 0 /* V1 placeholder — SSE Last-Event-Id 로 보정 */`으로 유지.

---

### 파일 4: use-widget-eager-start.test.ts

- **[WARNING]** "race fix" 테스트 케이스가 fetchMock을 `installFetch` 헬퍼 없이 인라인으로 중복 선언한다
  - 위치: `it("race fix: getStatus 가 buttons waiting 표면을 주면 ...")` 내부, 약 30줄 fetchMock 블록
  - 상세: 해당 테스트는 `installFetch()`를 재사용하지 않고 webhook POST + getStatus GET 응답을 모두 인라인으로 구현한다. 동일 파일의 W8 테스트도 비슷한 패턴으로 인라인 fetchMock을 만든다. GET status 응답만 추가하는 목적이므로, `installFetch`에 `statusResponse` 오버라이드 옵션을 추가하거나 `installFetchWithStatus(statusBody)` 헬퍼를 만들면 중복을 제거할 수 있다.
  - 제안: `installFetch({ statusResponse: { ... } })` 형태로 확장하거나, `getStatus` stub을 별도 헬퍼로 분리한다.

- **[INFO]** `"race fix"` 인라인 EventSource stub이 두 번째 테스트("openStream lastEventId=0")에서도 동일 구조를 반복한다
  - 위치: `it("race fix: openStream 을 lastEventId=0 ...")` 내 EventSource stub 선언
  - 상세: `class { constructor(url){ esUrl=url; } addEventListener(){} close(){} }` 패턴은 기존 `FakeEventSource` + `ControllableEventSource` 클래스 외에 세 번째 변형 구현으로, 한 파일 안에 동일 목적의 EventSource stub이 3가지로 분산된다.
  - 제안: `urlCapturingEventSource()` 팩터리 헬퍼를 만들어 URL 캡처 전용 stub를 재사용 가능하게 분리한다.

---

### 파일 5: use-widget.ts

- **[WARNING]** `seedWaitingFromStatus`의 `useCallback` 의존성 배열이 비어 있다
  - 위치: `useCallback(async (client, session) => { ... }, [])` — 종속 값인 `dispatch`, `parseWaitingForInput`, `threadToMessages` 가 배열에 없음
  - 상세: `dispatch`는 `useReducer`에서 반환되므로 안정적(stable)이고, `parseWaitingForInput`·`threadToMessages`는 외부 import 순수 함수라 실제 lint/exhaustive-deps 경고 없이 동작하지만, 명시적 빈 배열(`[]`)은 "외부 의존성 없음"을 의도한다는 신호가 불명확하다. 향후 의존성이 추가될 때 배열 갱신을 누락할 수 있다.
  - 제안: 명시적 주석 `// dispatch is stable(useReducer), parseWaitingForInput/threadToMessages are pure imports` 추가 또는 `useCallback` 대신 단순 함수로 분리해 `useCallback` 의존성 추적 부담을 없앤다.

- **[INFO]** `seedWaitingFromStatus` 내 `status.context as WaitingForInputEvent` 타입 단언
  - 위치: `parseWaitingForInput(status.context as WaitingForInputEvent)`
  - 상세: `EiaClient.getStatus` 반환 타입과 `WaitingForInputEvent` 사이의 불일치를 런타임 as-cast로 브리지하고 있어, 양쪽 타입이 diverge했을 때 무언의 오류가 발생할 수 있다.
  - 제안: `EiaClient.getStatus` 응답의 `context` 필드 타입을 `WaitingForInputEvent`와 호환되도록 타입 정의를 맞추거나, 런타임 타입가드(type guard)로 교체한다.

---

### 파일 2: interaction.service.spec.ts

- **[INFO]** `ExecRepoMocks` 인터페이스를 `nodeRepo`에 재사용하는 것은 의미상 부정확하다
  - 위치: `const nodeRepo: ExecRepoMocks = { findOne: jest.fn() };`
  - 상세: `ExecRepoMocks`는 Execution 저장소 목적으로 정의된 인터페이스이나, NodeExecution 저장소에도 동일 인터페이스를 재사용한다. 현재는 메서드 시그니처가 동일하여 문제없지만, 추후 저장소별 메서드가 달라지면 오해를 유발할 수 있다.
  - 제안: `RepoMock<T = unknown> = { findOne: jest.Mock<Promise<T | null>> }` 형태의 제네릭 타입 또는 `NodeExecRepoMocks` 별도 타입으로 분리하거나, `makeMocks` 함수 내 주석으로 의도를 명시한다.

---

## 요약

이번 변경은 SSE race 해소를 위한 백엔드 `getStatus` 확장과 위젯 side의 seed/replay 두 경로를 추가한 집중적인 버그픽스로, 전반적인 코드 스타일 일관성과 명명 규약은 기존 코드베이스를 잘 따르고 있다. 다만 `interaction.service.ts`의 `getStatus` 메서드 안에 outputData 파싱·context 조립 로직이 45줄 분량으로 인라인 집중되어 단일 책임 원칙에서 벗어나고, 테스트 파일에서는 fetchMock 인라인 중복이 증가하여 향후 수정 비용이 발생할 수 있다. 이 두 가지는 WARNING 수준이며, `it` 변수명·`seq: 0` 매직 넘버·`useCallback[]` 의존성 배열 명시 부재 등 INFO 항목과 함께 점진적으로 정리하면 장기 유지보수성이 개선된다.

## 위험도

LOW
