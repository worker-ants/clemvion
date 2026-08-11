# 보안(Security) Review

대상: `CHANGELOG.md`, `codebase/channel-web-chat/src/lib/session-store.ts`,
`codebase/channel-web-chat/src/widget/use-token-refresh.ts`,
`codebase/channel-web-chat/src/widget/use-widget.ts`,
`codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`,
`plan/in-progress/webchat-auth-session-status-reconcile.md`,
`spec/7-channel-web-chat/3-auth-session.md`, 그리고 이전 라운드(`16_09_40`/`16_26_09`/`16_42_07`) 리뷰 산출물.

지시받은 핵심 확인 항목 — "직전 라운드에 security 가 INFO 로 낸 '비-terminal refresh 실패 뒤 만료
토큰 재연결'이 side_effect 에서 CRITICAL 로 재판정되고, 반환값을 `"continue"` → `"stale"` 로 고쳐
닫았다"는 서술을 액면가로 받지 않고 실제 소스·테스트 실행으로 직접 확인했다.

## 1. 원래 CRITICAL 재검증 — 닫힘 확인

**결론: 닫혔다.** `codebase/channel-web-chat/src/widget/use-widget.ts` 의
`recoverFromExpiredToken`(390-449행)을 직접 읽었다.

- non-terminal(네트워크 오류 등, `401`/`410` 이 아닌 실패) 분기는 이제 `"continue"` 가 아니라
  `"stale"` 을 반환한다(435행). 주석(426-434행)이 그 근거를 명시한다 — "`"continue"` 를 돌려주면
  안 된다, 여기서는 토큰이 여전히 죽어 있다".
- 호출부 두 곳(`start()` 683행, `applyConfig()` 1035행) 모두 `if (outcome !== "continue") return;`
  로 게이팅해 `openStream(live, "0")`(698행/1050행)에 도달하지 않는다 — 서버가 이미 거부한 토큰으로
  SSE 를 여는 경로는 실제로 차단된다.
- `applyRefreshedToken` 은 이 non-terminal 분기에서 호출되지 않으므로 `sessionRef.current`/storage 는
  옛(만료) 토큰을 그대로 유지한다(세션 삭제 없음) — "세션은 보존" 이라는 RESOLUTION 서술과 실제
  동작이 일치한다.
- 회귀 테스트 `"§R4: refresh 가 네트워크 오류로 실패하면 종료로 확정하지 않는다"`
  (`use-widget-eager-start.test.ts:448-485`)를 포함해 `npx vitest run src/widget/use-widget-eager-start.test.ts`
  를 직접 실행 — **70 passed**.

## 발견사항

