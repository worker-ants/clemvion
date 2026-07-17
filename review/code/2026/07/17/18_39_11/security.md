# 보안(Security) 리뷰 — webchat-boot-single-flight

리뷰 대상: 고정 merge-base `14bc86a53` 기준 7파일 diff (`CHANGELOG.md`, `widget-state.test.ts`, `widget-state.ts`,
`use-widget-eager-start.test.ts`, `use-widget.ts`, `plan/in-progress/webchat-boot-single-flight.md`,
`spec/7-channel-web-chat/2-sdk.md`). `git diff --stat 14bc86a53..HEAD` 로 7파일 일치 확인 — 페이로드 오염 없음.

지시받은 5개 집중 검증 항목에 맞춰 코드(diff + 실제 소스 직접 확인)를 정독했다. 결론부터: **CRITICAL 은 없다.** `ERROR`
경로의 `teardownSession()` 추가(항목 1)와 origin pin/임베드 검증(항목 5)은 검증 결과 **문제 없음**으로 확인됐다.
반면 항목 2(재전송 시 `apiBase` 축 분리)와 항목 4(`unmountedRef` 신설)에서 **코드로 재현 가능한 실질적 갭**을
새로 찾았다 — 둘 다 이번 라운드의 지시 범위(diff 자체)에서 나온 것이라 WARNING 으로 보고한다.

---

### 발견사항

- **[WARNING] 재전송으로 `apiBase` 가 바뀌면, 옛 세션의 Bearer 토큰이 새 `apiBase` 로 전송된다 (항목 2)**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `establishConfig()` L845-861(특히 L848
    `clientRef.current = new EiaClient({ apiBase: cfg.apiBase })`), `sendCommand()` L604-640,
    `codebase/channel-web-chat/src/widget/use-token-refresh.ts` L79-102(특히 L87-88
    `currentClient.refreshToken(currentSession.endpoints, currentSession.token)`),
    `codebase/channel-web-chat/src/lib/eia-client.ts` L71-117(`interact`/`getStatus`/`refreshToken` 이
    전부 `this.apiBase`+`endpoints`(상대경로) 를 조합), `codebase/channel-web-chat/src/lib/session-store.ts`
    L8-13(`PersistedSession` 에 `apiBase` 필드 없음 — 세션이 "어느 apiBase 가 발급했는지" 를 기억하지 못함).
  - 상세: `establishConfig()` 는 매 `wc:boot`(재전송 포함)마다 `clientRef.current` 를 **무조건** 새
    `apiBase` 로 재구성한다. 반면 이번 diff 가 추가한 재전송 스킵 판정(`streamRef.current ? null :
    loadSession(...)`, L896)은 **복원 분기**(`getStatus`/`openStream`/`scheduleRefresh` 재실행)만 건너뛸
    뿐, `sessionRef.current`(옛 `apiBase` 가 발급한 `token`/`endpoints`)는 그대로 살아있다. `session.endpoints`
    는 상대경로이고 실제 요청 URL 은 **호출 시점의 `clientRef.current.apiBase`** 로 조합되므로(`eia-client.ts`
    `joinUrl`), 재전송 이후 사용자가 메시지를 보내거나(`sendCommand`→`interact`) 토큰 자동 갱신 타이머가
    발화하면(`use-token-refresh.ts`) **옛 apiBase 가 발급한 per_execution Bearer 토큰이 새 apiBase 로
    전송**된다. `PersistedSession` 에 발급 `apiBase` 가 기록되지 않아 이 불일치를 코드가 감지할 방법이 없다.
    실제 exploitability 는 host origin 이 이미 pin 돼 있어(host-bridge.ts) "완전 제3자"가 아니라 **이미
    신뢰된 host 가 보낸 config** 로 한정되지만, (a) `apiBase` 자체가 v1 부터 어떤 allowlist 검증도 없이
    boot config 그대로 신뢰돼 왔고, (b) 이 diff 는 재전송 시 세션/스트림은 "그대로 유지"하면서 **client 축만
    조용히 바뀌는 상태**를 새로 만들었다(재전송 스킵 이전엔 `openStream`이 매번 재연결돼 최소한 SSE 는 즉시
    새 apiBase 로 갔지만, `interact`/`refreshToken` 대상이 새 apiBase 로 바뀌는 근본 구조는 이 diff 이전부터
    있었다 — 이 diff 는 그 노출면을 줄이지도 늘리지도 않고 그대로 둔 채 "재전송=config 만 갱신"을 문서/의도로
    확정했다). 관리자 라이브 미리보기가 실사용 재전송 경로인 점을 고려하면, 배포 환경 전환(스테이징↔프로덕션
    등) 오조작으로 토큰이 의도치 않은 백엔드로 새어나갈 수 있는 **의도치 않은 설정 오류에도 열려있는** 갭이다.
    신규 테스트 6건 중 어느 것도 재전송 간 `apiBase` 변경 시나리오를 커버하지 않는다(전부 동일
    `"http://api.test/api"` 사용) — 이 축은 검증되지 않은 채 남아있다.
  - 제안: `applyConfig`/`establishConfig` 에서 살아있는 세션이 있는 상태(`streamRef.current` 또는
    `sessionRef.current` truthy)로 `cfg.apiBase !== configRef.current?.apiBase` 인 재전송을 받으면, 조용히
    `clientRef.current` 만 바꾸지 말고 **`newChat()`(전체 리셋) 을 강제**하거나 최소한 `console.warn` +
    회귀 테스트로 이 축을 명시적으로 고정할 것. `PersistedSession` 에 발급 `apiBase` 를 함께 저장해 두면
    향후 이런 축 불일치를 구조적으로 검출할 수 있다.

