# 부작용(Side Effect) Review — codebase/channel-web-chat/src/widget/use-widget.ts 외

> 대상: `use-widget.ts`(프로덕션), `use-widget-eager-start.test.ts`(테스트), `review/code/2026/07/17/02_31_18/*`(전 라운드 리뷰 산출물 — read-only 로그, 신규 부작용 없음)

## 발견사항

- **[WARNING]** `endConversation()` 의 `resetSessionRefs(); finalizeEnded(reason);` 시퀀스가 `endedRef` 1회 가드를 사실상 무력화한다 — race 시 `conversationEnded` 중복 발사 가능(이번 diff 가 고치려던 것과 같은 버그 클래스의 재발 경로)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:497-503`(`resetSessionRefs`), `:558-577`(`endConversation`)
  - 상세: `resetSessionRefs()` 는 무조건 `endedRef.current = false` 로 되돌린 뒤(L501) 곧바로 `finalizeEnded(reason)` 을 호출한다(L577). `finalizeEnded` 내부의 가드는 `if (endedRef.current) return false;` 인데, 이 호출 경로에서는 바로 직전 줄이 `endedRef.current` 를 `false` 로 강제 리셋했으므로 **이 가드는 `endConversation` 경유 호출에서는 항상 통과(no-op)** 한다. 즉 코드 주석(L572-575: "종료 시퀀스와 `endedRef` 1회 가드를 SSE terminal·REST 폴백 terminal·410 경로와 공유한다")이 주장하는 "가드 공유"는 이 함수에 한해서는 실질적으로 이뤄지지 않는다 — 중복 방지는 오직 함수 최상단의 `if (state.phase === "ended") return;`(L559) 하나에만 의존한다.
    실제 재발 시나리오: SSE `execution.completed` 이벤트가 `handleEiaEvent` → `finalizeEnded("execution.completed")` 를 호출해 `endedRef.current=true` + `dispatch({type:"ENDED"})` + `sendEvent("conversationEnded")` 를 이미 1회 발사했다고 하자. `dispatch` 는 비동기 재렌더를 트리거할 뿐 그 즉시 `state.phase` 를 동기적으로 갱신하지 않는다(React 배치). 이 좁은 창(SSE 콜백 처리~재렌더 커밋 사이)에서 사용자가 이미 렌더된(stale) `endConversation` 클로저를 통해 "대화 종료" 버튼을 누르면, `state.phase` 는 아직 `"ended"` 로 갱신되지 않았으므로 L559 가드를 통과하고, `resetSessionRefs()` 가 방금 `true` 로 세팅된 `endedRef.current` 를 다시 `false` 로 되돌린 뒤, `finalizeEnded(reason)` 이 재차 실행돼 `dispatch({type:"ENDED"})` 와 `bridgeRef.current?.sendEvent("conversationEnded", ...)` 를 **두 번째로** 발사한다. host 가 동일 종료를 2회 통지받는 것은 정확히 이번 diff 의 W1(410 경로)이 고친 버그와 동일한 클래스다.
  - 제안: `endConversation()` 최상단에 `if (endedRef.current) return;` 을 `resetSessionRefs()` 호출 **이전**에 추가해 실질적 방어선을 하나 더 두거나, `resetSessionRefs()` 가 `endedRef.current` 를 리셋하기 전에 `finalizeEnded` 를 먼저 호출하는 순서(`finalizeEnded(reason); resetSessionRefs();` 는 안 되므로 — `finalizeEnded` 도 `teardownSession` 을 통해 세션 정리를 하고 있어 순서 재조합이 필요)로 재구성. 또는 주석의 "가드 공유" 문구를 정정해, 실제 방어가 `state.phase` 단일 체크에 의존한다는 점과 그 한계를 명시.

- **[WARNING]** `sendCommand` 의 `useCallback` 의존성 배열에 새로 참조한 `finalizeEnded` 가 누락됨 (`react-hooks/exhaustive-deps` 경고 실측 확인)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:412-432`(특히 L425 `finalizeEnded("gone");` 호출부와 L431 `}, [],);`)
  - 상세: 이 diff 이전에는 `sendCommand` 의 410 catch 분기가 `clearSession`/`dispatch`/`bridgeRef.current?.sendEvent` 를 직접 호출했고 이들은 모두 ref/stable import 라 빈 deps 배열이 정확했다. 이번 diff 로 `finalizeEnded("gone")` 호출이 추가됐는데(L425) deps 배열은 여전히 `[]` 로 남아 있다. `npx eslint src/widget/use-widget.ts` 실행 결과 다음 경고가 실제로 발생한다: `431:5  warning  React Hook useCallback has a missing dependency: 'finalizeEnded'`. 같은 diff 에서 `endConversation` 은 정확히 `finalizeEnded` 를 deps 에 추가했는데(`}, [state.phase, state.pending, resetSessionRefs, finalizeEnded]);`) `sendCommand` 만 누락된 비일관성이다. 현재는 `finalizeEnded`→`teardownSession`→`closeStream`/`clearRefreshTimer` 체인이 전부 안정적인 참조(deps 불변)라 런타임상 stale closure 로 인한 실제 오동작은 발생하지 않지만, 이는 우연한 안전성이다 — 체인 중 하나라도 향후 deps 가 변경돼 안정성을 잃으면 `sendCommand` 는 마운트 시점의 옛 `finalizeEnded` 를 영구히 계속 호출하게 되어 `endedRef` 가드가 어긋나거나(다른 클로저의 `endedRef.current` 참조 자체는 ref 라 문제 없지만 `teardownSession` 체인의 옛 버전이 최신 `configRef`/`clearRefreshTimer` 를 못 따라가는 등) 조용히 회귀할 수 있다.
  - 제안: `}, [finalizeEnded]);` 로 수정. lint 경고가 CI 를 막지 않는 `warning` 등급이라 통과했더라도, 정확한 의존성 명시가 이런 종류의 회귀를 원천 차단한다.

