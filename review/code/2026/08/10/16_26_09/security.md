# 보안(Security) Review

대상: `CHANGELOG.md`, `codebase/channel-web-chat/src/lib/session-store.ts`,
`codebase/channel-web-chat/src/widget/use-token-refresh.ts`,
`codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`,
`codebase/channel-web-chat/src/widget/use-widget.ts`,
`plan/in-progress/webchat-auth-session-status-reconcile.md`,
`review/code/2026/08/10/16_09_40/**`(직전 라운드 산출물), `spec/7-channel-web-chat/3-auth-session.md`.

핵심 변경은 직전 라운드(`16_09_40`)에서 4명(security 포함) 독립 수렴으로 낸 CRITICAL —
"§R4 의 401 낙관적 refresh 성공 후 호출부가 갱신 전(=서버가 이미 거부한) 토큰으로 SSE 를
연다" — 에 대한 fix 다. 지시대로 "고쳤다"는 서술을 액면가로 받지 않고 실제 소스와 테스트
실행으로 직접 확인했다.

## 직전 CRITICAL 재검증 (액면가 아님 — 직접 확인)

**결론: 닫혔다.** 근거:

1. **소스 직독** — `codebase/channel-web-chat/src/widget/use-widget.ts` 를 직접 읽어 두
   호출부를 확인했다.
   - `start()`: `if (sessionEstablished()) return; const live = sessionRef.current; if (!live) return; openStream(live, "0");` — 캡처해 둔 `session` 지역 변수가 아니라 `sessionRef.current` 를 그 자리에서 재-read 한다.
   - `applyConfig()`: `if (sessionEstablished()) return; const live = sessionRef.current ?? saved; openStream(live, "0");` — 마찬가지로 `saved` 지역 변수 대신 ref 를 우선 사용한다.
   - `seedWaitingFromStatus` 의 401 분기(같은 파일, `catch` 블록)는 refresh 성공 시
     `sessionRef.current = applyRefreshedToken(session, { token, expiresAt }, cfg.triggerEndpointPath);`
     로 **ref 자체**를 갱신한 뒤 `"continue"` 를 반환한다. `openStream` 이 실제 SSE URL 을
     구성할 때 쓰는 필드(`client.openStream(session.endpoints, session.token, …)`, 344-363행)를
     대조하면, `live` 경로가 살아있는 한 갱신된 `token` 이 확실히 SSE 로 전달된다.
   - `await seedWaitingFromStatus(...)` 이후 `live` 를 읽기까지 사이에 다른 `await` 가 없다
     (동기 문장 연쇄) — 따라서 JS 단일 스레드 특성상 그 사이 다른 코드가 끼어들어
     `sessionRef.current` 를 다시 갈아치울 TOCTOU 창이 없다. staleness 재검사
     (`isStale(gen)`, `isAttemptStale(attempt)`, `sessionEstablished()`)는 모두 그
     "다음 await 지점"(refresh 왕복) 뒤에 정확히 위치해 있다.
2. **테스트 실측** — 이전 라운드가 지적한 "테스트가 토큰 불일치를 못 잡는다"는 WARNING 도
   같은 커밋에서 닫혔다. `installControllableEventSource` 의 stub `EventSource` 생성자가
   이제 `constructor(url: string) { latestUrl = String(url); … }` 로 URL 을 포획하고
   `getUrl()` 로 노출한다. 신규 회귀
   `"§R4: 재로드 getStatus 가 401 → 낙관적 refresh 1회 성공 시 복원(SSE 오픈)"` 은
   `expect(getUrl()).toContain("iext_fresh"); expect(getUrl()).not.toContain("iext_stale");`
   로 **정확히 이 CRITICAL 이 재발하면 실패하는 형태**의 단언을 갖는다(파일:
   `use-widget-eager-start.test.ts:318-330`, 직접 grep 으로 존재 확인).
3. **실행 확인** — `npx vitest run src/widget/use-widget-eager-start.test.ts` 를 직접
   실행해 67개 테스트 전부 통과(구 토큰 미포함 단언 포함)를 확인했다. 액면가 신뢰가 아니라
   실측이다.
