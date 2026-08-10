# Side Effect Review — `18_51_07`

대상: 웹채팅 위젯 재로드 REST 오류 분기 후속 — 이번 delta 의 유일한 런타임 동작 변경인
`redactToken`(로그 redaction) 중심. 나머지(CHANGELOG·plan 문서·JSDoc·테스트 마진)는 순수 문서/
테스트 변경이라 부작용 표면이 없음을 확인만 함.

## 발견사항

- **[INFO]** `redactToken` 은 순수 함수 — 부작용 없음 (질문 a)
  - 위치: `codebase/channel-web-chat/src/lib/eia-client.ts:193-195`
  - 상세: `text.replace(/([?&]token=)[^&\s"']+/gi, "$1<redacted>")` 하나뿐이다. 인자를 변형하지
    않고(`String.prototype.replace` 는 새 문자열 반환) 모듈·전역 상태를 읽거나 쓰지 않으며,
    I/O·네트워크·타이머·랜덤값·`Date` 어느 것도 참조하지 않는다. 정규식이 `/g` 플래그를 갖지만
    함수 본문 안의 리터럴이라 호출마다 새 `RegExp` 객체로 평가돼(ES5+ 스펙 동작) `lastIndex` 가
    호출 간에 공유되지 않는다 — 전형적으로 부작용을 만드는 "모듈 스코프에 저장한 전역 정규식"
    패턴이 아니다. 동일 입력 → 동일 출력이 항상 보장된다.
  - 판정: 문제 없음.

