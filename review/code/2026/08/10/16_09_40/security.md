# 보안(Security) Review

대상: `codebase/channel-web-chat/src/widget/use-widget.ts`, `use-widget-eager-start.test.ts`,
`spec/7-channel-web-chat/3-auth-session.md` — 재로드 복원 시퀀스(§3.1)의 `404`/`401` REST 오류 분기 구현,
특히 `401` 낙관적 refresh 1회(§R4).

### 발견사항

- **[CRITICAL]** `401` 낙관적 refresh 성공 후, 곧이어 SSE 를 여는 `openStream()` 호출이 **새로 발급된 토큰이 아니라
  refresh 이전의 stale 로컬 변수**를 사용한다 — 새 세션 인증 표면이 실질적으로 무효화된다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:510-515` (갱신 성공 시 `sessionRef.current` 를
    `updated` 로 교체·`saveSession` 하지만, 이 함수 파라미터로 받은 `session` 자체는 옛 토큰을 가진 채 그대로 남음),
    호출부 `use-widget.ts:602-611`(`start()` — `const session = persist(cfg, res); … openStream(session, "0")`)
    및 `use-widget.ts:945-961`(`applyConfig()` — `const saved = loadSession(...); … openStream(saved, "0")`).
  - 상세: `seedWaitingFromStatus` 는 `getStatus` 가 `401` 을 반환하면 `client.refreshToken(session.endpoints,
    session.token)` 로 갱신을 시도하고, 성공 시 `const updated = { ...session, token, expiresAt };
    sessionRef.current = updated; saveSession(cfg.triggerEndpointPath, updated);` 로 **`sessionRef.current` 와
    storage 는 올바르게 새 토큰으로 교체**한다. 그런데 함수는 `"continue"` 만 반환할 뿐 갱신된 세션 객체를
    호출부에 돌려주지 않는다. 호출부(`start()`의 `session`, `applyConfig()`의 `saved`)는 `seedWaitingFromStatus`
    호출 **이전에 캡처한 지역 변수**를 그대로 `openStream(session/saved, "0")` 에 넘기므로, 이 지역 변수는
    여전히 **방금 401 을 유발한(이미 무효화된) 옛 토큰**을 갖고 있다. `client.openStream()` 은 이 파라미터의
    `.token` 을 그대로 SSE URL 쿼리(`?token=`)에 실어 연결을 연다(`eia-client.ts` `openStream`).
    결과적으로 "복구 성공"(§R4)이라고 판정한 직후 열리는 실제 스트림은 **여전히 무효 토큰**으로 열려, 서버가
    거부하면 위젯은 `streaming` 화면에 무기한 고착되거나(이 PR 이 다른 분기에서 명시적으로 막으려던 바로 그
    증상 — "존재하지 않는/무효화된 자원에 스트림을 여는" 패턴) 혹은 SSE 가 자동 재연결한다고 코드 스스로 가정하는
    대로(`openStream` 의 `onError` 주석: "EventSource 는 자동 재연결하므로 흐름은 유지하되…", `use-widget.ts:354-355`)
    **이미 폐기된 토큰으로 무한히 재연결을 시도**할 수 있다 — 이번 리뷰에서 특히 확인하라고 지시된 "무한 재시도"
    실패 모드가, fetch 재시도가 아니라 SSE 계층에서 재현된다. `scheduleRefresh()` 는 호출 시점에
    `sessionRef.current` 를 다시 읽으므로 이 문제에서 자유롭지만(`use-token-refresh.ts:75,81`), `openStream()`
    은 파라미터로 받은 stale 객체를 쓰므로 영향을 받는다.
  - 제안: `seedWaitingFromStatus` 가 `"continue"` 를 반환한 뒤 호출부는 `sessionRef.current` 를 다시 읽어
    `openStream`/`scheduleRefresh` 에 넘겨야 한다(예: `openStream(sessionRef.current, "0")` 또는
    `seedWaitingFromStatus` 가 최신 세션 객체를 함께 반환). 401→refresh 성공 경로를 SSE 오픈까지 포함해
    e2e-lite 로 재현하는 회귀 테스트도 함께 추가할 것(아래 WARNING 참고).

- **[WARNING]** 위 CRITICAL 을 잡을 수 있는 새 테스트가 실제로는 **토큰 불일치를 검증하지 못하는 이중 함정**에
  걸려 있어 회귀 방지력이 없다(false confidence).
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:280-315`
    ("§R4: 재로드 getStatus 가 401 → 낙관적 refresh 1회 성공 시 복원(SSE 오픈)"), 헬퍼는
    `use-widget-eager-start.test.ts:87-99`(`installControllableEventSource`).
  - 상세: 테스트는 `getEs()).not.toBeNull()` 로 "EventSource 가 생성됐는가"만 확인하고, `sessionStorage` 에
    `"iext_fresh"` 문자열이 포함됐는지만 별도로 확인한다. 그러나 `installControllableEventSource` 의 stub
    `EventSource` 클래스 `constructor()`(라인 91-95)는 전달된 `url` 인자를 전혀 저장하지 않는다 — 즉
    "어떤 토큰으로 스트림이 열렸는가"를 이 테스트가 원리적으로 관측할 수 없다. 그래서 위 CRITICAL(구 토큰으로
    `openStream` 호출)이 있어도 이 테스트는 여전히 통과한다(실제로 diff 상의 세 신규 401 테스트 모두 GREEN).
    같은 파일의 다른 테스트("race fix: openStream 을 lastEventId=0 으로 열어…", 라인 981-1000)는 `esUrl` 캡처
    stub 을 별도로 만들어 URL 을 검증하는 패턴을 이미 갖고 있어 재사용 가능하다.
  - 제안: `installControllableEventSource` 를 확장하거나(생성자에서 `url` 저장 후 `getEs()` 반환 객체에 노출)
    별도 stub 을 써서, 401→refresh 성공 테스트에 `expect(esUrl/lastUrl).toContain("token=iext_fresh")` 류
    단언을 추가해 CRITICAL 을 실제로 가둘 것.