4. **세대(worldGen) 재검사 사각지대**(WARNING #3, 직전 라운드)도 회귀
   `"§R4: refresh 왕복 중 세계가 바뀌면 새 토큰을 옛 세션에 쓰지 않는다"` 로 커버되고 있음을
   테스트 파일에서 직접 확인했다 — refresh 응답을 붙잡아 두고 그 창에서
   `endConversation()` 을 호출한 뒤 놓아주는 형태로, `applyRefreshedToken` 이 실행되기
   전에 `isStale(gen)` 가 `"stale"` 을 반환해 storage 부활·구 세션 SSE 오픈을 막는지
   실측한다.

## 발견사항

- **[INFO]** `start()` 경로의 401 재로드 분기는 코드상 `applyConfig()` 와 동일하게
  `sessionRef.current` 를 읽도록 수정돼 있으나, 그 경로 전용 회귀 테스트는 아직 없다
  (SSE 가 열리지 않아 실패해 제거됨).
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `start()` 함수(625-632행 부근,
    "`sessionRef.current` 를 쓴다" 주석 블록) / `plan/in-progress/webchat-auth-session-status-reconcile.md`
    "함께 남은 미확인 갭" 절.
  - 상세: 뮤테이션 실측(`RESOLUTION.md`)으로 "`applyConfig` 만 되돌리면 RED, `start()` 만
    되돌리면 초록"임을 이미 스스로 확인해 갭으로 정직하게 남겨 두었다. 코드 리뷰 관점에서는
    **수정 자체는 대칭적으로 적용됐고**(두 호출부 모두 `sessionRef.current` 사용), 남은 것은
    "신규 대화 직후 `getStatus` 가 `401` 을 실제로 낼 수 있는가"라는 도달 가능성 검증과
    그에 따른 회귀 커버리지 공백이다 — 코드 자체에 알려진 보안 결함이 남아있다는 뜻은 아니다.
  - 제안: plan 에 이미 등재된 대로 도달 가능성 확인 후 회귀 추가(가능) 또는 방어 코드로
    주석 고정(불가능)을 진행할 것. 보안 관점에서 차단 사유는 아님.

- **[INFO]** SSE 인증 토큰은 여전히 URL 쿼리 파라미터(`?token=`)로 전달된다(이번 diff 로
  새로 생긴 표면 아님, `EventSource` 가 커스텀 헤더를 지원하지 않는 데 따른 기존 설계).
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:344-363`(`openStream`).
  - 상세: URL 에 실린 토큰은 브라우저 히스토리·서버 접근 로그·리퍼러 헤더로 유출될 수 있는
    일반적 위험이 있으나, `spec/7-channel-web-chat/3-auth-session.md` §R6/§8.3 에 문서화된
    기존 설계이고 이번 diff 가 그 표면을 넓히지 않았다(오히려 401 재발급 시 즉시 옛 토큰을
    무효한 채로 두지 않고 새 토큰으로 교체해 노출 창을 줄인다). 신규 지적 아님 — 기록용.

- **[INFO]** 새로 추가된 `applyRefreshedToken`(session-store.ts)은 `{ ...session, ...refreshed }`
  스프레드로 `token`/`expiresAt` 만 교체하고 `apiBase`/`endpoints`/`executionId` 는 보존한다.
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:125-133`.
  - 상세: `refreshed` 파라미터 타입이 `{ token: string; expiresAt: string }` 로 좁게 고정돼
    있어 다른 필드를 실수로 덮어쓸 표면이 타입 레벨에서 차단된다. `loadSession` 의 발급-origin
    바인딩(§R8, `apiBase` 불일치 시 폐기) 불변식도 이 함수로 인해 깨지지 않는다 — `apiBase` 는
    이 스프레드에서 손대지 않는다.

- **[INFO]** 에러 처리 시 host 로 전달되는 reason 문자열(`execution.not_found`,
  `execution.token_revoked`)과 `console.warn` 로그(`err.message`)는 토큰·서버 원문을
  담지 않는다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:502`, `:533`, `:538-541`.
  - 상세: 새로 추가된 404/401 분기 모두 고정 문자열 reason 만 전달하며, `EiaError` 자체나
    `refreshToken`/`getStatus` 응답 바디를 그대로 로그하거나 host 로 전파하지 않는다.

## 요약

지시받은 핵심 확인 항목 — "refresh 성공 후 호출부가 갱신 전 토큰으로 SSE 를 여는" 이전
라운드 CRITICAL — 은 실제 소스 직독(두 호출부 모두 `sessionRef.current`/`live` 를 읽음,
그 사이 await 없음)과 테스트 실행(67 passed, URL 캡처 헬퍼로 `iext_fresh` 포함·
`iext_stale` 미포함을 실제로 단언)으로 **닫혔음을 직접 확인**했다. 세대(worldGen) 재검사
사각지대 WARNING 도 별도 회귀로 커버됨을 확인했다. `applyRefreshedToken` 추출은 토큰 반영
범위를 타입으로 좁혀 새로운 노출 표면을 만들지 않았고, SSE 토큰의 URL 쿼리 전달은 기존
설계를 그대로 유지한다(이번 diff 로 확대되지 않음). 유일한 잔여 사항은 `start()` 경로의
401 분기가 코드상 동일하게 고쳐졌음에도 전용 회귀 테스트가 없다는 점인데, 이는 이미
`plan/in-progress/webchat-auth-session-status-reconcile.md` 에 갭으로 정직하게 등재돼
있고 코드 자체의 결함이 아니라 커버리지 공백이므로 INFO 로만 남긴다. 이번 diff 에서 새로
발견된 CRITICAL/WARNING 급 보안 결함은 없다.

## 위험도

LOW
