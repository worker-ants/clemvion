# 보안(Security) 리뷰 — webchat-boot-single-flight (23_58_23)

리뷰 대상: `git merge-base origin/main HEAD`(=`29aa918a6`)`..HEAD` — 코드 5파일(`CHANGELOG.md`,
`widget-state.ts`, `widget-state.test.ts`, `use-widget.ts`, `use-widget-eager-start.test.ts`) +
plan 2파일 + spec 1파일(`2-sdk.md` frontmatter만) + 이전(18_39_11) 라운드 리뷰 산출물(코드 아님).
`git diff --stat`으로 파일 목록 일치 확인 — 페이로드 오염 없음.

이번 라운드 핵심(orchestrator 지정)은 신규 코드가 아니라 **A-6 되돌림**(비-410 명령 실패 시
`teardownSession()` 미호출로 회귀) 이후의 잔여 위험 4축이다. 각 축을 코드 정독 + spec 대조 +
**격리 worktree 실측**(unit 2파일 재실행 + ad-hoc 회귀 테스트 1건 신규 작성·mutation kill 확인,
검증 후 worktree 제거)으로 검증했다. **CRITICAL·신규 WARNING 없음.**

---

## 발견사항

- **[INFO] (핵심 질문 1·2) 비-410 명령 실패 후 sessionStorage 토큰 잔존은 신규 위험이 아니다 — spec 이 요구하는 동작이며 노출 창이 넓어지지 않는다**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:652-697`(`sendCommand`, 특히
    671-693 비-410 분기), `codebase/channel-web-chat/src/lib/session-store.ts:45-65`(`loadSession`
    — `expiresAt` 자동 만료 폐기), `spec/7-channel-web-chat/3-auth-session.md:78-79`(§3.1-3 정리
    조건 열거), `:92-96`(§R6 — sessionStorage 채택 근거).
  - 상세: `sendCommand`의 비-410 catch 분기는 이제 `dispatch({type:"ERROR",...})`만 하고
    `sessionRef.current`/`sessionStorage`/SSE 스트림/토큰 갱신 타이머 어느 것도 건드리지 않는다.
    `merge-base(29aa918a6)`의 원본(브랜치 시작 이전, A-6 도입 이전) 코드와 **바이트 단위로
    동일**함을 `git show 29aa918a6:...` 로 직접 대조 확인했다 — 즉 이번 되돌림은 "새 동작"이
    아니라 **전 저장소 기준선으로의 복귀**다. 남는 토큰의 실질 위험을 4가지 기존 경계로 평가:
    (1) **scope** — per_execution 토큰(§R3)은 애초에 1 execution 으로 범위가 고정돼 있어, 더
    오래 보관돼도 접근 가능한 대상이 늘지 않는다(다른 세션/사용자 데이터에 닿지 않음).
    (2) **TTL** — `loadSession`이 `expiresAt` 경과 토큰을 로드 시점에 자동 `clearSession`하므로
    (L56-60), 무기한 유효한 토큰이 아니다. (3) **탭 종료 defense-in-depth**(§R6) — sessionStorage
    특성상 탭을 닫으면 자동 소거, 이 축은 이번 diff 와 무관하게 항상 동일. (4) **서버측 backstop**
    (§R6 말미) — `WebChatIdleReaperService`가 방치된 `waiting_for_input` execution 을 grace 후
    회수해 토큰을 무효화한다. 네 경계 모두 이번 diff 이전부터 있던 기존 방어선이고, A-6 되돌림은
    이 경계들이 원래 커버하도록 설계된 "실행 중인 execution 의 토큰이 sessionStorage 에 머문다"는
    상태로 **되돌아갔을 뿐**이다 — 새 노출면이 아니다.
  - 제안: 없음(확인 목적). 다만 아래 항목(연결된 "ended UI + 살아있는 세션" straddle 상태)은
    참고할 것.

- **[INFO] (핵심 질문 2 연장) "ended" UI 표면과 살아있는 세션의 straddle 구간 — 보안 영향 없음, 이미 별도 트랙으로 분리된 제품 결정**
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:190-191`(`ERROR` → `phase:"ended"`),
    `:45-47`(`isActiveConversationPhase` — `streaming`/`awaiting_user_message` 에서만 true),
    `plan/in-progress/webchat-command-failure-is-not-termination.md`(신규 분리 plan).
  - 상세: 비-410 실패 후 `phase`는 `ended`로 전이하지만 세션·SSE·토큰 갱신 타이머는 살아있다.
    `isActiveConversationPhase`가 `ended`에서 `false`를 반환하므로 헤더의 "대화 종료" 컨트롤이
    노출되지 않아, 사용자가 그 세션을 **명시적으로**(= 서버측 즉시 jti blacklist를 유발하는
    `cancel`/`end_conversation` 명령으로) 종료할 UI 경로가 이 straddle 구간 동안 없다. 토큰의
    실제 소멸은 위 4경계(TTL/탭종료/idle-reaper/재로드 시 서버 판정)에 맡겨진다. 이는 **가용성/UX
    갭**(`1-widget-app.md §2` Form "실패 시 재제출" 약속과 어긋남)이지 보안 갭이 아니다 — 토큰의
    노출 범위·수명이 위 항목에서 확인한 기존 경계를 넘지 않기 때문이다. 이미
    `plan/in-progress/webchat-command-failure-is-not-termination.md`로 분리돼 `project-planner`
    결정(A/B/C 옵션)을 기다리는 중이며, 이번 diff 가 만든 gap 이 아니라 "이 PR 이전부터의 gap"으로
    RESOLUTION.md·SUMMARY.md 에도 명시돼 있다. 보안 리뷰로서는 이 straddle 이 **토큰을 더
    노출시키지도, 재사용 가능하게 만들지도 않음**을 확인하는 선에서 충분하다고 판단한다.
  - 제안: 없음(제품 트랙에서 처리 중). 향후 그 결정(A/B/C)이 나면 이 straddle 자체가 사라지므로
    본 항목도 자연 소멸한다.

