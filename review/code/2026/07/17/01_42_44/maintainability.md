# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** ref 갱신 위치가 파일 자체의 명시된 컨벤션과 불일치
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1444-1447` (`seedWaitingFromStatusRef.current = seedWaitingFromStatus;`)
  - 상세: 같은 파일 뒤쪽(`apiRef`, 약 1701-1706행)에 "host 명령은 1회 등록 핸들러에서 최신 함수를 참조해야 함(stale closure 회피). **ref 갱신은 render 중이 아니라 effect 에서**(매 렌더)." 라는 명시적 컨벤션 주석과 함께 `useEffect(() => { apiRef.current = {...}; })` 패턴이 있다. 반면 신규 추가된 `seedWaitingFromStatusRef.current = seedWaitingFromStatus;` 는 컴포넌트 함수 바디에서 렌더 중 직접 대입한다 — 같은 파일이 스스로 문서화한 "effect 에서 갱신" 규칙을 따르지 않는 것으로 보인다. `seedWaitingFromStatus` 가 현재 deps `[]` 로 stable 하기 때문에 실질적 버그는 아니지만(코드 주석도 이를 근거로 듦), 동일 파일 내 동일 목적(참조용 ref 홀더)의 두 구현이 서로 다른 패턴을 쓰는 것은 향후 유지보수자가 어느 쪽이 규약인지 혼동할 소지가 있고, `seedWaitingFromStatus` 의 deps 가 나중에 `[]` 가 아니게 바뀌면(예: 캡처 필요 값 추가) 이 대입 위치가 조용히 stale 해질 위험이 있다.
  - 제안: `apiRef` 와 동일하게 `useEffect(() => { seedWaitingFromStatusRef.current = seedWaitingFromStatus; });` 로 통일하거나, 왜 이 ref 만 render-time 대입이 안전한지("deps `[]` 라서 1회로 충분") 를 `apiRef` 옆 컨벤션 주석 근처에 교차 언급해 두 패턴의 차이를 명시적으로 정당화할 것.

- **[INFO]** 동일 GET 판정 로직이 파일 내에서 두 가지 스타일로 표현됨
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` 신규 "버퍼 만료 재동기화" 테스트(`u.endsWith("/api/external/executions/e1") && init?.method === undefined`) vs 기존 "race fix" 테스트(`(init?.method ?? "GET") === "GET"`, 동일 파일 내 이미 존재)
  - 상세: 두 표현은 "이 요청이 GET(getStatus) 인지" 를 판별하는 동일한 의도를 서로 다른 코드로 작성한다. `init?.method === undefined` 는 `fetch(url, { method: "GET" })` 처럼 method 를 명시한 GET 호출은 걸러내지 못해(현재 프로덕션 코드가 method 를 명시하지 않으므로 지금은 문제 없음) 기존 관용구보다 미묘하게 좁다. 사소하지만 동일 파일 반복 패턴의 일관성 이슈.
  - 제안: 기존 관용구 `(init?.method ?? "GET") === "GET"` 로 통일.

