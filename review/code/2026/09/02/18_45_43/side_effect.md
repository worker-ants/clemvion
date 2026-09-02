# 부작용(Side Effect) 리뷰 — WS `auth.token_expired` 소켓 수명 종속 구현 (3라운드 확인)

## 검증 방법

diff 만으로 판단하지 않고 실제 소스를 `Read` 로 열어 최종 상태를 대조했다(뮤테이션 없음,
저장소 파일 미변경 — `git status --short` 확인 불필요, 아무것도 쓰지 않음). 이번 라운드는
1R(`review/code/2026/09/02/17_38_12/side_effect.md`, MEDIUM)·2R(`review/code/2026/09/02/18_18_53/side_effect.md`,
LOW)의 side_effect 지적이 **최종 코드에서 실제로 해소됐는지**를 재확인하는 것이 핵심이며,
그 위에서 신규 관측을 추가한다.

## 이전 라운드 대비 델타 확인 (해소 재검증)

- **1R WARNING(해소 확인)** — "정상 경로" 의 `socket.connect()` 가 이미 연결된 소켓에서
  no-op 이라 재핸드셰이크가 없던 결함. 현재 `codebase/frontend/src/lib/websocket/ws-client.ts`
  76-77번 줄에 `if (socket.connected) socket.disconnect(); socket.connect();` 로 명시적
  재핸드셰이크가 존재함을 확인했다.
- **2R WARNING(해소 확인)** — `refreshAttempted` 재진입 가드가 `connect_error` 트리거에만
  있어 `auth.token_expired`·`disconnect` 두 신규 트리거가 무가드였던 결함(느린 재발급 중
  서버 cutoff 가 겹치면 방금 성공한 재연결을 다시 끊는 경로). 현재 `ws-client.ts` 59-86번
  줄에 `refreshAndReconnect` 내부 `let inFlight: Promise<void> | null = null;` +
  `if (inFlight) return inFlight;` 가드가 세 트리거(`connect_error`·`auth.token_expired`·
  `disconnect`) 모두를 감싸는 것을 확인했다. 가드 배치를 직접 추적한 결과, `refreshAndReconnect`
  자신은 내부에 `await` 이전 구간이 없어(중첩된 `run` IIFE 안에서만 `await` 발생) `inFlight`
  체크→`run` 생성→`inFlight` 대입이 **단일 동기 구간**에서 끝난다 — 두 트리거가 같은 tick 에
  연달아 호출되어도(예: 서버가 `auth.token_expired`·`disconnect` 를 근접 발화) 두 번째 호출이
  `inFlight` 를 `null` 로 보는 레이스 윈도우가 없다. `websocket.gateway.spec.ts`/`ws-client.test.ts`
  의 신규 테스트(겹친 트리거 시나리오)도 이 가드를 직접 실행해 `refresh`/`connect` 각 1회만
  호출됨을 단언한다.

## 발견사항

- **[INFO]** `armExpiryTimers` 내부 예외가 `handleConnection` 의 넓은 인증 `try/catch` 에
  흡수돼 "Invalid token" 으로 오분류될 수 있음 — 2R 에서 이미 지적·등재, 이번 라운드에도 미반영
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `handleConnection`
    (`try` 시작 213줄대 / `catch` 263-267줄대) 안에서 `armExpiryTimers` 호출(243줄대) —
    `armExpiryTimers` 자체(170-210줄대)의 `new Date(expiresAtMs).toISOString()` 계산부
  - 상세: `expSeconds` 가 유한수이기만 하면(`typeof === 'number' && Number.isFinite`) 그대로
    `Date` 계산에 쓰인다. 서명은 유효하지만 `exp` 클레임이 `Date` 표현 범위를 벗어나는 비정상
    토큰(발급 로직 버그 등)이 들어오면 `toISOString()` 이 `RangeError` 를 던지고, 이 예외가
    바깥 `catch` 에 흡수되어 실제로는 서명이 유효했던 연결이 "invalid token" 으로 오분류된
    채 로그·클라이언트 emit 이 원인을 오도한다. `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`
    체크리스트에는 이 항목이 별도로 명시돼 있지 않지만, `review/code/2026/09/02/18_18_53/RESOLUTION.md`
    "미조치" 목록의 `#8`(예외가 인증 catch 에 흡수)로 이미 등재돼 "현재 도달 불가"(`auth.module.ts`
    가 `expiresIn: 900` 고정이라 이 입력이 실경로에서 발급되지 않음) 판단으로 의도적 defer 상태다.
    코드 결함이 아니라기보다 우선순위 판단이므로 재차 차단 사유로 올리지 않는다.
  - 제안: (선택적, 이미 등재됨) `armExpiryTimers` 를 인증 `try` 블록 밖(또는 자체 try/catch)으로
    분리해 이 함수 내부 예외가 "토큰 무효" 판정과 섞이지 않게 한다.

