# 부작용(Side Effect) 리뷰

## 검증 방법

프롬프트가 크기 제한으로 생략한 파일(`websocket.gateway.ts` · `ws-client.ts` ·
`ws-client.test.ts` · `ws-token-expired-socket-lifetime-impl.md`)은 `git diff
origin/main..HEAD -- <path>` 로 전문을 직접 확인했고, `handleConnection`/`handleDisconnect`
전체와 `KNOWN_WS_EVENTS`/`onAny` 배선은 `Read` 로 원본을 열어 대조했다. `main.ts` ·
`instrumentation.ts` · `shutdown-state.service.ts` 를 추가로 열어 그레이스풀 셧다운 경로에
새 타이머가 미치는 영향을 별도로 추적했다(아래 INFO #3). 저장소에는 아무것도 쓰지 않았다 —
`git status --short` 로 확인한 결과 이 세션 출력 디렉터리 외 변경 없음. 뮤테이션 테스트는
수행하지 않았다(정적 추적만으로 판단 가능한 범위).

이 PR 은 이미 4라운드 리뷰-수정 사이클(`17_38_12`→`18_18_53`→`18_45_43`→`19_12_36`)을 거쳤고,
`19_12_36` 라운드의 side_effect 리뷰가 이미 이번과 동일한 핵심 표면(신규 네트워크 트리거 3곳·
신규 소켓별 타이머 상태·신규 서버 이벤트·신규 리스너 2개)을 독립적으로 추적해 LOW/전부 INFO로
판정했다. 그 라운드가 낸 WARNING 3건(flaky 테스트·허위 "조치했다" 기록·JSDoc 과잉 서술)은
side-effect 범주가 아니었고 4R 커밋(`a18376f0c`)에서 조치됨을 `git show` 로 확인했다(이중
빈 줄 제거 1건, JSDoc 축소 1건, flaky 는 plan 에 watch 항목으로 등재). 아래는 그 위에서 **한 번
더 독립적으로** 추적한 결과이며, 이전 라운드가 다루지 않은 각도(그레이스풀 셧다운 상호작용)를
추가로 확인했다.

## 발견사항

- **[INFO]** backend `WebsocketGateway` 에 신규 소켓별 mutable 상태(`expiryTimers` Map)와
  연결마다 2개의 `setTimeout` 이 추가됨 — 정리 경로가 `handleDisconnect` 단일 지점으로
  수렴함을 코드로 재확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` —
    `expiryTimers` 필드 선언(`armExpiryTimers` 메서드 바로 위), `handleConnection` 내
    `this.armExpiryTimers(client, payload.exp);` 호출, `handleDisconnect` 내
    `const timers = this.expiryTimers.get(client.id); if (timers) { ... }` 블록
  - 상세: `handleConnection` 의 `try` 블록 안에서 `armExpiryTimers` 호출 **이후**에도
    `subscriptions.set` · `client.onAny(...)` 등록이 이어진다. 이후 코드가 예외를 던지면
    `catch` 는 `client.disconnect()` 만 호출하고 `expiryTimers` 를 직접 정리하지 않지만,
    NestJS 게이트웨이의 `handleDisconnect` 훅이 socket.io 의 `disconnect` 이벤트에 바인딩돼
    있어 `client.disconnect()` 호출이 그대로 `handleDisconnect` 를 유발하고 거기서 두 타이머가
    모두 `clearTimeout` 된다 — `subscriptions.delete`/`wsRateLimiter.release` 도 같은 간접
    경로에 의존하므로 이 PR 이 새로 만든 위험이 아니라 기존 불변식을 그대로 따른다. 타이머
    콜백(`notice`/`cutoff`) 자체는 `this.expiryTimers` 를 지우지 않지만 그럴 필요가 없다 —
    정리는 항상 `handleDisconnect` 로 수렴한다.
  - 제안: 없음(관측된 누수 경로 없음, 정보성 기록).

- **[INFO]** frontend `ws-client.ts` 의 네트워크 호출(`refreshAccessToken()`, REST
  `/auth/refresh`) 트리거 표면이 1개(`connect_error`)에서 3개로 확장됨 — in-flight 가드 +
  세대 비교로 중복 호출이 격리됨을 코드로 재확인
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts` — `refreshAndReconnect` 헬퍼
    (`let inFlight: Promise<void> | null = null;`, `if (inFlight) return inFlight;`,
    `if (!newToken || !mySocket || socket !== mySocket) return;`)와 이를 호출하는
    `connect_error` / `auth.token_expired` / `disconnect("io server disconnect")` 세 지점
  - 상세: 세 트리거 중 어느 쪽이 먼저 와도 `inFlight` 가 이미 걸려 있으면 그 Promise 를
    그대로 반환해 `refreshAccessToken()` 이 중복 호출되지 않고, `.finally(() => inFlight =
    null)` 로 완료 후 재무장됨을 확인했다. `mySocket` 스냅샷 + `socket !== mySocket` 세대
    비교로 `await` 도중 `connect()` 가 재호출돼 세대가 바뀌는 경우도 옛 세대가 새 세대를
    건드리지 않도록 격리돼 있다. 자기 자신이 유발한 `mySocket.disconnect()` 는 로컬에서
    reason `"io client disconnect"` 를 내므로, `disconnect` 핸들러의 `reason !== "io server
    disconnect"` 가드에 걸려 재귀적으로 `refreshAndReconnect` 를 재호출하지 않는다 — 자기
    유발 루프 없음을 확인.
  - 제안: 없음(3라운드에 걸쳐 검증·고정됨, 이번 라운드도 재확인만).

- **[INFO]** 그레이스풀 셧다운 경로와 신규 타이머의 상호작용 — 이전 라운드가 다루지 않은
  각도. 명시적 `process.exit()` 없음을 확인했으나 실질적 블로킹 근거는 찾지 못함
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `armExpiryTimers`
    내부 `timers.notice = setTimeout(...)`/`timers.cutoff = setTimeout(...)` (둘 다
    `.unref()` 없이 등록). 대조 확인한 셧다운 경로: `codebase/backend/src/main.ts:254`
    (`app.enableShutdownHooks()`), `codebase/backend/src/modules/execution-engine/shutdown/
    shutdown-state.service.ts`(`onApplicationShutdown`, `SIGTERM_GRACE_MS` 기본 30000ms),
    `codebase/backend/src/instrumentation.ts:104`(OTel 전용 `SIGTERM` 핸들러, `process.exit`
    없음)
  - 상세: 이 코드베이스에서 `process.exit()` 를 명시적으로 호출하는 셧다운 경로를 찾지
    못했다 — 즉 정상 종료는 이벤트 루프가 자연 drain 되는 것에 의존한다. `expiryTimers` 의
    `setTimeout` 은 `.unref()` 되지 않은 active handle 이라, 이론적으로는 이벤트 루프를 최대
    900초(access token TTL)까지 붙잡을 수 있는 새로운 handle 클래스다 — 같은 모듈의
    `WsRateLimiterService` 는 `setInterval`/`setTimeout` 을 전혀 쓰지 않아(`grep` 확인, 매치
    0건) 이 패턴이 이 모듈에서는 처음이다. 다만 NestJS 의 socket.io 어댑터는 `app.close()`
    시 기반 `Server.close()` 를 호출하는데, socket.io 의 `Server.close()` 는 연결된 클라이언트
    소켓을 능동적으로 종료하는 것으로 알려져 있다 — 그렇다면 셧다운 시 모든 소켓이
    `disconnect` 이벤트를 받아 `handleDisconnect` 가 즉시 실행되고 타이머도 즉시
    `clearTimeout` 되므로 실질적 블로킹은 없을 가능성이 높다. **이 마지막 단계(소켓 강제
    종료 타이밍)는 정적 추적만으로 확증하지 못했다** — 실행 중인 서버에 대한 SIGTERM 통합
    테스트가 필요하고 이 리뷰의 범위를 벗어난다.
  - 제안: 확정된 결함이 아니라 미검증 가정에 대한 기록이다. `.unref()` 를 `timers.notice`/
    `timers.cutoff` 양쪽에 추가하면 이 가정 자체를 없앨 수 있고 비용이 0에 가깝다(소켓
    라이프사이클에 영향 없음, `clearTimeout` 은 unref 여부와 무관하게 동일하게 동작).
    지금 병합을 막을 사안은 아니다.

- **[INFO]** frontend `connect()` 가 매 호출마다 붙이는 리스너가 3개(`error`·`connect`·
  `connect_error`)에서 5개(`+auth.token_expired`, `+disconnect`)로 늘었는데, 이전 세대
  소켓에 대한 `removeAllListeners()`/`off()` 호출은 여전히 없음(PR 이전부터 있던 패턴)
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts` — `connect` 함수 진입부
    `if (socket) { socket.disconnect(); }` 직후 `socket = io(...)` 로 새 인스턴스를 만들고
    이어서 5개 `socket.on(...)` 을 등록하는 지점
  - 상세: 방치되는 구세대 리스너가 실제로 부작용을 일으키는지 코드로 추적했다 — 구세대
    소켓이 스스로 `disconnect()` 되면 reason 이 `"io client disconnect"` 라 fallback
    핸들러가 걸러내고, `refreshAndReconnect` 내부의 `mySocket`/세대 비교가 구세대의 재발급
    결과가 새 세대를 건드리지 못하게 막는다. 새로 발견한 위험은 없다 — 리스너 수가 3→5로
    늘어난 만큼 "방치돼도 안전하다" 는 근거를 코드 각주로 매번 증명해야 하는 표면적만 커졌다.
  - 제안: 지금 결함은 아니다. 다음에 리스너가 더 늘어나는 시점에는 `connect()` 진입부에서
    `socket.removeAllListeners()` 를 명시적으로 부르는 편이 안전하다(이미 3라운드째 이월된
    INFO, 이번 라운드도 재확인).

- **[INFO]** 새 서버 발신 이벤트 `auth.token_expired` 는 `client.emit`(단일 소켓 대상)이지
  broadcast 가 아니며, 기존 인바운드 이벤트 완전성 게이트(`KNOWN_WS_EVENTS`/`onAny`)와
  네임스페이스 충돌이 없음을 직접 확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:41-50`
    (`KNOWN_WS_EVENTS` — 인바운드 전용, `auth.token_expired` 는 아웃바운드라 해당 없음이
    맞음), `codebase/backend/src/modules/websocket/websocket-events.types.ts:284`
    (`AUTH_TOKEN_EXPIRED = 'auth.token_expired'`)
  - 상세: `grep -rn "auth.token_expired|AUTH_TOKEN_EXPIRED|TOKEN_EXPIRED"` 로 전 코드베이스를
    훑어, DB `status_reason` 슬러그 `token_expired`(`integration-status-reason.ts`)와 REST/JWT
    에러 코드 `TOKEN_EXPIRED`(`auth.service.ts`, `interaction.guard.ts`)가 표기만 비슷할 뿐
    별개 네임스페이스로 남아 있고 JSDoc 이 그 구분을 명시함을 확인했다. `onAny` 핸들러는
    클라이언트→서버 인바운드 이벤트만 잡으므로 서버가 새로 emit 하는 이 아웃바운드 이벤트와
    상호작용하지 않는다. 구버전(이 이벤트를 모르는) 클라이언트는 등록 안 된 이벤트를 조용히
    무시하므로 additive 변경이다 — 배포 전환 창 리스크는 이미 plan/1R RESOLUTION 에 등재돼
    코드 조치 대상이 아님을 재확인.
  - 제안: 없음.

- **[INFO]** `review/**` 하위로 커밋된 이전 라운드 산출물(`RESOLUTION.md`·`SUMMARY.md`·
  `meta.json`·`_retry_state.json` 등)은 코드 실행 시점 파일시스템 부작용이 아니라 저장소
  관례(`review/code/<ts>/`, `review/consistency/<ts>/` 는 SoT 로 커밋 대상)를 따른 것임을
  재확인 — `_retry_state.json`/`meta.json` 내용에 절대경로와 라우팅 사유 문자열만 있고
  비밀값·환경변수 유출은 없음
  - 위치: `review/code/2026/09/02/{17_38_12,18_18_53,18_45_43,19_12_36}/**`,
    `review/consistency/2026/09/02/**`
  - 제안: 없음.

## 요약

핵심 애플리케이션 코드(backend `websocket.gateway.ts`, frontend `ws-client.ts`)를 diff 가
생략한 부분까지 전문 대조한 결과, 이 PR 이 도입한 부작용 표면(신규 네트워크 호출 트리거
3곳·신규 소켓별 타이머 상태 2개·신규 서버→클라이언트 이벤트 1개·신규 클라이언트 리스너 2개)은
모두 in-flight 가드·세대 스냅샷 비교·`handleDisconnect` 단일 정리 경로로 의도대로 격리돼
있다. 4라운드에 걸친 리뷰-수정 사이클이 정확히 이 축(no-op `connect()`, 가드 스코프,
cross-generation race)을 다뤘고 이번 독립 추적에서도 새로운 Critical/Warning 급 부작용은
찾지 못했다. 이번 라운드에서 추가로 확인한 것은 그레이스풀 셧다운 경로와의 상호작용인데,
이 코드베이스가 SIGTERM 시 `process.exit()` 를 명시적으로 호출하지 않는다는 사실을 확인했고
신규 `setTimeout` 이 `.unref()` 없이 등록돼 있어 이론적 우려는 있으나, socket.io 서버의
`close()` 가 연결된 소켓을 능동 종료하는 기존 동작에 의해 실질적으로 완화될 가능성이 높다 —
확정된 결함이 아니라 실행 중 SIGTERM 통합 테스트로만 확증 가능한 미검증 가정으로 기록한다.
전역 변수 신규 도입, 기존 함수/메서드 시그니처의 호출자 파괴적 변경, 예기치 않은 파일시스템
접근, 의도하지 않은 환경 변수 읽기/쓰기, 의도하지 않은 외부 네트워크 호출은 발견되지 않았다.

## 위험도

LOW
