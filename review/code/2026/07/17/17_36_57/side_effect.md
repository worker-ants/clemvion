# 부작용(Side Effect) 리뷰 — webchat-boot-single-flight

대상: `codebase/channel-web-chat/src/lib/widget-state.ts` · `widget-state.test.ts` · `codebase/channel-web-chat/src/widget/use-widget.ts` · `use-widget-eager-start.test.ts` · `spec/7-channel-web-chat/2-sdk.md`
(실제 diff 범위는 `git diff origin/main...HEAD --stat` 로 재확인 — 아래 INFO 참조)

## 발견사항

### [CRITICAL] `RESTORED` 의 `ended` 가드는 리듀서 디스패치만 막을 뿐, `applyConfig` 복원 분기의 부수효과(SSE 재연결·토큰 갱신 예약·세션 ref 되살림)는 막지 못한다 — "화면상 부활 방지"는 됐지만 "실제 재연결 방지"는 안 됐다

- 위치:
  - `codebase/channel-web-chat/src/lib/widget-state.ts:125-137` (`case "RESTORED"` 의 `if (state.phase === "ended") return state;`)
  - `codebase/channel-web-chat/src/widget/use-widget.ts:849-871` (`applyConfig` 의 세션 복원 분기)
  - 대조: 같은 파일 `handleEiaEvent` 의 `WAITING` 디스패치 지점(`use-widget.ts:347-356`)은 dispatch **단독** 호출이라 이 문제가 없음.

- 상세:
  `applyConfig`(use-widget.ts:849-871)의 복원 분기는 다음 순서로 실행된다.
  ```ts
  sessionRef.current = saved;
  startedRef.current = true;
  dispatch({ type: "RESTORED", executionId: saved.executionId });   // (a) — 리듀서가 무시할 수 있음
  ...
  const outcome = await seedWaitingFromStatus(clientRef.current, saved);  // (b) — 실제 GET 요청
  if (outcome !== "continue") return;
  if (isAttemptStale(attempt)) return;
  openStream(saved, "0");        // (c) — 실제 SSE 연결
  scheduleRefresh();             // (d) — 실제 token refresh 예약(추후 refreshToken POST)
  ```
  `dispatch`는 리듀서가 액션을 받아들였는지 여부를 호출부에 알려주지 않는다. 즉 (a)에서 리듀서가
  `ended` 가드로 액션을 무시(`return state;`)해도 `applyConfig`는 이를 전혀 모른 채 (b)~(d)를 **그대로
  실행**한다. `state.phase`는 "ended"로 남아 화면은 정상으로 보이지만, 내부적으로는:
  - `sessionRef.current`/`startedRef.current`가 "죽은" 세션을 가리키도록 되살아나고,
  - `seedWaitingFromStatus`가 실제 `getStatus` GET을 쏘고, 서버가 아직 `running`으로 응답하면(클라이언트
    ERROR와 서버 실제 상태는 별개이므로 매우 현실적인 조합),
  - `openStream`이 **실제 EventSource 를 새로 연다**(SSE 재연결),
  - `scheduleRefresh`가 **`refreshToken` 네트워크 호출을 예약**하고, 그 응답이 성공하면 `saveSession`으로
    **sessionStorage 를 갱신해(만료시각 연장) 좀비 세션 수명을 오히려 연장**한다.

  이 경로로 재연결된 스트림이 이후 `execution.ai_message`를 받으면 `AI_MESSAGE` 리듀서 케이스에는
  `ended` 가드가 없어(widget-state.ts:189-195) **유령 메시지가 `state.messages`에 조용히 누적**된다.
  터미널 이벤트가 도착하면 `finalizeEnded`가 (이번이 처음이므로 `endedRef.current`가 아직 false —
  ERROR 경로는 `endedRef`를 세팅하지 않음, use-widget.ts:575) 실행되어 host 에
  `conversationEnded`를 **뒤늦게, 그리고 대응하는 "시작" 통지 없이** 다시 보낸다.

  이는 정확히 이 PR(A-6)이 막으려던 버그의 **"반대편 구멍"**이다 — plan이 명시한 "이 결함 클래스는
  네 번 반대편 구멍이 났다"는 이력과 같은 패턴: 눈에 보이는 증상(phase 부활)은 막았지만, 그 증상을
  일으키던 부수효과(재연결)는 그대로 남아 더 찾기 어려운 형태로 이전했다.

  기존 회귀 테스트 `"ERROR 로 종료된 대화는 wc:boot 재전송으로 부활하지 않는다"`
  (use-widget-eager-start.test.ts:2616-2682)는 `installControllableEventSource()`로 `getEs()`를 이미
  확보해 두고도, wc:boot 재전송 이후에는 **`getEs()`를 다시 검사하지 않고** `state.phase === "ended"`만
  확인한다. 실제로 이 테스트의 mock(`getStatus` → `status: "running"`)로 코드를 그대로 추적하면
  `openStream`이 호출되어 새 `EventSource`가 생성됨(→ `getEs()`가 non-null로 바뀜)을 확인했다 — 즉
  이 부수효과는 현재 스위트로 **검증되지 않는다**.

