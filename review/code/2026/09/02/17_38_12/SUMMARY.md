# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — spec §9.2 가 명시한 "끊김 없는 토큰 전환"이 socket.io-client `connect()` 의 no-op 가드 때문에 실제로 동작하지 않고(requirement·concurrency 리뷰어가 독립적으로 CRITICAL 판정, security·side_effect·architecture·api_contract 는 같은 근본 원인을 WARNING 급으로 재확인), 신규 프론트 테스트 코드가 `frontend typecheck ratchet` CI 게이트를 실제 실행으로 확인된 방식으로 깨고 있다(testing 리뷰어가 CRITICAL 판정, 실행 로그 포함). forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 7개 전원 결과 확보됨 — 결과 누락으로 인한 은폐 위험은 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Concurrency | frontend "정상 경로"(사전 통지 시점 선제 재연결)가 이미 연결된 소켓에서 `socket.connect()` 를 호출하는데, socket.io-client(`if (this.connected) return this;`, 실측 확인)는 이를 완전한 no-op 로 처리한다. 결과적으로 `auth.token_expired` 통지 시점의 재발급·재연결 시도는 아무 효과가 없고, 실제 재연결은 항상 서버가 `exp` 시각에 강제 disconnect 한 뒤 fallback 경로에서만 일어난다. spec §9.2 "성공하면 사용자에게 끊김이 보이지 않는다"를 매 토큰 만료 주기(900초)마다 결정적으로 위반하며, REST `/auth/refresh` 도 불필요하게 2회 호출된다. | `codebase/frontend/src/lib/websocket/ws-client.ts:87-102` (`refreshAndReconnect`, `auth.token_expired` 핸들러) | 통지 수신 시 소켓이 이미 connected 라면 `socket.disconnect()` 후 `socket.connect()` 로 강제 재핸드셰이크하거나, 새 `io()` 인스턴스를 미리 열어 교체. 최소한 e2e/통합 테스트로 실제 재연결 성립 여부를 검증 |
| 2 | Testing | 신규 프론트엔드 테스트 3건이 `WsClient.connect(token: string)` 시그니처를 어기고 인자 없이 `createWsClient().connect()` 를 호출한다. `vitest run` 은 타입을 strip 해 통과하지만, 저장소가 별도 도입한 `frontend typecheck ratchet` 게이트(`tsc --noEmit` + `check-frontend-typecheck-ratchet.py`)를 **실행 확인 결과 실제로 깬다**(baseline 52 → 55, `TS2554: Expected 1 arguments, but got 0` 3건). 이 게이트는 CI `typecheck-ratchet` job 에 배선되어 있어 push 시 실패한다. | `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts:151,163,174` | 세 호출 모두 `createWsClient().connect("old-token")` 처럼 토큰 인자를 채운다. 수정 후 ratchet 스크립트 재실행으로 baseline 회귀 확인 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Maintainability / Documentation | "토큰 갱신 → `socket.auth.token` 교체 → `socket.connect()`" 로직이 기존 `connect_error` 핸들러와 신규 `refreshAndReconnect` 사이에 사실상 동일하게 중복돼 있다. 세 트리거(`connect_error`, `auth.token_expired`, `disconnect`)가 서로 다른 자리에서 거의 같은 몸통을 반복해, 재발급 정책이 바뀌면 한쪽만 고치는 shotgun-surgery 위험이 있다. | `codebase/frontend/src/lib/websocket/ws-client.ts:63-77` vs `:87-97` | `connect_error` 핸들러를 `refreshAndReconnect("connect_error")` 호출로 위임 통합해 구현을 한 곳으로 모은다 |
| 2 | Requirement / Concurrency | 위 Critical #1 을 검증해야 할 프론트 테스트가 vacuous 하다 — `createMockSocket()` 이 `connected: false` 로 고정되고 `auth.token_expired` 테스트가 이를 `true` 로 전환하지 않아, 실제 프로덕션 상황(통지 시점엔 소켓이 연결돼 있음)을 재현하지 못한 채 GREEN 이 난다. 같은 파일의 "skips connect if already connected" 테스트는 이 가드를 알고 있음에도 이 시나리오엔 적용되지 않았다. | `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts:3-17`(mock), `:150-160`(테스트) | `mockSocket.connected = true` 로 설정한 뒤 실제 재핸드셰이크가 트리거되는지(예: disconnect→connect 시퀀스) 단언하도록 보강 |
| 3 | Documentation | #1174 회귀("72 suites 가 `Cannot read properties of undefined` 로 터짐")를 막기 위해 만든 `EXPECTED_EXPORTS` 완전성 가드가 이번 diff 의 신규 export 2개(`AuthEventType`, `AuthTokenExpiredPayload`)를 반영하지 않아 "완전한 목록" 불변식이 조용히 깨졌다(부분집합 검사라 RED 는 아님). | `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:49-62` | `EXPECTED_EXPORTS` 배열에 `'AuthEventType'`, `'AuthTokenExpiredPayload'` 두 항목 추가 |
| 4 | Documentation | 이 저장소는 실질 기능 변경마다 `CHANGELOG.md` Unreleased 섹션을 동반 갱신하는 관행이 확립돼 있는데(최근 5개 커밋 전부 CHANGELOG 동반), 이번 WS 소켓 수명-토큰 수명 종속 기능은 CHANGELOG 갱신이 누락됐다. | `CHANGELOG.md` (diff 미포함) | "WS 소켓 수명이 토큰 수명에 종속된다" 계열 항목을 Unreleased 에 추가 |
| 5 | Documentation | spec 의 `_(계획·미구현)_`/"Planned" 배지(§1.2/§4.6/Rationale)가 이번 구현 완료 후에도 갱신되지 않았고, `spec-sync-websocket-protocol-gaps.md:23` 체크박스도 미체크다. developer 는 이 문구의 원저자가 아니므로 자기-반증형 소정정 예외에 해당하지 않아 별도 planner 턴이 필요한데, 이 PR 산출물에는 그 후속 조치에 대한 포인터가 없다. | `spec/5-system/6-websocket-protocol.md:28,52,876,1096-1100,1133` / `plan/in-progress/spec-sync-websocket-protocol-gaps.md:23` | `ws-token-expired-socket-lifetime-impl.md` 체크리스트에 "머지 후 planner 턴으로 spec 배지 flip + tracker 체크" 항목 추가 |
| 6 | API Contract | 이 신규 재연결 로직(`auth.token_expired` 구독, `disconnect` reason 분기)을 모르는 구버전 프론트엔드 번들 — 특히 배포 시점에 이미 열려 있던 브라우저 탭 — 은 최대 900초 뒤 무통지·복구 불가로(새로고침 전까지) 끊긴다. spec/plan 어디에도 이 배포 전환 창 리스크가 명시되지 않았다. | `codebase/backend/src/modules/websocket/websocket.gateway.ts:170,242-243` | 배포 런북에 FE 우선 배포 또는 900초 내 무통지 이탈 감내를 명시하거나, 예상치 못한 WS 세션 종료 감지 시 새로고침 안내 등 번들-불가지론적 안전망 검토. 최소한 spec Rationale/impl plan 에 리스크 기록 |
| 7 | User Guide Sync | 인증·세션 흐름 변경(WS 소켓 수명 ↔ JWT 만료 종속)인데 PROJECT.md 가 "자주 누락되는 패턴"으로 명시한 07-workspace-and-team 가이드 + e2e 동반 갱신이 이번 changeset 에 없다(`grep` 결과 관련 e2e 0건, `password-and-sessions.mdx` 미갱신). plan 이 이미 `[ ] e2e` 를 미완으로 추적 중이라 완전 은닉은 아니다. | `codebase/frontend/src/content/docs/07-workspace-and-team/` (미변경), e2e 부재 | 가이드에 사용자 영향 짧은 절 추가하거나 "내부 신뢰성 개선, 갱신 불요"를 명시적으로 기록. WS 토큰 만료→통지→재연결 e2e 1건 추가 후 plan 체크리스트 갱신 |
| 8 | Architecture | `WebsocketGateway` 가 이미 rate-limit·구독 상태를 별도 컴포넌트로 분리해 온 전례가 있는데, 이번 소켓별 만료 타이머(`expiryTimers` Map, `armExpiryTimers`)는 별도 서비스로 추출하지 않고 gateway 클래스에 인라인으로 흡수해 God-object 경향이 심화된다(1075줄). 지금 당장 결함은 아님. | `codebase/backend/src/modules/websocket/websocket.gateway.ts:144-210` | `WsRateLimiterService` 와 대칭되는 `WsTokenExpiryService`(arm/disarm/get)로 추출 검토(선택적) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 명시적 revoke(로그아웃) 이후에도 이미 발급된 access token 은 자연 만료(최대 900초)까지 WS 세션이 유지된다 — spec Rationale 이 명시한 카브아웃이며 이미 `--spec`/`--impl-prep` 라운드에서 승인됨. | `codebase/backend/src/modules/websocket/websocket.gateway.ts:156-168` | 조치 불요(설계 의도). 향후 즉시 revoke 필요 시나리오가 생기면 재검토 근거로 기록 |
| 2 | Architecture | `expiryTimers` 값 타입이 `{ notice?: ...; cutoff?: ... }` 로 항상 함께 세팅되는데도 optional 이라 "항상 쌍으로 존재" 불변식이 타입에 드러나지 않는다. | `codebase/backend/src/modules/websocket/websocket.gateway.ts:150-153,192` | non-optional 타입으로 좁혀 회귀를 컴파일 타임에 차단 |
| 3 | Side Effect | `expiryTimers` Map 에 모듈/앱 종료 시 잔여 타이머를 정리하는 `onModuleDestroy` backstop 이 없다 — 정상 경로(모든 소켓이 `handleDisconnect` 를 거침)에서는 관측된 리스크 없음. 자매 서비스(`execution-seq-allocator.service.ts`)는 이 패턴을 갖춤. | `codebase/backend/src/modules/websocket/websocket.gateway.ts:150-153` | `onModuleDestroy` 추가해 그레이스풀 셧다운 안전망 보강(선택적) |
| 4 | Maintainability | 타이머 쌍 타입 리터럴 `{ notice?: ...; cutoff?: ... }` 이 필드 선언과 지역 변수 두 곳에 중복. | `codebase/backend/src/modules/websocket/websocket.gateway.ts:150-153,192` | `type ExpiryTimerPair = ...` 로 이름 붙여 재사용 |
| 5 | Maintainability | 신규 wire 메시지 `'Access token expires soon — refresh and reconnect.'` 가 파일 내 기존 `MSG_*` 상수화 관례를 따르지 않고 인라인 리터럴로 남음. | `codebase/backend/src/modules/websocket/websocket.gateway.ts` (`armExpiryTimers` 내부) | `MSG_AUTH_TOKEN_EXPIRING` 류 모듈 상수로 승격 |
| 6 | Testing | `exp` 가 이미 lead time 보다 짧게 남은 경우 notice 는 0ms 클램프가 테스트되지만, cutoff 까지 동시에 0ms 발화하는 조합은 테스트되지 않음 — 실무에선 `jwtService.verify` 가 만료 토큰을 앞단에서 거부해 도달 불가 경로. | `codebase/backend/src/modules/websocket/websocket.gateway.ts` (`armExpiryTimers`) | `exp` 과거 케이스 테스트 추가(필수 아님) |
| 7 | Requirement / Documentation | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 의 TDD 체크리스트(backend/frontend)가 실제 구현 완료 상태를 아직 반영하지 않음 — 저장소 관례상 `/ai-review` 통과 후 체크하는 정상 중간 상태일 수 있음. | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:77-78` | 이번 리뷰 라운드(Critical 해소) 완료 후 체크박스 갱신 |
| 8 | Scope / Documentation | `--impl-prep` 게이트 재시도로 생긴 빈 consistency-check 세션 6개 중 5개가 커밋에 포함됨(`_retry_state.json`/`meta.json` 만 존재, 실제 checker 출력 없음). 최종 성공 런(`17_13_02/`)이 실제 근거이며 기능에 영향 없음. | `review/consistency/2026/09/02/{17_08_55,17_09_30,17_11_15,17_11_16,17_11_33,17_11_34}/` | 조치 불요. 향후 성공 세션만 남기거나 재시도 사유를 커밋 메시지에 한 줄 남기면 추적 비용 감소 |
| 9 | API Contract | 만료 cutoff 시 `client.disconnect()` 만 호출하고 `error` 이벤트는 emit 하지 않아, 최초 인증 실패 경로(explicit `error` payload)와 신호 방식이 다르다 — spec 이 의도한 설계(사전 통지가 원인 신호 역할)이며 프론트 테스트도 이 계약대로 작성돼 결함은 아님. | `codebase/backend/src/modules/websocket/websocket.gateway.ts:201-207` vs `:218-225,263-266` | 조치 불요. `error` 이벤트만 구독하는 신규 소비자가 이 케이스를 놓칠 수 있음을 기록 |
| 10 | Concurrency | `auth.token_expired`/`disconnect` 재연결 경로에 `connect_error` 핸들러의 `refreshAttempted` 같은 명시적 재진입 가드가 없음 — `refreshPromise` singleton 이 동시 겹침은 de-dup 하므로 현재 리스크는 낮으나, 향후 캐싱 정책이 바뀌면 조용히 레이스가 드러날 수 있는 구조. | `codebase/frontend/src/lib/websocket/ws-client.ts:59-77` vs `:87-110` | 세 핸들러를 단일 helper 로 통합하고 재진입 방어를 명시적으로 통일 |
| 11 | Concurrency | `expiryTimers` Map 은 동일 `client.id` 로 `armExpiryTimers` 가 두 번 호출되면 이전 타이머가 `clearTimeout` 없이 덮어써질 수 있음 — 현재 connection state recovery 미설정이라 도달 불가 경로. | `codebase/backend/src/modules/websocket/websocket.gateway.ts:170-210` | `armExpiryTimers` 진입 시 기존 타이머를 선제 clear(방어적, 우선순위 낮음) |
| 12 | User Guide Sync | WS 재연결 로직이 `use-execution-events.ts` 의 기존 `realtimeFallback` toast 와 간접 상호작용할 수 있으나(장시간 실행 감시 시 fallback 을 덜 보게 될 가능성), 해당 동작 자체가 원래도 05-run-and-debug 문서에 미문서화된 내부 동작이라 이번 PR 이 새로 깬 계약은 아님 — grey zone. | `codebase/frontend/src/lib/websocket/ws-client.ts` | 조치 불요. PR 본문에 "사용자 가시 흐름 불변" 근거 한 줄 남기면 재조사 비용 절감 |
| 13 | Security | 신규 코드에서 하드코딩 시크릿·인젝션·안전하지 않은 암호화·평문 전송·민감정보 로그 노출 없음(`exp` 는 서명 검증 통과 페이로드에서만 읽음, emit 은 해당 소켓 전용). | 전체 diff | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 세션관리 취약점(CWE-613) 자체는 이 변경이 닫음. notice 재연결 무효화를 WARNING 으로 재확인, revoke 카브아웃 residual 은 INFO |
| architecture | LOW | connect_error/refreshAndReconnect 중복, gateway God-object 경향 — 둘 다 병합 차단 아님 |
| requirement | HIGH | spec §9.2 무중단 전환 미달성(CRITICAL) + vacuous 테스트(WARNING) |
| scope | NONE | 실질 범위 이탈 없음. 빈 재시도 세션 커밋 포함만 INFO |
| side_effect | MEDIUM | notice 재연결 무효화(WARNING, REST 이중 호출 포함), onModuleDestroy 부재(INFO) |
| maintainability | LOW | 재연결 로직 중복(WARNING), 타입/상수화 사소 이슈(INFO) |
| testing | CRITICAL | frontend typecheck ratchet 게이트 실제 파괴(실행 확인) |
| documentation | LOW | #1174 가드 완전성 붕괴, CHANGELOG 미갱신, spec 배지 stale — 3건 WARNING |
| concurrency | CRITICAL | notice 재연결 무효화가 매 900초 결정적 재현, 이를 못 잡는 vacuous 테스트 |
| api_contract | LOW-MEDIUM | 배포 전환 구간 구버전 클라이언트 무통지 이탈(WARNING), error 이벤트 비대칭(INFO) |
| user_guide_sync | MEDIUM | 07-workspace-and-team 가이드 + e2e 동반 누락(WARNING, plan 추적 중이라 완전 은닉은 아님) |

## 발견 없는 에이전트

없음 — 11개 전 에이전트가 최소 1건 이상(WARNING 또는 INFO)의 발견사항을 보고했다.

## 권장 조치사항

1. **[최우선]** frontend `refreshAndReconnect` 의 "정상 경로"를 connected 상태에서도 실제 재핸드셰이크가 일어나도록 수정한다(`disconnect()` 후 `connect()`, 또는 신규 `io()` 인스턴스 교체) — spec §9.2 계약을 실제로 충족시킨다 (Critical #1).
2. **[최우선]** `ws-client.test.ts` 의 `connect()` 호출 3건에 토큰 인자를 채워 `frontend typecheck ratchet` CI 게이트를 통과시킨다 (Critical #2).
3. 위 #1 수정 후, `createMockSocket()` 의 `connected` 상태를 실제 시나리오(`true`)로 세팅해 회귀를 검출할 수 있도록 `auth.token_expired` 테스트를 보강한다 (Warning #2).
4. `connect_error`/`auth.token_expired`/`disconnect` 세 경로의 "토큰 갱신→재연결" 로직을 단일 헬퍼로 통합한다 (Warning #1).
5. `websocket-events.types.spec.ts` 의 `EXPECTED_EXPORTS` 에 `AuthEventType`, `AuthTokenExpiredPayload` 를 추가해 #1174 회귀 가드 완전성을 복원한다 (Warning #3).
6. CHANGELOG.md 에 이번 기능을 기록하고, `spec-sync-websocket-protocol-gaps.md` 체크박스·spec Planned 배지 flip 을 위한 후속 planner 턴 포인터를 plan 에 남긴다 (Warning #4, #5).
7. 배포 런북에 "구버전 세션 무통지 이탈" 리스크를 기록하고, 07-workspace-and-team 가이드 갱신 여부를 명시적으로 판단·기록하며 WS 토큰 만료 e2e 1건을 추가한다 (Warning #6, #7).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract, user_guide_sync (11명)
  - **제외**: 표 (reviewer · 이유, 3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **전원 결과 확보됨, 화이트리스트 미이행 없음**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(prompt 미상세) — 이번 diff 가 성능-critical 경로(hot loop, DB 쿼리 등)를 건드리지 않는다고 판단된 것으로 추정 |
  | dependency | router 판단(prompt 미상세) — 신규 외부 의존성 추가 없음 |
  | database | router 판단(prompt 미상세) — 스키마/쿼리 변경 없음(순수 in-memory 타이머 + WS 이벤트) |