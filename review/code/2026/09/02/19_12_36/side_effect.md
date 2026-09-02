# 부작용(Side Effect) 리뷰

## 검증 방법

프롬프트의 diff 가 일부 파일(`websocket.gateway.ts` · `ws-client.ts` · `ws-client.test.ts` 등)에서
"프롬프트 크기 제한으로 생략" 되어 있어, 해당 파일들은 `git diff origin/main...HEAD -- <path>` 로
직접 재확인하고 `websocket.gateway.ts` 의 `handleConnection`/`handleDisconnect` 전체를 `Read` 로
열어 대조했다. 저장소에는 아무것도 쓰지 않았다(`git status --short` 확인 결과 이 세션의
`review/code/2026/09/02/19_12_36/` 출력 외 변경 없음 — 뮤테이션 테스트 불필요, 로직을 정적으로
추적하는 것만으로 충분히 검증됨).

이 PR 은 이미 3라운드 리뷰(`17_38_12`→`18_18_53`→`18_45_43`)를 거쳤고, side_effect·concurrency
관점의 Critical/Warning(no-op `connect()`, 가드 스코프 누락, cross-generation race)이 전부
`RESOLUTION.md` 에 조치 기록과 함께 남아 있다. 아래는 그 위에서 **독립적으로** 코드를 다시 추적한
결과다.

## 발견사항

- **[INFO]** 네트워크 호출 트리거 표면이 1개(`connect_error`)에서 3개(`connect_error` ·
  `auth.token_expired` · `disconnect("io server disconnect")`)로 확장됨 — in-flight 가드로
  적절히 완화됨을 확인
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts` — `refreshAndReconnect` 헬퍼
    (함수 상단 `let inFlight: Promise<void> | null = null;` 및 `if (inFlight) return inFlight;`)
  - 상세: `refreshAccessToken()`(REST `/auth/refresh`)을 호출하는 지점이 세 이벤트 트리거로
    늘었다. 코드를 직접 읽어 `inFlight` 가드가 헬퍼 내부에 있어 세 트리거 어느 쪽이 먼저 와도
    중복 호출되지 않음을 확인했고(`socket !== mySocket` 세대 비교까지 포함), `.finally(() =>
    inFlight = null)` 로 완료 후 재무장되는 것도 확인했다. 의도된 확장이며 관측된 결함은 없다 —
    부작용 관점에서 "네트워크 호출 트리거가 늘었다" 는 사실 자체는 기록해 둔다.
  - 제안: 없음(이미 3R 에 걸쳐 검증·고정됨).

- **[INFO]** backend 에 새 소켓별 mutable 상태(`expiryTimers` Map)와 두 개의 `setTimeout` 이
  소켓 연결마다 추가됨 — 기존 `subscriptions`/`WsRateLimiterService` 와 동일한 lifecycle 패턴을
  따르는지 직접 대조 확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `expiryTimers` 필드
    선언부(`armExpiryTimers` 바로 위), `handleConnection` 내 `this.armExpiryTimers(client,
    payload.exp);` 호출, `handleDisconnect` 내 `clearTimeout` 두 줄.
  - 상세: `handleConnection` 은 `try` 블록 안에서 `armExpiryTimers` 를 호출한 **뒤에도**
    `subscriptions.set` · `onAny` 등록이 이어진다. 이 이후 코드가 예외를 던지면 `catch` 블록이
    `client.disconnect()` 만 부르고 `expiryTimers` 를 직접 정리하지 않는다 — 그런데 NestJS
    gateway 의 `handleDisconnect` 훅은 socket.io 의 `disconnect` 이벤트에 바인딩되어 있어
    `client.disconnect()` 호출이 `handleDisconnect` 를 유발하고, 거기서 두 타이머가 모두
    `clearTimeout` 된다 — 기존 `subscriptions.delete`/`wsRateLimiter.release` 정리도 같은
    간접 경로에 의존하므로 이 PR 이 새로 만든 위험이 아니라 기존 불변식을 그대로 따른 것이다.
    타이머 콜백(`notice`/`cutoff`) 자체는 `this.expiryTimers` 를 지우지 않지만 그럴 필요가
    없다 — 정리는 항상 `handleDisconnect` 단일 경로로 수렴한다.
  - 제안: 없음(관측된 누수 경로 없음, 정보성 기록).

- **[INFO]** frontend `ws-client.ts` 의 `connect()` 가 매 호출마다 소켓 인스턴스에 붙이는
  리스너 수가 3개(`error`·`connect`·`connect_error`)에서 5개(`+auth.token_expired`
  `+disconnect`)로 늘었는데, 이전 세대 소켓에 대한 `removeAllListeners()`/`off()` 는 이번에도
  다음에도 없음(기존 패턴 그대로)
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts` 의 `connect` 함수 —
    `if (socket) { socket.disconnect(); }` 직후 `socket = io(...)` 로 새 인스턴스를 만들고
    이어서 5개 `socket.on(...)` 을 등록하는 지점.
  - 상세: 이전 세대 소켓은 `disconnect()` 만 호출될 뿐 리스너가 명시적으로 해제되지 않는다.
    본 PR 이전에도 동일한 패턴(3개 리스너 방치)이었으므로 회귀는 아니지만, 리스너 수가 늘어난
    만큼 방치되는 클로저(각자 자기 세대의 `inFlight`·`mySocket` 을 캡처)도 늘었다. 실측 결과
    이 방치된 리스너들이 부작용을 일으키지 않음을 코드로 확인했다 — 클라이언트가 스스로
    `disconnect()` 를 호출하면 socket.io 는 reason `"io client disconnect"` 를 주는데,
    fallback 핸들러는 `reason !== "io server disconnect"` 를 걸러내므로 구세대 소켓의
    `disconnect` 핸들러가 재발급을 트리거하지 않는다. 다른 소비자(`use-execution-events.ts` 의
    `bind("disconnect", onDisconnect)`)도 별개의 소켓별 UI 상태(`isConnected`/
    `snapshotReceived`)만 건드려 이 헬퍼와 충돌하지 않는다.
  - 제안: 지금 당장 결함은 아니다. 다만 리스너가 계속 늘어나는 추세라면(이번이 +2), 다음
    확장 시점에는 `connect()` 진입부에서 `socket.removeAllListeners()` 를 명시적으로 부르는
    편이 "방치된 구세대 리스너가 부작용을 안 낸다" 는 사실을 코드마다 각주로 증명해야 하는
    현재 상태보다 안전하다.

