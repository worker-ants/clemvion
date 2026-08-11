# Security Review — `18_23_54`

대상: 웹채팅 위젯 재로드 REST 오류 분기 후속 3종 — (a) `resumeDeferredStream` 플래그 클리어를
`openStream` 뒤로 이동, (b) `onRefreshed` try/catch 격리, (c) 내부/공개 스케줄러 분리(`scheduleWithDelay`
vs `scheduleRefresh`), (d) 테스트·문서.

## 발견사항

- **[WARNING]** `onRefreshed` 소비자 예외를 삼키는 catch 가 **토큰이 이미 URL 에 박힌 뒤에 발생한
  동기 예외의 원문 메시지**를 그대로 `console.warn` 에 전달한다 — 방어가 "가장 흔한 throw 지점"만
  덮고 "토큰이 붙은 뒤의 throw 지점"은 비워 둔 형태다.
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts:166-173` (catch 블록),
    `codebase/channel-web-chat/src/lib/eia-client.ts:130-133` (`openStream` — `url.searchParams.set("token", token)` 이
    `esFactory(url.toString())` **호출보다 먼저** 실행돼, 이 시점 이후의 모든 동기 throw 는
    토큰이 이미 담긴 URL 문자열을 들고 있다), `codebase/channel-web-chat/src/widget/use-widget.ts:452-477`
    (`openStream` 래퍼 — `client.openStream(...)` 호출을 try/catch 로 감싸지 않음),
    `codebase/channel-web-chat/src/widget/use-widget.ts:742-761` (`resumeDeferredStreamRef.current` —
    `openStream(session, "0")` 호출도 무방비).
  - 상세: 호출 경로는 `useTokenRefresh` 의 `.then()` 성공 콜백(`use-token-refresh.ts:145-174`) →
    `onRefreshedRef.current?.(updated)`(166행) → `useWidget` 이 넘긴 `onRefreshed: (session) =>
    resumeDeferredStreamRef.current?.(session)`(`use-widget.ts:276`) → `resumeDeferredStreamRef.current`
    의 `openStream(session, "0")`(`use-widget.ts:758`) → `client.openStream(session.endpoints,
    session.token, ...)`(`use-widget.ts:459`, eia-client.ts 의 `EiaClient#openStream`). `eia-client.ts`
    의 `openStream` 은 `new URL(...)` 로 base URL 을 만든 **다음** `url.searchParams.set("token",
    token)` 으로 토큰을 쿼리스트링에 박고, 그 뒤에야 `this.esFactory(url.toString())`(= 실사용시
    `new EventSource(url)`)를 호출한다(130-133행). 즉:
    - `new URL(...)` 이 던지는 경우(손상된 `apiBase`/`endpoints.stream` 조합) → 토큰이 아직 안 붙은
      단계라 메시지에 토큰이 없다. 이 PR 의 테스트가 검증하는 것도 이 경로다.
    - **`esFactory`(`new EventSource(url)`) 가 던지는 경우 → 그 시점엔 이미 `url` 에 `?token=...` 이
      박혀 있다.** 브라우저 구현에 따라 `EventSource` 생성자 예외는 대상 URL을 메시지에 포함하는
      사례가 있고(예: "Cannot open an EventSource to '<url>'..."), 그 문자열이 실질적으로 새 토큰을
      실어 나른다. 이 경로는 `new URL()` 통과 이후이므로 URL 자체는 문법적으로 유효해 실제
      Chrome/Firefox 네이티브 `EventSource` 가 여기서 동기 throw 할 확률은 낮지만, 코드가 이 사실에
      **의존한다는 방어를 어디에도 명시하지 않았고** 어떤 계층에서도 redact 하지 않는다 — DI 가능한
      `eventSourceFactory`(`EiaClientDeps.eventSourceFactory`)를 통해 대체 구현이 주입되거나
      polyfill/확장이 개입하는 경우 이 가정은 깨진다.
    - 이 정확한 지점(esFactory 가 토큰이 붙은 뒤에 던짐)을 팀이 이미 **현실적인 분기로 다루고
      있다는 증거**가 있다 — `use-widget-eager-start.test.ts:99-109` 의 mock `EventSource` 생성자는
      `latestUrl = String(url)`(토큰 포함 URL 캡처) **다음에** `throwOnce` 가 서 있으면
      `throw new TypeError("malformed stream URL")` 한다. 그런데 이 합성 예외의 메시지는 `url` 을
      전혀 참조하지 않는 **고정 문자열**이라, 실제 브라우저 예외가 URL 을 포함하는지 여부를
      가려 버린다. 이 테스트(`§R4: 미뤄 둔 스트림 오픈이 던져도 다음 갱신이 다시 시도한다`,
      `use-widget-eager-start.test.ts:626-669`)도, `use-token-refresh.test.ts`의 `onRefreshed` 관련
      테스트들도 **`console.warn` 호출 인자를 단언하지 않는다**(두 파일 모두 `console.warn`/`spyOn`
      에 대한 grep 결과 이 케이스에 관련된 단언 없음) — 그래서 "토큰이 새지 않는다" 를 검증하는
      회귀가 존재하지 않는다.
  - 제안: (1) `eia-client.ts` 의 `EiaClient#openStream` 안에서 `esFactory(url.toString())` 호출을
    자체 try/catch 로 감싸고, 실패 시 URL 을 담지 않는 새 에러(예: `new EiaError("SSE 연결 실패",
    undefined)`)로 재던지거나, (2) 최소한 `use-token-refresh.ts:169-171`(그리고 대칭적으로
    `use-widget.ts` 의 다른 `notifyErr`/`refreshErr` 로깅 지점들)에서 로그 직전에 URL 형태 문자열의
    쿼리스트링을 스트립하는 공용 redaction 헬퍼를 통과시킬 것. (3) 위 `throwOnce` 테스트를
    `console.warn` spy 로 확장해 로그된 문자열에 `token`/`iext_` 접두 값이 포함되지 않음을 명시
    단언으로 고정할 것 — 지금은 합성 에러 메시지가 우연히 안전해서 회귀가 생겨도 못 잡는다.

