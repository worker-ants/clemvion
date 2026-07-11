# 동시성(Concurrency) Review — webchat 위젯 newChat coalesce/cancel (§R9)

## 리뷰 범위

실질적 동시성 로직 변경은 `codebase/channel-web-chat/src/widget/use-widget.ts` 의 `newChat()`
1건이다(booting 중 single-flight coalesce 가드 + 확립 세션발 best-effort cancel). 나머지:

- `widget-state.ts` — 주석(JSDoc)만 갱신, 런타임 로직 변경 없음(동시성 영향 없음).
- `use-widget-eager-start.test.ts` — 위 로직에 대한 신규 회귀 테스트(R9-A, R9-B-1×2).
- `plan/in-progress/spec-draft-webchat-execution-residuals.md`, `review/consistency/**`,
  `spec/7-channel-web-chat/1-widget-app.md` — 계획/검토/명세 문서. 코드 아님, 동시성 검토 대상 제외.
- backend(서버) 코드는 이번 diff 에 포함되지 않음 — DB 트랜잭션/락/커넥션 풀 관련 항목 해당 없음.

## 발견사항

- **[INFO]** `newChat()` best-effort cancel 은 세대 토큰(`startGenRef`) 검증 없이 fire-and-forget 된다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1094-1108` (`newChat`)
  - 상세: `prevSession`/`client` 를 `resetSessionRefs()` 호출 **이전**에 동기적으로 캡처한 뒤,
    `void client.interact(prevSession.endpoints, prevSession.token, {command:"cancel", ...})` 로
    발사한다. 이 캡처와 발사 사이에 `await` 지점이 없어(완전 동기 구간) 다른 async 작업이 끼어들
    여지가 없고, 캡처된 `prevSession` 은 지역 `const` 라 이후 `sessionRef.current` 가 새 세션으로
    갱신되더라도 cancel 호출 대상은 항상 옛 세션 엔드포인트로 고정된다. 즉 "새 세션에 옛 cancel 이
    잘못 발사되는" race 는 설계상 발생하지 않는다 — 결함이 아니라 확인된 안전 패턴.
  - 제안: 현행 유지. 향후 리팩터링 시 `prevSession` 캡처와 `client.interact` 호출 사이에 `await`
    을 끼워 넣지 않도록(그 경우 클로저 캡처 불변식이 깨질 수 있음) 회귀 방지 필요.

- **[INFO]** `newChat()`/`endConversation()` 교차 호출 시 이론적 stale-closure 경합(본 diff 도입 아님, pre-existing 패턴)
  - 위치: `use-widget.ts` — `endConversation()` 의 가드는 `useReducer` state 클로저(`state.phase === "ended"`)
    를 사용하는 반면, `newChat()`/`resetSessionRefs()` 는 ref(`startedRef`/`sessionRef`)를 **동기 즉시** 갱신한다.
    두 액션 모두 `apiRef.current` 를 통해 `useEffect`(passive effect, 렌더 커밋 후 비동기 실행)로
    최신 클로저를 참조하는 기존 패턴을 공유한다.
  - 상세: 만약 두 액션이 중간 렌더 커밋(그리고 `apiRef` 갱신 effect 실행) 없이 연속 트리거되면,
    `endConversation` 이 아직 `state.phase` 가 갱신되지 않은 stale 클로저를 참조해 방금 `NEW_CHAT` 으로
    시작된 새 대화 위에 `ENDED` 를 뒤이어 dispatch 할 이론적 여지가 있다(리듀서 액션 적용 순서상
    `NEW_CHAT` → `ENDED` 로 phase 가 최종적으로 `ended` 로 덮인다). 다만 실사용 경로 확인 결과
    `endConversation` 은 host bridge 명령(`bridge.onCommand`)에 매핑돼 있지 않고 UI 버튼 전용이며,
    `newChat` 을 유발하는 host `resetSession` 명령과는 서로 다른 트리거 경로라 실제로 동일 tick 에
    연속 호출될 개연성은 낮다. 이번 diff 가 새로 만든 경합은 아니며(구조는 기존과 동일), `newChat`
    쪽에 cancel 발사가 추가돼 표면이 넓어졌을 뿐이다.
  - 제안: 우선순위 낮음. 조치가 필요하다면 `endConversation` 의 종료 가드를 `state.phase` 대신
    `sessionRef`/`startGenRef` 같은 ref 기반 판정으로 전환해 렌더 지연에 영향받지 않게 하는 편이
    더 견고하다. 이번 PR 범위에서 반드시 고칠 필요는 없음.

## 요약

이번 diff 의 핵심은 `use-widget.ts::newChat()` 에 (A) booting 중 single-flight coalesce 가드
(`startedRef.current && !sessionRef.current` 이면 조기 return, in-flight `start()` 에 흡수)와
(B) 확립 세션발 best-effort `cancel` 명령(정리 이전에 `prevSession`/`client` 를 동기 캡처 후 발사,
실패해도 로컬 재시작을 되돌리지 않는 optimistic 처리)을 추가한 것이다. 두 로직 모두 async gap 없이
필요한 값을 동기적으로 캡처한 뒤 발사하는 방식이라 새로운 race window 를 만들지 않으며, 기존
`startGenRef` 세대 토큰 패턴(await 사이 teardown 발생 시 stale 결과 폐기)과 일관된 설계다. 오히려
이 변경은 booting 중 재클릭이 중복 webhook POST 를 유발하던 기존 결함을 제거하는 **동시성 개선**이며,
정확히 그 race window(수동 resolve 가능한 in-flight fetch)를 재현하는 테스트(R9-A)와 cancel
낙관적 처리 성공/실패 양쪽 경로 테스트(R9-B-1 ×2)가 신규로 추가되어 회귀 방지 커버리지도 충분하다.
발견된 항목은 모두 INFO 수준 확인 사항이며, 하나는 설계상 안전함을 재확인한 것이고 다른 하나는 이
diff 가 도입하지 않은 기존 패턴의 이론적 엣지케이스다. CRITICAL/WARNING 급 결함은 없다.

## 위험도

LOW
