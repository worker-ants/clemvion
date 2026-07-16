# 동시성(Concurrency) Review

대상 중 실질 분석이 필요한 것은 프로덕션 코드인 `codebase/channel-web-chat/src/widget/use-widget.ts`
뿐이다. `use-widget-eager-start.test.ts` 는 테스트 코드(회귀 테스트 추가)이고, 나머지(3~14번)는
직전 라운드(`02_31_18`)의 리뷰 산출물(RESOLUTION/SUMMARY/각 reviewer `.md`/JSON)이 신규 커밋되는
것으로 실행 코드가 아니다.

이번 diff 는 직전 concurrency WARNING(`Promise<boolean>` 이 "정상 시드"와 "stale 폐기"를 뭉개
`applyConfig` 복원 경로에서 새 대화 SSE 스트림이 지연 응답에 탈취될 수 있던 race, 및 `endedRef`
1회 가드가 `sendCommand` 의 410 경로·`endConversation` 을 커버 못하던 문제)를 고치는 fix 커밋이다.
아래는 이 fix 자체의 정확성 확인 + 잔존/신규 이슈 점검이다.

## 발견사항

- **[INFO]** (확인) 직전 라운드 concurrency WARNING 2건은 정확히 반영됨
  - 위치: `use-widget.ts:82-88`(`SeedOutcome` 3-state), `:180-190`(`finalizeEnded` 단일 진입점),
    `:395-396`(`start()`), `:643-646`(`applyConfig`), `:420-425`(`sendCommand` 410),
    `:576-577`(`endConversation`)
  - 상세: `seedWaitingFromStatus` 반환이 `boolean` → `"ended" | "stale" | "continue"` 3-state 로
    승격되어 `applyConfig`(세션 복원)와 `start()` 양쪽에서 "정상 시드"와 "await 중 세션 교체(stale)"를
    구분해 `!== "continue"` 로 동일하게 게이팅한다. 이전에는 `applyConfig` 만 이 재검증이 없어 마운트
    직후 getStatus 왕복 중 새 대화가 시작되면 지연 응답이 옛 토큰으로 새 스트림을 열 수 있었는데,
    지금은 `seedWaitingFromStatus` 내부의 `sessionRef.current !== session` 체크가 "stale" 을 반환해
    `applyConfig` 도 동일하게 중단한다. 또한 `finalizeEnded`(endedRef 1회 가드 + teardownSession +
    dispatch + host 통지)가 SSE terminal·REST 폴백 terminal·`sendCommand` 410·`endConversation`
    네 경로 전부의 단일 진입점이 되어, `endConversation` 이 `resetSessionRefs()` 로 `endedRef` 를
    false 로 되돌린 뒤 자체 dispatch 하던 이전의 `phase==="ended"` vs `endedRef===false` 불일치도
    사라졌다(JS 는 단일 스레드라 `resetSessionRefs(); finalizeEnded(reason);` 사이에 다른 코드가
    끼어들 수 없어 가드가 정확히 걸린다). 신규 테스트(W5/W7a/W7b)도 mutation 검증(가드 무력화 시
    fail)으로 실효성이 확인됨 — 발견사항 아님, 검증 목적으로 기록.

