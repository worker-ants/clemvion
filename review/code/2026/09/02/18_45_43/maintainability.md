# 유지보수성(Maintainability) 리뷰 — `auth.token_expired` 소켓 수명 종속 (3라운드)

## 검토 방법 및 범위

이번 diff 는 `review/code/2026/09/02/{17_38_12,18_18_53}/**`·`review/consistency/**` 산출물(파일
12~62)을 대량으로 포함하지만, 이들은 이전 두 라운드의 리뷰 프로세스 로그일 뿐 유지보수성 판단
대상인 애플리케이션 코드가 아니다(전 라운드 architecture/documentation/scope 리뷰가 이미 같은
근거로 제외했고, 그 판단에 이견 없음). 실제 코드 대상은 파일 1~9 다. 각 파일을 diff 뿐 아니라
`Read` 로 현재 상태(2라운드 W1·W2 조치 반영 후)를 직접 열어 확인했다.

1라운드(`17_38_12`) maintainability 리뷰는 WARNING 1건(`connect_error`↔`refreshAndReconnect`
중복)을 냈고, 2라운드(`18_18_53`)는 그 WARNING 이 해소됐음을 확인하고 INFO 3건(타이머 페어
optional 타입·wire 메시지 미상수화·빈 줄 2개)만 남겼다 — 셋 다 RESOLUTION.md 가 "취향 범위"로
명시적으로 보류한 항목이다. 이번 라운드에서는 그 판단을 재검증하되, **2라운드가 `refreshAndReconnect`
를 `inFlight` Promise 로 감싼 수정(W2) 자체가 새로 만들어낸 가독성 문제**를 직접 코드를 읽어
발견했다 — 이 부분이 이번 라운드의 핵심 신규 발견이다.

## 발견사항

