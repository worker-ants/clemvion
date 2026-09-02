# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 0건, WARNING 5건. 병합을 막을 결함은 없으나, 이번 diff 가 신설한 인증-재연결 공유 헬퍼(`refreshAndReconnect`)의 방어 분기가 뮤테이션 테스트로 생존이 확인됐고(testing), 인증·세션 흐름 변경인데도 유저 가이드(`07-workspace-and-team/`)·e2e 동반 갱신이 없다(user_guide_sync). 모든 forced reviewer(documentation, maintainability, requirement, scope, security, side_effect, testing) 결과가 전문으로 확보되어 화이트리스트 미이행은 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance | 만료 사전통지(`notice`)·강제종료(`cutoff`) 타이머 지연 계산에 지터가 전혀 없어, 동시 접속 클라이언트들의 재연결+토큰 재발급이 900초 주기로 동기화되어 뭉칠 수 있다(thundering herd). 재발급된 새 토큰도 다시 `exp=now+900` 이라 한 번 동기화된 코호트는 이후 모든 15분 주기마다 계속 동기화된 채로 남는 자기 강화적 steady-state 문제 | `codebase/backend/src/modules/websocket/websocket.gateway.ts:170-207` (`armExpiryTimers`, `TOKEN_EXPIRY_LEAD_MS`) | `untilNotice`/`untilCutoff` 계산에 소켓별 소폭 랜덤 지터(예: ±5~15초) 추가. 최소한 배포 런북에 "대량 동시 로그인 후 15분 주기 재연결 스파이크 가능성" 기록 |
| 2 | side_effect / concurrency | `refreshAndReconnect` 재진입 가드(`refreshAttempted`)가 `connect_error` 트리거에만 있고, 이번 diff 로 신설된 `auth.token_expired`·`disconnect("io server disconnect")` 두 트리거는 무가드로 같은 헬퍼를 호출한다. `refreshAccessToken()` 대기가 비정상적으로 길어지면(느린 네트워크) notice 트리거의 재연결이 진행 중인 상태에서 서버 cutoff 가 강제 disconnect 하고, fallback 이 두 번째 `refreshAndReconnect` 를 무가드로 기동해 방금 성공한 재연결을 다시 끊을 수 있다 — spec §9.2 "성공하면 끊김이 보이지 않는다" 계약을 좁은 타이밍 창에서 재차 깨는 경로. (REST 이중호출은 `refreshPromise` 싱글턴이 dedup, `socket.connect()`/`disconnect()` 시퀀스는 dedup 안 됨) | `codebase/frontend/src/lib/websocket/ws-client.ts:52-71`(`refreshAndReconnect` 정의, 가드 없음), `:83-92`(`connect_error` 만 `refreshAttempted` 가드 보유), `:104-106`, `:111-114`(신규 두 트리거, 무가드 호출) | 세 트리거가 공유하는 단일 in-flight 플래그(또는 진행 중인 Promise 캐시)를 `refreshAndReconnect` 안으로 옮겨 통합 |
| 3 | testing | `connect_error` → `refreshAndReconnect` 위임 경로(1R W1 리팩터로 신설) 자체를 검증하는 테스트가 없음. 호출부를 주석 처리(no-op)로 뮤테이션해도 `vitest run` 20/20 GREEN 유지 확인(원복 완료) | `codebase/frontend/src/lib/websocket/ws-client.ts` `connect_error` 핸들러의 `void refreshAndReconnect("connect_error");` 호출부 | `handlerFor("connect_error")` 로 핸들러를 꺼내 실제 호출을 검증하고, `refreshAttempted` 가드 포함해 "1회차엔 refresh+재연결, 2회차엔 스킵"을 최소 1건 단언 |
| 4 | testing | `refreshAndReconnect` 의 `if (!newToken || !socket) return;` 가드 및 `catch` 에러 경로가 미검증. `mockRefresh` 는 항상 성공만 반환하는 고정 구현이라 실패 경로 테스트 부재. 가드를 `if (false) return;` 로 뮤테이션해도 `vitest run` 20/20 GREEN 유지 확인(원복 완료) — 세 트리거가 이 함수 하나를 공유하므로 이 가드 결함은 세 경로 모두에 전파됨 | `codebase/frontend/src/lib/websocket/ws-client.ts` `refreshAndReconnect` 내부 `const newToken = await refreshAccessToken(); if (!newToken || !socket) return;` 및 `catch (refreshErr)` | `mockRefresh.mockResolvedValueOnce(null)`(또는 reject) 케이스 추가해 "재발급 실패 시 connect/disconnect 미호출"을 단언 |
| 5 | user_guide_sync | 인증·세션 흐름 변경(WS 소켓 수명↔토큰 수명 종속, `doc-sync-matrix.json` semantic 행 `auth-session-flow-change` 매칭)인데 `07-workspace-and-team/` 유저 가이드 갱신도 e2e 보강도 없음. e2e 미조치는 1R `RESOLUTION.md` W7 에 "boot-only 게이트와 결이 다름"이란 근거로 기록돼 있으나, 그 유예 근거가 `review/**`(SoT 아님)에만 있고 이번 PR 의 plan 체크리스트에는 없어 다음 사람이 재조사해야 할 정보 유실 위험 | `codebase/frontend/src/content/docs/07-workspace-and-team/{password-and-sessions,system-status}.mdx`(+`.en.mdx`) 미변경, e2e 스펙 0건 | `password-and-sessions.mdx`/`.en.mdx` 에 "실시간 연결은 토큰 갱신 시 자동 재연결" Callout 추가. e2e 유예 근거를 `ws-token-expired-socket-lifetime-impl.md` 체크리스트에도 명시적으로 옮겨 SoT 화 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture / maintainability | 타이머 쌍(`notice`/`cutoff`) 타입이 두 곳에 `optional` 로 중복 선언돼 "항상 쌍으로 존재"라는 실제 불변식이 타입으로 표현되지 않음(전 라운드 이월, "취향 범위"로 명시적 보류됨) | `websocket.gateway.ts:150-153`(필드), `:192`(지역변수), 소비부 `:286-290` | `type ExpiryTimerPair = { notice: NodeJS.Timeout; cutoff: NodeJS.Timeout }` non-optional 화 |
| 2 | security / concurrency | `expiryTimers` Map 이 동일 `client.id` 재진입 시 이전 타이머를 clear 없이 무조건 덮어씀. 현재 Socket.IO 는 연결마다 신규 id 를 발급해 도달 불가 경로지만, 향후 `connectionStateRecovery` 등이 도입되면 타이머 누수·유령 emit/disconnect 가능 | `websocket.gateway.ts:209`(`armExpiryTimers` 끝, `this.expiryTimers.set(...)`) | 진입부에 `handleDisconnect` 와 동일한 clear-then-set 방어 코드 선제 적용 |
| 3 | requirement / api_contract | spec 의 `_(계획·미구현)_`/`(Planned)` 배지가 구현 완료 후에도 미갱신. developer 가 원저자가 아니라 자기-반증형 소정정 예외 대상이 아니며, 이미 plan 체크리스트에 "머지 후 planner 턴" 으로 등재됨 — 조용한 누락 아님 | `spec/5-system/6-websocket-protocol.md:52,876,1100,1133` | 조치 불요(이 PR 범위 밖). 머지 후 planner 턴에서 배지 flip |
| 4 | requirement / security | `exp` 클레임/`setTimeout` 지연에 Node 32비트 상한(~24.8일) 클램프 없음. access token TTL 이 900초로 고정돼 있어 현재는 도달 불가 | `websocket.gateway.ts` `armExpiryTimers` 의 `setTimeout(..., untilNotice/untilCutoff)` | 조치 불요. TTL 이 가변화되는 시점에 재검토, 필요 시 clamp 추가 |
| 5 | testing / requirement | `exp` 가 이미 과거인 입력(음수 지연, notice·cutoff 동시 0ms 발화) 조합이 유닛테스트로 직접 검증되지 않음. `jwtService.verify` 가 만료 토큰을 앞단에서 걸러 현재 도달 불가 | `websocket.gateway.ts` `armExpiryTimers` `Math.max(0, untilCutoff)` / `websocket.gateway.spec.ts` | `connectWithExp(id, -10)` 케이스 추가로 방어 코드 주장을 실측 뒷받침(선택적) |
| 6 | scope / maintainability | `ws-client.ts` 신규 핸들러 등록부에 의미 없는 연속 빈 줄 2개 | `codebase/frontend/src/lib/websocket/ws-client.ts:101-102` | 빈 줄 1개로 정리 |
| 7 | scope | 정보 가치 0인 실패/빈 `--impl-prep` 재시도 세션 6개(10파일)가 diff 에 포함(전체 44개 파일의 약 23%), 1라운드에서 이미 지적됐으나 미정리 | `review/consistency/2026/09/02/{17_08_55,17_09_30,17_11_15,17_11_16,17_11_33,17_11_34}/` | 차단 사유 아님. 다음엔 성공한 최종 세션만 커밋하거나 재시도 사유를 커밋 메시지에 기록 |
| 8 | side_effect | `armExpiryTimers` 내부 예외(예: 비정상 `exp` 값의 `toISOString()` RangeError)가 `handleConnection` 의 넓은 catch 에 흡수돼 "Invalid token" 으로 오분류될 수 있음. 현재 TTL 경로에선 도달 불가 | `websocket.gateway.ts:212-268`(`handleConnection` try/catch), `:170-210`(`armExpiryTimers`) | `armExpiryTimers` 를 인증 try 블록 밖(또는 자체 try/catch)으로 분리 |
| 9 | side_effect | 서버가 요청-응답 밖에서 소켓에 비동기 push 이벤트(notice emit, cutoff disconnect)를 새로 발생시킴 — spec 이 명시적으로 요구하는 의도된 동작, 결함 아님, 관측 기록용 | `websocket.gateway.ts:193-207` | 해당 없음 |
| 10 | maintainability | 신규 wire 메시지 문자열(`'Access token expires soon — refresh and reconnect.'`)이 파일의 기존 "wire 문자열은 모듈 상수로 승격" 관례를 따르지 않고 인라인 리터럴로 남음(1R 에서 "취향 범위"로 보류됨) | `websocket.gateway.ts:195` | `MSG_AUTH_TOKEN_EXPIRING` 류 모듈 상수로 승격 |
| 11 | documentation | `cutoff` 타이머의 `Math.max(0, untilCutoff)` 클램프에 개별 설명 주석이 없음(인접한 `notice` 클램프 설명에 암묵적으로 얹혀 있음) | `websocket.gateway.ts:201-207` (인접 설명은 `:180-190`) | 짧은 참조 주석 추가 또는 `clampDelay(ms)` 헬퍼로 통합 |
| 12 | concurrency | frontend `refreshAndReconnect` 가 클로저 공유 변수 `socket` 을 세대(generation) 구분 없이 참조 — 이론상 stale 리프레시 결과가 새 소켓을 오염시킬 수 있는 구조. 현재 호출부는 모두 같은 싱글턴에 `connect()` 만 호출해 도달 불가 | `ws-client.ts:20,52-71,22-34,117-122` | 처리 대상 소켓 참조(세대 카운터)를 로컬 캡처, 재개 후 불일치 시 조기 반환 |
| 13 | concurrency | lead time 초과하는 느린 refresh 시 사전 통지·fallback 두 경로의 `refreshAndReconnect` 가 겹칠 수 있고, 안전성이 socket.io-client Manager 내부 `readyState` no-op 가드(서드파티 구현 세부)에 암묵 의존 | `ws-client.ts:104-106,111-114,52-71` | 세 트리거를 관통하는 명시적 in-flight 가드로 이 안전성을 코드 자체 계약으로 만들 것(WARNING #2 와 함께 해결 가능) |
| 14 | api_contract | 배포 전환 창 리스크 — 구버전 프론트 번들(배포 시점에 이미 열려 있던 탭)은 이 재연결 로직을 몰라 최대 900초 뒤 무통지·복구불가 이탈. 이미 plan 체크리스트에 등재됐으나 `[ ]` 미해결 상태로 남음 | `websocket.gateway.ts:170,204`, `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:87` | 코드 조치 불요. 배포 런북에 판단을 실제로 기록해 체크리스트를 닫을 것 |
| 15 | architecture | `ws-client.ts` `connect()` 클로저가 초기화 + 3개 재연결 트리거 배선을 계속 흡수하는 추세 — 지금은 문제 아니나 트리거가 더 늘어나면 계속 커지는 방향 | `ws-client.ts:22-115` | 트리거가 하나 더 늘어나는 시점에 `createReconnectPolicy` 류 독립 모듈로 추출 검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 이 diff 자체가 "만료 토큰으로 소켓 무기한 인가" 취약점(CWE-613)을 닫음. 1R CRITICAL(재연결 no-op) 해소 재검증. INFO 2건(타이머 재진입, 32비트 상한) |
| performance | LOW–MEDIUM | WARNING 1건 — 만료 타이머 지터 부재로 인한 주기적 부하 집중(thundering herd) 가능성 |
| architecture | LOW | 1R WARNING(재연결 로직 중복) 해소 확인. INFO 2건(타이머 타입, connect() 클로저 비대화 추세) |
| requirement | LOW | spec §1.2/§1.3/§4.6/§6.1/§9.2 line-level 일치, 79/79+20/20 테스트 직접 실행 재검증. INFO 3건(전부 추적 중이거나 도달불가) |
| scope | NONE | 핵심 변경은 plan/spec 범위와 1:1 대응. INFO 2건(재시도 세션 잔존, 빈 줄) |
| side_effect | LOW | WARNING 1건 — 재연결 재진입 가드가 신규 두 트리거에 없음. INFO 2건 |
| maintainability | LOW | 1R WARNING(재연결 로직 중복) 해소 확인. INFO 3건(전부 취향 범위 재확인) |
| testing | MEDIUM | CRITICAL 0, WARNING 2건 — 신설 공유 인증-재연결 경로(`refreshAndReconnect`)의 두 방어 분기가 뮤테이션으로 생존 확인. 1R CRITICAL 2건은 직접 실행 재검증 완료 |
| documentation | NONE | 1R WARNING 3건 전부 해소 확인. INFO 1건(클램프 설명 누락) |
| concurrency | LOW | 1R CRITICAL(재연결 no-op) 해소 확인. INFO 3건(전부 현재 도달불가 경로) |
| api_contract | LOW | 신규 이벤트 additive, spec 정합. INFO 2건(배포 전환 창, spec 배지) |
| user_guide_sync | MEDIUM | WARNING 1건 — 인증/세션 흐름 변경인데 07-workspace-and-team 가이드+e2e 동반 갱신 없음(부분적으로 근거 있는 유예) |

## 발견 없는 에이전트

없음(전원 최소 INFO 이상 보고).

## 권장 조치사항

1. `refreshAndReconnect` 의 재진입 가드를 세 트리거(`connect_error`/`auth.token_expired`/`disconnect`)가 공유하도록 통합하고, 그 위임·가드 분기에 대한 뮤테이션 테스트를 추가한다(WARNING #2~#4, 세션 관리 경로라 회귀 파급이 큼).
2. `password-and-sessions.mdx`(+`.en.mdx`)에 "실시간 연결은 토큰 갱신 시 자동 재연결" 안내를 추가하고, e2e 유예 근거를 `RESOLUTION.md`(SoT 아님)에서 plan 체크리스트로 옮겨 SoT 화한다(WARNING #5).
3. 만료 타이머 계산에 소폭 랜덤 지터를 추가해 대량 동시 로그인 이후의 15분 주기 재연결 동기화(thundering herd)를 완화하거나, 최소한 배포 런북에 리스크를 기록한다(WARNING #1).
4. INFO 항목은 차단 사유가 아니며 대부분 현재 도달 불가능한 경로에 대한 방어-심화 제안이거나 이미 추적 중(plan 등재)이므로 우선순위 낮게 후속 처리한다. 특히 배포 전환 창 리스크(INFO #14)는 이미 열린 plan 체크리스트 항목이라 배포 시점에 실제로 닫을 것.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract, user_guide_sync (12명)
  - **제외**: 아래 표 (2명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨(전문 인라인 확인 완료, 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단 — 이번 diff 에 신규/변경 외부 의존성 없음(코드 대조로도 확인: 신규 패키지 추가 없음) |
  | database | 라우터 판단 — 이번 diff 에 DB 스키마/쿼리 변경 없음(WS 프로토콜·타이머·클라이언트 재연결 로직뿐) |