### 발견사항

---

**[INFO]** `process.env.NODE_ENV !== "production"` 가드가 테스트 환경에서도 경고를 발화함
- 위치: `use-execution-events.ts` — `handleAiMessage`, `!Array.isArray(payload.messages)` 분기
- 상세: `NODE_ENV !== "production"` 조건은 `"test"` 환경도 포함하므로 `console.warn`이 테스트 중에도 실행된다. File 2의 테스트가 `vi.spyOn(console, "warn").mockImplementation(() => {})` + `try/finally` 패턴으로 이를 억제하는데, 이는 구현과 테스트 사이에 암묵적 결합을 만든다. 향후 유사 케이스를 추가할 때 스파이 설정을 잊으면 테스트 노이즈가 발생한다.
- 제안: `NODE_ENV === "development"`로 변경하거나, 경고를 주입 가능한 logger 인터페이스(또는 일급 함수 파라미터)로 분리하면 테스트에서 환경 변수에 의존하지 않아도 된다. 프로젝트 전체에서 `NODE_ENV !== "production"` 패턴을 통일해 사용 중이라면 현행 방식 유지도 수용 가능.

---

**[INFO]** `makeAiAgentHandler` — `as unknown as NodeHandler & {...}` 이중 캐스트
- 위치: `execution-engine.service.spec.ts` — `makeAiAgentHandler` 반환부
- 상세: `as unknown as TargetType` 패턴은 TypeScript가 타입 불일치를 탐지하지 못하게 한다. 실제 `NodeHandler` 인터페이스와 mock 객체 구조가 달라질 때 컴파일 오류 대신 런타임에서야 실패한다. 테스트 코드에서 흔한 패턴이지만, 팩토리 함수가 공유 헬퍼로 성장하면 숨겨진 타입 불일치가 누적될 수 있다.
- 제안: `NodeHandler`를 구현하는 `MockAiAgentHandler` 클래스(또는 `Partial<NodeHandler>` 활용)로 구성하면 타입 안전성을 높일 수 있다. 현행 범위에서는 INFO 수준.

---

**[INFO]** 빈 `messages` 배열(`length === 0`)을 invariant violation으로 처리하는 묵시적 의미
- 위치: `use-execution-events.ts` — `if (!Array.isArray(payload.messages) || payload.messages.length === 0)`
- 상세: 스펙상 올바른 판단이지만, `messages: []`(빈 배열)와 `messages` 필드 자체가 없는 경우를 동일하게 다룬다. 미래에 "첫 턴 전 초기화" 등의 이유로 빈 배열을 유효 페이로드로 만들 가능성이 있다면 두 조건이 한 분기에 묶여 있어 변경 비용이 올라간다. 현재 스펙에서는 문제없다.
- 제안: 현행 유지. 다만 조건이 바뀔 때 두 케이스를 분리해야 함을 기억할 수 있도록 기존 인라인 주석이 충분히 맥락을 제공하고 있어 별도 조치 불필요.

---

**[INFO]** 테스트 픽스처 인라인 객체 중복
- 위치: `execution-engine.service.spec.ts` — `makeAiAgentHandler` 내부 `execute` 목 반환값과 `processReturn` 콜백의 `_resumeState` 구조
- 상세: `execute` mock이 반환하는 초기 `_resumeState`와 `processReturn`이 반환하는 `_resumeState`가 거의 동일한 형태를 반복한다. 두 테스트 케이스 각각에서 이 구조를 독립적으로 인라인 정의하므로 필드명이 바뀌면 여러 곳을 수정해야 한다.
- 제안: `buildResumeState(overrides?)` 같은 소형 픽스처 빌더를 `makeAiAgentHandler` 위에 두면 변경 점이 한 곳으로 모인다. 현재 테스트가 2개이므로 즉각 리팩토링 필요 수준은 아님.

---

### 요약

이번 변경은 레거시 단일-어시스턴트 fallback 경로를 제거하고 `handleAiMessage`를 스냅샷 전용 경로로 단순화한 것으로, 순환 복잡도 감소와 의존성 배열 정리가 명확하게 이루어졌다. 삭제된 코드 양에 비해 추가된 코드가 훨씬 적고, 스펙 참조 주석이 invariant 근거를 명시해 미래 기여자가 fallback을 "복원"하는 실수를 예방한다. 백엔드 테스트의 `makeAiAgentHandler` 팩토리는 두 테스트 케이스 간 중복을 잘 제거했고, 구조적 일관성도 기존 describe 패턴과 맞다. 주요 우려는 `NODE_ENV !== "production"` 가드가 테스트에서 경고를 발화해 테스트 코드에 암묵적 결합을 만드는 점 하나이며, 나머지는 테스트 코드에 국한된 경미한 사항이다.

### 위험도

**LOW**