- **[CRITICAL]** `"stale"` 로 막은 그 자리에서, 위젯이 이 PR 이 고치려던 것과 **같은 증상**(SSE 없이
  `streaming` 스피너에 무기한 고착, 입력 비활성)을 **에러 메시지도 없이** 재현한다 — 원인은 `openStream`
  뿐 아니라 `scheduleRefresh()` 도 같은 `if (outcome !== "continue") return;` 뒤에 있어 함께
  건너뛰기 때문이다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1017-1035`(`applyConfig()` — `saved`
    세션 로드 → `dispatch({ type: "RESTORED", ... })`(1023) → `seedWaitingFromStatus` 호출(1032) →
    `outcome !== "continue"` 면 조기 `return`(1035)), `:1050-1051`(정상 경로에서만 실행되는
    `openStream`/`scheduleRefresh`). 같은 패턴이 `start()` 에도 있음: `:665`(`dispatch({ type: "BOOTED", ... })`)
    → `:682-683`(seed·조기 return) → `:698-699`(정상 경로 openStream/scheduleRefresh). `recoverFromExpiredToken`
    의 "stale" 반환 자체는 `:412-436`(특히 `:433-434` 주석 "다음 복구는 `use-token-refresh` 의 주기
    갱신이 맡는다"). `scheduleRefresh` 정의는 `codebase/channel-web-chat/src/widget/use-token-refresh.ts:73-105`
    — 이 훅은 **자체적으로 마운트 시 타이머를 시작하지 않는다**, `scheduleRefresh()` 를 외부에서 명시
    호출해야만 타이머가 생긴다(파일 전체를 읽어 확인 — `useEffect` 는 `clearRefreshTimer` 만 등록).
    UI 반영: `codebase/channel-web-chat/src/lib/widget-state.ts:125-146`(`RESTORED`/`BOOTED` 모두
    `phase: "streaming"` 즉시 설정), `codebase/channel-web-chat/src/widget/components/panel.tsx:191-192`
    (`Composer` 는 `phase === "streaming"` 이면 `loading=true`·`disabled=true` — "AI 응답 중" 스피너를
    보여주고 자유 텍스트 입력을 막는다).
  - 상세: 재로드(applyConfig) 흐름을 순서대로 추적하면 —
    1. `saved` 세션이 storage 에서 로드되자마자(REST 검증 **이전**) `dispatch({ type: "RESTORED", ... })`
       가 실행돼 `phase` 가 즉시 `"streaming"` 이 된다(1021-1023행). 이 시점에 UI 는 이미 "정상 복원됨"
       처럼 보인다.
    2. 이어서 `seedWaitingFromStatus` 가 `getStatus` 를 호출하고, 저장된 토큰이 만료돼 `401` 을 받으면
       §R4 낙관적 refresh(`recoverFromExpiredToken`)를 1회 시도한다.
    3. 그 refresh 요청 자체가 (401/410 이 아닌) **일시적 네트워크 오류**로 실패하면, 이번 라운드의
       수정으로 `"stale"` 이 반환된다(위 §1).
    4. `applyConfig()`/`start()` 는 `outcome !== "continue"` 를 보고 **그대로 `return`** 한다. 이
       `return` 은 `openStream` 뿐 아니라 바로 다음 줄의 `scheduleRefresh()` 도 건너뛴다 — 즉 이
       특정 세션에 대해 **어떤 주기 갱신 타이머도 예약되지 않는다**.
    5. `useTokenRefresh` 훅은 스스로 타이머를 시작하지 않으므로(마운트 훅에는 `clearRefreshTimer`
       cleanup 만 등록돼 있다), `scheduleRefresh()` 가 최소 한 번 호출된 적이 없는 이 세션에는
       **이후에도 영원히** refresh 재시도가 일어나지 않는다.
    6. 결과: `phase` 는 `"streaming"` 에 멈춘 채, SSE 연결도 없고 예약된 refresh 타이머도 없다.
       `Composer` 는 `loading=true`·`disabled=true` 를 계속 그린다 — 사용자는 응답을 기다리는
       스피너만 보고, 입력은 막혀 있으며, `state.error` 는 설정되지 않아 에러 배너조차 뜨지 않는다
       (`seedWaitingFromStatus`/`recoverFromExpiredToken` 은 이 경로에서 예외를 던지지 않고 정상적으로
       `"stale"` 을 반환하므로, `start()`/`applyConfig()` 바깥의 `catch`(예: `use-widget.ts:701-707`)
       도 발동하지 않는다). 사용자가 할 수 있는 유일한 복구는 페이지 새로고침뿐이다.
  - 왜 CRITICAL 인가: 이 저장소의 `CHANGELOG.md:197`(다른 항목이지만 같은 파일이 자인)이 정확히 이
    증상을 "종전에는 위젯이 `streaming`(AI 응답 중 스피너)에 무기한 멈췄다 ... 사용자 액션이 없는
    구간이라 사후 복구도 닿지 않았다" 로 서술하며, 그 CHANGELOG 신규 항목(`166-174행`) 자체가 "재로드
    401 REST 분기를 구현해 이 부류의 고착을 없앤다" 는 것이 이 PR 전체의 존재 이유다. 그런데 이번
    라운드가 원 CRITICAL(옛 토큰으로 SSE 재오픈)을 막기 위해 선택한 반환값(`"stale"`)이, **같은 호출부
    가드(`outcome !== "continue"` → `return`)를 SSE 오픈뿐 아니라 refresh 재예약까지 함께 건너뛰게
    만들어**, 정확히 같은 증상 클래스("무기한 streaming 고착, 사후 복구 없음")를 **새로운 트리거**(reload
    시 401 → refresh 자체가 네트워크 오류로 실패)로 재현한다. 코드 자신의 주석(`:433-434`)이 "다음
    복구는 `use-token-refresh` 의 주기 갱신이 맡는다" 고 명시적으로 주장하는데, 실제 호출 그래프상
    이 주장은 **거짓**이다 — `scheduleRefresh` 는 오직 `openStream` 직후에만 호출되고, 이 경로는
    `openStream` 에 도달하기 전에 return 하기 때문이다. "일시적 장애로 살아있는 대화를 죽이지 않는다"
    (요구사항 §R4 준수, 3라운드 연속 requirement 가 검증)는 목표는 지켜졌지만, 그 대가로 "일시적
    장애를 자동으로 넘기지도 못하는" 상태가 생겼다 — 재로드 401 시나리오는 §3.1-2/§R4 가 문서화한
    **핵심 시나리오**이므로 방어 코드가 아니라 실사용 경로다.
  - 재현 확인(테스트로 검증되지 않음): `use-widget-eager-start.test.ts:448-485`(`"§R4: refresh 가
    네트워크 오류로 실패하면 종료로 확정하지 않는다"`)와 `:487-521`(`500` 상태 필터 축)은 둘 다
    `expect(result.current.state.phase).not.toBe("ended")` 와 `expect(getEs()).toBeNull()` 만
    단언한다(482-484행, 518-520행). `phase` 가 실제로 무엇인지(`"streaming"` 인지), `scheduleRefresh`
    가 호출됐는지는 어느 테스트도 확인하지 않는다 — `not.toBe("ended")` 는 `"streaming"` 에서도
    참이므로 이 갭을 통과시킨다. 직접 `npx vitest run` 으로 70개 전부 통과함을 재확인했고(위 §1),
    이 갭 자체가 원인이라는 것도 코드 추적으로 실측했다.
  - 제안: 다음 중 하나 이상 검토.
    1. `outcome === "stale"`(non-terminal refresh 실패로 인한 경우에 한해)이면 호출부가
       `scheduleRefresh()` 는 호출하도록 분기 — `sessionRef.current` 는 이 시점에도 여전히
       (만료됐지만) 존재하므로, `scheduleRefresh` 가 `TOKEN_REFRESH_MIN_DELAY_MS`(5초) 뒤 즉시
       재시도를 예약해 실제로 "다음 복구는 주기 갱신이 맡는다" 는 주석의 약속을 지키게 한다. 다만
       현재 `SeedOutcome` 은 "stale" 이 world-교체로 인한 것인지 non-terminal refresh 실패로 인한
       것인지 구분하지 않으므로(§R4 세계-교체 stale 은 재시도가 부적절할 수 있음), 반환 타입을
       세분화하거나 별도 플래그가 필요할 수 있다.
    2. 또는 `dispatch({ type: "RESTORED"/"BOOTED", ... })`(phase→`"streaming"`)를 REST 검증 성공
       확인 이후로 미루거나, non-terminal 실패 시 명시적인 "재시도 중"/에러 배너 phase 로 전이시켜
       "응답 대기 중" 스피너가 무기한 고착돼 보이지 않게 한다.
    3. 위 두 시나리오(§R4 401→refresh 네트워크 실패, 그리고 이미 plan 에 등재된 `start()` 401 갭)를
       `plan/in-progress/webchat-auth-session-status-reconcile.md` 에 명시적으로 추가하고, 회귀
       테스트를 `phase`/`scheduleRefresh` 호출 여부까지 단언하도록 보강.