- **[WARNING]** 신규 테스트 2건이 vitest 전역 상태(`fake timers`, `window.parent.postMessage` spy)를 `try/finally` 없이 마지막 줄에서만 해제 — 조기 실패 시 다른 테스트로 누수 가능
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:213-258`(`vi.useFakeTimers` L218 / `vi.useRealTimers` L257), `:1481-1554`(`postSpy = vi.spyOn(window.parent, "postMessage")` L1482 / `postSpy.mockRestore()` L1554)
  - 상세: 두 테스트 모두 assert 문(예: L247/L249/L251/L256, 또는 L250/L258 부근의 `expect(endedEvents.length).toBe(1)`)이 해제 코드보다 먼저 여러 줄 등장한다. 어느 하나라도 실패(throw)하면 그 아래의 `vi.useRealTimers()` / `postSpy.mockRestore()` 는 실행되지 않는다. 파일 최상단 `afterEach(() => { vi.unstubAllGlobals(); })`(L172-174)는 `vi.stubGlobal` 로 생성한 스텁만 되돌릴 뿐, `vi.useFakeTimers()` 나 `vi.spyOn().mockImplementation()` 은 되돌리지 않는다(각각 별도 API — `vi.useRealTimers()`, `mockRestore()`/`vi.restoreAllMocks()` 필요). `vitest.config.ts` 에도 `restoreMocks`/전역 타이머 리셋 설정이 없다. 결과적으로 이 두 테스트 중 하나가 실패하면 이후 실행되는 **같은 파일의 모든 후속 테스트**가 fake timer 모드(또는 스푸핑된 `window.parent.postMessage`) 상태로 실행돼, 실제 실패 원인과 무관한 연쇄 실패(false failure)를 유발해 디버깅을 어렵게 만든다. 특히 `postSpy` 는 `bridgeRef.current?.sendEvent(...)` 가 내부적으로 사용하는 `window.parent.postMessage` 를 가로채므로 누수 시 다른 host-통지 관련 테스트들이 조용히 깨지거나(또는 조용히 통과해버리는 false negative) 위험이 크다.
    같은 파일 안에 이미 올바른 패턴이 존재한다(`:761-813`, 특히 L767 `vi.useFakeTimers(...)` ~ L812 `} finally { vi.useRealTimers(); }`) — 이번에 추가된 두 테스트만 이 관행을 따르지 않았다.
  - 제안: 두 테스트 모두 `try { ...본문... } finally { vi.useRealTimers(); }` / `try { ... } finally { postSpy.mockRestore(); }` 로 감싸거나, 최소한 전역 `afterEach` 에 `vi.useRealTimers(); vi.restoreAllMocks();` 를 추가해 파일 전체에 안전망을 둔다.

- **[INFO]** `endConversation()` 경로에서 `teardownSession()` 이 매번 2회 중복 실행됨(현재는 멱등이라 무해, 위 첫 WARNING 의 구조적 원인)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:497-503`(`resetSessionRefs` 내부 L498 `teardownSession();`), `:180-190`(`finalizeEnded` 내부 L184 `teardownSession();`), 호출부 `:576-577`
  - 상세: `endConversation()` 이 `resetSessionRefs()` → `finalizeEnded(reason)` 을 연달아 부르면, 두 함수가 각각 `teardownSession()` 을 호출해 `startGenRef.current++`(2회 증가) / `closeStream()`(2회, 2번째는 no-op) / `clearRefreshTimer()`(2회, idempotent) / `clearSession(...)`(2회, `sessionStorage.removeItem` idempotent) 가 매 호출마다 중복 실행된다. 현재 `teardownSession` 내부 연산이 모두 멱등이라 기능적 버그는 없으나, 향후 `teardownSession` 에 비-멱등 부작용(예: 서버 텔레메트리 호출, 카운터 증가 등)이 추가되면 이 경로만 조용히 2배로 실행돼 발견하기 어려운 회귀가 된다.
  - 제안: `resetSessionRefs()` 와 `finalizeEnded()` 중 하나만 `teardownSession()` 을 호출하도록 역할을 재정리(예: `finalizeEnded` 가 이미 `teardownSession` 을 부르므로, `endConversation` 은 `resetSessionRefs()` 대신 `sessionRef.current`/`startedRef.current`/`clearQueue()` 만 별도로 처리하는 얇은 헬퍼를 만들거나, `finalizeEnded` 에 "이미 teardown 됐으면 skip" 옵션 인자를 둔다).