- 제안:
  `applyConfig`가 "이 RESTORED 가 실제로 받아들여졌는지"를 알 수 있는 신호가 필요하다. 이 파일의 기존
  관용구(참조: `apiRef`, `seedWaitingFromStatusRef`)를 따르면:
  1. `endedRef`(이미 존재, use-widget.ts:218)를 `finalizeEnded` 경유 종료뿐 아니라 **`ERROR` 직접
     디스패치 지점**(use-widget.ts:575, 599)에서도 세팅하도록 확장하고,
  2. `applyConfig`의 복원 분기에서 `dispatch({type:"RESTORED",...})` 직후(혹은 그 전에) `endedRef.current`를
     확인해 `true`면 seed/openStream/scheduleRefresh 전체를 건너뛰도록 한다.
  이렇게 하면 리듀서 가드와 imperative 가드가 **같은 사실**(ended 여부)을 같은 방식(ref)으로 공유하게 되어,
  "리듀서는 막았는데 부수효과는 안 막힘" 류의 비대칭이 구조적으로 방지된다 — 이 파일이 이미 채택한
  "가드는 규율이 아니라 구조" 원칙과도 합치한다.
  최소한, 이 부수효과가 의도된 trade-off라면 `establishConfig`/`RESTORED` JSDoc에 이 사실을 명시하고
  `getEs()` 재확인 단언을 회귀 테스트에 추가해야 한다.

---

### [WARNING] supersede 로 대체된 시도가 `RESTORED` 디스패치까지는 성공한 뒤 두 번째 체크포인트에서 물러나면, "streaming 인데 연결 없음" 상태가 남을 수 있다 — 교정은 전적으로 살아있는 시도의 완료에 의존

- 위치:
  - `codebase/channel-web-chat/src/widget/use-widget.ts:261-270` (`beginBootAttempt`/`isAttemptStale`)
  - `codebase/channel-web-chat/src/widget/use-widget.ts:849-871` (동일 복원 분기 — 두 번째 `isAttemptStale` 체크포인트)
  - `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:2505-2557` (신규 테스트, `state.phase` 미검증)