- **[WARNING] `unmountedRef` 가 리셋되지 않는 1회성 래치라, `reactStrictMode: true` dev 환경에서 위젯이
  이후 어떤 `wc:boot` 도 적용하지 못하게 된다 (항목 4)**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L179(`const unmountedRef = useRef(false)`),
    L283-286(`cannotApplyConfig` — `unmountedRef.current || bootGenRef.current !== attempt.boot`),
    L976(`unmountedRef.current = true;`, 리셋 코드 없음), 마운트 effect L864-984(`useEffect(() => {...}, [])`
    — deps 배열 `[]`). `codebase/channel-web-chat/next.config.ts` L10(`reactStrictMode: true`, 실제로 켜져
    있음, 이 저장소의 실제 설정값 — 가정이 아니라 확인된 사실).
  - 상세: React 18 StrictMode(dev 전용) 는 `deps: []` 인 마운트 effect 를 **mount → cleanup → mount** 순서로
    1회 이중 호출한다. 컴포넌트 인스턴스·`useRef` 값 자체는 이 사이 **재생성되지 않고 그대로 유지**된다.
    이번 diff 이전엔 cleanup 이 `worldGenRef.current++` 만 했는데, `isStale(gen)`/`isAttemptStale` 류
    검사는 **호출 시점에 `gen` 을 새로 캡처**해 비교하므로 이중 호출 자체는 무해했다. 그런데 이번 diff 가
    추가한 `unmountedRef` 는 다르다 — **한 번 `true` 가 되면 그 인스턴스 수명 동안 다시 `false` 로 리셋되는
    지점이 코드 어디에도 없다**(grep 확인: 선언·읽기·`true` 대입 3곳뿐). StrictMode 의 시뮬레이션
    cleanup(가짜 "언마운트") 이 `unmountedRef.current = true` 를 한 번 세팅하면, 뒤이은 시뮬레이션
    remount(effect 재실행)는 물론 **그 이후 실제로 도착하는 모든 `wc:boot`** 이 `cannotApplyConfig` 의
    boot-축 검사(L284) 에 도달하기도 전에 `unmountedRef.current` 만으로 항상 `true` 를 반환해
    `establishConfig` 를 영구히 호출하지 못한다 — **dev 서버(`next dev`)에서 위젯이 최초 로드 이후 어떤
    config 도 적용하지 못하는 permanent lockout**이다. 프로덕션(`output: 'export'` 정적 번들, StrictMode
    이중 호출 없음)에는 영향이 없어 배포 보안 리스크는 아니지만, 이 diff 가 신설한 정확히 그 ref 의 설계
    결함이고 로컬 개발/디버깅을 원천 차단하는 실전 버그다.
  - 제안: 마운트 effect 본문 시작부에서 `unmountedRef.current = false;` 로 재무장할 것(다른 `useRef` 부울
    가드들과 달리 이것만 "1회성 래치"로 남아있는 게 원인). 또는 StrictMode 이중 호출 시나리오를 커버하는
    회귀 테스트(mount→cleanup→mount 시뮬레이션 후 `wc:boot` 이 여전히 적용되는지)를 추가.

