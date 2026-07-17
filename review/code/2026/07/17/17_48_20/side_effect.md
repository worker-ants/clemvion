# 부작용(Side Effect) 리뷰 — webchat-boot-single-flight

대상(prompt_file 기준 리뷰 스코프): `codebase/channel-web-chat/src/lib/widget-state.ts` ·
`widget-state.test.ts` · `codebase/channel-web-chat/src/widget/use-widget.ts` ·
`use-widget-eager-start.test.ts` · `spec/7-channel-web-chat/2-sdk.md`
(prompt_file 이 나열한 나머지 31개 파일은 이 브랜치의 실제 diff 가 아님 — 아래 INFO#1 참조)

검증 방법: 정적 추적에 더해, 셋 다 **`git worktree add --detach` 로 격리한 임시 워크트리**(작업 후
`git worktree remove` 로 제거, 공유 워크트리 무수정)에서 재현 테스트를 작성·실행해 확인했다. 아래
CRITICAL 2건은 가설이 아니라 **실측 재현 + 후속 커밋에서의 해소까지 재확인**한 결과다.

---

## 0. 리뷰 진행 중 브랜치가 실시간으로 갱신됨 (중요 — 아래 CRITICAL 판독에 필수 컨텍스트)

- **[INFO]** 이 리뷰 세션(`17_48_20`) 진행 도중 대상 브랜치에 새 커밋이 랜딩했고, 지금도 uncommitted 변경이 계속 발생하고 있다
  - 상세: prompt_file 은 커밋 `215cd1c3f`(`fix(web-chat): ERROR 로 종료된 대화가 wc:boot 재전송으로 부활하던 문제`) 기준으로 17:48:20 에 생성됐다. 리뷰 도중(대략 18:12:44) 같은 브랜치에 **`b1bef8633`**(`fix(web-chat): 리뷰가 찾은 CRITICAL 3건 — supersede 설계 결함 + 부작용 누출 + JSDoc 유실`)이 새로 랜딩했다 — 커밋 메시지 자체가 "ai-review 17_36_57/17_48_20(8인) 반영" 이라고 명시한다. 즉 **같은 워크트리를 대상으로 한 형제 리뷰 세션(`17_36_57`)의 reviewer 8인 + 그 resolution-applier 가 이 리뷰와 동시에 활동 중**이었고, 지금 이 순간도(`git status` 재확인 시) `use-widget.ts` 가 uncommitted 로 추가 수정되고 있다(maintainability 라운드 후속으로 보이는 `unmountedRef`/`cannotApplyConfig` 분리).
  - 이 사실이 왜 중요한가: 코드를 파일 경로로 `Read` 하면 **그 순간의 워킹트리 스냅샷**을 읽는다. 이 리뷰 도중 같은 섹션(`sendCommand` 의 ERROR 분기)을 서로 다른 시점에 두 번 읽었더니 **내용이 달랐다**(처음엔 `teardownSession()` 이 있었고, 격리 워크트리로 `215cd1c3f` 를 checkout 해 재확인하니 없었다) — 이는 파일이 아니라 **HEAD 자체가 리뷰 도중 이동**했기 때문이다(`git reflog` 로 확인). 아래 CRITICAL 2건은 이 문제를 인지한 뒤 **커밋 해시를 고정한 격리 워크트리**로 재검증한 결과이므로 시점 혼동이 없다.
  - 제안: (a) 이 세션의 SUMMARY 를 집계할 때 같은 시각대의 `17_36_57` 세션과 결과가 상당 부분 겹칠 수 있음을 감안해 중복 카운트하지 말 것. (b) 두 세션 모두 원래 대상(`215cd1c3f`)이 이미 지나간 상태이므로, **push/merge 전 `b1bef8633` 이후 HEAD 기준으로 한 라운드 재확인**을 권장(특히 지금도 진행 중인 `unmountedRef` 리팩터가 최종 반영본인지).

---

## 발견사항 — Q1: supersede(`bootGenRef`)의 "물러남"이 해야 할 일을 빠뜨리는가

- **[CRITICAL]** `isAttemptStale` 이 world·boot 두 축을 **OR** 로 묶어, 물러난(superseded) 시도가 일으키는 *정당한* world 무효화가 **아직 안 물러난 최신 시도까지 함께 stale 화**시켜 §106 을 깨뜨린다 — **실측 재현 완료**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `isAttemptStale`(`beginBootAttempt` 바로 아래), `applyConfig` 의 복원 분기(`seedWaitingFromStatus` 호출 지점과 그 직후 두 번째 staleness 재검증), `seedWaitingFromStatus` 내부 terminal 분기(`finalizeEnded` 호출), `teardownSession`(`worldGenRef.current++`).
  - 상세(메커니즘):
    1. 부팅 A(먼저 보낸 `wc:boot`)가 `isEmbedAllowed` 를 통과해 `establishConfig` 실행 후 저장 세션을 발견, 복원 분기로 진입한다. `sessionRef.current = saved` / `dispatch(RESTORED)` 는 **자신의 두 번째 재검증 이전에 무조건 실행**된다(justified — 이 구간엔 `await` 이 없어 다른 시도가 끼어들 수 없다).
    2. A 의 `seedWaitingFromStatus`(`getStatus`)가 in-flight 인 동안 부팅 B(재전송, §106 상 이겨야 할 "마지막 `wc:boot`")가 도착 — `beginBootAttempt()` 가 `bootGenRef` 를 올려 A 를 boot 축에서 정상적으로 superseded 시킨다.
    3. A 의 `getStatus` 가 뒤늦게 `status:"completed"`(**진짜 terminal**)로 resolve. `seedWaitingFromStatus` 내부의 `isStale(gen)`(world 축만 봄)은 아직 통과 → `finalizeEnded` → `teardownSession` → **`worldGenRef.current++`**. 세션이 실제로 끝난 게 맞으므로 이 무효화 자체는 정당하다.
    4. 그런데 B 가 이미 캡처해 둔 `attempt.world` 는 이 bump **이전** 값이다. B 가 나중에 `isAttemptStale(attemptB)` 를 검사하면 `worldGenRef.current !== attemptB.world` 가 참이 되어(boot 축은 여전히 자신이 최신인데도) **OR 결합 때문에** stale 판정을 받고 조용히 bail 한다.
    5. 결과: B 는 `establishConfig`(따라서 `configRef`/`useWidget().config`)를 **한 번도 실행하지 못한 채** 사라진다. `config` 는 A(먼저 보낸, 이겨선 안 될 값)에 **영구 고착**되고, 다음 `wc:boot` 이 오기 전까지 이를 되돌릴 이벤트가 없다.
  - **실측 재현**(격리 워크트리, 커밋 `215cd1c3f`): `bootWithPlan("A")` → embed-config 허용 → 복원 진입, `getStatus` in-flight 로 고정 → `bootWithPlan("B")` 전송(B 의 embed-config 는 의도적으로 미해결) → A 의 `getStatus` 를 `status:"completed"` 로 resolve → B 의 embed-config 도 허용으로 resolve → `expect(result.current.config?.profile?.plan).toBe("B")` 가 **`Received: "A"`로 재현 가능하게 실패**했다.
  - 이 시나리오는 plan 의 A-5 mutation 매트릭스("world 축 무력화")와는 다른 성격이다 — 매트릭스는 *가드를 손으로 제거했을 때* 잡히는지를 본 것이고, 이 결함은 **가드가 설계대로 정상 작동하는 중에** 두 개의 각자 정당한 이벤트(축 대체 A, world 무효화 B)가 **상호작용**해서 생긴다. 이 파일이 반복해 온 "비대칭 가드 누락" 계열과도 다른 새 하위 유형이다.
  - **해소 확인**: 리뷰 도중 랜딩한 후속 커밋 `b1bef8633` 가 정확히 이 결함(C1)을 고친다 — `seedWaitingFromStatus` 를 부팅 시도 인지형으로 바꿔 **대체된 시도의 seed 는 종료를 확정하지 않고 `"stale"` 을 반환**하도록 수정했다(저장 세션이 남아 있으므로 종료 자체는 유실되지 않고, 다음에 그 스냅샷을 보는 살아있는 시도가 확정한다 — 확정 주체만 바뀐다). **같은 재현 테스트를 `b1bef8633` 로 checkout 한 별도 격리 워크트리에서 재실행해 `config.profile.plan === "B"`(정상)로 통과함을 직접 확인했다.**
  - 제안: 코드 수정은 이미 반영됨(`b1bef8633`). 다만 지금도 이 로직이 `unmountedRef`/`cannotApplyConfig` 로 추가 리팩터링되는 중이므로(§0 참조), **최종본에 대해 이 정확한 회귀 시나리오(대체된 시도가 복원 중 terminal 을 발견 → 살아있는 최신 시도가 config 를 적용하는지)를 pin 하는 테스트가 남아있는지** 별도 확인 필요.

- **[WARNING]** supersede 로 물러난 시도가 이미 `dispatch(RESTORED)` 를 실행한 뒤 두 번째 체크포인트에서 물러나면, "phase 는 streaming 인데 실제 연결은 없는" 과도상태가 **남은 시도의 완주에만 의존**해 무기한 지속될 수 있다 — **215cd1c3f·b1bef8633 양쪽 모두에서 재현 확인(미해소)**
  - 위치: `use-widget.ts` `beginBootAttempt`/`isAttemptStale`(또는 `b1bef8633` 이후엔 `cannotApplyConfig`) · `applyConfig` 복원 분기의 `openStream`/`scheduleRefresh` 직전 체크 · `fetchEmbedConfig`(타임아웃 없는 `fetch`).
  - 상세: 겹친 두 `wc:boot`(#1,#2) 중 #1 이 `isEmbedAllowed` 통과 → `establishConfig` → 저장 세션 발견 → `dispatch(RESTORED)`(phase→`"streaming"`)까지 마친 뒤, `seedWaitingFromStatus` 대기 중 #2 가 도착해 `bootGenRef` 를 올린다. #1 의 `getStatus` 가 **비-terminal**(`"running"`)로 정상 응답하면 #1 은 두 번째 체크에서 물러나 `openStream`/`scheduleRefresh` 를 건너뛴다(§106 관점에서 이건 올바른 동작). 그러나 **`dispatch(RESTORED)` 는 이미 발사됐으므로** `state.phase` 는 `"streaming"` 으로 남고, 이를 교정하는 것은 오직 **#2 자신이 언젠가 어떤 dispatch 에 도달하는 것**뿐이다. `fetchEmbedConfig` 에는 `AbortController`/타임아웃이 전혀 없어(직접 확인: `use-widget.ts` 상단 `fetchEmbedConfig` 정의), #2 의 embed-config 요청이 느리거나 멈추면 "화면은 연결됨(streaming)을 암시하지만 실제 SSE 연결·토큰 갱신은 없는" 상태가 그만큼(극단적으로는 무기한) 지속된다.
  - **실측 재현**: `215cd1c3f`·`b1bef8633` 두 커밋 모두에서 동일 격리 테스트로 확인 — `#1` restore 후 `#2` 전송(embed-config 미해결 유지) → `#1` 의 `getStatus` 가 `"running"` 으로 resolve → 결과 `phase="streaming"`, `getEs()===null`(연결 없음). **두 커밋 모두 동일하게 재현되어**, `b1bef8633` 은 이 특정 케이스(비-terminal 상태에서 물러남)를 고치지 않았음을 확인했다 — 그 커밋이 고친 건 "물러난 시도가 **terminal** 을 만나 세계를 오염"시키는 케이스뿐이다.
  - 제안: 최소 조치로 `fetchEmbedConfig` 에 합리적 타임아웃(`AbortController` + 수 초)을 걸어 "무기한 hang" 가능성을 원천 차단. 더 견고하게는 두 번째 체크포인트 실패 시(`openStream` 을 안 열기로 결정한 시점) 그 자체를 명시적 신호로 삼아 — 예컨대 "이 시도는 phase 만 남기고 연결은 못 열었다" 를 로그/telemetry 로 남기거나, 회귀 테스트에 `result.current.state.phase` 단언을 추가해 "몇 초짜리 flicker" 인지 "무기한 정지" 인지 최소한 관측 가능하게 할 것.

## 발견사항 — Q2: `establishConfig` 비-async 추출은 순수 추출인가

- **[정보/확인]** 순수 추출 — 동작 무변경 확인
  - 위치: `use-widget.ts` `establishConfig` 정의부, 호출부(`applyConfig` 내 `if (establishConfig(cfg) === "reset") return;`).
  - 확인 내용:
    - 기존에 `applyConfig` 내부에 인라인돼 있던 5문장(`configRef.current = cfg; setConfig(cfg); clientRef.current = new EiaClient(...); if (pendingResetRef.current) {...}`)이 순서 변경 없이 그대로 이동했고, 기존 `return;`(외부 함수 조기 종료)은 `return "reset";` + 호출부의 `if (...) return;` 로 정확히 등가 치환됐다.
    - `establishConfig` 는 코드베이스 전체에서 **호출부가 단 하나**라 재사용으로 인한 새 결합 위험이 없다.
    - `useCallback(establishConfig, [])` 의 빈 deps 는 오직 ref/`setState` setter 만 참조하므로 stale closure 위험 없음(다른 `useCallback` 들과 동일 패턴).
    - **동시성 관점에서도 무해**: 일반(비-async) 함수 호출은 마이크로태스크 경계를 만들지 않으므로, 인라인이었을 때와 **정확히 동일한 인터리빙 특성**을 가진다. `establishConfig → (조건부) apiRef.current.newChat() → resetSessionRefs()/teardownSession() → dispatch(NEW_CHAT) → start() 의 첫 await 직전까지` 가 하나의 동기 run-to-completion 블록으로 유지됨을 추적 확인했다 — B 가 추가하기 전부터 있던 "config 확립 + 리셋 재생" 의 원자성이 이 추출로 깨지거나 넓어지지 않는다.
    - **강제력 자체도 실측 확인**: 이 함수 본문에 `await` 을 넣으면 `error TS1308` 로 컴파일이 막힌다 — "이 구간에 await 이 없다" 는 테스트로 고정할 수 없는 성질을 타입 검사가 대신 강제한다는 JSDoc 의 주장이 사실과 일치한다.
    - 결론: "순수 추출, 동작 무변경" 주장은 타당하다. 부작용 관점에서 조치 불필요.

## 발견사항 — Q3: 리듀서 `RESTORED`/`BOOTED` 의 `ended` 가드가 정당한 전이를 삼키는가

- **[정보/확인]** 리듀서 가드 자체는 정당한 전이를 삼키지 않는다 — 그러나 그 "방어"의 실효성은 인접한 부작용 누출에 의해 무력화돼 있었다(아래 CRITICAL 참조)
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` `case "RESTORED"`/`case "BOOTED"`.
  - 확인 내용: `NEW_CHAT`(→`"panel"`)·`START`(→`"booting"`) 등 `"ended"` 를 벗어나는 모든 액션이 `RESTORED`/`BOOTED` **이전에** 먼저 dispatch 되므로(리듀서는 액션을 도착 순서대로 순차 처리 — React 배치와 무관하게 순서 보장됨), 두 케이스가 `state.phase==="ended"` 를 관측하는 시점은 항상 "진짜로 끝난 대화 위에 도착한 낡은 이벤트" 뿐이다. `BOOTED` 는 `START` 직후에만 오므로 오늘 구조상 `"ended"` 에서 도달 불가(코드 주석과 일치, 직접 트레이스로 재확인). `RESTORED` 는 (아래 CRITICAL 이 보여주듯) 도달 **가능**하지만, 그 도달 자체가 "정당한 전이" 가 아니라 버그 시나리오이므로 가드가 막는 게 옳다. **정당한 전이를 오탐으로 막는 경로는 찾지 못했다.**
  - **그러나**: 이 가드는 **리듀서 디스패치만** 막는다. `dispatch()` 는 리듀서가 액션을 받아들였는지(vs `if (...) return state;` 로 무시했는지)를 호출부에 알려주지 않는다. `applyConfig` 의 복원 분기는 `dispatch(RESTORED)` 이후 `outcome`(`seedWaitingFromStatus` 반환값)과 `isAttemptStale(attempt)` **만** 보고 `seedWaitingFromStatus`(실제 GET)·`openStream`(실제 SSE 연결)·`scheduleRefresh`(실제 토큰 갱신 예약)를 계속 진행한다 — `state.phase` 나 리듀서가 그 dispatch 를 실제로 받아들였는지는 전혀 확인하지 않는다. 즉 화면(phase)은 지켜지지만, **그 아래 네트워크·SSE·타이머 부작용은 리듀서 가드로 전혀 보호되지 않는다.**

- **[CRITICAL]** 위 갭이 실제로 열려 있었다 — `sendCommand` 의 `ERROR` 경로가 `teardownSession` 을 거치지 않아 storage 가 남고, A-6(리듀서 가드)은 그 storage 를 소비하는 복원 분기의 부작용(신규 `getStatus` GET + 신규 `EventSource`)을 막지 못했다 — **실측 재현 완료**
  - 위치: `use-widget.ts` `sendCommand` 의 `catch` 절 `else` 분기(410 이 아닌 에러 처리) · `applyConfig` 복원 분기 전체 · `session-store.ts` `loadSession`/`clearSession`.
  - 상세: 커밋 `215cd1c3f` 시점의 `sendCommand` 는 `finalizeEnded`(410 Gone)와 달리, 일반 에러(예: 명령이 500 실패) 시 **`dispatch({type:"ERROR", ...})` 만 하고 `teardownSession()` 을 호출하지 않았다.** `ERROR` 리듀서 케이스는 `phase:"ended"` 로 보내지만 세션 정리(`clearSession`)는 별도로 일어나야 하는데, 이 경로는 그걸 하지 않는 **유일한 종료 경로**였다. 그 결과 `sessionStorage` 에 세션이 그대로 남는다. host 가 `wc:boot` 을 재전송하면(§106) `applyConfig` 의 `loadSession()` 이 그 잔존 세션을 **그대로 찾아** 복원 분기(`dispatch(RESTORED)` → `seedWaitingFromStatus` → `openStream`/`scheduleRefresh`)를 다시 태운다. A-6(리듀서의 `ended` 가드)은 그중 `dispatch(RESTORED)` 의 **화면 반영**만 막을 뿐, 그 앞뒤로 실행되는 `getStatus` 재조회와 `openStream`(신규 `EventSource`)·`scheduleRefresh`(신규 토큰 갱신 타이머)는 **막지 못한다.**
  - **실측 재현**(격리 워크트리, 커밋 `215cd1c3f`): 대기 표면 → 명령 전송 → 500 실패 → `ERROR`(`phase="ended"`) 직후 `sessionStorage` 를 직접 조회 → **세션 JSON 이 그대로 남아 있음**(null 아님) 확인. 이어서 `wc:boot` 재전송 → `getStatus` 호출 수가 **+1 증가**, `getEs()`(EventSource 인스턴스)가 **새 객체로 교체**됨을 확인 — 화면은 `"ended"` 로 정상 표시되지만, 죽은 execution 을 향한 SSE 연결이 은밀히 새로 열리고 토큰 갱신도 예약된다.
  - 이 발견은 특히 이 diff(A-6 계획 항목) 자신의 진행 기록이 "재현 확인" 이라며 **완전 해소를 시사하는 문구**를 남긴 것과 대비된다 — 실제로는 **증상(화면)만 닫혔고 원인(storage 잔존)은 그대로**였다. plan 이 스스로 경고한 "이 결함 클래스는 반대편 구멍을 내는 패턴" 이 여기서도 같은 모양으로 나타났다: 이번엔 폐기/이월 로직이 아니라 **가드의 보호 범위 과대평가**로.
  - **해소 확인**: 후속 커밋 `b1bef8633`(C2)이 `sendCommand` 의 비-410 에러 경로에 `teardownSession()` 호출을 추가해 근본 원인을 닫았다(`finalizeEnded` 를 쓰지 않은 이유도 명시: 그쪽은 `ENDED` 를 디스패치해 에러 메시지를 잃는다 — 정리만 공유, 전이는 `ERROR` 로 유지). **같은 재현 절차를 `b1bef8633` 로 checkout 한 별도 격리 워크트리에서 재실행해 storage 가 `null`, `getStatus` 호출 수 불변, `getEs()` 불변(재연결 없음)을 직접 확인했다.** 리듀서 가드는 최후 방어선으로 유지되고, 이제 두 방어선(즉시 storage 제거 + 리듀서 가드)이 각각 독립적으로 방어한다.
  - 제안: 코드 수정은 이미 반영됨(`b1bef8633`). 강화된 회귀 테스트(`getEs()`/`getStatus` 호출 수까지 단언)가 이 클래스의 재발을 막는 핵심이므로, 향후 이 파일을 건드릴 때 그 단언이 다시 "phase 만" 보는 얕은 형태로 퇴화하지 않았는지 확인할 가치가 있다.

- **[INFO]** (해소 확인) `widget-state.ts` `WAITING` 케이스의 "가드 범위는 WAITING 뿐" 주석이 이 diff 자신이 추가한 코드로 즉시 반증됐던 문제
  - 상세: 커밋 `215cd1c3f` 시점엔 `WAITING` 케이스 주석이 "가드 범위는 WAITING 뿐이다 — RESTORED/BOOTED/USER_MESSAGE 도 무조건 전이" 라고 서술했는데, 바로 이 diff 가 `RESTORED`/`BOOTED` 에 정확히 그 가드를 추가해 그 문장을 그 자리에서 거짓으로 만들었다. 후속 커밋 `b1bef8633` 에서 "가드 범위: WAITING·RESTORED·BOOTED 에 있다(USER_MESSAGE 는 여전히 없음)" 로 정정된 것을 현재 HEAD 에서 직접 확인했다. 조치 불필요(이미 해소).

## 발견사항 — 리뷰 payload 자체에 대한 관찰

- **[WARNING]** prompt_file 의 파일 목록(37개) 중 31개가 이 브랜치의 실제 diff 가 아니다 — payload 생성 아티팩트로 추정
  - 위치: prompt_file "파일 1~12, 20~21, 23~36" (`.claude/_shared/**` 신설·삭제, `review_guard.py`/두 orchestrator 의 report-path 공유화·롤백, `review/code/2026/07/17/15_48_02/**` 세션 산출물 전체 삭제, `plan/complete↔in-progress/harness-report-contract-followups.md` 왕복, `codebase/frontend/.../sidebar-*.tsx` 리팩터·롤백 등).
  - 상세: `git diff origin/main...HEAD --stat`(정확한 merge-base 3-dot 비교, merge-base=`14bc86a53`)로 재확인한 결과 이 브랜치가 실제로 바꾼 파일은 **6개뿐**이다 — `widget-state.test.ts`·`widget-state.ts`·`use-widget-eager-start.test.ts`·`use-widget.ts`·`plan/in-progress/webchat-boot-single-flight.md`(신규)·`spec/7-channel-web-chat/2-sdk.md`. `.claude/_shared/` 는 이 워크트리에 아예 존재하지 않고(`ls` 확인), `review/code/2026/07/17/15_48_02/` 도 존재하지 않는다 — 즉 prompt_file 이 보여주는 "삭제" 는 실제로 일어나지 않는다. 해당 작업(`.claude/_shared/report_paths.py` 신설 등)은 **완전히 별개의 형제 브랜치/워크트리**(`claude/report-paths-shared-0edbf0`, 별도 워크트리로 생존 확인)에 속한다. `code:` 매핑을 봐도 sidebar 파일들은 `.claude/tests/README.md`·`test_forced_coverage_selection.py` 등과 함께 그 브랜치의 산출물이지 이 브랜치와 무관하다.
  - 이는 실질적 파일시스템 부작용이 아니라 **리뷰 payload 를 만든 diff 계산 과정의 아티팩트**(잘못된 base ref 사용 등)로 추정된다 — 만약 문자 그대로 취급해 이 diff 를 "고쳐야 할 부작용" 으로 보고했다면 이미 완료·정리된 다른 작업을 조용히 되돌리라는 잘못된 지시가 됐을 것이다.
  - 제안: 코드 변경 자체에는 조치 불필요. orchestrator 의 리뷰 payload 생성 파이프라인이 diff 대상 base 를 어떻게 계산하는지 점검 권장 — `git diff origin/main...HEAD`(3-dot, merge-base 기준)를 안 쓰거나, 세션 준비 시점과 diff 계산 시점 사이에 다른 워크트리/커밋을 참조하면 이런 오염이 재발할 수 있다.

## 요약

세 갈래(supersede, `establishConfig` 추출, 리듀서 `ended` 가드 확대) 중 **`establishConfig` 추출(Q2)은
순수 추출로 확인**됐고, **리듀서 가드 자체(Q3)도 정당한 전이를 삼키지 않는다**. 그러나 나머지 두 축에서
"물러남/가드가 해야 할 일을 놓치는" 정확히 요청받은 유형의 결함을 **격리 워크트리에서의 실측 재현으로**
2건(CRITICAL) 확인했다: (1) `isAttemptStale` 의 world·boot **OR 결합**이 물러난 시도의 *정당한* 세계
무효화(복원 분기가 진짜 종료를 발견)를 통해 **아직 안 물러난 최신 시도까지 오염**시켜 §106 을 깨뜨리고
config 가 옛 값에 영구 고착되는 경로, (2) 리듀서의 `ended` 가드는 **화면(dispatch)만** 지킬 뿐 그 위
`applyConfig` 복원 분기의 **실제 네트워크·SSE·타이머 부작용**은 지키지 못하며, 그 실질 원인은 `sendCommand`
의 에러 경로가 storage 를 정리하지 않는 인접 gap 이었다. 두 CR: 세 번째 CRITICAL(WARNING 아님, 회귀
확대라는 REAL한 위협)까지 포함해 **모두 plan 이 스스로 경고한 "네 번 반대편 구멍" 패턴과 같은 계열**이다
— 이번엔 supersede·리듀서 가드라는 새 표면에서 재발했다.

가장 중요한 컨텍스트: 이 두 CRITICAL 은 **리뷰 대상으로 지정된 커밋(`215cd1c3f`)에 실재**하지만, 이 리뷰가
진행되는 동안 **형제 리뷰 세션(`17_36_57`, 동일 워크트리·거의 동일 시각)이 독립적으로 같은 결함들을
찾아냈고, 그 resolution-applier 가 낸 후속 커밋 `b1bef8633` 가 이미 브랜치에 랜딩해 둘 다 고쳤음을 별도
격리 워크트리 재현으로 직접 확인했다.** 다만 겹친 부팅에서 "phase=streaming 인데 실제 연결 없음" 이
남는 좁은 창(WARNING, `fetchEmbedConfig` 타임아웃 부재와 결합)은 `b1bef8633` 이후에도 재현되어 **아직
열려 있다.** 또한 이 워크트리는 지금 이 순간에도(다른 세션의 maintainability 후속으로 보이는) 추가
리팩터가 uncommitted 로 진행 중이므로, 이 보고의 "해소 확인" 은 `b1bef8633` 시점 기준이며 그 이후 변경은
별도 검증이 필요하다. 마지막으로 prompt_file 자체의 파일 목록에 무관한 형제 브랜치(harness
report-paths-shared) 변경 31건이 섞여 있었는데, 이는 실제 코드 부작용이 아니라 payload 생성 파이프라인의
아티팩트로 판단된다.

## 위험도

**CRITICAL** — 단, 리뷰 대상 커밋(`215cd1c3f`) 기준 평가다. 발견된 CRITICAL 2건은 같은 브랜치의 후속
커밋 `b1bef8633`(리뷰 도중 랜딩)에서 이미 수정됐음을 독립적으로 재현·확인했다. 남은 실질 리스크는 (a)
비-terminal 물러남 시의 "streaming 인데 연결 없음" WARNING(미해소, 낮은 도달 확률·자가 치유 가능하나
타임아웃 부재로 무기한 지속 가능성 있음), (b) 지금도 진행 중인 후속 리팩터가 최종적으로 안전한지의
재검증 필요성이다. **`b1bef8633` 이후 HEAD 를 대상으로 한 재검토(가능하면 이 세션·`17_36_57` 통합)를
push/merge 전 권장한다.**