- 상세:
  겹친 두 `wc:boot`(#1, #2) 중 #1이 이미 `isEmbedAllowed` 통과 → `establishConfig` → `loadSession`으로
  저장 세션을 찾아 `dispatch({type:"RESTORED",...})`(phase→"streaming")까지 마친 뒤,
  `await seedWaitingFromStatus(...)` 도중 #2가 도착해 `bootGenRef`를 증가시키면, #1은 그 await가
  끝난 뒤 두 번째 `isAttemptStale(attempt)` 체크(use-widget.ts:868)에서 물러나 `openStream`/
  `scheduleRefresh`를 **실행하지 않고** 반환한다.

  이 시점 `state.phase`는 이미 "streaming"(#1이 남긴 것)이지만 SSE 연결도, 토큰 갱신 예약도 없다.
  이를 교정하는 것은 오직 **#2가 스스로 어떤 dispatch에 도달하는 것**뿐이다(BLOCKED 든, 자기
  RESTORED든, `establishConfig`→`newChat`이든). world-gen 무효화 지점(teardownSession/start/unmount)은
  항상 "무효화 + 동일 동기 흐름 내 교정 dispatch"가 세트로 묶여 있는 반면, boot-gen 무효화(새 `wc:boot`
  도착 자체)는 **아무 교정 dispatch도 동반하지 않는다** — 오직 "나중 시도가 언젠가 뭔가는 디스패치할
  것"이라는 기대에 의존한다. `fetchEmbedConfig`(use-widget.ts:31-47)에는 fetch 타임아웃이 없으므로,
  #2의 embed-config 요청이 유난히 느리거나(네트워크 지연 편차) 멈추면 이 "streaming 인데 연결 없음"
  상태가 그만큼 오래(극단적으로는 무기한) 지속될 수 있다.

  신규 테스트 `"§106: 복원 seed 중 재전송으로 대체된 시도는 SSE 를 열지 않는다"`
  (use-widget-eager-start.test.ts:2505-2557)는 정확히 이 시나리오를 만들면서 "2차의 embed-config 는
  일부러 미해결로 둬 1차 거동만 관측한다"고 주석에 명시한다 — 즉 작성자도 2차가 붕 뜨는 상태를
  의도적으로 만들었지만, `renderHook`의 반환값에서 `result`조차 구조분해하지 않아 `state.phase`를
  검증할 수 없다(오직 `getEs()`만 확인). 이 테스트가 끝난 시점 `state.phase`는 "streaming"으로 남아
  있을 가능성이 높다(미검증).

  이전(supersede 도입 전) 코드에서는 겹친 시도가 서로를 무효화하지 않았으므로 §106 위반(먼저 보낸 쪽이
  이길 수 있음)은 있었지만, "완료된 쪽은 항상 실제 연결을 동반"했다 — 이번 fix로 §106은 준수하게 됐지만
  그 대가로 이 좁은 창의 "선언과 실제가 어긋나는 과도 상태"가 새로 생겼다.

- 제안:
  - 최소: `fetchEmbedConfig`에 합리적 타임아웃(예: `AbortController` + 수 초)을 두어 "영원히 hang"
    가능성을 원천 차단.
  - 더 견고하게: 위 CRITICAL 항목과 동일한 메커니즘(ended/stale 여부를 ref로 공유)을 확장해, 복원 분기의
    `dispatch(RESTORED)` 이후 세대가 바뀌면 **다음 성공한 시도가 자신의 RESTORED로 다시 한번 확정
    dispatch 하는 것"에만 의존하지 않고, 최소한 이 케이스를 명시적으로 검증하는 회귀 테스트(신규
    테스트에 `result.current.state.phase` 단언 추가)를 넣어 "몇 초짜리 flicker"인지 "무기한 정지"인지
    구분되게 할 것.

---

### [INFO] `widget-state.ts` WAITING 케이스의 인라인 주석이 이번 diff로 사실과 어긋나게 됨(문서 drift)

