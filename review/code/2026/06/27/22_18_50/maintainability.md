# 유지보수성(Maintainability) 리뷰

리뷰 대상: Channel Web Chat 위젯 리팩터(B) + 테스트 보강(C)
리뷰 일시: 2026-06-27

---

## 발견사항

### [INFO] `isTextInputSurface` — denylist 구현이 함수명(allowlist 의미)과 표면적 불일치
- 위치: `/codebase/channel-web-chat/src/lib/widget-state.ts` L30–32
- 상세: 함수 이름 `isTextInputSurface`는 "텍스트 입력 표면인가?"를 뜻하지만, 구현은 `pending?.type !== "buttons" && pending?.type !== "form"` 형태의 부정(denylist)이다. JSDoc에 "allowlist 의미: buttons/form 이 아님"이라 명시되어 있어 의도는 전달되나, `null`이 `true`를 반환한다는 점이 함수명에서 직관적으로 드러나지 않는다. 향후 새 interaction type이 추가될 때 이 함수를 반드시 갱신해야 한다는 사실이 호출부에서 보이지 않는다.
- 제안: 현행 JSDoc 커버로 비차단. 장기적으로는 `const TEXT_SURFACE_TYPES = ["ai_conversation"] as const` allowlist 방식으로 전환하면 새 타입 추가 시 누락을 컴파일 시점에 잡을 수 있다.

---

### [INFO] `TERMINAL_EVENTS as readonly string[]` 이중 타입 단언 — 맥락 없이 읽으면 불명확
- 위치: `/codebase/channel-web-chat/src/widget/use-widget.ts` `(TERMINAL_EVENTS as readonly string[]).includes(name)` 라인
- 상세: `as const` 리터럴 튜플에 임의 `string`인 `name`을 `.includes()`로 검색하는 TS 워크어라운드다. 이번 변경에서 인라인 주석이 이유를 설명하도록 추가되어 가독성이 개선됐다. 그러나 캐스트 자체를 없애는 방법(`const TERMINAL_EVENTS: readonly string[] = [...]`)도 존재한다.
- 제안: 현행 주석 보강으로 비차단. 타입 선언 시점에 `readonly string[]`으로 선언하면 캐스트 없이 동일 효과를 낼 수 있다.

---

### [INFO] `fake timer` 테스트 내부 fetch mock 인라인 — `installFetch`와 코드 중복
- 위치: `/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` fake timer 테스트 블록
- 상세: "fake timer: BOOTED 후 refresh delay 경과 → refresh-token 호출" 테스트는 `installFetch`/`installControllableSse` 를 재사용하지 않고 테스트 내부에 별도 `vi.fn()` fetch mock을 인라인으로 정의한다. webhook POST 응답 구조(202, `executionId: "e1"`, `NINETY_MIN_MS`)가 기존 헬퍼 내부와 사실상 동일하게 반복된다. `vi.useFakeTimers`가 전역 주입 타이밍과 충돌해 분리한 것으로 보이나, 장기적으로 fixture 중복이 누적될 수 있다.
- 제안: `installFetch({ withRefreshEndpoint: true })` 오버로드 또는 webhook POST mock만 별도 헬퍼로 추출하는 방향을 고려. 현 규모에서는 비차단.

---

### [INFO] C1 flush 테스트(inline `latestEs`)와 C1 폐기 테스트(`installControllableSse`) 간 설정 패턴 불일치
- 위치: `/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` 기존 C1 flush 테스트 vs 신규 C1 폐기 테스트
- 상세: 두 테스트 모두 `ControllableEventSource` 패턴에 의존하나, 기존 테스트는 `latestEs` 변수를 테스트 내부에 직접 선언하고, 신규 테스트는 `installControllableSse()` 팩토리를 사용한다. 동일 추상화를 다른 방식으로 설정하므로 향후 패턴 참고 시 혼란의 소지가 있다.
- 제안: 기존 C1 flush 테스트도 `installControllableSse()`로 통일하면 패턴이 일관해진다. 현재 기능 문제 없으므로 비차단.

---

### [INFO] `teardownSession` JSDoc의 "W9" 레퍼런스 — 코드베이스 내 정의 부재
- 위치: `/codebase/channel-web-chat/src/widget/use-widget.ts` `teardownSession` JSDoc 및 `newChat` 인라인 주석
- 상세: "순서 의존(W9)"이 반복 언급되나 `W9`의 정의가 코드베이스 어디에도 없다. 인근 주석이 어느 정도 이유를 설명하고 있어 이해는 가능하나, 외부 컨텍스트(plan/spec) 없이는 `W9`가 어떤 이슈 식별자인지 알 수 없다. 이전 ai-review(22_08_42)에서도 동일하게 지적된 pre-existing 패턴이다.
- 제안: JSDoc에 순서 의존 이유를 직접 서술(`"sessionRef 무효화 전 SSE 닫아야 null된 ref에 쓰기 방지"`)하거나, `W9` 정의를 주석 한 줄로 도입. 현재 인근 주석으로 커버되므로 비차단.

---

### [INFO] `installControllableSse` 내 `EventSource` 스텁 클래스 — 미사용 메서드(`addEventListener`, `close`)
- 위치: `/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` `installControllableSse` 함수 내 `vi.stubGlobal("EventSource", class { ... })`
- 상세: 스텁 클래스가 `addEventListener() {}` 와 `close() {}` 를 빈 메서드로 선언한다. 실제 이벤트 처리는 `ControllableEventSource` 내부에서 이루어지는데, 이 빈 메서드들이 실제 동작에 영향을 주는지 아니면 순수 인터페이스 만족용인지 코드만으로는 판단하기 어렵다. 의도 주석이 없다.
- 제안: `// no-op: ControllableEventSource 가 이벤트를 직접 관리` 와 같은 주석 한 줄로 의도를 명시. 비차단.

---

## 요약

이번 변경(B2/B3/B5/B6 헬퍼 추출 + C 테스트 보강)은 유지보수성 관점에서 전반적으로 긍정적인 리팩터다. `isTextInputSurface` 단일화로 텍스트 표면 판정 3중 중복이 제거됐고, `TERMINAL_EVENTS` 배열화로 이벤트명 문자열 비교가 중앙화됐으며, `clearRefreshTimer`/`teardownSession` 헬퍼 추출로 종료 경로 중복 로직이 제거됐다. 각 헬퍼에 JSDoc이 충실히 작성됐고, 변경 범위가 좁고 behavior-preserving이어서 복잡도 증가가 없다. 발견된 항목은 모두 INFO 수준의 장기 개선 제안이며, 즉각 조치가 필요한 Critical 또는 Warning 사항은 없다. 테스트 설정 패턴의 불일치(`installControllableSse` vs inline 패턴)는 향후 확장 시 일관성을 해칠 소지가 있으나 현재는 비차단이다.

## 위험도

NONE