- **[WARNING]** `sendCommand` 의 `useCallback` 의존성 배열에 `finalizeEnded` 누락 — stale closure 위험 (eslint 확인됨)
  - 위치: `use-widget.ts:412-432` (`sendCommand`, deps `[]`)
  - 상세: 이번 diff 로 410 catch 분기가 `dispatch`/`bridgeRef.current?.sendEvent` 직접 호출 대신
    `finalizeEnded("gone")` 을 참조하도록 바뀌었는데, `useCallback` 의존성 배열은 여전히 `[]` 로
    남아 있다. 실측(`npx eslint src/widget/use-widget.ts`): `react-hooks/exhaustive-deps` 가
    "React Hook useCallback has a missing dependency: 'finalizeEnded'" 를 경고한다(diff 이전에는
    이 분기가 참조하던 값이 전부 ref/모듈 상수/stable `dispatch` 뿐이라 `[]` 가 맞았음 — 이번 diff 가
    새로 만든 위반). 현재는 `finalizeEnded` 의 의존 체인(`teardownSession` ← `closeStream`(`[]`) +
    `clearRefreshTimer`(`use-token-refresh.ts` 내 `[]`))이 전부 stable 이라 `sendCommand` 가 캡처한
    첫 렌더의 `finalizeEnded` 참조가 우연히 항상 최신과 동일해 **현재는 실질 버그가 아니다**. 다만
    이 PR 자체가 "함수 안에 넣으면 우연히 안전할 것" 이라는 착각을 근본 원인으로 지목하며(W5 주석,
    `applyConfig` CRITICAL 의 교훈) 명시적 계약으로 승격하는 방향을 택했는데, 정작 같은 diff 가
    `sendCommand` 에서는 동일 패턴(암묵적 안정성에 의존)을 새로 만들었다는 점에서 이 프로젝트의
    자체 기준으로도 지적할 가치가 있다. 향후 `teardownSession`/`clearRefreshTimer` 의 의존 체인에
    비-stable 값이 하나라도 섞이면 `sendCommand` 는 조용히 낡은 `finalizeEnded` 를 계속 참조하게 된다.
  - 제안: `}, [],);` → `}, [finalizeEnded],);` 로 수정(eslint 제안 fix 그대로 적용 가능, 동작 변화 없음).

- **[WARNING]** `applyConfig`/`start()` 모두 마지막 `await` 이후 컴포넌트 unmount 를 재검사하지 않아 SSE 연결이 leak 될 수 있음 (이번 diff 범위 밖의 잔존 gap, 동일 함수 내)
  - 위치: `use-widget.ts:619-651`(`applyConfig`, 특히 `:643-648`), `:365-410`(`start()`, 특히 `:395-399`)
  - 상세: 마운트 effect 는 `cancelled` 클로저 변수로 `isEmbedAllowed` await 직후 1회만 unmount 를
    검사한다(`:622-623`). 그 뒤 `seedWaitingFromStatus` 의 두 번째 `await`(`:643`) 이 끝난 뒤에는
    `cancelled` 를 다시 확인하지 않고 바로 `openStream(saved, "0")`(`:648`) 을 호출한다. 컴포넌트가
    `getStatus` in-flight 중 unmount 되면, effect cleanup(`:695-700`) 이 이미 실행되어 `closeStream()`
    +`bridge.destroy()` 를 마친 뒤인데, `seedWaitingFromStatus` resolve 후 `openStream` 이 **새
    EventSource 를 열고 `streamRef.current` 에 저장** — 이 스트림은 이후 어떤 cleanup 도 다시
    돌지 않으므로 열린 채로 leak 된다. `scheduleRefresh()` 는 `useTokenRefresh` 자체의
    `cancelledRef`(독립 unmount effect) 로 자기방어되어 안전하지만(`use-token-refresh.ts:87-92`),
    `openStream` 은 이 보호가 없다. `start()` 는 애초에 `cancelled` 플래그 자체에 접근하지 않고
    `startGenRef` 비교만 하는데, 이 gen 은 `teardownSession()`(새 대화/종료/종료이벤트)에서만
    증가하고 순수 unmount 로는 증가하지 않아 동일한 leak 경로가 존재한다. 이번 diff 는 "세션 교체"
    race(W2)를 고쳤을 뿐 "컴포넌트 unmount" race 는 대상이 아니었으므로 신규 회귀는 아니나, 이
    diff 가 정확히 이 두 함수의 await-이후 후속 동작을 게이팅하는 계약(`SeedOutcome`)을 새로
    도입한 시점이라 같이 정리할 좋은 기회다.
  - 제안: 마운트 effect 전용 `cancelledRef`(ref, `applyConfig`/`start()` 양쪽이 참조 가능하도록 끌어올림)
    를 두고, `openStream` 직전(두 호출부 모두)에 `if (cancelledRef.current) return;` 을 추가.
    또는 `openStream` 자체에 "호출 시점에 `bridgeRef.current` 가 이미 destroy 됐으면 no-op" 가드를
    두는 것도 대안.