- 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:155-160`
- 상세:
  ```ts
  // **가드 범위는 WAITING 뿐이다** — `RESTORED`/`BOOTED`/`USER_MESSAGE` 도 `state.phase` 를
  // 검사하지 않고 무조건 전이하므로, "ended 를 벗어나는 액션"의 리듀서 레벨 불변식은 아직 없다.
  ```
  이 diff가 `RESTORED`/`BOOTED`에 정확히 그 `state.phase` 검사를 추가했으므로(widget-state.ts:136, 142)
  위 문장은 이제 `RESTORED`/`BOOTED`에 대해 **거짓**이다(`USER_MESSAGE`에 대해서만 참으로 남음). 이
  파일은 과거 라운드의 판단 근거를 정확한 인라인 주석으로 보존하는 데 공을 들여왔고(예: A-6 자체가
  "실패 사례 없음 → 있음"으로 과거 결정을 뒤집으며 그 이력을 남김), 이 stale 주석은 향후 작업자가
  "RESTORED/BOOTED는 아직 무방비"라고 오판해 불필요한 재작업을 하거나, 반대로 실제 범위를 오해하게
  만들 수 있다.
- 제안: 이 주석 문단을 `USER_MESSAGE`만 남았다는 사실에 맞게 갱신(또는 RESTORED/BOOTED로의 확대가
  A-6에서 이뤄졌다는 상호 참조 추가).

---

### [INFO] 리뷰 payload의 "파일 5"(plan 삭제)는 실제 이 브랜치의 diff에 없음 — payload 생성 아티팩트로 추정, 실제 파일시스템 부작용 아님

- 위치: `prompt_file`의 "파일 5: plan/in-progress/harness-session-anchor-guards.md" 섹션(`deleted file mode 100644`로 표기)
- 상세: `git diff origin/main...HEAD --stat`(정확한 3-dot merge-base 비교)로 재확인한 결과, 이 브랜치가
  실제로 변경한 파일은 6개뿐이다(`widget-state.test.ts`, `widget-state.ts`, `use-widget-eager-start.test.ts`,
  `use-widget.ts`, `plan/in-progress/webchat-boot-single-flight.md`[신규], `spec/7-channel-web-chat/2-sdk.md`).
  `plan/in-progress/harness-session-anchor-guards.md`는 이 브랜치의 커밋 4개(`1e0de3e5b`~`215cd1c3f`) 중
  어디에서도 건드리지 않았고, 현재 워크트리에도(`ls`, `git show HEAD:...`) 그대로 존재하며, `origin/main`
  에도 동일하게 존재한다(해당 파일은 병합된 PR #965로 이 브랜치의 base 커밋 `14bc86a53`에 이미 포함돼
  있음). 즉 "삭제"는 실제로 일어나지 않았다 — review payload를 만든 diff 생성 과정(예: 잘못된 base
  ref, two-dot vs three-dot 혼용 등)의 아티팩트로 보인다.
- 제안: 코드 변경 자체에는 조치 불필요. orchestrator/payload 생성 파이프라인이 `git diff origin/main...HEAD`
  (3-dot) 기준으로 파일 목록을 만드는지 점검 권장(다른 리뷰에서도 같은 방식으로 무관한 파일이 섞여 들어가면
  side-effect 오탐/누락의 원인이 될 수 있음).

---

### [정보/확인] Area 2 — `establishConfig` 비-async 추출은 실제로 순수 추출이며 동작 무변경 주장이 확인됨

- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:809-825`(`establishConfig`), 호출부 846행.
- 확인 내용:
  - 기존에 `applyConfig` 내부에 인라인돼 있던 5개 문장(`configRef.current = cfg; setConfig(cfg);
    clientRef.current = new EiaClient(...); if (pendingResetRef.current) {...}`)이 순서 변경 없이
    그대로 `establishConfig`로 이동했고, 기존의 `return;`(외부 함수 전체 조기 종료)은
    `return "reset";` + 호출부의 `if (establishConfig(cfg) === "reset") return;`로 정확히 등가
    치환됐다.
  - `establishConfig`는 코드베이스 전체에서 **호출부가 단 하나**(위 846행)라 재사용으로 인한 새 결합
    위험이 없다.
  - `apiRef.current.newChat()` 호출은 `useRef`를 통한 참조라 클로저 staleness 문제 없음(기존과 동일).
  - `useCallback(..., [])`로 안정된 참조이며, 마운트 전용 `useEffect(() => {...}, [])`의 deps 배열에서
    제외돼도(기존 `isStale`/`beginBootAttempt`/`isAttemptStale`와 동일 컨벤션) 문제없음 — 참조가
    렌더 간 불변이므로 effect 재실행 여부에 영향 없음.
  - 새 `useCallback` 훅 호출이 컴포넌트 최상위에 하나 추가됐으나, 매 렌더 동일한 순서/개수로 호출되므로
    Rules of Hooks 위반 없음.
  - `establishConfig`가 "성공적으로 리셋을 이행"할 때 호출하는 `apiRef.current.newChat()`이 사용하는
    `configRef.current`/`cfg.profile`은 **이 attempt 시점의 값**으로 고정된다. 만약 pendingReset이
    이행되는 바로 그 순간과 "그 직후 도착하는 더 최신 wc:boot"이 극히 좁은 창에서 겹치면, 새로 시작되는
    대화가 최신이 아닌 config(profile)로 시작될 수 있는 아주 좁은 엣지 케이스가 이론상 존재한다(기존
    `pendingResetRef` JSDoc의 "triggerEndpointPath를 구분하지 않는다"는 caveat과 같은 성격의 한계). 이번
    diff가 새로 만든 문제는 아니며 영향도 낮아 INFO로만 남긴다.
  - 결론: 이 추출 자체는 부작용 관점에서 **문제 없음** — "순수 추출, 동작 무변경" 주장은 타당하다.

