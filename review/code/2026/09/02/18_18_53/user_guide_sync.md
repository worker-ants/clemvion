# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

대상: WS `auth.token_expired` 소켓 수명 종속 구현 (`websocket-events.types.ts` / `websocket.gateway.ts` /
`websocket.gateway.spec.ts` / `ws-client.ts` / `ws-client.test.ts`) + CHANGELOG + plan 문서 +
`review/code/2026/09/02/17_38_12/**`(1라운드 리뷰 산출물, 순수 프로세스 아티팩트).

매트릭스 SSOT `.claude/config/doc-sync-matrix.json` 의 `rows[]` 20개 + `PROJECT.md` §변경 유형 → 갱신
위치 매핑 본문을 적재해 변경 파일 전수를 대조했다.

## 발견사항

- **[WARNING]** 인증·권한·세션 흐름 변경(WS 소켓 수명↔토큰 수명 종속) — `07-workspace-and-team/` 가이드
  갱신 + e2e 보강 둘 다 없음
  - 변경 파일: `codebase/backend/src/modules/websocket/websocket.gateway.ts`(신규
    `armExpiryTimers`/`TOKEN_EXPIRY_LEAD_MS`/`expiryTimers`, `handleConnection`/`handleDisconnect` 연동),
    `codebase/backend/src/modules/websocket/websocket-events.types.ts`(신규
    `AuthEventType`/`AuthTokenExpiredPayload`), `codebase/frontend/src/lib/websocket/ws-client.ts`(신규
    `refreshAndReconnect` + `auth.token_expired`/`disconnect` 구독)
  - 매트릭스 항목: `doc-sync-matrix.json` row `auth-session-flow-change` (`trigger.match: "semantic"`,
    glob 은 `codebase/backend/src/modules/auth/**` 이지만 semantic 행이라 경로 리터럴 매칭이 아니라 의미
    매칭 대상). PROJECT.md 표 원문: "인증·권한·세션 흐름 변경 | `codebase/frontend/src/content/docs/
    07-workspace-and-team/` 의 관련 페이지 + e2e | `make e2e-test`". 같은 문서 "자주 누락되는 항목" 목록에
    정확히 이 패턴이 별도로 명시돼 있다: *"인증·권한·세션 흐름 변경 vs 워크스페이스 가이드
    (`07-workspace-and-team/`) 미갱신 — 흐름 변경 + 가이드 갱신 + e2e 가 한 묶음"*.
  - 누락된 동반 갱신: `codebase/frontend/src/content/docs/07-workspace-and-team/{password-and-sessions,
    system-status}.mdx` (+ `.en.mdx`) 미변경. WS 재연결/세션 만료 관련 e2e 스펙도 이번 changeset 에 없음
    (`meta.json`/파일 목록 전수 확인 — `codebase/backend/test/**e2e**` 대상 파일 0건).
  - 상세: 이 변경은 문자 그대로 "액세스 토큰 수명에 세션(소켓) 수명을 종속시키는" 인증 흐름 변경이다 —
    `codebase/backend/src/modules/auth/` 디렉토리 밖(websocket 모듈)에서 구현됐지만 매트릭스 행이
    `match:"semantic"` 이므로 경로가 아니라 의미로 판단해야 하고, 이 변경의 본질은 정확히 "인증·권한·
    세션 흐름"이다. `07-workspace-and-team/password-and-sessions.mdx` 는 이미 "다른 기기 세션이 어떻게
    처리되는가"를 사용자에게 설명하는 페이지지만, 자연 만료(비밀번호 변경이 아니라 단순 access token
    TTL 도달)로 인해 실시간 연결이 재핸드셰이크된다는 사실은 어디에도 없다 — grep 결과
    `07-workspace-and-team/*.mdx` · `05-run-and-debug/*.mdx` 전체에 "재연결"·"WebSocket"·"소켓" 언급
    0건. `api_contract.md`(1R 리뷰 산출물)가 이미 지적한 배포 전환 창 리스크(구버전 번들 탭이 최대
    900초 뒤 무통지·복구불가 이탈)까지 감안하면, 최소 "실시간 연결은 자동으로 갱신되며 드물게 페이지
    새로고침이 필요할 수 있다"는 사용자 안내가 이 페이지에 있어야 문의(CS) 발생 시 근거가 된다.
    e2e 쪽은 `RESOLUTION.md` W7 에서 "900초 대기 또는 토큰 수명 주입이 필요해 현 e2e 하네스의
    boot-only 게이트와 결이 다르다"는 이유로 **의도적으로 미조치·우선순위 판단**이라 명시돼 있어 완전한
    "누락"은 아니고 근거 있는 유예다. 다만 매트릭스 관점에서는 target 두 개(가이드 페이지·e2e) 모두
    같은 changeset 에 없다는 사실 자체는 그대로 남는다.
  - 제안: (1) `password-and-sessions.mdx`/`.en.mdx` 에 짧은 Callout 한 단락 추가 — "실시간 연결은 토큰이
    갱신되면 자동으로 다시 연결돼요. 만약 오래 열어둔 탭에서 갑자기 연결이 끊긴 것처럼 보이면 새로고침
    해 주세요"류. (2) e2e 는 `RESOLUTION.md` 가 이미 기록한 유예 근거를 그대로 이 changeset 의
    plan(`ws-token-expired-socket-lifetime-impl.md`) 체크리스트에도 명시적 항목으로 옮겨 다음 사람이
    "e2e 안 붙였네?"로 재조사하지 않게 한다(현재 그 plan 체크리스트에는 e2e 유예 사유가 없고
    `review/code/.../17_38_12/RESOLUTION.md` 에만 있음 — plan 이 SoT 가 아니므로 항목을 잃을 위험).

## 매칭했으나 이상 없음으로 판단한 항목

- **`websocket-events.types.spec.ts` / `websocket-events.types.ts` 의 `AuthEventType`/
  `AuthTokenExpiredPayload` 신규 export** — 매트릭스의 "신규 cross-cutting enum 값 추가" 행은
  `WaitingInteractionType`/`ConversationTurnSource`/`PresentationType` 처럼
  `interaction-type-registry.md` 매트릭스 + N개 코드 분기가 걸린 enum 전용이다. `AuthEventType` 은
  `ExecutionEventType`/`KbEventType` 과 같은 성격의 WS wire 이벤트 enum(단일 소비 지점)이라 그 행 대상이
  아니다 — 매칭 안 함.
- **`auth.token_expired` payload 의 `message` 필드** — `backend-labels.ts` 의 `WARNING_KO`/`ERROR_KO`/
  `LABEL_KO` 어느 것도 대상 아님. 이 문자열은 노드 실행 결과의 warning/error 코드가 아니라 WS 프로토콜
  통지이고, `ws-client.ts` 는 `payload.message` 를 소비하지 않고 이벤트 수신 자체만 트리거로 쓴다(재핸드셰이크
  트리거일 뿐 사용자에게 그 문자열이 렌더되지 않음) — i18n/backend-labels 갭 아님.
  - 위치 확인: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `armExpiryTimers` 내부 —
    `message: 'Access token expires soon — refresh and reconnect.'` (게이트: diff 195행).
- **`error-codes.ts` / warningRules 변경 없음** — 이번 changeset 에 `codebase/backend/src/nodes/core/
  error-codes.ts` 도 warningRules 관련 파일도 포함되지 않음 — "신규 errorCode/warningCode" 두 행 모두
  매칭 안 함.
- **신규 TSX 한국어 리터럴 없음** — 변경 파일 중 `.tsx` 파일이 하나도 없음(모두 `.ts`/`.md`/`.json`) —
  "신규 UI 문자열" 행 매칭 안 함.
- **신규 노드/신규 섹션 디렉토리/통합 provider/표현식 언어/실행-디버깅 흐름 변경 없음** — `codebase/
  backend/src/nodes/**`, `codebase/frontend/src/content/docs/*/`(신규 디렉토리), `codebase/packages/
  expression-engine/**` 어느 것도 이번 changeset 에 없음.

## 요약

매트릭스 20개 trigger 중 실제로 매칭된 것은 1개 — `auth-session-flow-change`(semantic, WS 소켓 수명↔
토큰 수명 종속) — 이고, 그 target(`07-workspace-and-team/` 가이드 페이지 + e2e) 둘 다 이번 changeset 에
없어 WARNING 1건으로 기록한다. i18n parity·backend-labels·section-locale 등 CRITICAL 등급 trigger(신규
노드, 신규 UI 문자열, warning/error 코드, 신규 섹션 디렉토리)는 모두 해당 파일이 changeset 에 없어
매칭되지 않았다. 다만 이 WARNING 은 완전한 "조용한 누락"은 아니다 — 직전 리뷰 라운드
(`review/code/2026/09/02/17_38_12/RESOLUTION.md` W7)가 이미 같은 항목을 인지하고 "사용자 대면 UI 변경
없음 + e2e 하네스 부적합"이라는 근거로 명시적으로 유예했다. 다만 그 유예 근거가 `RESOLUTION.md`(SoT
아님, `review/**` 는 참조 가능하나 SoT 아님)에만 있고 이번 PR 의 plan 문서(`ws-token-expired-socket-
lifetime-impl.md`) 체크리스트에는 없어, 다음 사람이 plan 만 보고는 그 유예를 재발견해야 하는 정보 유실
위험이 남는다.

## 위험도

MEDIUM