- **[INFO]** `vi.spyOn(console, "warn")` 은 파일 전역 `afterEach` 로 확실히 복원됨 (질문 b)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:674`(spy 생성),
    `use-widget-eager-start.test.ts:233-246`(전역 `afterEach`, 특히 239행 `vi.restoreAllMocks()`)
  - 상세: 이 `afterEach` 는 `describe` 밖 파일 최상단에서 등록돼 있어 파일 내 모든 테스트(중첩
    `describe` 포함)에 적용된다. `vi.restoreAllMocks()` 가 단언 실패·예외로 테스트가 중단돼도
    Vitest 러너가 무조건 실행하는 `afterEach` 안에 있으므로, 해당 테스트의 `expect` 가 던지더라도
    스파이는 복원된다 — 개별 테스트 안에 `try/finally` 로 넣는 것보다 안전하다는 취지가 236행
    주석에도 명시돼 있다(이전 라운드 W4 로 이미 정착된 컨벤션과 동일 형태). `vitest.config.ts`/
    `vitest.setup.ts` 에는 전역 `restoreMocks` 옵션이 없어 이 로컬 `afterEach` 가 유일한
    복원 지점인데, 그 지점이 무조건 경로에 있으므로 다음 테스트로 새지 않는다.
  - 판정: 문제 없음.

- **[INFO]** `installControllableEventSource` 의 `throwOnce` 전역 플래그 — 현재는 누출되지 않음,
  전제는 "순차 실행" (질문 c)
  - 위치: `use-widget-eager-start.test.ts:125`(모듈 스코프 `let throwOnce = false`),
    `use-widget-eager-start.test.ts:104-105`(생성자 안에서 소비 시 `throwOnce = false`),
    `use-widget-eager-start.test.ts:228-231`(전역 `beforeEach` 의 `throwOnce = false` 리셋)
  - 상세: `throwOnce` 는 파일 전체가 공유하는 module-level mutable 이라 `installControllableEventSource()`
    를 부르는 모든 테스트의 `EventSource` mock 생성자 클로저가 같은 변수를 본다. 안전한 이유는
    (1) 리셋이 **파일 최상단 `beforeEach`** 에 있어 모든 테스트 앞에서 무조건 실행되고(그 테스트가
    직전 테스트에서 플래그를 세팅만 하고 소비하지 못한 채 끝났더라도 다음 테스트 시작 전에
    강제로 꺼짐), (2) 이 저장소의 vitest 설정(`vitest.config.ts`)과 이 파일 어디에도
    `test.concurrent`/`describe.concurrent` 가 없어 테스트가 순차 실행된다는 전제가 성립하기
    때문이다. 순차 실행이 깨지면(동시 실행) 한 테스트가 세운 `throwOnce=true` 를 다른 병행
    테스트의 `EventSource` 생성이 대신 소비할 수 있어 그때는 위험해진다 — 지금은 해당 안 됨.
  - 판정: 현재 구성 기준 문제 없음. 유지보수 시 이 파일에 `concurrent` 를 도입하면 이 가드가
    깨진다는 점만 잠재 리스크로 남겨 둔다(신규 결함 아님, 코드 변경 불요).

- **[WARNING]** `redactToken` 방어가 이번 delta 가 추가한 콘솔 로그 지점 한 곳에만 적용되고,
  같은 클래스(토큰이 쿼리에 실린 뒤 `EventSource` 생성이 동기 throw)의 다른 두 콘솔 싱크는
  여전히 무방비다 — "가드를 한쪽에만 적용" 패턴의 재발
  - 위치: 방어가 적용된 곳 — `codebase/channel-web-chat/src/widget/use-token-refresh.ts:166-174`
    (`onRefreshedRef.current?.(updated)` 를 감싼 `try/catch`, `redactToken` 호출).
    방어가 **없는** 곳 — `codebase/channel-web-chat/src/widget/use-widget.ts:790-861`(`start()`,
    특히 849행 `const claim = openStream(live, "0");` → 854행 `catch (e)` → 860행
    `dispatch({ type: "ERROR", message: errMessage(e) })`), `use-widget.ts:1297-1301`
    (`errMessage` 정의 — `console.warn("[widget] conversation error:", e.message)`, redaction 없음),
    `use-widget.ts:1141-1217`(`applyConfig`, 특히 1212행 `const claim = openStream(live, "0");` —
    이 async 함수 본문 전체에 `try`/`catch` 가 **전혀 없다**).
  - 상세: `EiaClient#openStream`(`eia-client.ts:130-133`)은 `url.searchParams.set("token", token)`
    으로 쿼리에 토큰을 박은 **뒤**에야 `esFactory(url.toString())`(실사용 시 `new EventSource(url)`)
    를 호출한다. 이 시점 이후 `esFactory` 가 동기 throw 하면(네이티브 구현에 따라 URL 을 포함한
    메시지를 내는 사례가 실재 — 이번 delta 자신의 JSDoc 도 `redactToken:186-189` 에서 이를
    근거로 든다) 그 예외 메시지엔 이미 토큰이 실려 있다. 이번 delta 가 이 계열의 유일한 새 진입
    경로(`useTokenRefresh` 의 `onRefreshed` → `resumeDeferredStreamRef.current` → `openStream`)
    에만 `redactToken` 을 붙였는데, 같은 `openStream`(래퍼, `use-widget.ts:452-477`) 을 부르는
    나머지 두 호출부는 이번 PR 이전부터 있던 코드라 그대로 무방비로 남았다:
    - `start()` 의 최초 SSE 오픈 실패는 `errMessage(e)` 를 거쳐 `console.warn` 으로 원문 메시지를
      그대로 찍는다 — redaction 미적용.
    - `applyConfig`(세션 복원/재전송) 의 SSE 오픈은 어떤 `try`/`catch` 로도 감싸여 있지 않아
      동기 throw 가 곧바로 `applyConfig` 의 미처리 promise rejection 이 된다(`void applyConfig(...)`
      로 fire-and-forget 호출되므로 `.catch()` 도 없다) — 브라우저/테스트 런타임의 기본
      unhandled-rejection 로깅이 원문 메시지(토큰 포함 가능)를 그대로 콘솔에 남긴다. 이건
      redaction 미적용보다 더 나쁘다(로깅 경로 자체가 앱 밖 기본 핸들러라 통제 불가).
    - 이 정확한 패턴은 직전 라운드 보안 리뷰(`review/code/2026/08/10/18_23_54/security.md` W1)가
      이미 지적했고("가장 흔한 throw 지점만 덮고 토큰이 붙은 뒤의 throw 지점은 비워 둔 형태",
      MEDIUM), 그 라운드의 처분(`review/code/2026/08/10/18_23_54/RESOLUTION.md` "W1(security) —
      고침")은 "`redactToken` 을 추가해 **catch 의 `console.warn` 에** 적용했다"고만 적어
      리뷰어가 제안한 3가지 중 (2)("대칭적으로 `use-widget.ts` 의 다른 `notifyErr`/`refreshErr`
      로깅 지점들"도 함께 고칠 것)를 실행하지 않은 채 좁게 닫혔다 — 이 세션 메모에도 반복
      기록된 "방어의 정의를 한 칸 좁게 잡는다" 형태의 재발이다.
  - 발생 확률: 낮음(네이티브 `EventSource` 가 유효한 URL 에 대해 동기 throw 하는 경우는 드물다 —
    직전 보안 리뷰도 같은 평가). 다만 발생 시 영향은 명확하다 — 공개 사이트에 임베드되는
    위젯이라 그 콘솔은 호스트 페이지의 다른 스크립트도 읽을 수 있다(bearer 토큰 노출,
    CWE-532 류). 이번 delta 의 테스트(`§R4: 미뤄 둔 스트림 오픈이 던져도 다음 갱신이 다시
    시도한다`)도 이 시나리오를 `throwOnce` 로 명시적으로 모델링해 뒀지만 `resumeDeferredStreamRef`
    경로 하나만 겨냥하고, `start()`/`applyConfig` 의 직접 `openStream` 호출 경로에 대한 회귀는
    없다.
  - 제안: (1) 근본 수정은 `EiaClient#openStream`(`eia-client.ts:130-153`) 안에서 `esFactory` 호출을
    자체 `try/catch` 로 감싸 URL 을 담지 않는 에러로 재던지는 것 — 이러면 호출부가 몇 곳이든
    자동으로 안전해진다(직전 보안 리뷰의 제안 (1)과 동일). (2) 최소 수정이라면 `use-widget.ts`
    의 `errMessage`(1297-1301행)에 `redactToken` 을 적용하고, `applyConfig` 에도 `start()` 와
    대칭인 `try/catch` 를 씌울 것. 이번 라운드에서 즉시 처리하지 않더라도 미룰 경우 근거를
    plan(`webchat-auth-session-status-reconcile.md` 등 관련 후속 트래커)에 트리거 조건과 함께
    명시해 둘 것 — "언젠가" 가 아니라 "다음에 `openStream` 호출부가 하나 더 늘 때" 처럼.

## 요약

이번 delta 의 유일한 런타임 변경인 `redactToken` 자체는 순수 함수로 부작용이 없고(a), 새로
도입한 `vi.spyOn(console, "warn")` 은 파일 전역 `afterEach` 의 무조건 `restoreAllMocks()` 로
안전하게 복원되며(b), `installControllableEventSource` 의 `throwOnce` 전역 플래그도 현재의
순차 테스트 실행 전제 하에서는 매 `beforeEach` 리셋으로 테스트 간 누출이 없다(c) — 세 질문
전부 문제 없음으로 판정한다. 다만 조사 중 이번 delta 가 닫으려 한 "토큰 콘솔 노출" 결함
클래스 자체가 완전히 닫히지 않았음을 확인했다: `redactToken` 은 이번 PR 이 새로 만든 진입
경로(`onRefreshed` catch) 한 곳에만 적용됐고, 같은 `openStream` 래퍼를 부르는 기존 두
호출부(`start()`의 `errMessage` 경유 로그, `applyConfig`의 무방비 promise rejection)는
직전 라운드 보안 리뷰가 이미 지적한 그대로 여전히 비대칭 방어 상태다. 발생 확률은 낮지만
같은 클래스의 정보 노출이라 WARNING 으로 등재한다.

## 위험도

LOW — 새로 작성된 코드(`redactToken`, 관련 테스트 두 건) 자체는 안전하고 질문 (a)(b)(c) 모두
정상이다. WARNING 1건은 신규 결함이 아니라 기존에 알려진 채 부분적으로만 닫힌 방어 격차의
재확인이며, 트리거 조건(네이티브 `EventSource` 동기 throw)의 발생 확률이 낮아 즉시 차단
사유는 아니다.

STATUS: OK
