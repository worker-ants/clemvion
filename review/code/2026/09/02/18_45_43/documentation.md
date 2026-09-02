# 문서화(Documentation) 리뷰 — WS 소켓 수명 = 토큰 수명 (`auth.token_expired`), 3R

## 배경 — 이전 라운드 대비 확인

이번 diff 는 핵심 구현(파일 1~9: `CHANGELOG.md`, `websocket-events.types.{ts,spec.ts}`,
`websocket.gateway.{ts,spec.ts}`, `ws-client.{ts,test.ts}`, plan 문서 2건)과 함께 직전 두 리뷰
라운드(`review/code/2026/09/02/17_38_12/**`, `18_18_53/**`)와 `--impl-prep` 세션 아티팩트를
커밋으로 포함한다. 1R·2R 의 `documentation.md` 가 낸 WARNING 3건(`EXPECTED_EXPORTS` 완전성
목록 누락·CHANGELOG 미갱신·spec 배지 후속 포인터 부재)은 실제 파일(`Read`)로 대조해 모두
해소를 재확인했다:

- `websocket-events.types.spec.ts` `EXPECTED_EXPORTS` 에 `AuthEventType`·`AuthTokenExpiredPayload`
  가 이유 주석과 함께 존재.
- `CHANGELOG.md` `Unreleased` 섹션에 `connect()` no-op 함정·revoke 카브아웃까지 포함한 서술형
  항목 존재.
- `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 체크리스트에 "머지 후 planner
  턴 — spec 배지 flip" 항목이 신설돼 있고, spec(`6-websocket-protocol.md:52,876,1100,1133`)은
  실제로 여전히 `_(계획·미구현)_` 배지가 남아 있음을 직접 확인했다. developer 가 그 문구의
  원저자가 아니므로 자기-반증형 소정정 예외 대상이 아니라는 판단이 맞고, 포인터가 남아
  추적이 끊기지 않는다 — 신규 지적 아님, 재확인.

2R 이 낸 INFO 1건(`cutoff` 타이머 `Math.max(0, untilCutoff)` 클램프에 개별 설명 부재,
`websocket.gateway.ts` 현재 201~207행)도 현재 코드에 그대로 남아 있음을 재확인했다 — 차단
사유 아님, 재확인 차 유지.

## 발견사항

- **[WARNING]** `ws-client.ts` `connect()` 의 pending-가드 주석이 이번 PR 이 넓힌 트리거
  표면을 반영하지 않는다 — "connect_error 핸들러" 만 언급
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts` `connect` 함수 상단 pending-가드
    주석(`Read` 로 직접 확인한 실제 줄 번호 22~30행, 특히 26~27행:
    `// 포함하므로 이를 함께 가드한다. (토큰 갱신 재연결은 이 함수가 아니라` /
    `// connect_error 핸들러가 기존 인스턴스의 auth 갱신 후 재연결하므로 무영향.)`) — 이
    구간은 이번 diff 의 unified diff 블록에 나타나지 않는(즉 게이트 숫자가 없는) 기존
    컨텍스트라 `Read` 로 직접 열어 줄 번호를 확인했다.
  - 상세: 이 주석은 `if (socket && (socket.connected || socket.active)) return;` 가드가
    "토큰 갱신 재연결" 흐름을 막지 않는 이유를 설명하면서, 그 흐름의 주체를 **"connect_error
    핸들러"** 하나로만 지목한다. 이 PR 이전에는 실제로 그게 유일한 경로였다. 그런데 이번
    PR 은 정확히 같은 "재발급 → `auth.token` 교체 → 명시적 재연결"을 수행하는 공유 헬퍼
    `refreshAndReconnect`(52~86행)를 신설해 **세 트리거**(`connect_error`·
    `auth.token_expired`·`disconnect: io server disconnect`)가 공유하도록 만들었다
    (`connect_error` 는 106행, `auth.token_expired` 는 119~121행, `disconnect` 는
    126~129행에서 각각 위임 호출). 즉 지금은 세 경로 모두 이 pending-가드를 우회해 기존
    소켓 인스턴스에서 직접 재핸드셰이크하는데, 가드 옆 주석은 여전히 그 중 하나만 원인으로
    적는다. 동작 자체에는 영향이 없다(가드 우회 사실 자체는 세 경로 모두 여전히 참이다) —
    다만 이 특정 가드가 "왜 신규 두 트리거(§1.2/§9.2)와 충돌하지 않는가"를 추적하려는
    다음 사람이 이 자리만 읽으면 `auth.token_expired`/`disconnect` 경로의 존재를 놓칠 수
    있다. 같은 파일의 49~58행 주석이 "세 트리거의 공통 몸통"이라고 명시적으로 적어 둔
    사실과 대비하면, 이 오래된 주석만 갱신에서 빠진 모양새다.
  - 제안: 괄호 안 문구를 "connect_error · auth.token_expired · disconnect(io server
    disconnect) 세 트리거가 공유하는 `refreshAndReconnect` 헬퍼가 기존 인스턴스에서 직접
    재연결하므로 무영향" 정도로 갱신해, 49~58행의 최신 서술과 일치시킨다. 동작 변경 없음,
    문서 정확성만의 이슈.

