# Security Review — 18_51_07

대상: `redactToken`(`codebase/channel-web-chat/src/lib/eia-client.ts`) 도입이 이전 라운드(`18_23_54`)
WARNING("SSE 재연결 실패 시 `console.warn`이 토큰을 실은 URL을 그대로 찍는다")을 실제로 얼마나 넓게
막았는지 판정. 결론: **한 곳에만 적용됐고, 같은 함수(`openStream`)를 호출하는 다른 두 진입점과
이벤트 객체 경유 경로는 여전히 무방비다.** 이 브랜치가 반복해 낸 "방어를 한 칸 좁게 잡는다" 패턴의
재발.

## 발견사항

- **[CRITICAL]** `openStream()`의 EventSource 생성 실패(토큰이 이미 쿼리에 실린 뒤 발생)가 `start()`
  경로를 통해 **`redactToken` 없이** 콘솔에 출력된다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `openStream` 정의(452-477행,
    특히 459행 `client.openStream(...)`), `start()`의 호출 지점 849행 → `catch (e)` 854행 →
    `errMessage(e)` 860행 → `errMessage` 정의 1297-1301행(1299행 `console.warn("[widget]
    conversation error:", ...)`, redact 미적용).
  - 상세: `eia-client.ts`(121-153행)의 `openStream`은 130행 `new URL(...)` 다음 131행에서
    `url.searchParams.set("token", token)`으로 토큰을 쿼리에 붙인 **뒤** 133행
    `this.esFactory(url.toString())`(기본 팩토리는 `new EventSource(url)`)를 호출한다. 브라우저의
    `EventSource` 생성자는 URL이 유효하지 않으면 `Failed to construct 'EventSource': ...`
    형태로 **URL 전체(토큰 포함)를 메시지에 담아 동기 throw**한다 — 정확히
    `eia-client.test.ts`의 새 `redactToken` 테스트가 재현하는 그 문자열 형태다. `use-widget.ts`
    757행 자신의 주석("`openStream` 이 동기 throw 할 때(손상된 `endpoints.stream`/`apiBase`
    조합에 …)")이 이 경로가 이미 인지된 실측 가능 시나리오임을 확인해 준다. 이 throw는
    `start()`의 `try` 블록(801행) 안에서 발생하므로 854행 `catch`로 잡히고, `errMessage()`가
    `redactToken`을 호출하지 않은 채 `console.warn`으로 원문을 그대로 찍는다. `redactToken`이
    실제로 적용된 유일한 지점(`use-token-refresh.ts` 172-175행, `onRefreshed` 콜백 예외)과
    **완전히 동일한 위협**(토큰 실린 URL이 EventSource 생성 실패로 예외 메시지에 노출)인데,
    이쪽은 무방비다.
  - 제안: `errMessage()` 내부(또는 최소한 `start()`의 `catch`)에서
    `redactToken(e instanceof Error ? e.message : String(e))`를 적용한다. `redactToken`을
    `eia-client.ts`의 예외 발생 지점 자체(예: `openStream` 내부에서 catch 후 redact된 메시지로
    다시 throw)로 옮기면 호출부마다 반복 적용할 필요 없이 구조적으로 막힌다.