- **[INFO]** `sessionRef.current` 가 `finalizeEnded`/`teardownSession` 경로에서는 null 화되지 않음(`resetSessionRefs` 만 null 화) — `clickButton`/`submitForm` 이 phase 가드 없이 종료된 세션에 커맨드를 보낼 수 있음
  - 위치: `use-widget.ts:158-164`(`teardownSession`, `sessionRef` 미터치), `:180-190`(`finalizeEnded`),
    `:464-476`(`clickButton`/`submitForm`, phase 가드 없음)
  - 상세: SSE terminal 이벤트(`handleEiaEvent`)나 `sendCommand` 의 410 이 `finalizeEnded` 만
    거치는 경로(`endConversation` 처럼 `resetSessionRefs()` 를 먼저 호출하지 않는 경로)에서는
    `sessionRef.current` 가 종료 후에도 옛 세션 객체를 계속 참조한다(`resetSessionRefs()` 만
    `sessionRef.current = null` 을 수행). `submitMessage` 는 `state.phase === "awaiting_user_message"`
    로 가드되어 종료 후 `enqueue` 로 빠지지만, `clickButton`/`submitForm` 은 phase 를 전혀 검사하지
    않고 곧바로 `sendCommand` 를 호출한다. 종료 직후 화면이 아직 이전 버튼/폼을 렌더 중인 순간
    사용자가 클릭하면 이미 무효화된 세션으로 `interact` 요청이 한 번 더 나간다. 실질 피해는
    제한적이다 — 서버가 다시 410 을 주더라도 `finalizeEnded` 의 `endedRef` 가드가 두 번째 종료
    통지를 막아 host 중복 통지는 없다(낭비된 네트워크 요청 1회뿐). 데이터 손상이나 상태 불일치로
    이어지지는 않아 WARNING 이 아닌 INFO 로 분류.
  - 제안: 저비용으로는 `clickButton`/`submitForm` 에도 `state.phase !== "ended"` 가드 추가. 근본적으로는
    `finalizeEnded` 가 `sessionRef.current = null` 도 함께 수행하도록(현재 `resetSessionRefs` 전용
    로직과 통합) 고려 — 단 `resetSessionRefs` 의 "새 대화는 재시작 허용" 의미(`startedRef=false` 등)와는
    분리해야 함.

## 요약

이번 diff 는 직전 라운드에서 지적된 두 concurrency WARNING(세션 교체 stale race, `endedRef` 가드
커버리지 공백)을 `SeedOutcome` 3-state 승격과 `finalizeEnded` 단일 진입점 통합으로 정확히 고쳤다 —
mutation 검증(가드 무력화 시 실패)까지 확인된 견고한 수정이다. 다만 그 수정 과정에서 `sendCommand`
가 `finalizeEnded` 를 참조하면서도 `useCallback` 의존성 배열을 갱신하지 않아 stale-closure 위험을
새로 만들었고(현재는 하위 의존 체인이 전부 stable 이라 실질 버그는 아니나 eslint 가 실제로 경고함),
`applyConfig`/`start()` 양쪽에 이미 있던 "컴포넌트 unmount 중 마지막 await 이후 재검증 누락" gap(SSE
연결 leak 가능)은 이번 fix 범위 밖으로 그대로 남았다. 둘 다 즉시 차단 사유는 아니지만, 이 파일이
이미 여러 라운드에 걸쳐 정확히 이런 부류(참조 안정성에 대한 암묵적 가정, await 경계에서의 재검증
누락)의 CRITICAL/WARNING 을 반복 배출해 온 이력을 감안하면 다음 라운드에서 정리할 가치가 있다.

## 위험도

LOW
