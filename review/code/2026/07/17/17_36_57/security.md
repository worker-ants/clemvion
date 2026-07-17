# 보안(Security) Review

## 발견사항

- **[WARNING]** `RESTORED`/`BOOTED` 의 `ended` 리듀서 가드는 **표시 상태만** 막고, `applyConfig` 복원 분기의 **실제 네트워크/세션 부작용은 막지 못한다** — 근본 원인(`ERROR` 가 `teardownSession`/`clearSession` 을 거치지 않음)이 이번 fix 로 닫히지 않았기 때문
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `applyConfig` 복원 분기(L847-871, 특히 `dispatch({type:"RESTORED",...})` 뒤에도 계속 실행되는 `seedWaitingFromStatus`/`openStream`/`scheduleRefresh` 호출) · `ERROR` 디스패치 두 지점(L575 `start()` catch, L599 `sendCommand()` catch — 둘 다 `teardownSession()`/`finalizeEnded()` 를 호출하지 않음) · `codebase/channel-web-chat/src/lib/widget-state.ts` L136(`RESTORED`), L142(`BOOTED`) 가드
  - 상세: `applyConfig` 는 `dispatch({ type: "RESTORED", executionId })` 를 호출한 **직후에도 코드 흐름을 멈추지 않는다**. `state.phase==="ended"` 일 때 리듀서가 그 dispatch 를 no-op 으로 만들어도(이번 PR 의 fix), `applyConfig` 자신은 `state`(React state, mount-once effect 안이라 stale) 가 아니라 `configRef`/`sessionRef`/`clientRef` 같은 **ref 와 storage 값**만 보고 계속 진행한다:
    1. `sessionStorage` 에 `ERROR` 가 지우지 않은 옛 세션(만료 전 토큰)이 남아 있으면 `loadSession()` 이 그걸 그대로 읽는다.
    2. `seedWaitingFromStatus(clientRef.current, saved)` 가 그 **옛(어쩌면 무효화됐어야 할) 토큰**으로 실제 `GET /api/external/executions/:id` 를 backend 에 보낸다. 서버측 execution 이 아직 terminal 이 아니면(클라이언트 관점 `ERROR` 가 서버 관점 종료를 의미하지 않는 경우 — 예: `submit_message` 가 일시적 500 을 받았지만 execution 자체는 여전히 `waiting_for_input`) `outcome` 은 `"continue"` 로 반환된다. soft-fail 분기(`catch`)조차 `"continue"` 를 반환하므로(L490-495, "종료로 오판하지 않는다") 요청이 실패해도 진행이 막히지 않는다.
    3. `outcome==="continue"` 고 `isAttemptStale(attempt)` 도 false(supersede 되지 않은 단일 부팅)면 **`openStream(saved, "0")` 이 실행돼 옛 토큰으로 새 SSE 연결을 연다.**
    4. **`scheduleRefresh()` 도 호출돼**, `useTokenRefresh`(`use-token-refresh.ts`)가 이 세션의 토큰을 백그라운드에서 자동 갱신하며 `saveSession()` 으로 **storage 의 만료시각을 계속 연장**한다(L95). `useTokenRefresh` 는 `worldGenRef` 만 보고 `state.phase`/`endedRef` 를 전혀 참조하지 않는다(`use-token-refresh.ts` L60-103) — 즉 UI 가 "종료됨"을 표시하는 동안에도 **그 세션의 토큰이 조용히 살아 있게 유지**된다.
    - `endedRef`(다른 모든 종료 경로가 `finalizeEnded()` 를 통해 세팅하는 "정말 끝났다" 신호, L333-343)도 `ERROR` 경로에서는 세팅되지 않고, `applyConfig` 는 애초에 `endedRef` 를 전혀 참조하지 않는다 — 따라서 restore 분기가 "이 세션은 이미 사용자가 종료 화면을 본 세션"이라는 사실을 판별할 방법이 현재 없다.
    - 결과적으로 이번 fix 는 **재현됐던 증상(화면이 streaming 으로 되돌아가는 것)은 정확히 막지만**, "종료됐다고 표시된 대화의 옛 토큰이 재부팅마다 backend 에 재조회되고, 심지어 자동 갱신으로 계속 연장될 수 있다"는 **더 눈에 덜 띄는 세션 위생 문제**는 남는다.
  - 제안: `ERROR` 액션을 디스패치하는 두 지점(`start()`/`sendCommand()`)도 다른 4개 종료 진입점과 동일하게 `finalizeEnded()`(또는 최소한 `teardownSession()`+`clearSession()`)를 경유시켜 storage 를 비우고 `worldGenRef` 를 올리는 것을 권장한다. `finalizeEnded` 는 `dispatch({type:"ENDED"})` 를 함께 호출하므로 `state.error` 메시지 보존이 필요하면 별도 헬퍼(`finalizeEndedWithError(message)` 류) 분리를 고려. 이렇게 하면 (a) storage 가 즉시 비워져 다음 `wc:boot` 의 `loadSession()` 이 애초에 `null` 을 반환해 restore 분기 전체가 스킵되고, (b) `applyConfig` 코드를 추가로 손대지 않아도 문제가 원천 차단된다(리듀서 가드는 이제 순수 defense-in-depth 로 남는다).