- **[INFO]** (확인용) `applyRefreshedToken` 공유 헬퍼·SSE 토큰 URL 쿼리 전달·에러 reason 문자열은
  이전 라운드(`16_26_09`/`16_42_07`) security 검증과 달라진 바 없음 — 재확인만 했고 새 결함 없음
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:110-133`, `codebase/channel-web-chat/src/widget/use-widget.ts:344-363`(`openStream`), `:502`/`:538-541`(reason 문자열).
  - 상세: `applyRefreshedToken` 은 여전히 `{token, expiresAt}` 만 좁게 교체하는 순수 함수이고
    `apiBase`/`endpoints`/`executionId` 는 보존한다. `console.warn` 로그(`refreshErr.message`)에도
    토큰·서버 원문이 섞이지 않는다(`EiaError.message` 는 상태 코드만 포함, `eia-client.ts` 확인).
  - 제안: 없음(확인용).

## 요약

지시받은 핵심 확인 — "`"continue"` → `"stale"` 수정이 실제로 원 CRITICAL(만료 토큰으로 SSE 재오픈)을
닫았는가" — 는 **그렇다**로 확인했다: 소스 직독·호출 그래프 추적·회귀 테스트 실행(70 passed) 모두
일치한다. 그러나 그 수정 자체가 **새로운 부작용**을 만들었다 — `outcome !== "continue"` 조기 return 이
`openStream` 뿐 아니라 `scheduleRefresh()` 도 함께 건너뛰기 때문에, "reload 401 → refresh 자체가
non-terminal 오류로 실패" 시나리오에서 위젯은 (a) REST 검증 이전에 이미 `phase: "streaming"` 으로
전이돼 있고, (b) SSE 도 안 열리고, (c) 어떤 주기 갱신 타이머도 예약되지 않으며, (d) 예외를 던지지
않아 에러 배너도 뜨지 않는다 — 사용자는 응답 대기 스피너만 보며 입력이 막힌 채 영구히 고착되고,
새로고침 외에는 복구 수단이 없다. 이는 이 PR 의 CHANGELOG(`166-174행`, `197행`)가 명시적으로 "없앴다"고
주장하는 바로 그 증상 클래스("streaming 무기한 고착, 사후 복구 불가")를 새 트리거로 재현하는 것이라
CRITICAL 로 판정한다. 코드 자신의 주석("다음 복구는 `use-token-refresh` 의 주기 갱신이 맡는다",
`:433-434`)은 실제 호출 그래프와 어긋나는 거짓 주장이다. 신규 회귀 테스트 2건은 `phase !== "ended"`
만 확인해 이 갭을 통과시킨다. 그 외 이번 라운드 델타(공유 헬퍼·에러 로그·SSE 토큰 전달)에서는 새로운
인젝션·시크릿 노출·인증 우회·암호화 결함이 발견되지 않았다.

## 위험도

CRITICAL