---

### [정보/확인] Area 1 특정 질문 — `pendingResetRef`의 "이월(carry-over) vs 소실(loss)" 구분은 코드·회귀 테스트로 뒷받침됨

- 위치: `use-widget.ts:176-179`(JSDoc), `establishConfig`(809-825), 회귀 테스트
  `use-widget-eager-start.test.ts:2359-2441`("겹친 부팅에서 나중 진입이 차단으로 먼저 끝나도…").
- 확인 내용: `beginBootAttempt`/`isAttemptStale`은 `pendingResetRef.current`를 전혀 건드리지 않는다 —
  superseded된 시도는 `establishConfig`에 도달하지 못해(1차 체크포인트에서 조기 반환) 플래그를
  그대로 남긴다. 플래그는 오직 `establishConfig`가 실제로 실행될 때(= 그 순간 superseded 상태가
  아님이 JS 단일 스레드 특성상 보장됨) 정확히 1회 소비된다. 실제로 위 회귀 테스트에서 1차·2차가 모두
  실패(stale/blocked)한 뒤 3차 boot을 보내면 그때 `hookPosts`가 1이 되는 것으로 "소실이 아니라 이월"이
  검증된다. 이 축에서는 **소실 경로를 찾지 못했다** — "폐기 로직을 다시 넣지 말 것"이라는 금지도
  건드리지 않았음을 확인. (단, 위 CRITICAL/WARNING은 이 축과는 별개로 "이행된 이후"의 부수효과 스코프
  문제이며, `pendingResetRef` 자체의 소실 문제는 아니다 — 혼동 방지를 위해 명시.)

## 요약

세 갈래(supersede, `establishConfig` 추출, 리듀서 `ended` 가드 확대) 중 `establishConfig` 추출(Area 2)은
순수 추출로 확인됐고, supersede의 `pendingResetRef` "이월" 의미도 코드·테스트로 뒷받침된다. 그러나 리듀서
`RESTORED` 가드(Area 3)는 **리듀서 디스패치만 막을 뿐, 그 디스패치를 감싸고 있는 `applyConfig` 복원
분기의 실제 네트워크/연결 부수효과(SSE 재오픈·토큰 갱신 예약·세션 ref 부활)는 전혀 막지 못한다** — "화면상
부활 방지"는 달성했지만 "실제 재연결 방지"는 달성하지 못했고, 이는 정확히 이 PR이 고치려던 버그의 반대편
구멍이다(플랜이 스스로 경고한 실패 이력과 동형). supersede(Area 1)에서도 대체된 시도가 `RESTORED`
디스패치까지 성공한 뒤 물러나면 "streaming인데 실제 연결 없음"이라는 유사한 성격의 과도 상태가 남을 수
있고, 이를 검증하려 만든 신규 테스트조차 `state.phase`를 확인하지 않아 이 간극을 놓쳤다. 두 발견 모두
"필요한 일을 빠뜨리는 경로"라는 요청에 정확히 부합하며, 기존 스위트로는 잡히지 않는다.

## 위험도

CRITICAL
