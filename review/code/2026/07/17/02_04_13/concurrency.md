# 동시성(Concurrency) Review

대상: `codebase/backend/.../webauthn.controller.spec.ts`(테스트 전용, 동시성 무관) 및
`codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(테스트 전용) 는
동시성 관점에서 특이사항 없음. 실질 분석은 프로덕션 코드인
`codebase/channel-web-chat/src/widget/use-widget.ts` 의 `seedWaitingFromStatus` 신규
terminal 분기 + `seedWaitingFromStatusRef` effect 전환에 집중.

## 발견사항

- **[WARNING]** `seedWaitingFromStatus` 에 `start()` 와 동일한 세대(generation)/staleness 가드가 없어, 지연된 `getStatus` 응답이 그 사이 교체된 세션·상태를 덮어쓸 수 있음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:240-278`(`seedWaitingFromStatus` 정의), 호출부 `:181`(`execution.replay_unavailable` fire-and-forget), `:332`(`start()`), `:570`(`applyConfig` 세션 복원)
  - 상세: `start()` 는 `startGenRef` 를 캡처해 `await` 이후 두 지점(`:324`, `:334`)에서 `startGenRef.current !== gen` 을 검사해, in-flight 도중 `teardownSession()`(새 대화/종료)이 발생하면 stale 결과의 적용을 명시적으로 차단한다(파일 자체 주석 W10/§R6 이 이 패턴을 "경쟁 조건 방지" 목적으로 문서화). 반면 `seedWaitingFromStatus` 는 동일하게 `await client.getStatus(...)` 를 건너는 비동기 함수이면서도 이런 가드가 전혀 없다. 특히 `handleEiaEvent` 의 `execution.replay_unavailable` 분기(`:181`)는 `void seedWaitingFromStatusRef.current?.(client, session)` 로 **fire-and-forget** 호출한다 — 이 호출이 `getStatus` 응답을 기다리는 동안 사용자가 "새 대화"(`newChat`)를 누르거나 "대화 종료"(`endConversation`)를 호출하면 `resetSessionRefs()`/`teardownSession()` 이 먼저 실행되어 `sessionRef.current` 가 null 또는 새 세션으로 교체되고 `startGenRef` 가 증가한다. 그런데 이미 in-flight 이던 `seedWaitingFromStatus` 는 이 변화를 알지 못한 채 나중에 도착한 옛 `getStatus` 응답을 그대로 `dispatch` 한다:
    - `waiting_for_input` 이면 `dispatch({type:"WAITING", ...})` 가 이미 `ended`/`panel`(새 대화로 리셋된) 상태를 다시 `awaiting_user_message` 로 되돌린다. `widgetReducer` 의 `WAITING` case(`widget-state.ts:129-137`)는 현재 phase 를 검사하지 않고 무조건 전이한다. 이 시점엔 `sessionRef.current` 가 null 이거나 새 세션이므로, 되살아난 UI 에서 사용자가 입력해도 `sendCommand` 가 `if (!session || !client) return;` 로 조용히 버려 — 사용자에게는 "응답 없음"으로만 보이는 유령 상태가 된다.
    - 이번 diff 로 신규 추가된 terminal 분기(`:249-255`)면 더 심각하다 — 옛 실행이 마침 그 사이 완료돼 있었다면, 방금 새로 시작한(또는 여전히 진행 중인) **새 세션**에 대해 `teardownSession()`(스트림 close·타이머 정리·`clearSession`) + `dispatch({type:"ENDED"})` + `bridgeRef.current?.sendEvent("conversationEnded", ...)` 를 실행해버려, 실제로는 살아있는 새 대화를 로컬·host 양쪽에 "종료됨"으로 잘못 통지한다.
  - 제안: `seedWaitingFromStatus` 도 `start()` 와 동일한 패턴을 적용한다 — 예: `await` 직후 `if (session !== sessionRef.current) return;` (또는 `startGenRef` 를 캡처해 비교)로, 자신이 조회한 세션이 여전히 "현재" 세션일 때만 `dispatch`/`teardownSession`/`sendEvent` 를 수행하도록 가드. 세 호출부(`start`/`applyConfig`/`replay_unavailable` 폴백) 모두 이 가드의 보호를 받게 되므로 한 곳만 고치면 된다.

