# 테스트(Testing) Review

대상: `codebase/channel-web-chat/src/lib/session-store.ts`, `use-token-refresh.ts`, `use-widget.ts`,
`use-widget-eager-start.test.ts`, `CHANGELOG.md`, `plan/in-progress/webchat-auth-session-status-reconcile.md`
— 직전 라운드(`16_09_40`) CRITICAL(refresh 성공 후 stale 토큰으로 SSE 재오픈) 수정 + 그 수정을 검증하는
회귀 2건(URL 포획, 세대 재검사) 추가.

먼저 참고 1(직전 지적 반영 여부)부터 확인한다.

## 참고 1 확인 — URL 포획·세대 재검사 회귀는 실측대로 반영됨

- `installControllableEventSource`가 생성자 `url` 인자를 `getUrl()`로 노출하도록 확장됐고
  (`use-widget-eager-start.test.ts:97`, `102-103`, `110`), 401-성공 테스트가
  `expect(getUrl()).toContain("iext_fresh")` / `.not.toContain("iext_stale")`로 실제 소비 지점(`openStream`
  인자)을 단언한다(`use-widget-eager-start.test.ts:329-330`). 코드 쪽도 두 호출부(`start()` 630-632,
  `applyConfig()` 982-984)가 `sessionRef.current`를 다시 읽도록 고쳐져 있어 일치한다.
- 세대 재검사 회귀("§R4: refresh 왕복 중 세계가 바뀌면...", `use-widget-eager-start.test.ts:342-384`)도
  `releaseRefresh` 를 붙잡아 둔 채 `endConversation()`으로 세계를 바꾼 뒤 풀어주는 방식으로 실제 race
  window를 연다 — 즉시 resolve하는 기존 테스트들과 달리 이 창을 실제로 만든다는 점에서 유효하다.

두 항목 모두 지시된 대로 잘 반영됐다. 다만 아래에서 이 두 번째 회귀가 **겨냥한 두 지점 중 하나만** 덮는다는
점을 발견해 별도로 짚는다.

## 발견사항

