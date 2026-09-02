# 성능(Performance) 리뷰 — WS 토큰 만료 소켓 수명 종속 (`auth.token_expired`)

대상: `websocket.gateway.ts`(`armExpiryTimers`/`handleConnection`/`handleDisconnect`) ·
`websocket-events.types.ts` · `ws-client.ts`(`refreshAndReconnect` + 3개 트리거) 및 대응 테스트.
`review/code/**`·`review/consistency/**`(파일 10~44)는 이전 라운드/checker 실행 산출물로 성능
분석 대상이 아니므로 제외한다.

## 발견사항

- **[WARNING]** 만료 사전 통지·강제 종료 타이머에 지터(jitter)가 없어, 동시 접속 클라이언트들의
  재연결+토큰 재발급이 900초 주기로 동기화되어 뭉칠 수 있다 (thundering herd)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:170`(`armExpiryTimers`
    함수 전체) — 특히 `:187-190`(`untilNotice` 계산, `TOKEN_EXPIRY_LEAD_MS` 고정 60_000ms)과
    `:201-207`(`cutoff` `setTimeout`, `Math.max(0, untilCutoff)`)
  - 상세: 두 타이머 모두 `exp`(JWT 발급 시각 + 고정 900초)로부터 결정론적으로 역산된 지연을
    쓴다 — 랜덤 요소가 전혀 없다. 로그인이 몰리는 이벤트(업무 시작 시각, 배포 직후 대량
    재연결, 장애 복구 후 재접속 폭주 등)에서는 다수 소켓의 `exp` 가 근접한 시각에 몰리고,
    그 결과 `notice`(만료 60초 전)와 `cutoff`(만료 시점) 타이머도 초 단위로 동기화된다.
    이는 (1) 프론트 `ws-client.ts` 의 `refreshAndReconnect` 가 같은 시각대에 일제히
    REST `/auth/refresh` 호출을 발생시키고, (2) 곧이어 같은 시각대에 `socket.disconnect()`→
    `socket.connect()` 재핸드셰이크(JWT 재검증 포함)를 일제히 발생시킨다는 뜻이다. 더 중요한
    점은 **재발급된 새 토큰도 다시 `exp = now + 900` 로 고정**되므로(spec 상 access token
    TTL 은 상수), 한 번 동기화된 코호트는 지터가 없는 한 이후 모든 15분 주기마다 계속
    동기화된 채로 남는다 — 자기 강화적 정상 상태(steady-state) thundering herd 다. 이 경로는
    N+1 형태의 반복 DB/API 호출은 아니지만, 리뷰 관점 6(불필요한 연산)·2(N+1 호출)이 겨냥하는
    "예측 가능한데 방지되지 않은 부하 집중"에 해당한다. spec(`6-websocket-protocol.md`
    §1.2/§9.2)과 이번 plan(`ws-token-expired-socket-lifetime-impl.md`) 어디에도 지터·부하
    분산은 언급되지 않는다(grep 결과 §6.1 의 "지터" 언급은 Socket.IO 내장 reconnection backoff
    전용이며 이 만료 타이머와 무관).
  - 제안: `untilNotice`/`untilCutoff` 계산에 소켓별 소폭 랜덤 지터(예: ±5~15초, 또는
    `TOKEN_EXPIRY_LEAD_MS` 자체에 랜덤 성분 추가)를 더해 동시 만료 클러스터를 시간축으로
    분산한다. 최소한 배포 런북에 "대량 동시 로그인 후 15분 주기 재연결 스파이크 가능성"을
    기록해 둘 것 — 이미 등재된 W6(배포 전환 창)와는 다른 축의 운영 리스크다.

## 검토했으나 이상 없음으로 판단한 항목

- **소켓당 타이머 2개(`notice`/`cutoff`) 오버헤드**: `expiryTimers` Map 은 `subscriptions`/
  `WsRateLimiterService` 와 동일한 socket-id 키 패턴이라 조회/삽입 O(1)이고, `handleDisconnect`
  (`websocket.gateway.ts:284-291`)에서 두 타이머를 예외 없이 `clearTimeout` + `Map.delete` 하므로
  소켓당 누수는 없다. Node 의 타이머 힙은 수만 개 규모까지 문제없이 처리하는 구조라, 지터 문제와
  별개로 "타이머 개수 자체"는 성능 병목이 아니다.
  검증: `websocket.gateway.spec.ts:777-791`("handleDisconnect 가 두 타이머를 모두 해제한다") 이
  이 계약을 직접 단언한다.
- **블로킹 I/O**: `armExpiryTimers`·타이머 콜백 모두 동기 CPU 연산(`Date.now()`, `Math.max`,
  `new Date().toISOString()`)뿐이며 DB/네트워크 호출이 없다.
- **문자열/객체 생성 비용**: 콜백마다 `payload` 객체 리터럴 1개, `Math.max(0, …)` 중복 방어 1회
  — 소켓당 1회성이라 무시 가능한 수준(주석이 스스로 "의도적 중복 방어"라고 실측 근거를 남김,
  `websocket.gateway.ts:183-186`).
- **frontend 중복 REST 호출**: 이전 라운드(CRITICAL #1, `review/code/2026/09/02/17_38_12/
  concurrency.md`)에서 지적된 "정상 경로가 no-op 이라 매 주기 REST refresh 가 2회 발생" 문제는
  이번 diff 의 `ws-client.ts:66`(`if (socket.connected) socket.disconnect();`)로 구조적으로
  해소됐다 — 통지 시점에 실제 재핸드셰이크가 일어나므로 서버측 `cutoff` 콜백이 도달하기 전에
  `handleDisconnect` 가 옛 소켓의 타이머를 정리하고, fallback(`disconnect` reason 가드,
  `ws-client.ts:111-114`)은 재진입하지 않는다. 재검증 결과 회귀 없음.
- **데이터 구조**: `Map<socketId, {notice, cutoff}>` 은 이 파일의 기존 관례(`subscriptions`,
  rate-limiter)와 일관되고 용도(소켓별 O(1) 조회/정리)에 적합하다.
- **캐싱**: 이 변경은 캐시를 도입/무효화하지 않는다(해당 없음).
- **지연 로딩**: 타이머는 `handleConnection` 시점에만 arm 되고 그 전에 다른 리소스를 선행
  로딩하지 않는다 — 해당 없음.

## 요약

이번 diff 는 소켓당 O(1) 오버헤드(Map 엔트리 1개 + 타이머 2개)만 추가하며, 블로킹 I/O·N+1
DB/API 패턴·비효율 자료구조·불필요한 객체 대량 생성·메모리 누수 같은 전형적 성능 안티패턴은
관측되지 않는다(타이머 해제는 테스트로 계약화돼 있고 이전 라운드에서 지적된 중복 REST 호출
문제도 이번 diff 의 명시적 재핸드셰이크 수정으로 구조적으로 해소됐다). 유일한 실질적 우려는
설계 차원의 것으로, 만료 타이머 지연 계산에 지터가 전혀 없어 로그인이 몰리는 이벤트 뒤에는
재연결·토큰 재발급이 15분 주기로 계속 동기화되어 뭉칠 수 있다는 점이다 — 즉시 결함은 아니지만
트래픽 규모가 커지면 auth 서비스·gateway 에 주기적 부하 스파이크를 만들 수 있어 조치를 권한다.

## 위험도

LOW–MEDIUM (WARNING 1건 — 지터 부재로 인한 주기적 부하 집중 가능성; 그 외 관측된 성능 결함 없음)