- **[INFO]** 새 서버 발신 이벤트 `auth.token_expired` 는 구독하지 않는 (구버전) 클라이언트에는
  그냥 무시되는 additive 변경이지만, 배포 전환 창 동안 구코드가 무통지로 끊기는 부작용은 이미
  `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`(§"배포 전환 창 리스크") 와 1R
  `RESOLUTION.md` W6 에 등재되어 배포 런북 판단으로 넘겨져 있음을 재확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:283`
    부근(`client.emit(AuthEventType.AUTH_TOKEN_EXPIRED, payload)`, 실제 줄 번호는
    `armExpiryTimers` 내부 `timers.notice = setTimeout(...)` 블록)
  - 상세: 코드 관점에서는 broadcast 가 아니라 `client.emit`(해당 소켓 1개)이라 다른 사용자에게
    새어나가지 않는다. 부작용은 "이 로직을 모르는 구버전 번들이 최대 900초 뒤 무통지로 끊긴다"
    는 배포 시점 문제이며, 코드로 막을 수 있는 종류가 아니라는 plan 의 판단에 동의한다. 새로
    발견한 사실은 없다 — side-effect 관점에서도 유효한 리스크임을 확인 차 기록.
  - 제안: 없음(이미 등재·처분 완료, 코드 조치 대상 아님).

- **[INFO]** `review/**` 하위 78개 파일 diff 중 67개는 이전 3라운드 리뷰/consistency 세션의
  산출물(`RESOLUTION.md`·`SUMMARY.md`·`meta.json`·`_retry_state.json` 등)이 커밋에 포함된 것 —
  코드 실행 시점의 파일시스템 부작용이 아니라 워크플로 산출물이 저장소 관례
  (`review/code/<ts>/`, `review/consistency/<ts>/` 는 SoT 로 커밋 대상)를 따른 것임을 확인
  - 위치: `review/code/2026/09/02/{17_38_12,18_18_53,18_45_43}/**`,
    `review/consistency/2026/09/02/{17_08_55,17_09_30,17_11_15,17_11_16,17_11_33,17_11_34,
    17_13_02}/**`
  - 상세: `_retry_state.json`/`meta.json` 내용을 열어 대조했고 경로·라우팅 사유 문자열만
    담겨 있어 비밀값·환경변수 유출 등은 없다.
  - 제안: 없음.

## 요약

핵심 애플리케이션 코드(backend `websocket.gateway.ts`, frontend `ws-client.ts`)를 diff 가
생략한 부분까지 직접 열어 추적한 결과, 이번 PR 이 도입한 부작용 표면(신규 네트워크 호출
트리거 3곳·신규 소켓별 타이머 상태·신규 서버 이벤트·신규 클라이언트 리스너 2개)은 모두
in-flight 가드·세대 스냅샷 비교·`handleDisconnect` 단일 정리 경로로 의도대로 격리되어 있고,
이는 이미 3라운드에 걸친 리뷰-수정 사이클이 정확히 이 축(no-op `connect()`, 가드 스코프,
cross-generation race)을 다뤘기 때문이다. 독립적으로 재추적한 결과 새로운 Critical/Warning
급 부작용은 발견하지 못했다. 남은 항목은 전부 INFO 수준(리스너 정리 없음의 확장, 배포 전환
창)이며 이미 알려진 트레이드오프이거나 코드 조치 대상이 아니다. 전역 변수 신규 도입,
기존 함수 시그니처의 호출자에게 영향을 주는 breaking 변경, 예기치 않은 파일시스템·환경 변수
접근은 발견되지 않았다.

## 위험도

LOW