- **[INFO]** TDZ 우회 근거 주석이 두 곳에 유사 내용으로 중복
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1142` (ref 선언부 주석)와 `:1444-1446` (ref 대입부 주석)
  - 상세: "`seedWaitingFromStatus` 를 `handleEiaEvent` 가 참조하려는데 선언 순서상 TDZ 라 ref 로 우회한다" 는 동일한 설명이 두 지점에서 각기 다른 문장으로 반복 서술된다. 코드량 대비 크지 않으나, 향후 이 메커니즘이 바뀔 때 두 주석을 모두 갱신해야 drift 가 안 생긴다.
  - 제안: 선언부는 "아래 대입부 참고" 로 짧게, 상세 근거는 대입부(또는 그 반대) 한 곳에만 남기는 것도 고려 가능. 다만 필수 수정은 아님.

- **[INFO]** `useWidget` 훅이 이미 대형(500행 이상)인데 이번 변경으로 상태(ref)·분기가 추가로 늘어남
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (`useWidget` 함수 전체, 대략 1286~1795행)
  - 상세: 본 diff 자체는 소규모(ref 1개 + `handleEiaEvent` 분기 1개)이지만, `useWidget` 은 이미 세션/스트림/토큰갱신/큐/재연결 등 다수 책임을 한 함수에 담고 있어 이번 추가로 복잡도가 조금 더 늘었다. `useTokenRefresh`·`usePendingMessageQueue` 처럼 이미 일부 관심사를 별도 훅으로 분리해 온 기존 리팩터링 흐름과 비교하면, `seedWaitingFromStatus`/`openStream`/`handleEiaEvent` 축(SSE 이벤트 처리·재동기화)도 향후 별도 훅으로 뽑을 후보가 될 수 있다.
  - 제안: 즉시 조치 불필요. 다만 이 영역에 SSE 관련 로직이 추가로 붙는 다음 변경이 있다면 `useEiaStream`(가칭) 류 훅 분리를 검토할 것.

- **[INFO]** (긍정적 발견, 참고용) EventSource stub 중복 제거는 유지보수성 개선
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — `installControllableEventSource()` 신규 추출, 4개 테스트 사이트의 로컬 `latestEs`/`latest` 변수·중복 stub 클래스 정의 제거, `getEs()` 로 일원화
  - 상세: 타입-우회 캐스트(`as unknown as this`, `as unknown as typeof EventSource`)가 헬퍼 1곳에만 남아 향후 관련 TS 버전 이슈 발생 시 수정 지점이 하나로 줄었다. `installControllableSse()` 를 통째로 재사용하지 않고 EventSource stub 만 분리 추출한 판단(fetch 동작이 케이스마다 다름)도 plan 문서(`eia-context-schema-followups.md`)에 근거가 잘 기록되어 있어 리뷰 가능성이 높다. 새로 추가된 헬퍼의 JSDoc 도 기존 `installControllableSse`/`installFetch` 문서화 스타일과 일관됨.

- **[INFO]** (긍정적 발견, 참고용) DTO 주석 정정
  - 위치: `codebase/backend/src/modules/auth/webauthn/dto/responses/webauthn-response.dto.ts:126-131`
  - 상세: 기존 주석("SessionListDto 의 이중 중첩 패턴은 피한다")이 실제로는 반대(동일 패턴을 따름)였던 것을 바로잡고, spec 교차참조와 함께 load-bearing 계약임을 명시했다. 코드 가독성·정확성 개선.

## 요약

이번 diff 는 규모가 작고 목적이 명확하다 — (1) DTO 의 stale/부정확한 주석 정정, (2) 테스트 파일의 EventSource stub 4중 중복을 헬퍼 1곳으로 통합(중복 제거는 유지보수성 관점에서 명확한 개선), (3) `execution.replay_unavailable` SSE 이벤트 소비 분기를 `use-widget.ts` 에 배선하면서 TDZ 문제를 ref 홀더 패턴으로 우회. 세 변경 모두 기존 코드베이스의 상세 주석/문서화 스타일을 잘 따르고 있고 새 매직 넘버·과도한 중첩·불필요한 함수 비대화는 없다. 유일하게 눈에 띄는 것은 신규 ref 홀더(`seedWaitingFromStatusRef`)의 갱신을 렌더 중 직접 대입으로 처리해, 같은 파일이 몇십 줄 아래에서 명시적으로 문서화한 "ref 갱신은 effect 에서" 컨벤션과 표면적으로 어긋난다는 점이다. 현재 deps 가 `[]` 로 stable 해 실질적 부작용은 없으나 일관성 관점에서 조치를 권한다. 그 외는 모두 INFO 수준의 사소한 스타일 불일치 또는 향후 리팩터링 후보 언급이다.

## 위험도

LOW
