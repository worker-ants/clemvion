### 발견사항

- **[WARNING]** `sanitizeAssistantText` 이중 호출 (SRP 위반)
  - 위치: `assistant-message.tsx:44`, `markdown-renderer.tsx:25`
  - 상세: `AssistantMessageView`가 `sanitizeAssistantText`를 호출해 `displayText`를 만들고, 그 결과를 `MarkdownRenderer`에 props로 전달한다. `MarkdownRenderer`는 전달받은 인자에 다시 `sanitizeAssistantText`를 호출한다. 함수가 idempotent하므로 버그는 아니지만, sanitize 책임의 소유권이 불명확하고 `MarkdownRenderer`가 pure presentation 컴포넌트에서 벗어나 도메인 특화 필터링 지식을 가지게 된다. `MarkdownRenderer`가 다른 곳에서 재사용될 경우 불필요한 필터가 같이 실행된다.
  - 제안: 책임을 한 곳으로 수렴한다. `MarkdownRenderer`에서 `sanitizeAssistantText` 호출을 제거하고 `AssistantMessageView`에서만 호출하거나, 반대로 `AssistantMessageView`에서 제거하고 `MarkdownRenderer` 입구에서 한 번만 처리하도록 선택한다. 전자가 더 자연스럽다(`showBubble` 판단 로직이 이미 `AssistantMessageView`에 있으므로).

- **[INFO]** 필터링 레이어가 프론트엔드에만 존재
  - 위치: `harmony-filter.ts`, `system-prompt.ts`
  - 상세: 백엔드 SSE 스트림 핸들러에서 harmony 토큰을 한 번 걸러주면 모든 클라이언트가 혜택을 받는다. 현재 구조는 프롬프트 지침(서버)과 UI 렌더 필터(클라이언트)의 두 계층 방어인데, 서버 스트림 레벨 필터가 없어 미래에 다른 클라이언트(모바일, API 직접 소비 등)가 추가될 경우 같은 방어 로직을 중복 구현해야 한다.
  - 제안: 단기적으로는 현재 구조를 유지하되, 백엔드 SSE 이벤트 발행 직전에 `text` delta에 대해 동일한 sanitize 단계를 추가하는 것을 검토한다.

- **[INFO]** `lastSignature` 미메모이제이션
  - 위치: `assistant-panel.tsx:69-78`
  - 상세: `lastSignature` 문자열이 `useMemo` 없이 매 렌더마다 재계산된다. React의 `useEffect` 의존성 배열 비교는 문자열 값 동등성으로 동작하므로 버그는 아니나, 메시지 수가 많아질수록 `plan.steps.filter()` 호출 비용이 누적된다.
  - 제안: `useMemo`로 감싸거나, `filter().length` 대신 `plan.steps`를 reduce로 한 번만 순회하도록 최적화한다.

- **[INFO]** `CHANNEL_BLOCK_RE` 정규식의 `g` 플래그 모듈 싱글턴
  - 위치: `harmony-filter.ts:21`
  - 상세: `g` 플래그가 붙은 정규식을 모듈 수준 상수로 선언하고 `matchAll()`에 전달하면 현대 JS 엔진은 내부적으로 복사본을 생성하므로 `lastIndex` 오염 문제는 없다. 그러나 이 동작은 `String.prototype.matchAll` 스펙에 의존하는 암묵적 보장이다. `replace()` 경로(`ROLE_HEADER_RE`, `STRAY_TOKEN_RE`)도 매 호출 전에 `lastIndex`가 0으로 리셋되므로 현재는 안전하다.
  - 제안: 코드 의도를 명확히 하려면 `CHANNEL_BLOCK_RE`를 함수 호출 시마다 `new RegExp(...)` 로 생성하거나, 주석으로 `matchAll`의 스펙 보장에 의존함을 명시한다.

- **[INFO]** 스트리밍 중 부분 harmony 블록 처리
  - 위치: `harmony-filter.ts:32`, `assistant-message.tsx:44`
  - 상세: 스트리밍 delta가 쌓이는 도중 `<|channel|>final<|message|>` 이후 body가 아직 완성되지 않았을 때 `CHANNEL_BLOCK_RE`는 `$`(문자열 끝)을 lookahead 경계로 사용해 현재 수신된 텍스트를 body로 취급한다. 이는 대부분 의도한 동작이지만, body가 불완전한 상태에서 렌더되다가 `<|end|>`가 도착하면 다시 재평가되므로 시각적 깜빡임이 발생할 수 있다.
  - 제안: 스트리밍이 완료될 때까지(`message.streaming === false`) final 채널 body 추출을 지연하는 옵션을 검토한다.

---

### 요약

`harmony-filter.ts` 자체는 단일 책임을 잘 지키는 순수 유틸리티 모듈로 설계가 명확하다. 그러나 이를 사용하는 곳에서 `AssistantMessageView`와 `MarkdownRenderer` 양쪽이 동일 함수를 호출하는 구조가 되어 sanitize 책임의 소유권이 분산되었고, `MarkdownRenderer`가 도메인 특화 지식(`harmony-filter` 의존성)을 보유하게 되어 재사용성이 저하되었다. 나머지 변경들(자동 스크롤 signature 확장, 시스템 프롬프트 지침 추가, 스펙 문서 갱신)은 아키텍처적으로 무난하다.

### 위험도

**LOW**