- **[INFO]** (재확인, 미해결 이월) `cutoff` 타이머의 `Math.max(0, untilCutoff)` 클램프에
  개별 설명이 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `timers.cutoff =
    setTimeout(...)` 블록(`Read` 로 확인한 실제 줄 번호 201~207행). 인접한 `untilNotice`
    클램프 설명은 182~186행.
  - 상세: 2R `documentation.md` 가 이미 지적한 항목이 이번 라운드에도 그대로 남아 있다.
    `armExpiryTimers` 안에는 `Math.max(0, …)` 클램프가 두 곳(`untilNotice` 계산과 `cutoff`
    타이머 지연)에 각각 쓰이는데, "이 clamp 를 빼도 동작이 같고 실제로 뮤테이션에서 살아남았다
    (M3)… 런타임 구현 세부를 코드가 표현하려는 계약으로 명시한다"는 근거는 `untilNotice`
    바로 위(182~186행)에만 달려 있고 `cutoff` 쪽(206행)에는 참조가 없다. 같은 함수 안에
    8줄 간격이라 실제 혼동 가능성은 낮다.
  - 제안: `Math.max(0, untilCutoff)` 옆에 "notice 와 같은 이유 — 위 설명 참조" 정도의 짧은
    참조 주석을 추가하거나 두 클램프를 한 헬퍼로 묶어 설명을 한 곳으로 합친다. 차단 사유
    아님.

- **[INFO]** (재확인, 이미 등재됨) spec 이 이 이벤트를 여전히 `_(계획·미구현)_`(Planned)로
  표기 — 구현 완료와 spec 배지 불일치
  - 위치: `spec/5-system/6-websocket-protocol.md:52`(§1.2), `:876`(§4.6 표),
    `:1100`·`:1133`(Rationale)
  - 상세: 이번 diff(파일 1~9)가 backend 타이머·emit·frontend 구독/재연결을 모두 구현했음을
    코드로 확인했지만 spec 은 아직 "미구현"으로 표기한다. 이미 `ws-token-expired-socket-
    lifetime-impl.md` 체크리스트에 "머지 후 planner 턴 — spec 배지 flip" 으로 등재돼 있고,
    developer 가 그 문구의 원저자가 아니므로 자기-반증형 소정정 예외 대상이 아니라는 판단도
    맞다 — 은닉된 누락이 아니라 추적된 후속 조치다. 1R·2R api_contract/documentation 리뷰가
    이미 같은 결론을 냈다.
  - 제안: 코드 조치 불요. 이미 등재된 planner 턴을 머지 후 실제로 수행할 것.

## 검토했으나 이상 없음으로 판단한 항목

- **신규 JSDoc(`AuthEventType`/`AuthTokenExpiredPayload`/`TOKEN_EXPIRY_LEAD_MS`/
  `expiryTimers`/`armExpiryTimers`)**: spec 절번호(§1.2/§4.6/§9.2)·Rationale ID
  (`R-ws-socket-lifetime-binds-token`)·수치(60초, 900초의 약 6.7%)가 실제 spec 문서·코드
  상수와 `grep`/`Read` 대조로 일치. `expiresAt` 3중 명명 충돌(`_retryState.expiresAt`·
  `auth.refreshed.expiresAt`) 구분 서술도 정확.