- **[WARNING]** `AI_MESSAGE`(및 `execution.message`) 리듀서 케이스에는 다른 종료-후 액션들(`WAITING`/`RESTORED`/`BOOTED`)과 달리 `ended` 가드가 없다 — 위 항목의 시나리오가 실제로 발현되면(재오픈된 스트림에 이벤트가 도착하면) 유령 메시지가 그대로 렌더된다
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` L170-176(`AI_MESSAGE`, 가드 없음) — L136/L142/L161(`RESTORED`/`BOOTED`/`WAITING`, 가드 있음)과 대비. `codebase/channel-web-chat/src/widget/components/panel.tsx` L133-134(`messages.map(...)` 가 `isEnded` 와 무관하게 항상 렌더)
  - 상세: 이 파일은 "리듀서는 모든 경로가 통과하는 단일 지점이므로 여기서 한 번 더 막는다(defense-in-depth)"는 원칙을 `WAITING`/`RESTORED`/`BOOTED` 세 곳에 명시적으로 적용했다(각각의 주석 참조). 그런데 위 항목에서 서술한 대로 재오픈된 스트림이 **`execution.waiting_for_input` 이 아니라 `execution.ai_message`/`execution.message` 를 먼저 받으면** — 예컨대 서버가 이미 다음 assistant 응답을 생성 중이었던 경우 — `handleEiaEvent` 는 그대로 `dispatch({ type: "AI_MESSAGE", ... })` 한다. 이 케이스는 `state.phase` 를 검사하지 않으므로 `phase==="ended"` 인 상태에서도 `state.messages` 에 append 되고, `panel.tsx` 는 `isEnded` 와 무관하게 `messages` 배열을 항상 렌더하므로(L133-134) **"대화 종료" 배너가 떠 있는 화면에 새 assistant 말풍선이 섞여 나타날 수 있다.** 같은 이벤트는 host 에도 `wc:event{name:"message"}` 로 그대로 전달된다(`use-widget.ts` L363).
  - 제안: 최소 조치로 `AI_MESSAGE`(및 `execution.message` → `AI_MESSAGE`) 케이스에도 `if (state.phase === "ended") return state;` 가드를 추가해 이 파일의 기존 defense-in-depth 원칙과 일관되게 맞추는 것을 권장한다. 다만 이건 **증상 완화**일 뿐 근본 수정은 첫 번째 항목(ERROR 경로의 `teardownSession` 부재)이다 — 스트림 자체를 재오픈하지 않으면 이 경로는 애초에 도달하지 않는다.

- **[INFO]** supersede(`bootGenRef`/`beginBootAttempt`/`isAttemptStale`)는 임베드 origin 검증(`isEmbedAllowed`)을 우회시키지 않는다 — 코드 추적으로 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L835-842
  - 상세: `applyConfig` 는 `isEmbedAllowed(...)` 를 **먼저 await 하고**, staleness 검사(`isAttemptStale`)가 그 **직후**, `!allowed` 분기보다 **먼저** 실행된다. 따라서 (a) superseded(stale) 시도는 `allowed` 값이 무엇이었든 `establishConfig`/`RESTORED`/`BOOTED` 그 어느 것에도 도달하지 못하고 즉시 return 한다 — "차단됐어야 할 config 가 적용되는" 경로는 코드 구조상 존재하지 않는다(staleness 체크가 항상 allow/block 판정보다 먼저 게이팅). (b) 반대로, 진짜 살아있는(non-stale) 마지막 시도가 `allowed===true` 로 판정되면 `applyConfig` 는 직전에 다른 시도가 남긴 `blocked`/`ended` 등 어떤 이전 phase 도 검사하지 않고 `RESTORED`/`establishConfig`(→ 필요 시 `NEW_CHAT`)로 무조건 진행한다 — "허용된 config 가 차단 상태로 영구히 남는" 경로도 없다. 두 겹침(mixed-order blocked/allowed) 시나리오 모두 `use-widget-eager-start.test.ts` L2275, L2359 에서 실측 회귀 테스트로 고정돼 있고, 코드 추적 결과와 일치한다. `isEmbedAllowed` 의 fail-open 성격 자체는 이 변경으로 더 위험해지지 않는다 — supersede 이전에는 **먼저 resolve 한 임의의 시도**가 결과를 정했지만, 이후에는 **마지막으로 보낸 시도**로 결정론이 생겨 오히려 예측 가능성이 개선된다(§106 준수의 부수 효과).

- **[INFO]** superseded 시도가 `BLOCKED` 를 디스패치하지 않는 설계는 안전하다 — "차단 상황이 조용히 넘어가는" 취약점이 아님
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L838-842 · `use-widget-eager-start.test.ts` L2359-2441(`"겹친 부팅에서 나중 진입이 차단으로 먼저 끝나도..."`)
  - 상세: BLOCKED 판정을 내리는 유일한 값(`allowed`)은 **그 시도 자신의** `isEmbedAllowed(cfg.apiBase, cfg.triggerEndpointPath)` 결과다. 어떤 시도가 대체(superseded)되어 BLOCKED 를 못 내더라도, 그 시도는 **config 를 적용하지도 못한다**(위 항목) — 즉 "차단 판정을 숨기는" 것이 아니라 "이 시도 자체가 무효화되어 판정할 자격이 없어지는" 것이다. 진짜 위험한 시나리오(마지막 시도가 실제로는 차단돼야 하는데 화면에 그게 반영 안 되는 것)는 마지막 시도가 자기 자신의 `allowed` 로 정확히 `BLOCKED` 를 디스패치하므로 발생하지 않는다(위 테스트가 `expect(result.current.state.phase).toBe("blocked")` 로 고정).

- **[INFO]** `wc:boot` 재전송의 origin 핀은 supersede 로직과 완전히 분리된 계층에 있어 약화되지 않는다
  - 위치: `codebase/channel-web-chat/src/widget/host-bridge.ts` L45-62(`onMessage`, 특히 L51-58) — 이번 diff 에서 **변경되지 않음**
  - 상세: origin 핀 검증(`e.origin !== hostOrigin` 이면 `bootCb` 자체를 호출하지 않고 drop)은 `host-bridge.ts` 의 동기 `postMessage` 핸들러에서 일어난다. `bootGenRef`/`beginBootAttempt`/`isAttemptStale` 은 전부 `use-widget.ts` 안에, `bridge.onBoot((c) => { void applyConfig(...) })` 콜백 **내부**에서만 동작한다 — 즉 origin 이 핀과 불일치하는 메시지는 `applyConfig`/`bootGenRef` 에 도달하기 전에 이미 걸러진다. 두 메커니즘이 서로 다른 축(메시지 신뢰 vs config 적용 순서)이라 supersede 도입이 origin 검증 경로에 어떤 코드 경로도 추가/변경하지 않았다(diff 대상 파일 목록에 `host-bridge.ts` 자체가 없음 — 실제로 미변경 확인). 단, "첫 `wc:boot` 를 보낸 origin 이 곧 핀 대상이 되며, 그 시점엔 아직 embed allowlist 검증이 끝나지 않은 상태"라는 기존(이번 diff 무관) 설계는 유지된다 — 이는 spec 4-security §3-① 이 명시한 soft-check 의 의도된 동작이라 별도 결함으로 보지 않는다.

- **[INFO]** 하드코딩된 시크릿·인젝션·평문전송·의존성 취약점 없음
  - 상세: 이번 diff 는 클라이언트 상태기계(reducer)·React 훅·테스트·plan 문서 변경으로 한정된다. 테스트의 `"iext_old"`/`"iext_fresh"` 등은 명백한 목(mock) 토큰 리터럴이며 실제 시크릿이 아니다. SQL/커맨드/경로 조작 입력 처리 코드는 diff 범위에 없다. `errMessage()`(`use-widget.ts` L952-956, 미변경)는 서버 예외 원문을 `console.warn` 에만 남기고 UI/host 에는 항상 generic 문구만 노출해 4-security §5 를 유지한다.

## 요약

이번 변경(`bootGenRef` supersede + `establishConfig` 동기 구간 추출 + `RESTORED`/`BOOTED` ended 가드 확대)은 요청받은 4가지 관점 중 3가지(embed origin 검증 우회, BLOCKED 미디스패치, origin 핀 약화)에서는 코드 추적과 기존 회귀 테스트로 안전성이 확인된다 — supersede 는 오히려 §106 순서 결정성을 높여 fail-open 창을 더 예측 가능하게 만든다. 다만 4번째 관점(`ended` 가드 확대)은 **부분적 fix** 다: 리듀서 가드는 재현됐던 "화면이 되살아나는" 증상을 정확히 막지만, `ERROR` 가 여전히 `teardownSession`/`clearSession` 을 거치지 않는다는 근본 원인은 남아 있어 `applyConfig` 복원 분기의 네트워크 재조회·SSE 재오픈·토큰 자동갱신 같은 **부작용은 리듀서 가드와 무관하게 계속 실행**된다. `AI_MESSAGE` 케이스가 다른 종료-후 액션들과 달리 `ended` 가드를 갖지 않는다는 점까지 겹치면, 좁은 조건(클라이언트 인지 ERROR 발생 + 서버측 execution 이 실제로는 non-terminal + 이후 `wc:boot` 재전송)에서 유령 assistant 메시지가 실제로 렌더될 수 있는 이론적 경로가 존재한다. 이 경로는 동일 사용자·동일 토큰 범위 내의 문제이고(교차 사용자/테넌트 데이터 노출 아님) 오늘 시점 재전송 경로가 관리자 라이브 미리보기로 한정돼 공격 표면은 좁지만, 이 코드베이스가 반복적으로 겪은 "유령 부활" 버그 계열과 정확히 같은 클래스이므로 방치하지 않는 것을 권장한다.

## 위험도

MEDIUM
