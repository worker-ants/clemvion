# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 소켓별 만료 타이머 쌍의 타입 리터럴이 2곳에 그대로 중복되고, "항상 쌍으로 존재한다"는 불변식이 타입으로 표현되지 않음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:150-153`(`expiryTimers` 필드 선언) 및 `:192`(`armExpiryTimers` 내부 `timers` 지역 변수 선언). 소비부는 `:286-290`(`handleDisconnect` 의 `if (timers.notice) …` / `if (timers.cutoff) …`).
  - 상세: `{ notice?: NodeJS.Timeout; cutoff?: NodeJS.Timeout }` 형태가 두 자리에 문자 그대로 반복된다. 필드가 하나 늘면 두 곳을 함께 고쳐야 한다. 또한 `armExpiryTimers` 안에서 `notice`·`cutoff` 는 항상 같은 실행 경로에서 함께 대입되고(둘 중 하나만 세팅되는 분기가 없다) Map 에 저장되는데, 값 타입은 둘 다 `optional` 이라 "이 두 타이머는 항상 쌍으로 존재한다"는 실제 불변식이 타입 시스템에 드러나지 않는다. `handleDisconnect` 의 `if (timers.notice) clearTimeout(...)` 도 실질적으로 항상 참인 방어적 optional-check 라 코드가 그 사실을 숨긴다.
  - 제안: `type ExpiryTimerPair = { notice: NodeJS.Timeout; cutoff: NodeJS.Timeout };` (non-optional) 로 이름 붙여 두 자리에서 재사용하면, 타이머 한쪽만 존재하는 상태가 생기는 회귀를 컴파일 타임에 차단하고 중복도 사라진다. 동작에 영향 없는 표기 수준 이슈로, 이전 리뷰 라운드(`review/code/2026/09/02/17_38_12/architecture.md` INFO, `maintainability.md` INFO)에서 이미 지적되고 "취향 범위"로 명시적 보류된 항목이다 — 재확인 차 유지한다.

- **[INFO]** 신규 wire 메시지 문자열이 같은 파일의 확립된 "wire 문자열은 모듈 상수로 승격" 관례를 따르지 않음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:195` (`armExpiryTimers` 내부 `message: 'Access token expires soon — refresh and reconnect.'`)
  - 상세: 같은 파일 상단에는 `MSG_NOT_AUTHENTICATED`·`MSG_NOT_AUTHORIZED_EXECUTION`(`:86-87`)처럼 "값은 명문 wire 문자열 — 변경 금지" 주석과 함께 모듈 스코프 상수로 뽑아 두는 관례가 있다. 새로 추가된 `auth.token_expired` payload 의 `message` 는 이 관례를 따르지 않고 함수 본문에 인라인 리터럴로 남아 있다. 테스트가 `expect.any(String)` 으로만 검증해 지금 당장 깨지지는 않지만, 파일 내부 스타일 일관성 관점에서 벗어난다.
  - 제안: 다른 wire 상수들과 나란히 `MSG_AUTH_TOKEN_EXPIRING` 류의 모듈 상수로 승격. (이전 라운드 `maintainability.md` INFO #3 과 동일 지적, RESOLUTION.md 에서 "메시지 상수화 — 취향 범위"로 명시적 보류됨을 확인 — 재확인 차 유지한다.)

- **[INFO]** `ws-client.ts` 안 연속 빈 줄 2개
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:101-102` (`connect_error` 블록과 `auth.token_expired` 구독 사이, 설명 주석 블록 바로 다음)
  - 상세: 다른 이벤트 핸들러 사이는 빈 줄 1개로 구분되는데 이 자리만 2개가 연속돼 있다. 동작에 영향은 없으나 파일 내 서식 일관성이 살짝 어긋난다. lint/format 설정에 `no-multiple-empty-lines` 류 규칙이 없어 CI 로는 안 걸린다.
  - 제안: 빈 줄 1개로 정리.

## 검토했으나 이상 없음으로 판단한 항목

- **중복 코드(핵심)**: 이전 라운드(`architecture.md`/`maintainability.md` WARNING)에서 지적된 "`connect_error` 핸들러와 `refreshAndReconnect` 가 토큰 갱신+재연결 로직을 판박이로 중복"은 이번 diff 에서 해소됐다 — `connect_error` 핸들러(`ws-client.ts:87-92`)가 이제 `void refreshAndReconnect("connect_error")` 로 위임하고, `auth.token_expired`(`:104-106`)·`disconnect`(`:111-114`) 두 신규 경로도 같은 헬퍼를 쓴다. "토큰 갱신 → `auth.token` 교체 → 명시적 재연결" 계약이 한 곳(`refreshAndReconnect`, `:52-71`)에만 존재한다.
- **함수 길이·중첩 깊이·복잡도**: `armExpiryTimers`(`websocket.gateway.ts:170-210`)는 단일 책임의 ~40줄, 조기 반환 1개, 중첩 1단(콜백 내부)뿐이다. `refreshAndReconnect`(`ws-client.ts:52-71`)도 try/catch 1단, 조기 반환 1개로 단순하다. 순환 복잡도 모두 낮다.
- **네이밍·일관성**: `AuthEventType.AUTH_TOKEN_EXPIRED = 'auth.token_expired'` 는 기존 `ExecutionEventType`/`NodeEventType`/`InAppNotificationEventType` 의 `namespace.snake_case` 관례와 정확히 일치. `TOKEN_EXPIRY_LEAD_MS`·`armExpiryTimers`·`expiryTimers` 등 신규 식별자는 목적을 명확히 드러내고 기존 `wsRateLimiter`류 소켓별 상태 관리 패턴(`Map<socketId, …>` + `handleConnection`/`handleDisconnect` 쌍의 arm/disarm)과 대칭적이다.
- **매직 넘버**: `TOKEN_EXPIRY_LEAD_MS = 60_000`은 named constant 이고 JSDoc(`:138-143`)이 값의 근거(900초의 약 6.7%, "관측 가능한 계약")까지 남겨 매직 넘버로 보지 않는다. 테스트 파일의 인라인 `900`/`60`/`30`은 spec 상수를 그대로 쓰는 fixture 값으로, 각 테스트 이름(`connectWithExp`)이 의미를 드러내 가독성에 문제가 없다.
- **테스트 중복 회피**: `websocket.gateway.spec.ts` 의 `connectWithExp` 헬퍼, `ws-client.test.ts` 의 `handlerFor` 헬퍼가 반복되는 셋업을 잘 추출해 개별 `it` 블록은 각자의 단언에만 집중한다.
- **문서화 스타일**: 신규 JSDoc·주석(설계 근거·기각 대안·범위 경계 명시)이 이 코드베이스에서 확립된 "두꺼운 주석" 관례를 그대로 따른다.

## 요약

이전 라운드에서 지적된 유일한 실질적 유지보수성 결함(프론트 `ws-client.ts` 의 토큰 갱신+재연결 로직 중복, WARNING)은 `refreshAndReconnect` 공통 헬퍼로 통합되어 이번 diff 에서 해소됐다. 남은 항목은 모두 INFO 수준으로, 타이머 페어 타입의 optional 중복 선언, wire 메시지 문자열 미상수화, 사소한 서식 흠 세 가지이며 셋 다 동작에 영향이 없고 이미 지난 라운드에서 "취향 범위"로 명시적 보류된 사안의 재확인이다. 함수 길이·중첩·순환 복잡도·네이밍·매직 넘버·테스트 구조 모두 이 코드베이스의 기존 패턴을 충실히 따르고 있어 전반적인 유지보수성 품질은 양호하다.

## 위험도

LOW