- **[INFO]** (a) `resumeDeferredStreamRef` 의 "미뤄 둔 스트림" 플래그를 `openStream` **호출 뒤에**
  지우도록 바꾼 것 자체는, 종료된 세션이 백그라운드에서 계속 스트림을 열려 시도하는 새 경로를
  만들지 않는다 — 확인함.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:742-761` (플래그 클리어 위치),
    `codebase/channel-web-chat/src/widget/use-widget.ts:341-349`(`teardownSession` 이
    `deferredStreamRef.current = false` 로 세계 교체 시 의사를 폐기),
    `codebase/channel-web-chat/src/widget/use-token-refresh.ts:150`(`.then()` 진입 시
    `worldGenRef.current !== gen` 이면 `onRefreshedRef` 호출 자체를 건너뜀).
  - 상세: 종료는 `finalizeEnded`(SSE terminal·REST 폴백 terminal·명령 `410`·사용자 종료 네
    진입점 전부)를 경유하고, `finalizeEnded` → `teardownSession()` 은 `worldGenRef.current++` 와
    함께 `deferredStreamRef.current = false` 를 명시적으로 세운다. 또한 서버측 설계상 per_execution
    토큰은 execution 종료 시 **즉시** jti blacklist 되므로(EIA §8.3, EIA-AU-04), SSE 가 한 번도
    안 열려 클라이언트가 종료를 아직 모르는 채로 `deferredStreamRef.current=true` 가 남아 있어도,
    다음 주기 `refreshToken` 시도는 서버에서 `401` 을 받아 `isTerminalAuthError`
    (`use-token-refresh.ts:183`)에 걸려 재시도가 멈춘다 — `onRefreshed`/`openStream` 에 도달하지
    않는다. 남는 잔여 리스크는 순수 liveness 성격이다: 종료와 무관하게 `openStream` 이 매번
    동기 throw 하는(예: 손상된 로컬 세션 데이터) 경우 플래그가 계속 `true` 로 남아 매 갱신 주기마다
    재시도하는데, 이는 코드 스스로 `use-widget.ts:343-348` 주석에 "관측 가능한 회귀로 고정하지
    못했다" 며 알려진 트레이드오프로 남겨 둔 것이고 인증 우회나 정보 노출이 아니다.
  - 제안: 현 상태로 충분. 다만 위 WARNING 항목과 같은 지점(`resumeDeferredStreamRef.current` 내부의
    `openStream` 호출)이 예외를 던질 때 로그되는 메시지에 토큰이 남지 않도록 고치면 이 INFO 의
    잔여 리스크(무한 재시도)도 자연히 조용해진다(에러 원인이 로그에 안전하게 남아 진단이 쉬워짐).

## 요약

이번 delta 는 자기 완결적이고 이전 라운드들이 반복해 지적한 "가드를 한쪽에만 적용" 패턴을
`isTerminalAuthError`/`applyRefreshedToken`/`shouldAbortAfterSeed` 공유 헬퍼로 잘 닫았다. 인증·인가
축(만료 vs blacklist 판별 불가 전제, world-세대 가드, origin 바인딩)은 기존 설계를 그대로 유지하며
새 취약점을 만들지 않았고, (a) 의 플래그-클리어-순서 변경도 종료 세션이 스트림을 재개하는 경로를
새로 열지 않는다(서버측 즉시 blacklist + world-gen 가드가 이중으로 막는다). 다만 (b) 의 예외 격리는
"토큰이 URL 에 붙기 **전**에 던지는" 가장 흔한 시나리오만 안전하고, `esFactory`(`new EventSource`)가
토큰이 붙은 **뒤**에 던지는 시나리오는 어느 계층에서도 redact 되지 않은 채 `console.warn` 으로
그대로 흘러간다 — 이 정확한 분기를 팀이 이미 테스트(`throwOnce`)로 모델링해 두고도 로그 내용은
단언하지 않아, 회귀가 나도 못 잡는 사각지대다. 발생 확률은 낮지만(네이티브 `EventSource` 는 유효한
URL 에 대해 거의 동기 throw 하지 않음) bearer 토큰이 걸린 CWE-532 류 로그 노출이라 WARNING 으로
등재한다.

## 위험도

MEDIUM — 인증 우회·직접 인젝션 취약점은 없음. 조건부(비-네이티브 `EventSource`/드문 브라우저 예외
경로)이지만 실제 bearer 토큰이 콘솔 로그로 새는 구체적 경로가 코드·테스트 양쪽에서 확인돼 WARNING
1건을 등재했고, redaction 부재가 이유라 수정 비용은 낮다.

STATUS: OK