- **[CRITICAL]** `applyConfig()`는 `openStream()` 호출을 `try/catch`로 감싸지 않아, 같은 실패가
  **unhandled promise rejection**이 되어 애플리케이션 코드가 전혀 개입할 수 없는 브라우저 기본
  콘솔 출력으로 토큰이 노출된다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `applyConfig` 정의
    1141-1217행(비-`try` 블록 전체), `openStream` 호출 1212행, 호출부 `void applyConfig(...)`
    1222행·1258행.
  - 상세: `use-widget.ts` 전체에서 `try {`가 나타나는 줄은 38·165·504·655·801·870·1061행뿐이며
    (grep 확인), `applyConfig`(1141-1217행) 본문 어디에도 `try`가 없다. 위와 같은 이유로
    `openStream(live, "0")`(1212행)이 동기 throw하면 `applyConfig`가 반환한 Promise가 reject되고,
    이는 `void applyConfig(...)`로 호출돼(1222·1258행) 아무도 `.catch`하지 않는다 →
    `window.onunhandledrejection`의 브라우저 기본 처리(콘솔에 "Uncaught (in promise) TypeError:
    Failed to construct 'EventSource': https://.../stream?token=...")로 직행한다. 코드베이스
    전체에 `unhandledrejection`/`window.onerror` 핸들러가 없음을 확인했다(grep 0건) — 즉
    `redactToken`을 어디에 추가하든 **이 경로는 애초에 애플리케이션 코드를 거치지 않으므로 현재
    설계로는 막을 수 없는 구조적 갭**이다.
  - 제안: `applyConfig` 본문 전체 또는 최소한 `openStream` 호출 지점을 `try/catch`로 감싸
    `redactToken`을 적용한 후 재-throw하거나 무시한다. 근본적으로는 `openStream`(use-widget.ts)이
    스스로 내부 `try/catch`를 갖고 실패 시 redact된 로그만 남기고 `StreamClaim`의 실패 variant(예:
    `"open_failed"`)를 반환하도록 만들면 호출부(3곳)가 각자 감쌀 필요가 없어진다 — 이 파일이
    `openStream` 안에 "이미 소유 중" 게이트를 넣어 복제를 없앤 것과 같은 패턴.

- **[WARNING]** SSE `error` 리스너가 원본 `Event` 객체를 그대로 `console.warn`에 넘겨, **문자열
  정규식 기반 `redactToken`으로는 원천적으로 방어할 수 없는** 토큰 노출 경로가 남아 있다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` 466-470행 —
    `onError: (e) => console.warn("[widget] SSE stream error — ...", e)` (`openStream` useCallback
    내부, 452-477행).
  - 상세: `e`는 `eia-client.ts` 149-150행에서 `es.addEventListener("error", (e) =>
    handlers.onError!(e))`로 그대로 전달된 네이티브 `Event`이고, `e.target`(WHATWG 표준상
    `EventSource` 인스턴스)은 `.url` getter로 **연결에 실제 사용된 전체 URL(토큰 포함)을
    노출**한다. `console.warn(msg, e)`는 `e`를 문자열로 직렬화하지 않고 **살아있는 객체 참조**로
    콘솔에 넘기므로, 호스트 페이지 스크립트가 `console.warn`을 감싸/후킹하거나(이 위젯이 호스트
    페이지와 같은 콘솔을 공유한다는 전제는 `redactToken`의 자체 JSDoc, `eia-client.ts` 187-189행이
    이미 명시) devtools에서 인자를 펼쳐 보면 `e.target.url` 로 토큰이 그대로 드러난다.
    `redactToken(text: string)`은 문자열 인자에만 작동하므로 이 지점은 애초에 `redactToken`을
    붙여도 고쳐지지 않는 **범주가 다른** 취약점이다.
  - 제안: 원본 `e`를 그대로 넘기지 말고 `e.type`처럼 안전한 필드만 추리거나,
    `redactToken(String((e as any)?.target?.url ?? ""))`처럼 URL을 명시적으로 뽑아 redact한 뒤
    문자열로만 로깅한다.

- **[WARNING]** 나머지 `console.warn` 지점들은 현재 EIA 클라이언트 설계상(Bearer 헤더 전달) 토큰이
  URL에 실리지 않아 직접적 유출은 아니지만, **하나도 `redactToken`을 방어적으로 적용하지 않아**
  "한쪽만 고친다" 패턴이 이 파일 전역에 반복돼 있다.
  - 위치: `use-widget.ts` 529-532행(`recoverFromExpiredToken` 비종단 실패 — `client.refreshToken`
    예외), 719-722행(`seedWaitingFromStatus` soft-fail — `client.getStatus` 예외), 1014-1017행
    (`newChat` cancel 명령 실패 — `client.interact` 예외), 1064-1067행(`endConversation` 명령
    실패 — `client.interact` 예외); `use-token-refresh.ts` 183행(`refreshToken` 자체 실패 —
    `.catch` 블록, 같은 파일 172-175행의 redact된 `console.warn`과 3줄 차이).
  - 상세: 이들 호출은 모두 `interact`/`getStatus`/`refreshToken`(Authorization 헤더 방식)의 예외를
    다루므로 **오늘은** URL에 토큰이 없어 안전하다. 그러나 `EiaError`의 메시지는 `상태
    조회 실패(${res.status})` 류로 짧지만, 브라우저/런타임에 따라 `fetch` 실패의 `TypeError`가
    요청 URL을 메시지에 포함하는 경우(특정 Node/undici 계열 폴리필)도 있어 **엔드포인트 형태가
    바뀌거나(예: 쿼리 토큰 방식 REST 엔드포인트 추가) 런타임이 바뀌면 조용히 재발**할 수 있다.
    `use-token-refresh.ts`는 정확히 두 개의 인접한 `console.warn`(172-175행 redact,
    183행 미redact)을 갖고 있어 "같은 파일 안에서도 한쪽만" 패턴이 그대로 재현됨을 보여준다.
  - 제안: 개별 호출부마다 판단하지 말고, 이 위젯의 모든 진단 `console.warn(msg, err)` 호출을
    통과시키는 공용 헬퍼(예: `logWidgetError(prefix, err)`가 내부에서 항상
    `redactToken(String(err.message ?? err))`를 거치도록)로 통일해 "토큰 URL을 만드는 함수를 호출한
    catch만 골라 redact"하는 현재의 결정 방식 자체를 없애는 것을 권한다.

- **[INFO]** 정규식 `/([?&]token=)[^&\s"']+/gi` 자체의 커버리지 평가.
  - 위치: `codebase/channel-web-chat/src/lib/eia-client.ts` 193-195행.
  - 상세: 현재 코드의 유일한 실제 생성 형태(`URLSearchParams.set("token", token)` →
    `?token=...` 또는 `&token=...`)에 한해서는 대소문자(`i` 플래그로 `Token=`까지 커버)와 중복
    파라미터(`g` 플래그로 여러 `token=` 발생 각각 치환)를 잘 덮는다. 다만 (1) `token`이 아닌
    다른 파라미터명(`access_token=` 등)이나 프래그먼트(`#`) 뒤에 붙는 토큰은 안 잡히고(현재
    코드베이스엔 그런 형태가 없어 지금은 사각지대가 아니지만, 위 WARNING처럼 확장되면 조용히
    재발), (2) 애초에 **문자열이 아닌 값**(위 CRITICAL 항목의 `Event` 객체, `Error` 객체 그대로
    로깅, `URL` 인스턴스 등)에는 정규식 실행 자체가 일어나지 않는다는 점이 더 근본적 갭이다 —
    "정규식이 URL 형태를 못 덮는다"기보다 "문자열화되지 않은 호출부에는 애초에 적용되지 않는다"가
    실제 리스크의 크기다.
  - 제안: 상시 반영 필수는 아니나, 파라미터명을 하드코딩 대신 상수(`TOKEN_QUERY_PARAM = "token"`)로
    빼 `openStream`의 `url.searchParams.set(...)` 호출과 짝을 맞추면 향후 이름이 바뀔 때 두 곳이
    같이 깨지는 대신 컴파일 타임에 드러난다.

## 요약

이번 diff가 새로 만든 취약점은 없고(백엔드 인젝션·인증 우회·하드코딩 시크릿류는 해당 없음), 순수하게
"토큰이 콘솔에 남는다"는 이전 WARNING의 수정 범위가 문제다. `redactToken`은 `openStream`을 호출하는
세 진입점(`start()`, `applyConfig()`, `resumeDeferredStreamRef` 콜백) 중 **딱 하나**(마지막 것,
`use-token-refresh.ts`의 `onRefreshed` 예외 경로)에만 적용됐다. 나머지 둘 중 하나(`start()`)는
같은 위협을 무방비 `console.warn`으로 노출하고, 다른 하나(`applyConfig()`)는 애초에 `try/catch`가
없어 브라우저 기본 unhandled-rejection 로거로 직행해 애플리케이션 레벨 redaction이 개입할 여지조차
없다. 게다가 SSE `onError` 핸들러는 원본 `Event` 객체를 통째로 로깅해, 문자열 정규식으로는 원천적으로
막을 수 없는 별도 유출 경로(EventSource `.url` 프로퍼티)를 남긴다. "이 브랜치가 반복해 낸 결함"이라고
스스로 여러 차례 문서화한 "한쪽만 적용" 패턴이 보안 방어 자체에서도 재발했다.

## 위험도

**HIGH** — 신규 인젝션/인가 취약점은 없으나, 이번 라운드가 고치려던 "단명 토큰의 콘솔 노출"이 실제로는
가장 흔한 두 실패 경로(연결 실패 시 `start()` 경로, 재전송/복원 시 `applyConfig()` 경로)에서 여전히
막히지 않은 채 남아 있고, 그중 하나는 애플리케이션 코드로 고칠 수 없는 구조(unhandled rejection)라
재발 위험이 크다.

STATUS: DONE