- **인라인 주석-코드 일치**: `ws-client.ts` 의 `refreshAndReconnect`·
  `socket.on("auth.token_expired", …)`·`socket.on("disconnect", …)` 블록 주석은 실제 조건
  분기(reason 필터, disconnect→connect 순서)와 정확히 대응. `websocket.gateway.ts` 의
  `handleConnection`/`handleDisconnect` 인접 주석도 실제 arm/disarm 쌍과 일치.
  `websocket-events.types.ts` 의 `{@link AuthEventType.AUTH_TOKEN_EXPIRED}` TSDoc 문법도 파일
  관례와 일치.
- **테스트 설명 vs 실제 검증**: `websocket.gateway.spec.ts`("해제 누락은 소켓당 누수다",
  "lead time 보다 짧게 남은 토큰은 즉시 통지")와 `ws-client.test.ts`("재핸드셰이크한다
  (disconnect → connect)", "겹친 트리거는 한 번만 재연결한다 — in-flight 가드",
  "connect_error 도 같은 헬퍼로 위임된다") 의 `describe`/`it` 문구가 실제 단언(호출 순서,
  호출 횟수, 가드 우회 여부)과 부합 — 문서 역할을 하는 테스트명이 정확하다.
- **CHANGELOG**: `Unreleased` 섹션이 문제(무기한 인가)·해결(사전 통지+재핸드셰이크)·함정
  (`connect()` no-op)·카브아웃(자연 만료만)을 모두 서술하며 기존 항목들과 톤·형식이 일치.
- **유저 가이드(`password-and-sessions.{mdx,en.mdx}`)**: ko/en 두 파일이 병렬 구조로
  추가됐고, "최대 15분 안에" 라는 수치는 access token TTL 900초(=15분)와 정확히 일치한다.
  이 PR 이 revoke 카브아웃의 창을 "무한"에서 "15분"으로 유계화했다는 서술도 코드
  (`armExpiryTimers` 의 자연 만료까지만 종속)와 부합.
- **README/설정 문서**: 신규 환경변수·설정 옵션·REST 엔드포인트 없음(WS emit-only 이벤트
  1종 추가, 기존 JWT `exp` 클레임 재사용). `codebase/{backend,frontend}` 하위 websocket
  모듈에는 원래 모듈별 README 관례가 없어 README 갱신 대상 아님.
- **e2e/유저 가이드 유예 근거**: `review/**` 가 아니라 `plan/in-progress/ws-token-expired-
  socket-lifetime-impl.md` 에 재개 신호(하네스 런타임 TTL 주입 표면 부재 → 생기거나 회귀
  관측 시)와 함께 기록돼 있어 SoT 위치가 올바르다(2R W5 지적의 실제 조치 확인).

## 요약

핵심 구현(backend 타이머·emit, frontend 구독·재연결)의 JSDoc·인라인 주석·테스트명은 spec
절번호·Rationale ID·수치까지 실체와 정확히 일치하며, 1R·2R 이 지적한 문서화 WARNING 3건
(export 완전성 목록·CHANGELOG·spec 배지 후속 포인터)은 모두 해소가 확인됐다. 이번 라운드의
신규 발견은 하나뿐이다 — `ws-client.ts` 의 `connect()` pending-가드 주석이 "connect_error
핸들러" 하나만 원인으로 지목하는데, 이번 PR 이 같은 재연결 로직을 공유 헬퍼로 묶어
`auth.token_expired`·`disconnect` 두 트리거까지 확장했음에도 그 주석은 갱신되지 않았다
(WARNING). 이 파일 49~58행의 최신 주석과 26~27행의 오래된 주석이 서로 다른 트리거 개수를
말하고 있어, 다음 유지보수자가 이 가드 자리만 읽으면 신규 두 경로를 놓칠 수 있다. 그 외에는
`cutoff` 타이머 클램프 설명 부재(2R 이월, INFO)와 spec `Planned` 배지 미반영(이미 등재된
planner 턴, INFO) 두 건이 재확인 차 남아 있을 뿐, 새로운 문서화 CRITICAL/WARNING 급 결함은
발견되지 않았다.

## 위험도

LOW