## 검토 결과 — 특이사항 없음 확인

- **시그니처/인터페이스 변경(4·5)**: `seedWaitingFromStatus` 반환 타입이 `Promise<boolean>` → `Promise<SeedOutcome>`(`"ended"|"stale"|"continue"`)로 바뀌었으나, 이 함수와 `seedWaitingFromStatusRef` 는 모두 `useWidget` 훅 내부 비공개 클로저이며 export 되지 않는다. 세 호출부(`start()`, `applyConfig()`, `handleEiaEvent`)가 모두 이 diff 안에서 함께 갱신됐고, 외부 공개 API(`useWidget()` 의 반환 `state`/`actions` shape)는 변경되지 않았다 — 호출자 영향 없음.
- **전역 변수(2)**: 새 전역 변수 도입 없음. `SeedOutcome` 은 모듈 스코프 타입 별칭일 뿐 런타임 상태 아님.
- **환경 변수(6)**: 관련 변경 없음.
- **네트워크 호출(7)**: 이번 diff 는 기존 네트워크 호출 지점(`client.interact`, `getStatus`)의 결과 처리 로직만 재구성했을 뿐, 신규 외부 호출을 추가하지 않았다.
- **파일시스템 부작용(3)**: `review/code/2026/07/17/02_31_18/*`(RESOLUTION.md, SUMMARY.md, 각 리뷰어 산출물, `_retry_state.json`, `meta.json`) 신규 생성은 프로젝트 관례(`review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)에 따른 리뷰 프로세스의 정상 산출물이며 코드 변경에 부수된 의도치 않은 파일 생성이 아니다.

## 요약

프로덕션 변경(`use-widget.ts`)은 3라운드에 걸친 종료(termination) 경합 버그를 좁혀가는 방어적 강화이고, 새로 도입한 `SeedOutcome` 3-state 반환값은 내부 전용이라 외부 인터페이스 파손 위험은 없다. 다만 `endConversation()` 이 `resetSessionRefs()` 로 `endedRef` 를 리셋한 직후 `finalizeEnded()` 를 호출하는 구조는, 코드 주석이 주장하는 "`endedRef` 1회 가드 공유"를 이 경로에서는 사실상 무력화하며(항상 `false`→`true` 로 통과), 실질적 중복 방지는 `state.phase==="ended"` 단일 체크에만 의존한다 — SSE terminal 처리(비동기 dispatch)와 사용자 클릭(stale 클로저)이 근접 타이밍에 겹치면 host 가 `conversationEnded` 를 2회 통지받는, 이번 diff 가 바로 잡으려던 것과 동일한 클래스의 회귀가 좁은 창에서 재발할 수 있다. 또한 `sendCommand` 의 `useCallback` deps 누락(`finalizeEnded`, eslint 경고 실측)은 현재는 우연히 안전하지만 향후 deps 체인이 불안정해지면 stale closure 로 이어질 수 있는 잠재 리스크이며, 신규 테스트 2건이 `vi.useFakeTimers`/`vi.spyOn` 을 `try/finally` 없이 정리해 테스트 실패 시 전역 상태가 후속 테스트로 누수될 수 있다는 점도 파일 자체에 이미 존재하는 올바른 패턴과 비교해 눈에 띄는 비일관성이다. CRITICAL 로 격상할 만큼 결정적으로 재현 가능한 문제는 아니나(모두 좁은 race 또는 잠재적 미래 리스크), 이번 라운드가 정확히 이런 부류의 경합을 3회 연속 놓쳤던 이력을 감안하면 조치를 권장한다.

## 위험도

MEDIUM
