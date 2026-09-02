# 부작용(Side Effect) 리뷰 — WS `auth.token_expired` 소켓 수명 종속 구현

리뷰 범위: 실제 런타임 코드 변경(파일 1~7: `CHANGELOG.md`, `websocket-events.types.{ts,spec.ts}`,
`websocket.gateway.{ts,spec.ts}`, `ws-client.{ts,test.ts}`) + plan 문서(파일 8~9). 파일 10~44
(`review/code/.../17_38_12/**`, `review/consistency/**`)는 전 라운드 리뷰·consistency 산출물
(markdown/json 데이터)로 실행되는 코드가 아니라 side-effect 관점에서 검토 대상이 아님을 확인함
(내용은 훑었으나 실행 side effect 없음 — 그중 `concurrency.md`(17_38_12)는 이번 발견 #1 과 겹치는
INFO 를 이미 담고 있어 교차 확인용으로 인용).

뮤테이션 없이 정적 분석(Read/Grep)만 수행했고 저장소 파일은 건드리지 않았다 — `git status --short`
확인 대상 없음(변경 자체가 없었음).

## 발견사항

- **[WARNING]** 프론트 `refreshAndReconnect` 재진입 가드가 트리거 3곳 중 1곳에만 존재 — 서버
  cutoff 타이머가 재발급 대기 중에 겹쳐 발화하면 방금 재연결한 소켓을 다시 disconnect/connect 시켜
  이 PR 이 없애려던 "보이는 끊김" 을 재도입할 수 있음
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:52-71`(`refreshAndReconnect` 정의 —
    재진입 가드 없음) · `:104-106`(`auth.token_expired` 핸들러, 무가드 호출) ·
    `:111-114`(`disconnect` 핸들러, 무가드 호출) 대비 `:83-92`(`connect_error` 핸들러만
    `refreshAttempted` 플래그로 재진입을 막음)
  - 상세: `connect_error` 경로는 `refreshAttempted` 로 감싸 재호출을 막지만, 이번 diff 로 새로
    생긴 `auth.token_expired`·`disconnect("io server disconnect")` 두 경로는 그 가드를 공유하지
    않는다. 서버는 `exp-60s`(notice)와 `exp`(cutoff) 두 개의 **독립 타이머**를 갖고 있으므로
    (`websocket.gateway.ts:193-207`), 클라이언트의 `refreshAccessToken()` 대기가 (느린 네트워크 등
    비정상 상황에서) 60초를 넘기면: notice 로 시작된 `refreshAndReconnect` 가 아직 pending 인
    상태에서 서버가 cutoff 시각에 강제 `disconnect()` 하고, 그 로컬 `disconnect` 이벤트
    (`reason === "io server disconnect"`)가 **두 번째** `refreshAndReconnect` 를 무가드로 기동한다.
    `refreshAccessToken()` 자체는 `codebase/frontend/src/lib/api/client.ts` 의 `refreshPromise`
    singleton 이 동시 호출을 de-dup 하므로 REST 이중 호출까지는 가지 않지만(이전 라운드
    `review/code/2026/09/02/17_38_12/concurrency.md` INFO 항목이 이미 이 지점을 지적했고, 그 RESOLUTION
    의 "조치" 목록(C1·C2·W1·W3·W4·W5·W6)에는 이 가드 추가가 없어 이번 라운드에도 그대로 남아 있음을
    직접 코드로 재확인함), `socket.connect()`/`socket.disconnect()` 시퀀스는 de-dup 되지 않는다.
    타이밍상 첫 번째 콜백이 이미 성공적으로 재연결(`socket.connected === true`)한 뒤에 두 번째
    콜백이 실행되면, `if (socket.connected) socket.disconnect();`(`:66`) 가 그 방금 맺은 연결을 다시
    끊고 `socket.connect()` 를 한 번 더 부른다 — spec §9.2 "성공하면 끊김이 보이지 않는다" 계약을
    좁은 타이밍 창에서 재차 깨는 경로다.
  - 제안: 세 트리거가 공유하는 `refreshAttempted` 류의 단일 in-flight 플래그(또는 진행 중인
    `refreshAndReconnect` 프라미스 자체를 캐시)를 `refreshAndReconnect` 안으로 옮겨 세 경로 모두가
    같은 뮤텍스를 쓰도록 통합한다.

- **[INFO]** `armExpiryTimers` 내부 예외가 `handleConnection` 의 넓은 `try/catch` 에 흡수돼
  "Invalid token" 으로 오분류될 수 있음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:212-268`(`handleConnection`
    의 `try`(:213)/`catch`(:263-267)) · `:170-210`(`armExpiryTimers`, 그 try 블록 안에서 `:243` 에
    호출됨)
  - 상세: `armExpiryTimers` 는 `expSeconds` 가 유한수인지만 가드하고(`:174`), 그 값으로
    `new Date(expSeconds * 1000).toISOString()`(`:178`)을 곧바로 계산한다. `jwtService.verify` 가
    서명은 검증하지만 `exp` 클레임의 상식적 범위(예: `Date` 유효 범위 밖의 극단값)까지 보증하지는
    않으므로, 발급 로직 버그 등으로 비정상적으로 큰 `exp` 를 담은(서명은 유효한) 토큰이 들어오면
    `toISOString()` 이 `RangeError: Invalid time value` 를 던진다. 이 예외는 `handleConnection` 의
    바깥 `catch`(:263)에 그대로 흡수되어, 실제로는 토큰 서명이 유효했음에도 로그가
    "Connection rejected: invalid token"(:264)으로, 클라이언트 emit 이 `'Invalid token'`(:265)으로
    남아 원인을 오도한다. 현재 `auth.module.ts` 의 `expiresIn: 900` 경로에서는 도달하지 않는 edge
    case 라 우선순위는 낮다.
  - 제안: `armExpiryTimers` 를 `handleConnection` 의 인증 try 블록 밖(또는 자체 try/catch)으로
    분리해, 이 함수 내부 예외가 "토큰 무효" 판정과 섞이지 않게 한다.