- **[INFO] `AI_MESSAGE`(및 `USER_MESSAGE`) 에 `ended` 가드 부재 — 지배적 경로는 이번 diff 로 닫혔으나
  아주 좁은 레이스는 이론상 남아있다 (항목 3, 이전 라운드 지적 사항 재확인)**
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` L639-645(`AI_MESSAGE` 케이스, `ended` 가드
    없음), `codebase/channel-web-chat/src/widget/components/panel.tsx` L133-134(`messages.map(...)` 이
    `phase` 무관하게 항상 렌더).
  - 상세: 이전 라운드에서 지적한 대로 `AI_MESSAGE` 리듀서 케이스엔 여전히 `if (state.phase === "ended")
    return state;` 가드가 없다. 다만 이번 diff 의 근본 fix(`sendCommand` ERROR 분기의 `teardownSession()`)
    가 **지배적 경로를 닫았다** — `AI_MESSAGE` 를 디스패치하는 유일한 소스는 열린 SSE 스트림의 이벤트
    (`handleEiaEvent`)뿐이고, `teardownSession()` 이 `closeStream()` 을 동기 호출하므로 ERROR 이후엔 그
    스트림이 실제로 닫힌다. 게다가 스토리지도 함께 지워지므로 이후 `wc:boot` 재전송이 와도 복원 분기가
    세션을 찾지 못해(`loadSession` → null) 새 스트림을 열지 않는다 — 검증용 통합 테스트(`ERROR 로 종료된
    대화는 wc:boot 재전송으로 부활하지 않는다`, use-widget-eager-start.test.ts L1148-1223)가 이 전체 경로를
    실측으로 고정했다. 남은 이론적 창구는 **`interact()` 실패와 정확히 같은 타이밍에 이미 도착해 브라우저
    task queue 에 올라간 SSE 메시지**뿐이다 — `EventSource.close()` 는 그 이후 도착하는 이벤트만 막을 뿐,
    호출 직전에 이미 큐에 올라간 이벤트를 취소하진 못한다. 이 경우 `handleEiaEvent`가 `ended` 전이 **직후**
    실행돼 `AI_MESSAGE`/`WAITING` 을 디스패치할 수 있고, `WAITING` 은 이미 가드가 있지만 `AI_MESSAGE` 는
    없어 `state.messages` 에 append 되고 `panel.tsx` 가 phase 와 무관하게 그 배열을 렌더하므로 화면에는
    보일 수 있다. 다만 이건 (a) 같은 execution 의 정상 콘텐츠이지 다른 세션/사용자의 데이터가 아니고,
    (b) 타이밍이 극도로 좁아(명령 실패와 SSE 메시지 도착이 같은 tick 에 경합) 실질적 보안 영향(데이터 유출·
    인증 우회)은 없다 — UI 상 "종료 후 메시지 하나가 더 뜨는" 표시상의 결함에 그친다.
  - 제안: 코드베이스 자신의 관례(`WAITING`/`RESTORED`/`BOOTED` 에 이미 적용된 "최후 방어선" 패턴)를
    `AI_MESSAGE` 에도 동일하게 확대해 defense-in-depth 를 완성할 것을 권장하나, 지배적 실패 사례가 이미
    닫혔으므로 긴급도는 낮다(WAITING/RESTORED/BOOTED 확대 때와 동일하게 "실패 사례 재현 시 확대" 원칙을
    따른다면, 이 좁은 레이스도 plan 에 트리거로 기록해 두는 것으로 충분해 보인다).

- **[INFO] `sendCommand` ERROR 분기의 수동 `teardownSession()` 이 `endedRef` 를 세팅하지 않아, 동시
  도착한 terminal SSE 이벤트와 경합 시 지연된 중복 `conversationEnded` 통지가 발생할 수 있음 (항목 1 세부)**
  - 위치: `use-widget.ts` L604-640(`sendCommand`, 특히 L634 `teardownSession()` 이후 `endedRef` 미설정),
    L355-366(`finalizeEnded` — `endedRef.current = true` 는 이쪽에서만 설정).
  - 상세: `finalizeEnded` 는 `endedRef` 로 "같은 종료를 두 경로가 중복 통지하지 않도록" 가드하지만,
    `sendCommand` 의 새 ERROR 분기는 `finalizeEnded` 를 거치지 않고 `teardownSession()` 을 직접 호출하므로
    `endedRef` 가 세팅되지 않는다. 대부분의 경우 `teardownSession()` 이 `closeStream()` 으로 SSE 를 즉시
    닫아 이후 terminal 이벤트가 발생할 여지 자체가 없으므로 무해하다. 다만 위 항목과 같은 좁은 레이스로
    terminal SSE 이벤트가 이미 in-flight 상태였다면, 그 이벤트 핸들러가 나중에 `finalizeEnded()` 를 호출해
    (a) 이미 `teardownSession` 된 상태를 한 번 더 정리(멱등이라 안전)하고 (b) host 에 `conversationEnded`
    를 보낸다 — ERROR 시엔 의도적으로 통지하지 않기로 한 설계(주석에 명시)와 상충되는 지연 통지가 나갈 수
    있다. 보안 영향은 없다(민감정보 노출 아님, 단순 라이프사이클 이벤트 중복/지연).
  - 제안: 우선순위 낮음. 필요 시 `sendCommand` ERROR 분기도 `endedRef.current = true` 를 세팅해 동일 종료의
    후속 통지를 억제하도록 정리 가능.

- **[INFO] origin pin·임베드 soft 검증은 boot-축 전용 checkpoint 재편으로 약화되지 않음 (항목 5, 확인 완료)**
  - 위치: `codebase/channel-web-chat/src/widget/host-bridge.ts` L45-62(`onMessage` — `hostOrigin` pin,
    이번 diff 미변경 파일), `use-widget.ts` L865-878(`applyConfig` checkpoint 1, `isEmbedAllowed` 호출 +
    `cannotApplyConfig`).
  - 상세: 두 메커니즘은 서로 다른 레이어에서 독립적으로 동작한다. (1) **origin pin** 은 `host-bridge.ts`
    의 `onMessage` 리스너에서 첫 `wc:boot` 의 `event.origin` 을 고정하고 이후 모든 메시지(재전송 포함)를
    그 origin 으로 검증한다 — 이 파일은 이번 diff 대상이 아니며 로직도 `worldGenRef`/`bootGenRef` 와 완전히
    무관하다. (2) **임베드 soft 검증**(`isEmbedAllowed` fetch+allowlist)은 매 `applyConfig` 호출(=매
    `wc:boot`, 재전송 포함)마다 **무조건 실행**되며, `cannotApplyConfig` 로 바뀐 checkpoint 1 은 그 결과를
    "이 시도가 아직 유효한가"로 게이팅할 뿐 검증 자체를 건너뛰지 않는다. world 축을 이 checkpoint 에서
    보지 않게 된 것(C1 fix)의 실질적 효과는 "대체된(superseded) 옛 시도가 형제의 정당한 세계 무효화에
    휩쓸려 BLOCKED 를 못 내는" 것뿐인데, 대체된 시도의 판정은 애초에 §106("마지막 wc:boot 승리")에 의해
    무시돼야 하는 판정이라 — **마지막(생존) 시도는 자신의 고유한 `isEmbedAllowed()` 결과로 독립적으로
    검증**된다. `establishConfig(cfg)` 에 도달하는 유일한 경로는 "이 시도가 boot-축에서 아직 최신이고,
    unmount 되지 않았고, 자신의 `isEmbedAllowed()` 가 true" 인 경우뿐이므로 차단 우회 시나리오는 없다.
    오히려 이전 세대(world 축만으로 판정하던 시절)는 "이 시도와 무관한 어떤 세계 변화든" BLOCKED 디스패치를
    삼켜버릴 수 있어 억제 조건이 더 넓었다 — 이번 재편은 억제 조건을 boot-축(진짜 대체 상황)으로 좁혔다는
    점에서 오히려 더 정교해졌다.
  - 제안: 없음(문제 아님, 확인 목적의 기록).

---

### 요약

인젝션·하드코딩 시크릿·인증 우회·안전하지 않은 암호화 등 고전적 OWASP Top 10 범주에서는 이번 diff 에
CRITICAL 급 결함이 없다. 지시받은 5개 집중 항목 중 두 가지(항목 1: `ERROR` 경로의 `teardownSession()`,
항목 5: origin pin/임베드 검증)는 실제 소스 확인 결과 의도대로 정확히 동작하며 세션 위생·보안 검증을
약화시키지 않는다 — 특히 항목 1 은 SSE 스트림 종료·갱신 타이머 해제·`sessionStorage` 삭제까지 전부 확인돼
"좀비 세션" 문제를 근본적으로 닫았다. 반면 나머지 두 항목에서 diff 자체(또는 diff 가 남겨둔 기존 구조)에서
유래하는 실질적 갭을 코드로 확인했다: (2) 재전송 시 `apiBase` 가 바뀌면 옛 세션의 Bearer 토큰이 새
`apiBase` 로 전송될 수 있는 축 분리(세션이 발급 `apiBase` 를 기억하지 않음), (4) 이번 diff 가 신설한
`unmountedRef` 가 리셋 없는 1회성 래치라 이 저장소에 실제로 켜져 있는 `reactStrictMode: true` dev 환경에서
위젯이 영구적으로 config 를 적용하지 못하는 회귀. 두 항목 모두 공격자가 host origin pin 을 우회해야 하거나
(2) 프로덕션에 영향이 없는 dev 전용 버그라서(4) 즉각적인 외부 위협은 아니지만, 전자는 향후 배포 환경 전환
실수로 토큰이 잘못된 백엔드로 새는 실질적 하드닝 갭이고 후자는 이번 라운드가 만든 새 결함이라 반드시
고쳐야 한다. `AI_MESSAGE` ended 가드 부재는 지배적 실패 경로가 닫혀 실질 위험이 크게 줄었고, 나머지 한
항목(중복 `conversationEnded`)도 데이터 노출이 없는 사소한 라이프사이클 이슈다.

### 위험도

LOW