- **[WARNING]** 신규 세대 재검사 회귀는 `catch` 분기(재차 실패 후 `isStale`)를 겨냥하지 못한다 —
  RESOLUTION.md/SUMMARY.md의 "세대 재검사 2곳... 뮤테이션 RED" 주장이 실제로는 절반만 검증됨
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:519`(refresh **성공** 후 `isStale(gen)`
    재검사 — 테스트 있음) vs `codebase/channel-web-chat/src/widget/use-widget.ts:531`(refresh **실패**
    후 `isStale(gen)` 재검사, `catch` 블록 안 — 테스트 없음). 대응 테스트:
    `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:342-384`(성공 경로만 커버).
  - 상세: 신규 테스트는 `releaseRefresh`가 **성공 응답**(`ok:true, iext_late`)을 resolve하는 경로만
    다룬다. `catch` 블록의 재검사(519행과 대칭 구조인 531행)는 refresh 자체가 **실패**할 때만 실행되는데,
    이 창을 여는 테스트가 없다 — 기존 "401 → refresh 도 실패" 테스트(`:386-416`)는 refresh를 즉시
    reject시켜 세계가 바뀔 창을 만들지 않는다. 531행의 `isStale(gen)` 검사를 제거하는 뮤턴트는 두
    테스트 중 어느 쪽으로도 RED가 안 된다 — 즉 "세계가 바뀐 채 refresh가 뒤늦게 실패로 도착하면
    `finalizeEnded`가 (이미 새로 시작된) 다른 세션을 오종료시키지 않는가"라는, 코드 주석(505-506행
    "이 검사가 없으면... 새 세션을 옛 세션으로 덮고 방금 지운 storage를 되살린다")이 명시적으로
    경계하는 바로 그 클래스의 회귀가 이 diff에는 무방비다. RESOLUTION.md §3/SUMMARY.md는 "두 지점"을
    묶어 서술해 이 비대칭이 가려져 있다.
  - 제안: 기존 `releaseRefresh` 패턴을 그대로 재사용해 `rejectRefresh`(같은 Promise를 reject로
    resolve)를 만들고, 그 창에서 `endConversation()`/`newChat()`으로 세계를 바꾼 뒤 reject시켜
    `finalizeEnded`가 새 세션을 건드리지 않는지(예: 새 세션의 `sessionStorage` 값이 그대로인지, 혹은
    `state.phase`가 옛 세션 종료로 되돌아가지 않는지) 단언하는 테스트를 추가할 것.

- **[WARNING]** — `start()` 경로 401 커버리지 갭 판정: **부분적으로만 옳다.** "실제 도달 가능성부터
  확인" 원칙 자체는 맞지만, 그 판단축이 회귀가 막아야 할 진짜 위험보다 좁다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:630-632`(`start()`의
    `live = sessionRef.current; if (!live) return; openStream(live, "0");`) vs
    `codebase/channel-web-chat/src/widget/use-widget.ts:982-984`(`applyConfig()`의 동형 3줄,
    `saved` fallback만 다름). 갭 서술: `plan/in-progress/webchat-auth-session-status-reconcile.md:55-70`.
  - 상세: plan은 "신규 대화 직후 `getStatus`가 `401`을 줄 수 있는가"만 미확인 전제로 놓았다. 그런데
    이번 라운드가 고친 CRITICAL의 본질은 401 자체가 아니라 **"`await seedWaitingFromStatus` 도중
    `sessionRef.current`가 바뀌면 호출부가 캡처해 둔 지역 변수로 `openStream`을 부른다"**는 코드-형태
    결함이다(`use-widget.ts:625-629` 주석이 이렇게 정확히 서술한다). 이 파일은 이미 `sessionRef.current`를
    바꾸는 **다른, 확실히 도달 가능한** 트리거를 여러 벌 갖고 있다 — 예컨대 `applyConfig`의 재전송(동시
    boot 시도)이나 `newChat()`. `start()`가 도는 동안 동시에 재전송/새 대화가 들어와 `sessionRef.current`를
    바꾸는 시나리오는 401 재현성과 무관하게 이미 이 파일의 다른 테스트들이 증명한 대로 재현 가능하다
    (예: "복원 seed가 network 오류로 soft-fail 해도 새 대화 스트림을 옛 세션이 탈취하지 않는다",
    `use-widget-eager-start.test.ts:1912` 부근). `start()`의 630-632에 있는 정확히 그 3줄을 겨냥하려면
    401을 재현할 필요가 없다 — **`sessionRef.current`를 어떤 경로로든 바꿔 놓고 `start()`의 seed가
    "continue"로 resolve하는 시나리오**(soft-fail도 "continue"를 반환하므로 충분)만 있으면 된다. 즉
    "401이 start()에서 도달 가능한가"라는 질문에 대한 답을 기다릴 필요 없이, **오늘 당장 재현 가능한
    다른 트리거로 630-632의 뮤테이션 사각지대를 닫을 수 있었다.**
  - 판정: "SSE가 안 열려 통과할 때까지 구부리지 않았다"는 태도, 그리고 이를 코드 주석·plan·RESOLUTION
    세 곳에 투명하게 남긴 절차는 이 저장소의 관례에 부합하고 옳다. **다만 유예 사유(401 재현성 미확인)가
    실제로 막아야 할 위험(콜사이트의 stale-local-vs-ref 회귀)의 필요조건이 아니다** — memory의
    "유예 근거는 실측해야 한다"와 같은 결(유예 사유 자체를 의심할 지점)로, 이번엔 사유가 거짓은
    아니지만 범위가 실제보다 좁게 잡혔다. 지금 덮는 편을 권장한다: 401 조사를 기다리지 말고, soft-fail
    또는 concurrent-resend 트리거로 630-632 전용 회귀를 먼저 추가할 것. (401 자체의 도달 가능성 조사는
    별개로 plan에 남겨 둬도 무방 — 그건 "테스트 정확성"이 아니라 "코드가 실제로 그 분기를 필요로
    하는가"라는 별개 질문이다.)

- **[INFO]** 신규 `applyRefreshedToken`(session-store.ts)에 대응하는 직접 unit test가 없다 —
  session-store.test.ts의 함수별 describe 관례에서 벗어남
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:125-133`(`applyRefreshedToken` 정의).
    `codebase/channel-web-chat/src/lib/session-store.test.ts`는 여전히
    `saveSession, loadSession, clearSession`만 import한다(`applyRefreshedToken` 미포함, 파일 전체 109줄).
  - 상세: 이 함수는 정확히 "자매 함수 미적용" 결함을 막으려고 추출됐고(JSDoc이 스스로 그 근거를
    적는다), `use-token-refresh.test.ts:81-98`와 `use-widget-eager-start.test.ts`의 401-성공 테스트를
    통해 **간접적으로는** 검증된다(spread 시맨틱·`apiBase` 보존·`saveSession` 위임 모두 그 두 통합
    테스트가 실제로 단언한다 — 커버리지 자체는 vacuous 하지 않음). 다만 두 호출부 모두를 거쳐야만
    이 함수의 계약(예: `{...session, ...refreshed}` spread가 `apiBase`/`endpoints` 등 나머지 필드를
    보존하는지)이 검증되므로, 향후 이 함수 자체를 손볼 때 실패 지점이 두 훅의 통합 테스트로만 보고돼
    원인 특정 비용이 더 든다. `session-store.test.ts`의 기존 관례(각 export마다 전용 `describe`)를
    따르는 편이 이 저장소의 다른 파일들과 일관되고, 세션 스토어 계층에서 즉시 결함을 잡을 수 있다.
  - 제안: `session-store.test.ts`에 `describe("applyRefreshedToken", ...)` 추가 — 최소
    (a) 갱신 필드(`token`/`expiresAt`)만 바뀌고 나머지(`executionId`/`endpoints`/`apiBase`)는 보존되는지,
    (b) `saveSession`이 올바른 `triggerEndpointPath`로 호출되는지(spy storage로 확인) 2건이면 충분.

- **[INFO]** 신규 REST 오류 분기 4테스트(404/401-성공/401-재차실패/500)는 vacuous하지 않고, mock이
  `eia-client.ts`의 실제 계약(`res.ok`만으로 분기, `EiaError`에 `status` 보존)과 정확히 일치한다 —
  직접 `eia-client.ts:95-118`을 대조해 확인.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:260-444`.
  - 상세: `getStatus`/`refreshToken` 모두 `!res.ok`일 때 `EiaError(msg, res.status)`를 던지므로,
    테스트의 `{ ok: false, status: N }` mock shape가 `err instanceof EiaError && err.status === N` 분기
    조건과 정확히 맞물린다 — mock 충실도에는 문제 없음.
  - 제안: 없음(참고용).

- **[INFO]** 격리·가독성은 양호 — 4건 모두 로컬 `vi.fn` fetchMock을 쓰고 `beforeEach`(sessionStorage
  clear)/`afterEach`(`unstubAllGlobals`/`restoreAllMocks`)에 의존해 교차 오염이 없다. 각 `it()` 앞
  JSDoc이 "왜 셋을 갈라 단언하는지"를 명시한 것도 이전 라운드 지적대로 유지되고 있다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:255-267`(JSDoc),
    `199-216`(공용 `beforeEach`/`afterEach`).
  - 제안: 없음(참고용).

## 요약

이번 diff는 직전 라운드가 지적한 두 항목(EventSource URL 미포획으로 인한 false confidence, 세대
재검사 뮤테이션 사각지대)을 실측 근거(뮤테이션 RED)와 함께 반영했고, 그 반영 자체는 견고하다.
다만 "세대 재검사 2곳을 회귀로 고정했다"는 주장은 성공 경로(519행) 하나만 실제로 검증하고 실패
경로(catch, 531행)는 여전히 무방비다 — 코드가 명시적으로 경계하는 바로 그 클래스의 사각지대가
문서상 "닫혔다"고 서술된 채 남아 있다. `start()` 경로의 401 커버리지 갭을 "도달 가능성 확인 전까지
구부리지 않는다"고 미룬 판단은 절차상 옳지만, 실제로 막아야 할 위험(콜사이트가 캡처된 지역 변수 대신
`sessionRef.current`를 읽는지)은 401 재현과 무관하게 이 파일의 다른 트리거(재전송·새 대화·soft-fail)로
오늘 당장 검증 가능했다 — 유예 범위가 실제 위험보다 좁게 설정됐다. 신규 추출 함수
`applyRefreshedToken`은 간접적으로는 검증되지만 이 파일의 함수별 unit test 관례에서 벗어나 있다.

## 위험도

MEDIUM
