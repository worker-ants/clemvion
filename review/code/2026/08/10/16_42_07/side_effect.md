# 부작용(Side Effect) Review

대상: `codebase/channel-web-chat/src/lib/session-store.ts`, `use-token-refresh.ts`, `use-widget.ts`,
`use-widget-eager-start.test.ts`, `CHANGELOG.md`, `spec/7-channel-web-chat/3-auth-session.md`,
`plan/in-progress/webchat-auth-session-status-reconcile.md` (+ 이전 라운드 review 산출물 커밋).
diff base `origin/main`, 현재 HEAD `de6a1b84b`.

오케스트레이터 요청 두 가지를 먼저 판정하고, 이번 라운드 자체 diff 에서 발견한 항목을 뒤에 붙인다.

## 요청 1 — "refresh 동시 발화 경합" plan 등재 처분이 충분한가

**판정: 절차상 충분. 다만 우선순위 상향을 권고.**

`plan/in-progress/webchat-auth-session-status-reconcile.md` §"refresh 동시 발화 경합"을 확인했다.
재현 메커니즘(주기 타이머 vs `execution.replay_unavailable` fire-and-forget 401 복구가 스트림이
열린 채 동시에 `refreshToken()`을 부를 수 있음), "실측하지 않았다"는 명시적 고백, 재현에 필요한
세 조건(폴백 발화·토큰 401·타이머 동시 발화)을 정확히 나열한 점, 처방이 설계 선택(3가지 대안,
실패 모드가 서로 다름)이라는 근거, 그리고 "두 라운드 연속 지적됐고 1라운드에서 내가 흘렸다"는
투명한 이력까지 — 이 저장소가 반복해 배운 "재현 없이 고치면 무엇을 고쳤는지 모른다"는 원칙과
"review 산출물은 SoT 가 아니므로 plan 에 등재해야 한다"는 원칙 둘 다 충족한다.

다만 side-effect 관점에서 보면 이 경합이 실제로 발화했을 때의 파급은 가볍지 않다 — **정상적으로
살아있는 세션이 `finalizeEnded("execution.token_revoked")`로 영구 오종료**된다(호스트에
`conversationEnded`까지 통지된다). 재현되지 않았다는 사실이 "안전하다"를 뜻하지 않고, 발생 시
사용자가 관측 가능한 파괴적 부작용이라는 점에서 다른 두 미확인 항목(`start()` 401 도달 가능성,
catch 세대 재검사)보다 우선순위를 높게 잡을 것을 권고한다. 처분 형식 자체는 재작업 불필요.

## 요청 2 — 종료 조건을 `401`/`410` 로 좁힌 것이 새 부작용을 만드는가

**판정: 그렇다 — "정상 세션을 잘못 끝낸다"는 이전 결함을 "이미 죽은 토큰으로 SSE 를 열어
좀비 상태로 방치한다"는 다른 결함으로 바꿨다.** 직전 버전(narrowing 이전, 모든 refresh 실패를
terminal 로 봄)은 과했지만 적어도 **깔끔하게** 끝냈다. 이번 narrowing 은 그 과잉을 고쳤지만,
그 결과 세션을 끝내지도 살리지도 못하는 새로운 미종결 상태가 생겼다 — 아래 CRITICAL 항목 참조.

## 발견사항