- **[INFO] (핵심 질문 2 연장) §3.1-3 정리 조건 열거와 실제 코드가 정합 — "복원 후 서버 판정" 흐름에서 토큰 재사용/노출 위험 없음**
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:64-79`(§3.1 전체), `use-widget.ts:511-572`
    (`seedWaitingFromStatus` — terminal 분기 534-537, waiting 분기 538-554, catch 556-569).
  - 상세: §3.1-3 이 열거한 4개 정리 트리거(SSE terminal·200+terminal·404·복구불가 401·명령 410)
    중 코드가 실제로 분기 처리하는 건 SSE terminal(`TERMINAL_EVENTS`, `handleEiaEvent`)과
    200+terminal(`seedWaitingFromStatus` 534-537)뿐이다. **404·복구불가 401 REST 분기는 spec
    자신이 "여전히 미구현(Planned)"이라 명시**한다(§3.1 도입부 62행) — 코드도 이와 정합: `catch`
    블록(556-569)이 모든 HTTP 오류(404 포함)를 구분 없이 soft-fail 처리해 storage 를 지우지
    않는다. 이는 spec 이 이미 투명하게 밝힌 기존 미구현 항목이고, 이번 diff 가 그 catch 블록
    로직 자체는 변경하지 않았다(diff 는 `attempt`/`cannotApplyConfig` 검사만 waiting 분기에
    추가). 이 gap 의 실질 위험도 위 항목과 같은 이유로 낮다 — 404(execution 실제 소멸)를 만나도
    그 토큰은 서버에서 이미 죽어 있어(§R6 jti blacklist) 재사용 자체가 불가능하고, 남는 건
    "죽은 토큰이 sessionStorage 에 정리되지 않고 남는" 위생 문제뿐이다. 복원 흐름 자체(로드 →
    `getStatus` → 상태별 분기)는 서버 진실을 매번 재확인하므로, 클라이언트가 "복원됐다"고
    믿는 것과 서버가 실제로 살려두는 것 사이에 재사용 가능한 간극이 없다.
  - 제안: 없음(spec 이 인지한 기존 gap, 이번 diff 범위 밖). 이 미구현 항목이 별도로 정리된다면
    `seedWaitingFromStatus`의 catch 블록에 상태 코드별 분기(404/401)를 추가하는 것이 자연스러운
    위치라는 점만 참고로 남긴다.

- **[INFO] (핵심 질문 3) `unmountedRef` 축 — 리소스 누수(언마운트된 컴포넌트의 신규 execution 시작) 방지가 온전함을 실측 확인**
  - 위치: `use-widget.ts:184`(`unmountedRef` 선언), `:287-290`(`cannotApplyConfig` —
    `unmountedRef.current || bootGenRef.current !== attempt.boot`), `:928`(마운트 시
    `unmountedRef.current = false` 재무장), `:938`(checkpoint 1 — `establishConfig` 호출 **전**
    게이팅), `:902-918`(`establishConfig` — `newChat()`을 트리거할 수 있는 유일한 동기 지점),
    `:1035-1040`(언마운트 cleanup — `unmountedRef.current = true` → `worldGenRef++` →
    `bridge.destroy()`), `host-bridge.ts:84-88`(`destroy()` — `removeEventListener` 동기 호출로
    이후 `wc:boot`/`wc:command` 수신 자체를 차단).
  - 상세: 정적 분석 — 언마운트된 컴포넌트가 새 서버측 execution을 시작할 수 있는 유일한 동기적
    관문은 `establishConfig()`(→ `pendingResetRef` 소비 시 `newChat()` → `start()` → webhook
    POST)이며, 이 함수는 checkpoint 1(`cannotApplyConfig`, `unmountedRef` 포함)을 통과해야만
    호출된다. checkpoint 1과 `establishConfig()` 호출 사이에 `await`이 없어(동기 구간, JSDoc
    "async 를 붙이지 말 것" 계약) 그 사이 언마운트가 끼어들 수도 없다. 언마운트 후 재차 `open()`/
    `resetSession` 명령이 들어올 경로(`bridge.onCommand`)는 `bridge.destroy()`가 리스너를
    동기 제거해 원천 차단된다. **격리 worktree 실측**: (1) 기존 회귀 테스트
    `webhook POST in-flight 중 언마운트 → 지연 응답이 storage·SSE 를 되살리지 않는다`,
    `embed-config 왕복 중 언마운트 → 지연 응답이 세션·SSE 를 되살리지 않는다`,
    `StrictMode(dev 이중 마운트) 에서도 wc:boot 이 적용된다` 3건 모두 통과(56/56 전체 스위트도
    통과). (2) 기존 스위트가 **직접 커버하지 않던** 조합(`pendingResetRef` 소비 경로 + 언마운트)을
    검증하는 ad-hoc 테스트를 별도로 작성해 실행 — **통과**. 이어서 `cannotApplyConfig`에서
    `unmountedRef.current ||`만 제거하는 mutation을 적용해 재실행하니 **실패**로 전환됐다
    (`hookPosts` 0→1, 즉 사라진 컴포넌트가 실제 webhook POST를 발사함을 재현) — 원본 코드로
    복원 후 재확인 통과. 이 mutation-kill 로 해당 관문이 실제로 방어를 수행하고 있음을(우연한
    통과가 아님을) 실측 확인했다.
  - 제안: 없음(이번 라운드 코드는 안전, 실측 완료). 다만 검증에 쓴 "pendingReset 소비 + 언마운트"
    시나리오는 기존 추적 테스트 스위트에 없던 조합이었다 — `testing`/`maintainability` 관점에서
    이 조합을 정식 회귀 테스트로 편입해 두면(이번 라운드에서 임시로 작성했던 것과 동형) 향후
    리팩터 시 같은 관문이 실수로 느슨해지는 것을 자동으로 잡을 수 있다. 보안 결함은 아니므로
    차단 사유는 아니다.

- **[WARNING → 재확인, 신규 아님] (핵심 질문 4) `apiBase` 축 분리(세션이 발급 apiBase 미기록) — 이번 되돌림으로 악화되지 않았음을 확인**
  - 위치: `use-widget.ts:902-918`(`establishConfig` — 매 `wc:boot`마다 `clientRef.current`를
    무조건 새 `apiBase`로 재구성, 이번 diff 미변경), `session-store.ts:8-13`(`PersistedSession`에
    `apiBase` 필드 부재, 이번 diff 미변경), `use-token-refresh.ts:79-96`(타이머 발화 시점의
    **최신** `clientRef.current`/`sessionRef.current`를 재조합, 이번 diff 미변경),
    `eia-client.ts:71-117`(이번 diff 미변경).
  - 상세: 18_39_11 라운드 security 리뷰가 이미 WARNING으로 식별해 RESOLUTION.md·SUMMARY.md 에
    "이월(side_effect·security 교차)"로 명시 처리한 항목이다 — 재전송으로 `apiBase`가 바뀌면
    옛 세션의 Bearer 토큰이 새 `apiBase`로 전송될 수 있는 구조(발급처를 세션이 기억하지 않음).
    이번 diff는 이 메커니즘에 관여하는 세 파일(`establishConfig`의 client 재구성 로직,
    `session-store.ts`의 `PersistedSession` shape, `use-token-refresh.ts`의 타이머 재조합 로직)을
    **전혀 건드리지 않는다** — `git diff --stat`으로 확인한 변경 파일 목록에 `session-store.ts`·
    `use-token-refresh.ts`·`eia-client.ts`가 없고, `establishConfig()` 함수 본문도 이전 라운드
    검토 시점과 동일하다. A-6 되돌림이 만지는 대상(`sendCommand`의 catch 분기)은 `client`가
    아니라 `session`/`storage`/`stream` 축이라 `apiBase` 크로스오버 메커니즘과 직접 교차하지
    않는다. 추가로 "세션이 더 오래 살아있으면(A-6 되돌림 결과) 토큰 갱신 타이머가 더 오래
    armed 상태로 남아, 그 사이 apiBase 가 바뀐 재전송이 오면 노출 창이 넓어지지 않는가"를
    별도로 검토했다 — merge-base(29aa918a6, 브랜치 시작 전) 시점의 `sendCommand` catch 분기와
    현재(A-6 되돌림 후) 분기를 직접 diff 했더니 **완전히 동일**해, 이 타이머-armed 구간의 길이는
    항상 저장소 기준선과 같았다(A-6 라는 임시 버그가 있던 구간에서만 우연히 짧아졌었을 뿐). 즉
    이번 되돌림은 이 특정 갭의 "새로운 악화"가 아니라 "저장소가 항상 가지고 있던 노출 창으로의
    복귀"다.
  - 제안: 이 항목 자체에 대한 신규 제안은 없음(18_39_11 security.md 의 기존 제안 — `apiBase`
    변경 감지 시 `newChat()` 강제 또는 `PersistedSession`에 발급 `apiBase` 기록 — 이 유효하며
    별도 트랙에서 처리될 사안). 이번 라운드 리뷰의 역할은 "악화 여부 확인"이었고 결과는
    악화 없음이다.

- **[INFO] 표준 체크리스트(인젝션·하드코딩 시크릿·암호화·에러 노출·의존성) — 이번 diff 범위에서 이상 없음**
  - 위치: 전체 diff(`widget-state.ts`/`.test.ts`, `use-widget.ts`/`.test.ts`, `CHANGELOG.md`,
    plan 문서, spec frontmatter).
  - 상세: (1) 인젝션 — 이번 diff는 상태기계(reducer)·async 흐름 제어 로직뿐이라 신규 DOM
    렌더링·SQL·커맨드 실행 경로가 없다. `dangerouslySetInnerHTML`/`eval`/`innerHTML`/
    `new Function` 패턴 grep 결과 diff 범위 내 0건. (2) 하드코딩 시크릿 — API 키/비밀번호/토큰
    리터럴 패턴 grep 결과 0건(테스트 픽스처의 `"iext_old"`/`"iext_1"` 등은 명백한 가짜 값).
    (3) 암호화 — 이번 diff는 해시/암호화 로직을 도입·변경하지 않는다. (4) 에러 처리 — `sendCommand`
    catch 분기가 새로 참조하는 `errMessage()`(`use-widget.ts:1061-1065`, 이번 diff 미변경)는
    원본 에러(`e.message`)를 `console.warn`에만 남기고 UI 에는 항상 i18n 제네릭 문자열
    (`GENERIC_ERROR_MESSAGE`)을 반환한다 — `EiaError.detail`(서버 원본 응답 바디, `eia-client.ts:84`
    `safeJson(res)`로 캡처)은 diff 범위 전체(`use-widget.ts` 전체 grep)에서 **어디서도 소비되지
    않아** UI/로그 어느 쪽에도 노출되지 않는다. (5) 의존성 — 이번 diff 는 `package.json`/
    lockfile 을 변경하지 않는다(신규 의존성 없음).
  - 제안: 없음.

---

## 요약

이번 라운드의 핵심 변경(A-6 되돌림: 비-410 명령 실패 시 `teardownSession()` 미호출)을 spec
`3-auth-session.md` §3.1-2/§3.1-3 대조와 코드 정독으로 검증한 결과, **이 되돌림은 신규 보안
위험을 만들지 않는다** — merge-base(브랜치 시작 이전) 코드와 바이트 단위로 동일한 저장소
기준선 동작으로의 복귀이며, 남는 sessionStorage 토큰은 per_execution scope·TTL 자동폐기·탭종료
defense-in-depth·서버측 idle-reaper backstop 네 겹의 기존 경계 안에 있다("ended" UI와 살아있는
세션의 straddle 구간은 가용성 문제로 별도 product-planner 트랙에 이미 분리돼 있고 보안 영향은
없음을 확인). `unmountedRef` 축은 정적 분석에 더해 **격리 worktree 실측**(기존 회귀 3건 재실행
통과 + 기존 스위트가 커버하지 않던 "pendingReset 소비 + 언마운트" 조합의 신규 ad-hoc 테스트 작성·
통과 + `unmountedRef` 체크 제거 mutation 으로 실제 webhook POST 재현·kill 확인)까지 거쳐 리소스
누수(언마운트 후 신규 execution 시작) 방지가 온전함을 확인했다. 이월된 `apiBase` 축 분리는
관련 3개 파일(`session-store.ts`·`use-token-refresh.ts`·`eia-client.ts`)이 이번 diff 에 전혀
포함되지 않았고 `sendCommand` catch 분기도 저장소 기준선과 동일함을 직접 diff 로 확인해 —
이번 되돌림으로 악화되지 않았다(기존 WARNING 은 18_39_11 라운드에서 이미 별도 트랙으로 이월
결정된 채 유효하며, 본 라운드가 재작업할 항목은 아니다). 표준 OWASP 체크리스트(인젝션·시크릿·
암호화·에러 노출·의존성)도 이번 diff 범위에서 이상 없음을 확인했다. 종합하면 이번 라운드는
CRITICAL·신규 WARNING 없이 통과 가능한 상태다.

## 위험도

LOW