- **[INFO]** 서버가 요청-응답 밖에서 소켓에 비동기 push 이벤트를 새로 발생시킴(의도된 설계, 결함
  아님 — 관측용으로 기록)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:193-199`(notice 타이머의
    `client.emit(AuthEventType.AUTH_TOKEN_EXPIRED, payload)`), `:201-207`(cutoff 타이머의
    `client.disconnect()`)
  - 상세: 이번 diff 이전에는 게이트웨이가 클라이언트 메시지에 대한 응답으로만 `emit`/`disconnect`
    를 호출했다. 이제는 `handleConnection` 시점에 등록된 `setTimeout` 두 개가, 아무 클라이언트
    액션 없이도 최대 900초 뒤 자율적으로 `emit`·`disconnect` 를 발화한다 — spec §1.2/§4.6 이 명시적으로
    요구하는 의도된 동작이며 arm(`:243`)/disarm(`:284-291`) 쌍도 정확하다. 결함은 아니지만 "이벤트
    발생 시점이 변경됨"(리뷰 관점 8) 자체를 기록해 둔다.

## 검토했으나 이상 없음으로 판단한 항목

- `expiryTimers` Map(`:150-153`)은 `WebsocketGateway` 싱글턴 인스턴스에 귀속된 새 공유 상태이지만,
  기존 `subscriptions`/`WsRateLimiterService` 와 동일한 socket-id 키 arm-on-connect/disarm-on-disconnect
  패턴을 그대로 따른다. `handleConnection` 의 인증 실패 두 경로(`:223`, `:266`)는 모두
  `armExpiryTimers` 호출(`:243`) **이전**에 `disconnect()` 하므로 그 경로들에서 타이머 누수는 없다.
- `websocket-events.types.ts`/`.spec.ts` 의 `AuthEventType`/`AuthTokenExpiredPayload` 신규 export 는
  기존 심볼을 건드리지 않는 순수 additive 변경 — 시그니처·인터페이스 파괴적 변경 없음. (단,
  `EXPECTED_EXPORTS` "완전한 목록" 불변식이 두 심볼에 대해 조용히 좁아진 점은 이미
  `documentation.md`(전 라운드)가 WARNING 으로 포착했으므로 여기서 중복 기재하지 않음.)
- `websocket.gateway.spec.ts` 신규 `describe('토큰 만료 …')` 블록의 `jest.useFakeTimers()`/
  `jest.useRealTimers()` 는 그 블록 자신의 `beforeEach`/`afterEach` 로 스코프돼 있어(`:722-728`)
  형제 `it`/`describe` 로 fake timer 상태가 새는 test-pollution 부작용은 없다.
- `ws-client.ts` 의 `connect()` 는 매 호출마다 새 `socket` 인스턴스를 만들고 리스너도 그 새 인스턴스에
  등록하므로(`:36-114`), 동일 클라이언트 반복 `connect()` 호출로 인한 리스너 누적(핸들러 중복 등록)
  부작용은 없음. `refreshAndReconnect` 가 외부 `let socket` 클로저 변수를 참조하는 점(오래된 소켓의
  콜백이 재연결 후 새 소켓 인스턴스를 건드릴 수 있는 잠재 레이스)은 `connect_error` 경로에서도 이미
  존재하던 기존 패턴이고, 현재 `resetWsClient()`/재-`connect()` 호출부는 테스트 외에 프로덕션
  코드에서 쓰이지 않아(`grep` 확인 — `getWsClient().connect(token)` 은 `workflow-editor.tsx` 마운트
  1회뿐) 실제로 도달 가능한 경로가 아니다.
- 환경 변수 읽기/쓰기, 파일시스템 생성/수정/삭제, 외부 네트워크 신규 호출처(엔드포인트) 도입은 없음
  — `refreshAccessToken()` 은 기존에도 쓰이던 동일 REST 엔드포인트를 그대로 재사용한다.

## 요약

핵심 side effect 표면은 두 곳이다 — 백엔드는 `WebsocketGateway` 싱글턴에 소켓별 만료 타이머
(`expiryTimers` Map)라는 새 공유 상태를 arm/disarm 쌍으로 정확히 추가했고, 프론트는 소켓에 새 자율
이벤트 리스너 2개(`auth.token_expired`, `disconnect` fallback)를 배선해 서버가 개시하는 비동기
push(emit/disconnect)에 반응하도록 만들었다. 두 축 다 의도된 설계이고 인터페이스 변경은
전부 additive 다. 다만 프론트의 3개 재연결 트리거(`connect_error`/`auth.token_expired`/`disconnect`)
중 새로 추가된 2개가 기존 경로에 있던 재진입 가드를 공유하지 않아, 서버의 독립 cutoff 타이머와
클라이언트 재발급 지연이 겹치는 좁은 타이밍 창에서 이미 성공한 재연결을 다시 끊는 잉여 side
effect(불필요한 disconnect→connect 사이클)가 발생할 수 있다 — 이는 전 라운드 concurrency 리뷰가
이미 INFO 로 지적했고 이번 RESOLUTION 의 조치 목록에 포함되지 않아 여전히 남아 있음을 코드로
재확인했다. 그 외에는 예외 오분류(`armExpiryTimers` 예외가 "Invalid token" 으로 흡수) 같은 낮은
우선순위 edge case뿐이며, 전역 변수 신설·파일시스템 변경·환경 변수 접근·시그니처 파괴적 변경·의도치
않은 신규 외부 서비스 호출은 발견되지 않았다.

## 위험도

LOW