- **[CRITICAL]** 401 복구용 `refreshToken()` 이 `401`/`410` **외의** 사유로 실패하면, 서버가 이미
  거부한 것으로 확인된 토큰으로 **새** SSE 연결을 연다 — phase 는 "정상"으로 보이지만 이벤트가
  영원히 오지 않는 좀비 상태. PR 이 고치려던 "streaming 고착"과 동일 증상이 이 서브케이스에서
  재현된다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:485-493`(`recoverFromExpiredToken`
    catch 의 `if (!terminal) { ...; return "continue"; }`) → `use-widget.ts:687-689`(`start()`
    의 `const live = sessionRef.current; if (!live) return; openStream(live, "0");`) /
    `use-widget.ts:1037-1041`(`applyConfig()` 의 `const live = sessionRef.current ?? saved;
    openStream(live, "0");`). 재발화 지연 계산은
    `codebase/channel-web-chat/src/widget/use-token-refresh.ts:73-78`(`refreshDelayMs`).
  - 상세: `client.refreshToken(...)` 이 `EiaError(401|410)` 가 아닌 사유(네트워크 reject, 5xx,
    403, 429, timeout 등)로 실패하면 `terminal=false` → `console.warn` 후 `"continue"` 를
    반환한다. 이때 **`sessionRef.current` 는 갱신되지 않은 채 그대로**다 — 이 토큰은 방금
    `getStatus` 가 `401` 로 명시 거부한 바로 그 토큰이다. 그런데 호출부(`start()`/`applyConfig()`)
    는 `outcome === "continue"` 이면 무조건 `openStream(live, "0")` 을 실행한다 — **처음 여는
    연결**이다(reload 복원 경로라 아직 SSE 가 열려 있지 않았다). 결과: 서버가 이미 거부 확인한
    토큰으로 새 EventSource 를 연다. `openStream` 의 `onError` 핸들러(`use-widget.ts:359-363`)는
    `console.warn` 만 하고 아무 상태 전이도 하지 않으며, 브라우저 `EventSource` 는 URL 을 바꾸지
    않고 무한 자동 재연결하므로 이 상태는 스스로 회복되지 않는다.
    - **자기치유 경로의 상한이 넓다.** `openStream` 직후 호출되는 `scheduleRefresh()`
      (`use-token-refresh.ts`)는 다음 refresh 시도를 `session.expiresAt` 기준으로 예약한다
      (`refreshDelayMs = max(5s, expiryMs - now - 30min)`). 이 diff 자신이 추가한 테스트
      (`use-widget-eager-start.test.ts:418-446`, 아래)의 fixture 그대로 `expiresAt` 을 "지금부터
      90분 뒤"로 두면 다음 refresh 재시도는 **60분 뒤**로 예약된다 — 그 사이 위젯은 겉보기엔
      정상인 "streaming" 상태로 아무 응답도 못 받는다.
    - **더 나쁜 경우: 토큰이 실제로 revoke(blacklist) 된 경우.** 60분 뒤 재시도하는 쪽은
      `use-token-refresh.ts` 의 **자체** catch(`:100-103`)인데, 이쪽은 상태코드와 무관하게
      항상 `console.warn` 만 하고 세션을 절대 끝내지 않는다(주석 "SSE 는 hard expiry 까지
      유지"). 즉 진짜로 죽은 토큰이라면 이 경로는 **다시는 세션을 끝내지 않는다** — 유일한
      탈출구는 사용자가 메시지를 보내 `sendCommand` 가 `ERROR`(⚠ `ended` 아님)를 그리거나,
      페이지를 새로고침해 이 reload 흐름을 재진입하는 것뿐이다.
    - 비교: **narrowing 이전 버전**(모든 refresh 실패를 terminal 로 처리)은 이 케이스에서
      `finalizeEnded` 로 세션을 (부당하지만) **깔끔하게** 끝냈다. narrowing **이후**인 이번 diff
      는 그 부당 종료는 없앴지만, 대신 "끝나지도 살지도 않는" 좀비 상태를 **새로** 만든다 —
      오케스트레이터가 물은 "새 부작용" 에 해당한다.
    - narrowing 자체(§R4 문언 `401`/`410` 로 한정)는 spec·CHANGELOG 원칙과 정확히 일치하고
      옳은 방향이다 — 문제는 그 non-terminal 분기가 세션을 "살아있는 것처럼" 취급해 곧바로
      `openStream` 까지 진행한다는 점이지, 상태코드 한정 자체가 아니다.
  - 재현: 코드 경로 직접 추적으로 확인(실행 프로파일링은 하지 않음). 신규 테스트
    `use-widget-eager-start.test.ts:418-446`("§R4: refresh 가 **네트워크 오류**로 실패하면
    종료로 확정하지 않는다")가 정확히 이 조건(getStatus 401 + refresh TypeError + expiresAt
    +90분)을 실행하면서도 `expect(getEs()).not.toBeNull()` / `phase !== "ended"` /
    `storage 보존` 만 단언한다 — **`getUrl()` 을 단언하지 않는다.** 같은 파일의 401-성공
    테스트(`:318-330`)는 정확히 `getUrl()` 로 "옳은 토큰으로 열렸는가" 를 검증하는데, 이
    테스트는 그 짝을 빠뜨려 "SSE 가 열렸다(참)"만 보고 "어떤 토큰으로 열렸나(거부된 토큰)"는
    못 본다 — `16_09_40` CRITICAL 을 통과시켰던 바로 그 형태의 false confidence 다.
  - 제안: (a) 이 서브케이스에서는 `openStream` 을 바로 진행하지 말고, 이미 거부 확인된 토큰으로
    새 스트림을 여는 것 자체를 피하는 별도 outcome(예: `"pending-retry"`)을 두거나 최소한
    `scheduleRefresh` 의 다음 시도를 이 경로에서만 즉시(=`TOKEN_REFRESH_MIN_DELAY_MS`)로
    강제해 좀비 구간을 초 단위로 좁힐 것. (b) 즉시 고치기 어렵다면 최소한 테스트에
    `getUrl()`/`fake timer 로 재시도 지연` 단언을 추가해 이 구멍을 회귀로 고정하고,
    `plan/in-progress/webchat-auth-session-status-reconcile.md` 에 "refresh 동시 발화 경합"과
    나란히 항목으로 등재할 것 — 그렇지 않으면 이 지적도 `review/**` 에만 남아 사라진다
    (이 저장소가 이미 겪은 패턴).

- **[INFO]** `start()`/`applyConfig()` 가 "`sessionRef.current` 가 예상과 달리 비어있을 때"를
  다르게 처리한다 — 하나는 조기 return, 하나는 옛 캡처값으로 폴백
  - 위치: `use-widget.ts:687-689`(`start()`: `if (!live) return;`) vs `use-widget.ts:1037`
    (`applyConfig()`: `const live = sessionRef.current ?? saved;` — `saved` 는 seed 호출 이전에
    캡처한 지역 변수).
  - 상세: 두 호출부 모두 `isStale`/`isAttemptStale` 재검사를 통과한 뒤 이 지점에 도달하므로,
    현재 코드에서 `sessionRef.current` 가 null 인 채로 여기 닿는 경로는 실질적으로 없어 보인다
    (`resetSessionRefs` 가 null 화하는 유일한 지점이고, 그 경로는 항상 world gen 을 먼저
    올린다). 즉 지금은 도달 불가능한 방어 코드다. 그러나 두 처리가 다르다는 것 자체가
    함정이다 — 만약 향후 리팩터로 이 불변식(= "gen 안 바뀌었으면 sessionRef 는 반드시 채워져
    있다")이 깨지는 경로가 생기면, `start()` 는 안전하게 아무것도 안 하고 멈추는 반면
    `applyConfig()` 는 **바로 이 PR 이 고친 CRITICAL 패턴**(캡처해 둔 옛 `saved` 로 SSE 를
    여는 것)을 조용히 재현한다. 방어 코드의 두 형제가 서로 다른 안전망을 갖는 것은 "자매 함수
    미적용" 계열과 같은 형태의 위험이다.
  - 제안: `applyConfig()` 도 `start()` 와 동형으로 `if (!live) return;` 을 쓰거나, 정말
    `saved` 폴백이 필요하다면(예: 첫 진입 시 `sessionRef.current` 셋업 타이밍 차이) 그 이유를
    주석으로 명시해 의도적 비대칭임을 남길 것. 강제 아님(현재 도달 불가) — 다음에 이 함수를
    손볼 때 반영 권장.

- **[INFO]** 종료 사유 신규 문자열(`"execution.not_found"`, `"execution.token_revoked"`)이 host
  로 나가는 공개 이벤트 `conversationEnded.data.reason` 에 새 값을 추가하지만, 계약 위반 아님 —
  확인
  - 위치: `use-widget.ts:582`(`finalizeEnded("execution.not_found")`), `use-widget.ts:502`
    (`finalizeEnded("execution.token_revoked")`) — 두 값 모두 `bridgeRef.current?.sendEvent(
    "conversationEnded", { reason })`(`use-widget.ts:291`)를 거쳐 임베드 host 로 나간다.
  - 상세: `spec/7-channel-web-chat/2-sdk.md:119` 가 `reason` 을 "**열린 문자열**(닫힌 enum
    아님)... host 는 특정 값에 강결합하지 말고 '종료됨' 신호로만 소비한다" 로 명시적으로
    정의해 두었다. 새 reason 값 추가가 기존 host 통합을 깨지 않는다 — 이 checklist 의 "이벤트/
    콜백 변경" 관점에서 문제 없음.
  - 제안: 조치 불요(확인용).

- **[INFO]** `applyRefreshedToken` 신규 공개 함수(`session-store.ts`) — storage 부작용이
  이름/JSDoc 으로 명시돼 있고, 두 호출부 모두 호출 직전 자체 staleness 재검사를 유지한다 —
  확인
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:110-133`, 호출부
    `use-widget.ts:494-499`(`recoverFromExpiredToken` 성공 분기, `isStale(gen)`·
    `configRef.current` 존재 확인 뒤 호출), `use-token-refresh.ts:92-97`(`worldGenRef.current
    !== gen` 재검사 뒤 호출).
  - 상세: 함수 자체는 `{...session, ...refreshed}` 스프레드 후 `saveSession`(storage 쓰기) +
    반환뿐인 순수-근접 함수이고 JSDoc 이 "세대 검사는 호출부 책임" 이라고 명시해 부작용의
    소유권을 분명히 한다. 두 호출부 모두 실제로 헬퍼 호출 **직전**에 각자의 staleness 가드를
    거치므로, 공유 추출이 "검사를 빠뜨리기 쉽게" 만들지는 않았다. 새 전역 상태·환경변수·
    네트워크 호출 없음.
  - 제안: 없음(확인용).

## 요약

이번 diff 는 `3-auth-session.md §3.1-2/§R4` 가 정한 재로드 `404`/`401` REST 오류 분기를 구현하고,
직전 라운드 CRITICAL(성공 refresh 후 stale 토큰으로 SSE 재오픈)을 두 호출부 모두에서 올바르게
고쳤으며, 이전 라운드가 지적한 "네트워크 오류도 종료로 오판" 과잉을 `401`/`410` 로 좁혀 spec 문언과
정합시켰다. `applyRefreshedToken` 공유 추출은 세대 검사 책임을 흐리지 않고, 신규 종료 사유 문자열도
host 이벤트 계약(열린 문자열)을 위반하지 않는다. "refresh 동시 발화 경합" plan 등재는 절차상
충분하다(재현 시도·설계 대안 문서화·체크리스트 추적 모두 갖춤). 다만 이번에 새로 확인한 CRITICAL —
`401`/`410` 로 좁힌 non-terminal 분기가 "이미 거부 확인된 토큰으로 새 SSE 를 여는" 좀비 상태를
만들고, 그 경로를 정확히 실행하는 신규 테스트조차 `getUrl()` 을 단언하지 않아 이 구멍을 못 잡는다 —
가 남아 있다. 이는 narrowing 자체가 틀렸다기보다 narrowing 이 만든 "continue" 분기가 무조건
`openStream` 으로 이어지는 상위 호출부 로직과 충돌해서 생긴 결과다.

## 위험도

HIGH
