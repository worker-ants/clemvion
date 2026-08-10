# 테스트(Testing) Review

대상: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`,
`codebase/channel-web-chat/src/widget/use-widget.ts`, `spec/7-channel-web-chat/3-auth-session.md`
— 재로드 복원(§3.1) `404`/`401` REST 오류 분기 + `401` 낙관적 refresh 1회(§R4) 신규 구현·회귀 테스트 4건.

오더가 지시한 대로 회귀 4건(404 / 401-성공 / 401-재차실패 / 500 soft-fail)의 vacuousness 와, 뮤테이션이
겨냥 못 한 분기(refresh 성공 후 세대 재검사, `configRef` 부재 경로)를 독립적으로 프로브 테스트로 검증했다.

### 발견사항

- **[CRITICAL]** "§R4: 401 → 낙관적 refresh 1회 성공 시 복원(SSE 오픈)" 테스트가 검증해야 할 핵심 주장 —
  **refresh 로 얻은 새 토큰으로 SSE 가 재연결된다** — 를 실제로는 검증하지 못한다. mock 설계상 원리적으로
  검증 불가능해서 실제 결함(구 토큰으로 스트림이 열림)을 그대로 통과시킨다. False confidence.
  - 위치: 테스트 — `use-widget-eager-start.test.ts:280`(`it(...)` 시작)~`315`, 특히 단언부
    `309-314`(`expect(getEs()).not.toBeNull()` / `expect(refreshCalls).toBe(1)` /
    `sessionStorage...toContain("iext_fresh")`). 헬퍼 — `use-widget-eager-start.test.ts:87-100`
    (`installControllableEventSource`, 생성자가 `url` 인자를 저장하지 않음).
    근본 원인 코드 — `use-widget.ts:508-515`(refresh 성공 시 `sessionRef.current`/`saveSession` 만
    새 토큰으로 갱신하고 호출부에 갱신된 세션을 반환하지 않음), `use-widget.ts:930-934`+`945`+`961`
    (`applyConfig` 의 `saved` 지역변수는 `seedWaitingFromStatus` 호출 **이전** 값 그대로 `openStream(saved, "0")`
    에 전달됨 — refresh 로 교체된 `sessionRef.current` 를 다시 읽지 않는다).
  - 상세: 프로브로 직접 재현했다 — `installControllableEventSource` 를 URL 캡처가 되는 커스텀 stub 으로
    교체하고("race fix: openStream 을 lastEventId=0…" 테스트가 이미 쓰는 패턴, `use-widget-eager-start.test.ts:981-1000`
    참고), 401→refresh-성공 시나리오를 그대로 재현한 결과:
    ```
    PROBE esUrl: http://api.test/api/api/external/executions/e1/stream?token=iext_stale&lastEventId=0
    ```
    `refresh-token` 이 `iext_fresh` 를 반환하고 `sessionStorage` 에도 `iext_fresh` 가 반영되지만, 실제
    `EventSource` 는 **`iext_stale`**(만료로 401 을 유발한 옛 토큰)로 열린다. spec(`3-auth-session.md:82-85`,
    `§R4`)은 "성공 시 SSE 재연결로 복원"을 명시하는데, 실제 재연결은 이미 거부된 토큰으로 이루어진다 —
    서버가 다시 401 을 내면 EventSource 는 같은 URL 로 자동 재연결을 반복하므로(`use-widget.ts:354-361` 의
    `onError` 주석이 스스로 그렇게 가정한다) 위젯이 무기한 실패 루프에 들어갈 수 있다. 그런데 테스트는
    `getEs()).not.toBeNull()` 로 "스트림이 하나 열렸는가"만 보고, 그 스트림이 어떤 토큰으로 열렸는지는
    관측할 방법이 stub 설계상 없다(`ControllableEventSource`/생성자 어디에도 `url` 을 저장하는 필드가 없음).
    `refreshCalls===1`·`sessionStorage`-`iext_fresh` 단언은 "refresh 요청과 로컬 저장은 옳게 됐다"만
    증명하고, "그 결과가 실제로 쓰였다"는 증명하지 못한다 — 두 검사 지점(요청측/저장소) 사이에 있는
    유일한 소비 지점(`openStream` 인자)이 빠졌다.
  - 제안: `installControllableEventSource` 를 `getEs()` 뿐 아니라 마지막 생성 URL(`getLastUrl()` 등)도
    노출하도록 확장하거나, 401-성공 테스트에 한해 "race fix" 테스트가 쓰는 URL-캡처 stub 을 재사용해
    `expect(esUrl).toContain("token=iext_fresh")`(또는 최소 `not.toContain("iext_stale")`) 단언을 추가할 것.
    이 단언이 추가되면 현재 GREEN 인 세 401 관련 테스트 중 "성공" 케이스가 즉시 RED 로 바뀌어 실제 결함을
    드러낸다 — 코드 수정은 이 리뷰의 스코프 밖(developer)이지만, 테스트가 이를 검출하지 못하는 것 자체가
    이 리뷰(Testing)의 스코프다.

- **[WARNING]** 오더가 지목한 "refresh 성공 후의 세대 재검사"(`isStale(gen)`, `use-widget.ts:507`)와
  "재차 실패 후 세대 재검사"(`use-widget.ts:517`) 두 분기 모두, 이를 겨냥한 테스트가 **전무**하다.
  같은 파일에 거의 동일한 패턴(진행 중인 비동기 await 도중 `newChat()`으로 세대를 올려 stale 판정을
  검증)이 이미 두 벌 존재하는데(`use-widget-eager-start.test.ts:1763`
  "복원 seed 가 in-flight 인 동안 새 대화 시작…", `:1843` "…network 오류로 soft-fail 해도…"), 이번 diff 가
  새로 추가한 401 분기 내부의 두 재검사 지점에는 짝이 되는 테스트가 없다.
  - 위치: `use-widget.ts:507`(refresh 성공 후 `isStale(gen)` 재검사), `use-widget.ts:517`(refresh 실패 후
    `isStale(gen)` 재검사). 대응 테스트 부재 — `use-widget-eager-start.test.ts:280`, `:317` 두 테스트
    모두 refresh 요청을 즉시 resolve/reject 시켜, "왕복 도중 세계가 바뀌는" 창을 전혀 열지 않는다.
  - 상세: 이 재검사가 지키는 불변식은 코드 주석(`use-widget.ts:505-506` "그 사이 세계가 바뀌었으면 새
    토큰을 옛 세션에 쓰지 않는다")이 스스로 "이 파일이 반복해 배운 규율"이라 부를 만큼 이 코드베이스가
    과거 실제로 반증(CRITICAL#1, W2)까지 겪은 클래스의 버그다. 그런데 정작 이번에 새로 생긴 두 인스턴스는
    (a) refresh 가 in-flight 인 동안 `newChat()`이 오면 새로 받은 토큰을 이미 교체된(새) 세션에 덮어쓰지
    않는지, (b) `outcome` 이 `"stale"` 로 올바르게 걸러져 `applyConfig`/`start()` 가 되감기를 하지 않는지
    를 검증하는 테스트가 없다. 지금은 가드 코드 자체는 존재하므로 활성 버그는 아니지만, 이 가드가
    회귀로 제거/약화돼도 어떤 테스트도 RED 가 되지 않는다 — mutation 관점에서 507/517 두 줄은 이 diff 의
    사각지대다.
  - 제안: `refresh-token` fetch 를 수동 resolve Promise 로 잡아둔 채(`use-widget-eager-start.test.ts:1768`
    의 `resolveStatus` 패턴과 동형으로 `resolveRefresh` 홀드), 그 사이 `newChat()` 호출 → 이후 refresh
    resolve/reject → (성공 케이스) 새 토큰이 **새** 세션(옛 세션 아님)에 쓰이지 않음 + 옛 세션
    sessionStorage 가 되살아나지 않음, (실패 케이스) `finalizeEnded` 가 새 세션을 오종료시키지 않음을
    단언하는 테스트 각 1개씩 추가.

- **[INFO]** `use-widget.ts:509`(`const cfg = configRef.current; if (!cfg) return "stale";`)는 어떤
  테스트도 겨냥하지 않지만, 현재 코드베이스 불변식상 **도달 불가능한 방어적 분기**로 보인다 —
  `teardownSession`(`use-widget.ts:254` 부근) 자신의 주석이 "`configRef.current` 는 확립 후 다시 null 이
  되지 않는다(현재 대입 2곳·해제 0곳)"고 명시하며, `seedWaitingFromStatus` 의 두 호출부(`start()`,
  `applyConfig()`) 모두 `configRef.current` 가 이미 확립된 뒤에만 도달한다. black-box 테스트로 이
  분기를 겨냥하려면 공개 API 로는 `configRef.current` 를 재-null 화할 방법이 없어 사실상 불가능하다.
  지적의 성격은 "테스트 안 됨"이 맞으나 현시점 리스크는 낮다 — 다만 `teardownSession` 의 동일 불변식
  주석("`configRef.current = null` 을 도입하면 조용히 no-op 이 된다 — 그때는 이 조건도 함께 재검토할 것")과
  달리 이 분기에는 그 의존 사실을 알리는 주석이 없다. 향후 이 불변식이 깨지면 이 분기가 조용히
  살아나 "부팅 전 되돌아감" 이 아니라 "정상 refresh 결과를 stale 로 폐기"하는 회귀가 될 수 있다.
  - 제안: 최소한 `teardownSession` 과 동일한 "불변식 의존 주의" 주석을 이 분기에도 남길 것. 여력이 되면
    `configRef` 를 얇은 getter로 감싸 whitebox 유닛에서 주입 가능하게 하면 이 분기도 직접 겨냥할 수 있다.

- **[INFO]** 회귀 4건(404/401-성공/401-재차실패/500)은 vacuous 하지 않다 — 독립적으로 확인했다. 404 케이스는
  변경 전 코드라면(모든 오류가 soft-fail `"continue"` 로 수렴) `openStream` 이 그대로 호출돼
  `getEs()).toBeNull()` 이 실패했을 것이고, 500 케이스는 반대로 종료로 오판되면 `getEs()).not.toBeNull()` 이
  실패한다(§3.1 REST 오류 3분기가 서로 다른 귀결이라 한 assertion 세트로 교차 검증됨). 401-재차실패
  케이스도 `refreshCalls===1` 이 무한 재시도 도입 뮤테이션을 잡는다. 다만 위 CRITICAL 이 보여주듯,
  "vacuous 하지 않다"(뭔가는 검증한다)와 "테스트 제목이 주장하는 바를 검증한다"(SSE 가 **올바른 토큰**으로
  열렸다)는 별개다 — 401-성공 케이스는 전자는 만족하지만 후자는 만족하지 못한다.

- **[INFO]** 테스트 격리·가독성은 양호하다. 4건 모두 `beforeEach`(sessionStorage clear)/`afterEach`
  (`unstubAllGlobals`/`restoreAllMocks`)에 의존해 독립 실행 가능하고, 각 `fetchMock` 은 테스트 로컬
  `vi.fn` 이라 교차 오염이 없다. mock 응답 shape(`{ ok, status, json }`)도 `eia-client.ts` 의
  `getStatus`/`refreshToken` 실제 계약(`res.ok` 로만 분기, 실패 시 `res.json()` 미호출)과 정확히 일치해
  이 부분의 mock 충실도는 문제 없다. 각 `it()` 의 선행 JSDoc(`use-widget-eager-start.test.ts:244-253`)이
  "왜 셋을 갈라 단언하는지"를 명시한 것도 좋다.

### 요약

새로 추가된 4건의 회귀 테스트는 자기 자신이 겨냥한 상태 전이(phase, storage 정리 여부, refresh 재시도
횟수)에 대해서는 vacuous 하지 않고 견고하다. 그러나 401-성공 테스트는 제목이 주장하는 "SSE 오픈(복원)"을
실제로는 검증하지 못하는 근본적 mock 설계 결함(`EventSource` stub 이 URL/토큰을 캡처하지 않음)을 안고
있고, 이는 프로브로 직접 재현한 실결함(refresh 로 갱신된 토큰이 아니라 stale 토큰으로 SSE 가 열림)을
그대로 통과시킨다 — 이번 diff 가 구현하려는 §R4 낙관적 refresh 기능이 실질적으로 동작하지 않는데도
테스트는 GREEN 이다. 추가로, 이 코드베이스가 과거 여러 번 반증한 "await 도중 세계가 바뀌는" 클래스의
race 를 막는 두 재검사 지점(refresh 성공/실패 후 `isStale(gen)`)이 이번 diff 로 신설됐음에도 짝이 되는
회귀 테스트가 없어 mutation 사각지대로 남아 있다. `configRef` 부재 분기는 현재 불변식상 도달 불가능해
보여 시급성은 낮다.

### 위험도

CRITICAL
