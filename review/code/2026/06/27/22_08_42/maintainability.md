# 유지보수성(Maintainability) 리뷰

리뷰 대상: Channel Web Chat 위젯 리팩터(B) + 테스트 보강(C)
리뷰 일시: 2026-06-27

---

## 발견사항

### [INFO] `isTextInputSurface` — denylist 의미가 함수명(allowlist)과 불일치할 소지
- 위치: `/codebase/channel-web-chat/src/lib/widget-state.ts` L300
- 상세: 함수 이름 `isTextInputSurface` 는 "텍스트 입력 표면인가?"를 뜻하지만, 구현은 `pending?.type !== "buttons" && pending?.type !== "form"` 형태의 부정(denylist)으로 되어 있다. JSDoc 주석에 "allowlist 의미: buttons/form 이 아님"이라 설명하고 있어 의도는 명확하나, `null`(pending 없음)이 `true`를 반환한다는 세부 동작이 함수 이름에서 직관적으로 드러나지 않는다. 향후 새로운 interaction type이 추가될 때 이 함수를 반드시 갱신해야 한다는 사실이 호출부에서는 보이지 않는다.
- 제안: 현행 유지해도 JSDoc 주석으로 커버되고 있어 비차단. 단, 장기적으로 `isTextInputSurface(pending)` 대신 명시적인 allowlist(`const TEXT_INPUT_TYPES = ["ai_conversation"] as const`)로 전환하면 새 타입 추가 시 누락 위험을 컴파일 시점에 잡을 수 있다.

---

### [INFO] `TERMINAL_EVENTS as const` 캐스트 후 `as readonly string[]` 이중 타입 단언
- 위치: `/codebase/channel-web-chat/src/widget/use-widget.ts` L1772
- 상세: `(TERMINAL_EVENTS as readonly string[]).includes(name)` 패턴은 `as const` 튜플에 `string` 을 `.includes()` 로 검색하기 위한 TS 워크어라운드다. 기능은 정확하나 코드를 처음 보는 사람이 왜 이중 캐스트가 필요한지 이해하기 어렵다.
- 제안: 인라인 타입 캐스트 대신 별도 헬퍼 또는 `TERMINAL_EVENTS` 의 타입을 `string[]`으로 선언하는 것을 고려. 혹은 주석 한 줄로 TS 제약 이유를 명시하면 가독성 향상.

---

### [INFO] `fake timer` 테스트 내부에 fetch mock 인라인 중복
- 위치: `/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L917~L964
- 상세: "fake timer: BOOTED 후 refresh delay 경과 → refresh-token 호출" 테스트는 `installFetch`/`installControllableSse` 대신 테스트 내부에 별도 `vi.fn()` fetch mock을 인라인으로 정의한다. webhook POST 응답 코드(202, `executionId: "e1"`, `NINETY_MIN_MS` 등)가 `installFetch` 내부와 거의 동일하게 반복되고 있다. `vi.useFakeTimers`가 `installFetch` 의 `EventSource` 전역 주입과 맞지 않아 분리한 것으로 보이나, 장기적으로 fixture 코드 중복이 증가할 수 있다.
- 제안: fake timer 변형을 수용하는 `installFetch({ fakeTimer: true })` 오버로드 또는 `/refresh-token` 응답만 추가로 구성하는 `withRefreshEndpoint` 헬퍼를 추출하여 webhook POST mock 코드 반복을 줄일 수 있다. 현 규모에서는 비차단.

---

### [INFO] C1 flush 테스트(기존 inline mock)와 C1 폐기 테스트(`installControllableSse`) 간 구조적 불일치
- 위치: `/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L1163~L1220 (기존 C1 flush) vs L1222~L1249 (신규 C1 폐기)
- 상세: 기존 C1 flush 테스트는 `latestEs` 변수를 테스트 내부에 직접 선언하는 패턴을 사용하고, 신규 C1 폐기 테스트는 `installControllableSse()` 팩토리를 사용한다. 두 테스트가 동일한 `ControllableEventSource` 패턴에 의존하면서도 설정 방식이 다르다.
- 제안: 기존 C1 flush 테스트도 `installControllableSse()`를 사용하도록 리팩터하면 패턴이 통일되어 향후 유사 테스트 작성이 일관해진다. 단, 현재 기능적 문제는 없으므로 비차단.

---

### [INFO] `teardownSession` 주석의 "순서 의존(W9)" 레퍼런스가 자기 참조적
- 위치: `/codebase/channel-web-chat/src/widget/use-widget.ts` L1736~L1744
- 상세: `teardownSession` JSDoc 및 `newChat` 함수 인라인 주석 모두 "순서 의존(W9)"을 언급한다. `W9`는 내부 이슈 식별자로 보이나 코드베이스 어디에도 정의가 없어 외부 컨텍스트(plan/spec) 없이는 의미를 알 수 없다.
- 제안: JSDoc 주석에 순서 의존 이유를 직접 기술하거나(`// sessionRef 무효화 전 SSE 닫아야 null 된 ref에 쓰기 방지`), W9를 spec 또는 주석 내에서 한 번이라도 정의해주면 가독성이 높아진다. 현재 인근 주석이 어느 정도 설명하고 있어 비차단.

---

### [INFO] `panel.tsx` 내 `key={i}` 인덱스 키 사용
- 위치: `/codebase/channel-web-chat/src/widget/components/panel.tsx` L749, L780
- 상세: `messages.map((m, i) => ...)` 와 `welcomeSuggestions.map((s, i) => ...)` 에서 배열 인덱스를 `key`로 사용한다. 이는 기존 코드이고 이번 변경 범위가 아니지만, 리스트 아이템이 재정렬되거나 앞에서 삭제될 때 React 재조정 성능 이슈를 유발할 수 있다.
- 제안: 향후 메시지에 안정적인 `id` 필드를 추가하거나 `role+text` 조합으로 key를 구성하는 것을 고려. 현 변경 범위 외이므로 비차단 참고사항.

---

### [INFO] `mergeMessages` 함수의 비직관적 병합 논리
- 위치: `/codebase/channel-web-chat/src/lib/widget-state.ts` L437~L440
- 상세: 함수 이름은 "merge"이지만 실제 동작은 "snapshot이 더 길면 snapshot으로 교체, 그렇지 않으면 local 유지"다. 주석("중복(동일 role+text 연속)을 회피")이 구현과 정확히 대응하지 않으며, 실제로 dedup 로직은 없고 단순히 길이 비교로 교체한다. 기존 코드이고 이번 변경 범위가 아니지만, 향후 snapshot이 동일 길이일 때의 동작이 모호하다.
- 제안: 함수 주석을 실제 동작("snapshot이 local보다 길면 snapshot 우선, 그렇지 않으면 local 유지")에 맞게 정정하는 것을 고려.

---

## 요약

이번 변경은 `isTextInputSurface` 헬퍼 추출, `TERMINAL_EVENTS` 배열화, `clearRefreshTimer`/`teardownSession` 헬퍼 추출로 중복 코드를 제거하고 의도를 명확히 분리한 전형적인 유지보수성 향상 리팩터다. 각 헬퍼에 JSDoc 주석이 충실히 작성되어 있고, 변경 범위가 작고 behavior-preserving임이 plan 문서에도 명시되어 있다. 테스트 보강도 각 케이스가 독립적으로 설정되어 있고 단언 의도가 인라인 주석으로 설명된다. 전반적으로 유지보수성이 개선된 변경이며, 발견된 INFO 항목은 모두 장기적 제안 수준이다. 즉각 조치가 필요한 Critical 또는 Warning 사항은 없다.

## 위험도

NONE