- **[WARNING]** `refreshAndReconnect` 내부 `try/catch` 블록의 들여쓰기가 실제 중첩 구조와 어긋나 스코프를 오독하게 만든다
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:62-81` (`const run = (async () => { … })();` 로 감싼 부분. 특히 `:63` `try {`, `:78` `} catch (refreshErr) {`, `:81` `})();`)
  - 상세: 직접 각 줄의 선행 공백 수를 세어 확인했다.
    ```
    6칸   const run = (async () => {
    6칸   try {
    8칸     const newToken = await refreshAccessToken();
    ...
    8칸     socket.connect();
    6칸   } catch (refreshErr) {
    8칸     console.error(...)
    6칸   }
    6칸   })();
    ```
    `const run = (async () => {` 의 몸통(`try { … }`)은 그 줄보다 한 단 더 들여써야 정상인데
    (파일 전체가 2-space 단계별 들여쓰기를 일관되게 쓴다 — 예: `waitForConnect` 의 Promise executor,
    `armExpiryTimers` 등 대조), `try`/`catch`/닫는 `})();` 가 전부 `const run = (async () => {` 와
    **같은 6칸**에 있다. 그 결과 코드를 훑어보면 `try { … } catch { … }` 가 `const run =
    (async () => {` 의 **형제(sibling)** 처럼 보이고, `})();` 가 무엇을 닫는지 시각적으로
    불명확하다 — 실제로는 `try/catch` 전체가 그 화살표 함수의 유일한 몸통이다. JS 파서는
    공백을 무시하므로 동작·테스트(20/20 PASS, 리뷰 2R 검증 재확인)에는 영향이 없지만, 이
    라운드가 `inFlight` 가드(§9.2 재진입 결함 W2)를 정확히 이 자리에 추가하며 스코프 경계가
    가장 중요해진 구간에서 그 경계를 육안으로 잘못 읽게 만든다 — 다음 사람이 `try` 를 `run`
    바깥으로 옮기는 리팩터링을 시도하다 `inFlight`/`run.finally` 배선을 놓칠 위험을 키운다.
    2라운드에서 `let inFlight…` + `const run = (async () => {…})();` 래핑을 기존 try/catch
    바깥에 새로 씌우면서(원래는 `const refreshAndReconnect = async (why) => { try {…} catch
    {…} };` 형태였을 것) 안쪽 블록을 재인덴트하지 않아 생긴 흔적으로 보인다.
  - 제안: `try` 이하 전체를 `const run = (async () => {` 대비 한 단(2칸) 더 들여써 실제 중첩과
    시각적 들여쓰기를 일치시킨다(`try` → 8칸, 그 내부 → 10칸, `catch`/닫는 `}` → 8칸,
    `})();` → 6칸). 이 파일에 prettier 설정이 로컬에 없어(backend 만 `.prettierrc` 보유) CI가
    자동으로 잡아주지 않으므로 수동 정리가 필요하다.

- **[INFO]** (이월·이미 2회 명시적 보류) `expiryTimers`/`armExpiryTimers` 타이머 페어 타입이 여전히 `optional` — 항상 쌍으로 존재한다는 불변식이 타입에 드러나지 않음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:150-153`(`expiryTimers` 필드), `:192`(`armExpiryTimers` 내 `timers` 지역 변수)
  - 상세: 현재 코드에서도 그대로 확인된다 — `{ notice?: NodeJS.Timeout; cutoff?: NodeJS.Timeout }` 가 두 자리에 리터럴 중복되고, 실제로는 둘이 항상 같은 경로에서 함께 대입돼 `handleDisconnect`(`:287-290`)의 `if (timers.notice) …`/`if (timers.cutoff) …` 가 항상 참인 방어적 optional-check 로 남아 있다. 1라운드·2라운드 모두 같은 관찰을 했고 RESOLUTION.md(2R)가 "취향 범위"로 명시 보류했다 — 새 근거는 없으므로 차단 사유로 올리지 않는다.
  - 제안: (기존 제안 유지) `type ExpiryTimerPair = { notice: NodeJS.Timeout; cutoff: NodeJS.Timeout };` non-optional 화. 착수 시점 판단은 이번 라운드에서 바꿀 근거가 없음.

- **[INFO]** (이월·이미 2회 명시적 보류) wire 메시지 문자열이 파일의 기존 "wire 상수 승격" 관례를 따르지 않음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:195` (`message: 'Access token expires soon — refresh and reconnect.'`)
  - 상세: 같은 파일의 `MSG_NOT_AUTHENTICATED`/`MSG_NOT_AUTHORIZED_EXECUTION` 관례와 달리 인라인 리터럴로 남아 있음을 재확인. 2라운드 RESOLUTION 이 이미 "메시지 상수화 — 취향 범위"로 보류.
  - 제안: 변화 없음 — 조치하려면 `MSG_AUTH_TOKEN_EXPIRING` 류 모듈 상수로 승격.

- **[INFO]** (이월·이미 2회 명시적 보류) `ws-client.ts` 연속 빈 줄 2개
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:116-117` (`connect_error` 블록 설명 주석과 `auth.token_expired` 구독 사이)
  - 상세: 현재도 그대로 남아 있음을 확인. 동작 영향 없음, lint 규칙 없음, 2라운드가 이미 인지.
  - 제안: 변화 없음.

## 검토했으나 이상 없음으로 판단한 항목

- **함수 길이·중첩·복잡도**: `armExpiryTimers`(`websocket.gateway.ts:170-210`, ~41줄)는 조기 반환 1개·콜백 내부 1단 중첩으로 단순. `refreshAndReconnect`(`ws-client.ts:60-86`)도 try/catch 1단·조기 반환 1개로 논리적 복잡도는 낮다(위 WARNING 은 순수 표기 문제이지 실제 분기·복잡도 문제가 아니다).
- **중복 코드**: 1라운드에서 지적된 "`connect_error` 핸들러 vs `refreshAndReconnect` 몸통 판박이"는 2라운드에서 `connect_error` 가 `void refreshAndReconnect("connect_error")` 로 위임하도록 통합돼 여전히 해소 상태(`ws-client.ts:102-107`). 새 트리거(`auth.token_expired`·`disconnect`)도 같은 헬퍼를 쓴다 — 3중 사용처가 단일 구현 하나.
- **네이밍·컨벤션 일관성**: `AuthEventType.AUTH_TOKEN_EXPIRED = 'auth.token_expired'` 는 기존 `ExecutionEventType`/`KbEventType` 의 `namespace.snake_case` 관례와 일치. `TOKEN_EXPIRY_LEAD_MS`·`expiryTimers`·`armExpiryTimers`·`refreshAndReconnect` 모두 목적이 이름에서 명확.
- **매직 넘버**: `TOKEN_EXPIRY_LEAD_MS = 60_000` 은 named constant + 근거 JSDoc(값의 유래 6.7% 계산까지) 보유. 테스트의 `900`/`60`/`30` 리터럴은 `connectWithExp(id, secondsFromNow)` 헬퍼 인자로 의미가 명확해 매직 넘버로 보지 않음.
- **테스트 구조**: `websocket.gateway.spec.ts` 의 `connectWithExp`, `ws-client.test.ts` 의 `handlerFor` 헬퍼가 셋업 중복을 잘 추출했고, 신규 `it` 블록들은 각각 단일 관심사(정상 경로·해제·lead-time 경계·`exp` 없음·in-flight 겹침·실패 경로·대조군)에 집중해 가독성이 좋다. `ws-client.test.ts` 는 `WsClient.connect(token: string)` 시그니처를 이제 모두 올바르게 호출한다(1R Critical #2 해소, 직접 확인).
- **일관성(코드베이스 스타일)**: 신규 JSDoc·인라인 주석의 "근거·범위 경계·기각 대안 명시" 톤은 기존 확립된 관례와 일치. `Map<socketId, …>` 소켓별 상태 관리 + `handleConnection`/`handleDisconnect` 쌍의 arm/disarm 패턴도 `WsRateLimiterService` 등 기존 패턴과 대칭.

## 요약

핵심 유지보수성 문제(1라운드 중복)는 2라운드에서 실제로 해소됐고, 남은 INFO 3건은 이미 두 차례
명시적으로 "취향 범위"로 보류된 항목이라 이번 라운드에서 판단을 바꿀 근거가 없어 그대로 유지한다.
다만 그 2라운드 수정(`inFlight` in-flight 가드) 자체가 `try/catch` 블록을 감싸면서 안쪽을
재인덴트하지 않아, 정확히 이번 PR이 가장 공들여 고친 동시성 가드 구간의 스코프 경계를 육안으로
오독하게 만드는 새 가독성 결함을 남겼다. 기능·테스트에는 영향이 없지만, 다음 사람이 이 헬퍼를
다시 손볼 때 잘못된 멘탈 모델(`try` 가 `run` 밖에 있다는 착시)로 시작할 위험이 있어 WARNING으로
기록한다. 그 외 함수 길이·중첩 깊이·복잡도·네이밍·매직 넘버·테스트 구조는 이 코드베이스의 기존
패턴을 잘 따르고 있어 전반적인 유지보수성 품질은 양호하다.

## 위험도

LOW