- **[INFO]** 배포 전환 창 — 이 로직을 모르는 구버전 프론트 번들은 서버발신 `disconnect()` 뒤
  자동 재연결하지 않는다 (기존 트랙 항목, 재확인)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` cutoff 타이머의
    `client.disconnect()`(200줄대) · `codebase/frontend/src/lib/websocket/ws-client.ts` 의
    `io(...)` 옵션(`reconnection: true, reconnectionAttempts: Infinity`, 36-43줄) — 이 옵션
    자체는 이번 diff 이전부터 있던 기존 설정
  - 상세: 이번 변경 이후 **모든** 인증된 소켓이 `exp` 도달 시 무조건 서버발신 `disconnect()`
    를 받는다 — 이전에는 이 강제 종료 자체가 없었다(버그였지만 "연결이 끊기지 않는다"는
    부작용은 없었다). Socket.IO 클라이언트는 `reason === "io server disconnect"` 인 경우
    내장 자동 재연결을 **발화하지 않는다**(공식 동작) — 신구 프론트 코드 모두에 적용되는
    라이브러리 규칙이다. 이번 diff 로 추가된 `socket.on("disconnect", ...)` 폴백 핸들러가
    없는 구버전 번들(배포 시점에 이미 열려 있던 탭)은 그 disconnect 이후 아무 것도 하지
    않아, 최대 900초 뒤 무통지·무복구로 연결을 잃는다(페이지 재진입 전까지). 이미
    `review/code/2026/09/02/17_38_12/api_contract.md` W6 로 지적됐고, plan 체크리스트에
    "배포 전환 창 리스크 — 배포 런북에 남길 것" 으로 등재돼 아직 `[ ]` 미해결 상태로
    남아 있음을 확인했다. 코드로 닫을 수 있는 문제가 아니라(구버전 번들은 이번 PR 의
    수정 범위 밖) 배포 운영 판단이 필요한 항목이라 재차 조치 요구하지 않는다.
  - 제안: (선택적, 이미 등재됨) PR 머지 전/직후 배포 런북에 "FE 우선 배포 또는 900초
    이내 무통지 이탈 감내" 판단을 실제로 기록해 plan 체크리스트를 닫을 것.

## 검토했으나 이상 없음으로 판단한 항목

- **신규 공유 상태의 arm/disarm 페어링**: `WebsocketGateway.expiryTimers` Map(150-153줄대)은
  `handleConnection`(243줄대)에서 arm, `handleDisconnect`(286-291줄대)에서 disarm — 인증
  실패 두 경로(토큰 없음·검증 실패)는 모두 `armExpiryTimers` 호출 **이전**에 `disconnect()`
  하므로 그 경로에서 타이머 누수는 없다. `subscriptions`/`WsRateLimiterService` 와 동일한
  socket-id 키 arm-on-connect/disarm-on-disconnect 패턴을 그대로 따른다.
- **전역 변수**: 신규 전역 변수 없음. `expiryTimers`(gateway 인스턴스 필드), `inFlight`(프론트
  `connect()` 클로저 지역 변수) 모두 스코프가 좁게 유지된다.
- **시그니처/인터페이스**: `AuthEventType`/`AuthTokenExpiredPayload` 는 순수 additive export.
  `WsClient.connect(token: string)` 등 기존 공개 시그니처 변경 없음. `connect_error` 핸들러가
  `async` 화살표에서 동기 화살표(`void refreshAndReconnect(...)` 위임)로 바뀌었으나 이는
  내부 콜백이라 호출자 계약(소켓 이벤트 리스너 등록)에는 영향이 없다.
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: `refreshAccessToken()` 은 기존에 쓰이던 동일 REST 엔드포인트를 재사용.
  신규 엔드포인트 없음. 세 트리거가 겹칠 때의 중복 호출은 `inFlight` 가드로 해소됨(위 델타
  확인 참조).
- **이벤트/콜백**: `auth.token_expired` emit·cutoff `disconnect()` 는 클라이언트 액션과
  무관하게 `setTimeout` 으로 자율 발화하는 신규 비동기 push다 — spec §1.2/§4.6 이 명시적으로
  요구하는 의도된 동작이고 arm/disarm 쌍이 정확해 결함으로 보지 않는다(1R/2R 에서 이미 관측
  기록됨). `websocket.gateway.spec.ts` 신규 `describe` 블록의 `jest.useFakeTimers()`/
  `useRealTimers()` 는 자신의 `beforeEach`/`afterEach` 로 스코프돼 있어 형제 테스트로의
  fake-timer 누수는 없다.
- **파일시스템**: 프로덕션 코드 경로에 파일 I/O 없음. diff 에 포함된 `review/**`·`plan/**`
  신규 파일은 프로젝트 컨벤션(`CLAUDE.md` "코드 리뷰 산출물"/"진행 중 작업" 표)이 지정한
  정규 저장 위치이며, 런타임 부작용이 아니라 정적 문서 산출물이다.

## 요약

1R(MEDIUM, "정상 경로" 재연결이 no-op)·2R(LOW, 재진입 가드가 신규 두 트리거를 안 덮음)에서
지적된 side-effect 급 결함은 모두 최종 코드에서 실제로 해소됐음을 소스 대조로 확인했다 —
`socket.disconnect()`→`socket.connect()` 명시적 재핸드셰이크, `refreshAndReconnect` 내부의
`inFlight` in-flight 가드(세 트리거 공유, 동기 구간이라 레이스 윈도우 없음). 백엔드
`expiryTimers` Map 은 소켓별 사전 통지·강제 종료 타이머라는 새 공유 상태를 도입하지만
arm(`handleConnection`)/disarm(`handleDisconnect`) 쌍이 기존 `subscriptions`/`WsRateLimiterService`
패턴과 일관되게 정확하다. 전역 변수 신설, 시그니처/인터페이스 파괴적 변경, 의도치 않은 환경
변수 접근, 신규 외부 서비스 호출, 파일시스템 이상 부작용은 발견되지 않았다. 남은 것은 이미
plan/RESOLUTION 에 등재되어 의도적으로 defer 된 INFO 두 건뿐이다 — (1) `armExpiryTimers` 의
극단적 `exp` 값 예외가 "invalid token" 으로 오분류될 수 있는 도달 불가 edge case, (2) 이
로직을 모르는 구버전 프론트 번들이 배포 전환 창에서 서버발신 disconnect 후 자동 복구하지
않는(코드가 아니라 배포 운영으로 닫아야 하는) 리스크. 둘 다 새로 발견된 것이 아니라 이전
라운드 판단이 최종 코드에서도 여전히 유효함을 재확인한 것이다.

## 위험도

LOW