- **[INFO]** `refresh-token` 요청 자체는 만료/블랙리스트 여부와 무관하게 **정확히 1회**로 제한돼 있고
  (`use-widget.ts:499-522`, 실패 시 재시도 없이 즉시 `finalizeEnded("execution.token_revoked")`), 3건의 신규
  테스트(`use-widget-eager-start.test.ts:280,317,349`)가 각각 "성공 1회 복원", "실패 1회 종료 확정(무한 재시도
  방지)", "그 외 오류는 soft-fail(500 이 종료로 오판되지 않음)" 을 개별 분기로 고정하고 있다. fetch 계층에서의
  낙관적 refresh 자체는 무한 루프로 번질 수 없음을 확인했다 — 위 CRITICAL 은 그 이후(SSE 오픈) 단계의 별도 결함이다.

- **[INFO]** 새 토큰의 저장 경로 자체(`saveSession(cfg.triggerEndpointPath, updated)`, `use-widget.ts:512`)는
  기존 `apiBase`/`endpoints`/`executionId` 를 `{ ...session, token, expiresAt }` 로 보존한 채 `token`/`expiresAt`
  만 교체하므로, `session-store.ts` 의 발급-origin 바인딩(§R8, `apiBase` 불일치 시 폐기) 불변식을 깨지 않는다.
  저장소는 기존과 동일하게 `sessionStorage`(탭 종료 시 소거, §R6)이고 `localStorage` 로 격하되지 않았다 — 새로운
  노출 표면 없음. 에러 처리 경로(`404`/`401`/refresh 실패)에서 host 로 보내는 `reason` 문자열(`execution.not_found`,
  `execution.token_revoked`)도 서버 원문·토큰 값을 담지 않는다(§4-security §5, W1 관례와 일치).

- **[INFO]** `refreshToken` 은 (기존 `eia-client.ts`, 이번 diff 로 변경되지 않음) 만료됐을 옛 `session.token` 을
  `Authorization: Bearer` 로 실어 갱신을 요청한다 — EIA §8.3(jti blacklist)·§R4 설계와 일치하며 이번 diff 가
  새로 만든 표면이 아니다. SSE 토큰이 URL 쿼리(`?token=`)로 전달되는 것도 EventSource 헤더 미지원에 따른 기존
  설계로, 이번 diff 로 새로 도입된 노출 표면이 아니다(`3-auth-session.md` §R6/§8.3 문서화됨).

### 요약

이번 diff 의 핵심은 spec §R4 가 정한 재로드 `401` 낙관적 refresh 를 구현하는 것이다. **refresh 자체의 재시도
횟수는 정확히 1회로 안전하게 제한**돼 있고 저장소 경로(`sessionStorage`, origin 바인딩, 에러 메시지 일반화)에
새로운 노출 표면은 없다. 그러나 refresh 성공 직후 SSE 를 여는 호출부가 **새로 갱신된 토큰이 아니라 갱신 이전의
지역 변수(stale token)를 그대로 사용**하는 결함이 `start()`·`applyConfig()` 양쪽에 존재한다 — 이는 이번에 새로
추가된 "낙관적 refresh 로 세션을 복구한다"는 보안·세션 관리 기능 자체를 사실상 무력화하며, 코드가 스스로 문서화한
"EventSource 는 자동 재연결한다"는 가정 하에서는 이미 폐기된 토큰으로 무한 재연결을 시도하는 경로로 이어질 수
있다. 더 나쁜 것은, 이를 검증하도록 새로 작성된 테스트가 `EventSource` stub 이 URL(토큰)을 전혀 캡처하지 않는
탓에 이 결함을 통과시키고 있어 회귀 방지력이 없다는 점이다. 두 지점(`openStream` 호출부 3곳 상당 — 실제로는
`start()`/`applyConfig()` 2곳) 모두 `sessionRef.current` 를 다시 읽도록 고치고, 최소 한 개의 회귀 테스트가
실제 오픈된 스트림 URL 의 토큰을 단언하도록 보강해야 이 기능이 spec §R4 대로 동작한다고 신뢰할 수 있다.

### 위험도

HIGH