- **[WARNING]** `execution.replay_unavailable` 폴백의 신규 terminal 분기와 `handleEiaEvent` 의 기존 terminal 분기가 상호 배타적이지 않아, 동일 종료 이벤트에 대해 `teardownSession`/`dispatch(ENDED)`/host `conversationEnded` 통지가 중복 발생할 수 있음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:184-189`(`handleEiaEvent` 의 기존 `TERMINAL_EVENTS` 분기) vs `:249-255`(`seedWaitingFromStatus` 신규 terminal 분기)
  - 상세: 주석(`:178`)이 명시하듯 `replay_unavailable` 은 "종료 신호가 아니므로 스트림·세션은 유지 — 이후 이벤트는 정상 처리된다". 즉 `replay_unavailable` 수신 후에도 SSE 스트림은 살아있고 이후 도착하는 진짜 terminal 이벤트는 `handleEiaEvent` 의 기존 분기(`:184-189`)로 정상 처리된다. 동시에 같은 `replay_unavailable` 이벤트가 트리거한 `seedWaitingFromStatus` 의 REST `getStatus` 폴백(fire-and-forget, `:181`)도 진행 중이다. 실행이 이 두 경로의 타이밍 사이(버퍼 gap 안)에 이미 종료돼 있었다면, 라이브 SSE 로 도착하는 terminal 이벤트와 REST 폴백의 terminal 감지가 **서로 독립적으로** 같은 종료를 각각 처리할 수 있다. 둘 다 순서·중복 여부를 검사하지 않으므로(동일 파일의 `endConversation()` 은 `if (state.phase === "ended") return;` 로 중복 방지 가드를 명시적으로 두고 있는 것과 대비된다) `bridgeRef.current?.sendEvent("conversationEnded", {reason})` 가 host 에 두 번 발사될 수 있다(`dispatch({type:"ENDED"})` 자체는 reducer 상 멱등이라 로컬 phase 는 무해하지만, host 쪽 이벤트 소비자는 중복 알림을 받는다).
  - 제안: 위 첫 번째 발견의 staleness 가드(`session !== sessionRef.current` 등)를 적용하면 이 중복도 함께 차단된다 — 둘 중 하나가 먼저 `teardownSession()` 을 실행해 `sessionRef.current` 를 무효화(null/gen 증가)하면, 나중에 도착하는 쪽은 가드에 걸려 `dispatch`/`sendEvent` 를 건너뛴다. 별도 가드를 원하면 "이미 teardown 했음" 을 나타내는 ref 플래그(`endedRef` 등) 로 최초 1회만 종료 처리를 수행하도록 명시적으로 제한하는 것도 대안.

- **[INFO]** staleness 가드를 추가할 때 `state.phase` 를 직접 참조하면 또 다른 stale-closure 함정이 될 수 있음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:240-278`(`seedWaitingFromStatus` 의 `useCallback` deps `[teardownSession]` — `state` 미포함)
  - 상세: 위 두 발견의 수정 제안으로 `if (state.phase === "ended") return;` 류의 검사를 떠올리기 쉽지만, `seedWaitingFromStatus` 는 `useCallback` deps 에 `state` 가 없어 매 렌더 재생성되지 않는다(의도적 — JSDoc `:237-238` "실 의존은 `teardownSession` 뿐"). 이 상태에서 클로저가 캡처한 `state.phase` 를 직접 읽으면, 실제로는 최신 렌더의 `state` 가 아니라 `seedWaitingFromStatus` 가 생성된 시점의 stale `state` 를 참조하게 되어 가드가 무력화될 수 있다.
  - 제안: 첫 번째 발견 제안처럼 `sessionRef`/`startGenRef` 등 **ref 기반** 비교를 사용할 것 — `state`(React state) 가 아니라 ref 값은 항상 최신을 반영하므로 이 클로저 캡처 문제를 피할 수 있다.

## 참고 — 확인 완료(문제 없음)

- `seedWaitingFromStatusRef.current = seedWaitingFromStatus;` 를 render-body 대입에서 `useEffect(() => {...});`(deps 없음, 매 렌더 실행)로 옮긴 변경(`:284-286`)은 파일의 기존 `apiRef` 컨벤션(`:542-545`)과 정확히 동일한 패턴이며, 이전 리뷰(01_42_44 세션)의 W1 지적을 올바르게 반영했다. 이 ref 는 SSE 이벤트(=effect 로 연 스트림)로만 소비되므로 최초 effect 커밋 이전에 stale 값이 읽힐 경합은 없음을 확인.
- `useCallback` deps 변경(`[]` → `[teardownSession]`, `teardownSession` 자체는 `[closeStream, clearRefreshTimer]` 로 stable)은 React 훅 의존성 규칙상 올바르며 별도의 동시성 결함을 유발하지 않음.

## 요약

이번 diff 의 핵심 프로덕션 변경은 `use-widget.ts` 의 `seedWaitingFromStatus` 에 terminal 상태 처리 분기를 추가한 것이다. 기능 의도(버퍼 만료 gap 중 유실된 terminal 이벤트 복구)는 타당하고 `seedWaitingFromStatusRef` 갱신을 effect 로 옮긴 것도 올바르다. 다만 이 함수는 `await` 을 넘나드는 비동기 흐름이면서도, 같은 파일이 `start()` 에서 이미 확립한 "in-flight 비동기 작업이 stale 해지면 그 결과를 버린다"는 `startGenRef` 패턴을 적용받지 못했다. 그 결과 `execution.replay_unavailable` 폴백(fire-and-forget)이 새 대화 시작/대화 종료/실제 SSE terminal 이벤트와 겹치는 좁은 타이밍 창에서, 지연된 `getStatus` 응답이 이미 교체되거나 종료된 세션·상태에 대해 `dispatch(WAITING/ENDED)`·`teardownSession()`·host `conversationEnded` 통지를 잘못 적용하거나 중복 적용할 수 있다. 발생 조건이 좁아(5분 버퍼 만료 + 그 폭 안에서의 상태 전이 경합) 즉각적인 실사용 재현 가능성은 낮지만, 결과(세션 오종료·유령 UI·host 로의 오탐 알림)는 사용자 체감에 유의미하므로 `start()` 와 동일한 staleness 가드를 `seedWaitingFromStatus` 에도 적용할 것을 권고한다.

## 위험도

LOW
