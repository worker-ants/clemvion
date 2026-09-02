# Code Review 통합 보고서

대상: `auth.token_expired` — WS 소켓 수명을 JWT access token 수명에 종속시키는 기능
(`spec/5-system/6-websocket-protocol.md` §1.2/§1.3/§4.6/§6.1/§9.2, Rationale
`R-ws-socket-lifetime-binds-token`). 이번은 **3라운드째** 리뷰이며, 1R/2R 에서 발견된
Critical 2건(재핸드셰이크 no-op, typecheck ratchet 위반)·Warning 다수는 소스 대조로 모두
해소가 재확인됐다. 12개 reviewer 전원 결과 확보(forced 7명 전원 포함, 누락 없음).

## 전체 위험도
**MEDIUM** — CRITICAL 0건. WARNING 4건 중 가장 중요한 것은 concurrency 팀이 **격리 재현
스크립트로 직접 검증한** cross-generation race(오래된 소켓 세대의 in-flight 토큰 재발급이
공유 `socket` 변수를 통해 새 소켓 세대를 건드려 방금 성공한 연결을 다시 끊는 현상) — 데이터
손상·보안 침해는 아니지만, 이 PR 이 막으려던 "보이는 끊김"이 좁은 타이밍 창에서 다른 경로로
재현되며 현재 테스트 하네스 구조상 회귀를 잡을 수 없다. testing 팀이 뮤테이션으로 확인한
in-flight 가드 리셋 미검증(WARNING)도 같은 구간(`refreshAndReconnect`)에 대한 회귀 방지망
공백을 가리킨다. 나머지 두 WARNING(들여쓰기 오독 유발, 오래된 pending-가드 주석)은 가독성/
문서 정확성 문제로 기능에는 영향 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency | `connect()` 재호출 시 이전 소켓 세대의 in-flight `refreshAndReconnect` 가 공유 외부 `socket` 변수를 통해 **새 소켓 세대**를 건드리는 cross-generation race. 신규 `disconnect("io server disconnect")` fallback 이 `active=false` 전이를 반복 발생시키는 유일한 경로라 이전보다 도달 가능성이 커짐. 격리 재현 스크립트로 "소켓B 가 연결 성공 직후 다시 disconnect→connect 되는" 현상을 직접 확인. `WorkflowEditor` 의 `connect()` 호출부에 unmount cleanup 없어 재마운트 시 실제 트리거 가능 | `codebase/frontend/src/lib/websocket/ws-client.ts:20,28,59-86,126-129`; 호출부 `codebase/frontend/src/components/editor/workflow-editor.tsx:65-70` | `connect()` 안에서 `const mySocket = socket;` 로 스냅샷 후 `await` 뒤 모든 접근을 `mySocket` 기준으로 하고, `if (socket !== mySocket) return;` 가드 추가. 테스트의 `io: vi.fn()` mock 도 호출마다 다른 인스턴스를 반환하도록 변경해 회귀 포착 가능하게 할 것 |
| 2 | testing | `inFlight` 재진입 가드가 **완료 후 초기화**되어 다음 트리거가 다시 refresh 를 시작하는지 검증하는 테스트가 없음. `.finally` 리셋 라인을 제거해도 24/24 GREEN 유지(뮤테이션으로 직접 확인, 즉시 원복). 현재 코드는 정확하나, 이 회귀가 들어오면 최초 1회 갱신 이후 세 트리거(`connect_error`/`auth.token_expired`/`disconnect`) 모두가 영구히 무시돼 이 PR 이 고치려던 "만료 후 무기한 인가" 결함이 두 번째 900초 주기부터 조용히 재발 | `codebase/frontend/src/lib/websocket/ws-client.ts:82-85`; 테스트 `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts:189-211` | 첫 트리거 resolve 후 별도의 두 번째 트리거를 쏘아 `mockRefresh`/`connect` 가 다시 호출되는지 단언하는 테스트 추가 |
| 3 | maintainability | `refreshAndReconnect` 를 감싸는 `const run = (async () => { try {...} catch {...} })();` 블록의 들여쓰기가 실제 중첩과 어긋남 — `try`/`catch`/닫는 `})();` 가 전부 `const run = (async () => {` 와 같은 들여쓰기라 `try/catch` 가 그 화살표 함수의 형제처럼 보임. 2R 의 `inFlight` 가드 도입 시 안쪽을 재인덴트하지 않아 생긴 흔적. 동작에는 영향 없으나 다음 리팩터링 시 스코프 오독 위험 | `codebase/frontend/src/lib/websocket/ws-client.ts:62-81` | `try` 이하 전체를 한 단(2칸) 더 들여써 실제 중첩과 시각적 들여쓰기 일치 |
| 4 | documentation | `connect()` 상단 pending-가드 주석이 "토큰 갱신 재연결은 connect_error 핸들러가 담당"이라고만 설명 — 이번 PR 이 같은 로직을 `refreshAndReconnect` 공유 헬퍼로 묶어 `auth.token_expired`/`disconnect` 두 트리거까지 확장했음에도 주석은 갱신되지 않음. 동작 영향 없음, 문서 정확성 문제 | `codebase/frontend/src/lib/websocket/ws-client.ts:22-30`(특히 26-27행) | 주석을 "connect_error·auth.token_expired·disconnect(io server disconnect) 세 트리거가 공유하는 refreshAndReconnect 헬퍼가 기존 인스턴스에서 직접 재연결하므로 무영향"으로 갱신 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement/documentation/api_contract | spec 이 `auth.token_expired` 를 여전히 `_(계획·미구현)_`(Planned)로 표기 — 구현은 완료됐으나 developer 권한 밖(원저자 아님)이라 미수정. plan 체크리스트에 "머지 후 planner 턴"으로 이미 등재됨 | `spec/5-system/6-websocket-protocol.md:876,1133`; `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` | 조치 불요(이미 등재). 머지 후 planner 턴에서 배지 flip |
| 2 | side_effect/api_contract | 배포 전환 창 — 이 로직을 모르는 구버전 프론트 번들은 서버발신 disconnect 후 자동 재연결하지 않아 최대 900초간 무통지 이탈. 코드로 닫을 문제 아니고 plan 체크리스트에 배포 런북 등재 항목으로 미해결(`[ ]`) 상태로 남아 있음 | `codebase/backend/src/modules/websocket/websocket.gateway.ts`(cutoff `disconnect()`); `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` | 배포 런북에 FE 우선 배포 또는 감내 판단을 실제로 기록해 체크리스트를 닫을 것 |
| 3 | security | 명시적 세션 revoke(비밀번호 변경·다른 기기 로그아웃) 후에도 이미 열린 WS 소켓은 access token 자연 만료(최대 15분)까지 계속 인가된 채 유지 — spec Rationale 이 명시적으로 승인한 설계 카브아웃, 유저 가이드에도 "최대 15분"으로 명문화됨 | `websocket.gateway.ts`(`armExpiryTimers` docstring); `password-and-sessions.mdx:68-74` | 조치 불요(의도된 설계). 향후 "즉시 강제 종료" 요구 시 별도 revocation list 설계 필요 |
| 4 | security/concurrency | `armExpiryTimers` 가 동일 `client.id` 재진입 시 이전 타이머를 `clearTimeout` 없이 덮어씀 + `exp` 크기 상한 미검증. 현재 `handleConnection` 이 연결마다 신규 `client.id` 로 1회만 호출되고 TTL 이 900초 고정이라 도달 불가 | `websocket.gateway.ts:209`(덮어쓰기), `:201-207`(상한 미검증) | 조치 불요(도달 불가 확인됨). connection state recovery 도입 시 재평가 |
| 5 | side_effect | `armExpiryTimers` 내부 `toISOString()` 이 극단적 `exp` 값에서 `RangeError` 를 던지면 `handleConnection` 의 넓은 인증 catch 에 흡수돼 "invalid token" 으로 오분류될 수 있음 — `expiresIn: 900` 고정이라 실경로 도달 불가로 이미 defer 판정됨 | `websocket.gateway.ts`(`handleConnection` try/catch, `armExpiryTimers` 내부) | 조치 불요(이미 등재, 저위험) |
| 6 | performance | 만료 타이머(사전 통지·강제 종료)에 지터가 없어 동시 접속 코호트가 900초 주기로 재연결이 뭉칠 가능성(thundering herd) — plan 에 defer 사유(spec 고정값이라 developer 권한 밖)와 재개 신호 명시됨 | `websocket.gateway.ts:144,187-207`; `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:98-105` | 조치 불요. 배포 런북에 기록 여부만 후속 확인 |
| 7 | architecture | `AuthTokenExpiredPayload.expiresAt` JSDoc 이 "클라이언트가 이 값으로 남은 창을 계산"한다고 문서화하지만, 실제 핸들러는 payload 를 전혀 읽지 않고 즉시 refresh — 기능 결함 아님(spec 계약은 충족), 문서-구현 정합성 관찰 | `websocket-events.types.ts:293`; `ws-client.ts:119-121` | JSDoc 을 실제 동작에 맞게 정정하거나 `expiresAt` 을 실제 활용하도록 구현 확장(선택) |
| 8 | architecture | `WebsocketGateway`(소켓별 상태 3축: subscriptions/rateLimiter/expiryTimers)와 frontend `connect()` 클로저(연결+인증갱신 멀티플렉싱) 양쪽 모두 책임이 점증 — 1R 에서 이미 평가·보류(추출 시 arm/disarm 왕복만 늘어남) | `websocket.gateway.ts:144-207`; `ws-client.ts:59-129` | 조치 불요. 소켓별 상태 축이 4번째로 늘어나는 다음 변경 시 재검토 |
| 9 | maintainability | `expiryTimers`/`armExpiryTimers` 타이머 페어 타입이 여전히 optional(`{notice?, cutoff?}`) — 항상 쌍으로 존재하는 불변식이 타입에 드러나지 않음. 2회 "취향 범위"로 명시 보류됨 | `websocket.gateway.ts:150-153,192` | non-optional 타입으로 승격(선택) |
| 10 | maintainability | wire 메시지 문자열이 파일의 기존 `MSG_*` 상수화 관례를 따르지 않고 인라인 리터럴로 남음. 2회 "취향 범위"로 보류됨 | `websocket.gateway.ts:195` | `MSG_AUTH_TOKEN_EXPIRING` 류 상수로 승격(선택) |
| 11 | scope/maintainability | `ws-client.ts` 신규 핸들러 등록부에 의미 없는 이중 빈 줄 — 2R fix 이후에도 미정리, 3라운드 연속 지적 | `ws-client.ts:116-117` | 빈 줄 1개 제거(선택) |
| 12 | scope | 실패/빈 `--impl-prep` consistency 재시도 세션 6개(10파일)가 diff 에 그대로 커밋됨 — 3라운드 연속 지적, 기능과 무관 | `review/consistency/2026/09/02/{17_08_55,17_09_30,17_11_15,17_11_16,17_11_33,17_11_34}/` | 성공한 최종 세션만 커밋하는 관례 고려(선택) |
| 13 | testing | 백엔드 — `exp` 자체가 이미 과거인 토큰(음수 `untilCutoff`) 케이스 미검증. `jwtService.verify` 가 만료 토큰을 앞단에서 걸러 실경로 도달 불가로 저위험 판정 유지 | `websocket.gateway.ts:201-207`; `websocket.gateway.spec.ts:719-825` | 필수 아님. 추가한다면 `connectWithExp(id, -10)` 1건 |
| 14 | testing/user_guide_sync | WS 만료→재연결 e2e 부재 — plan 에 유예 근거(하네스가 런타임 TTL 주입 표면 없음)와 재개 신호가 명시돼 은닉된 갭이 아님 | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` | 조치 불요 |
| 15 | documentation | `cutoff` 타이머의 `Math.max(0, untilCutoff)` 클램프에 개별 설명 주석이 없음(인접 `untilNotice` 클램프에만 설명 존재). 2R 이월, 혼동 가능성 낮음 | `websocket.gateway.ts:201-207` | 참조 주석 추가 또는 헬퍼로 통합(선택) |
| 16 | requirement | 재발급이 반복 실패하면 자동 재시도 경로가 없음(설계상 의도된 정지점으로 보이나 문서화는 없음) | `ws-client.ts:78-80` | 코드/가이드에 이 정지점을 한 줄 명시(선택) |
| 17 | api_contract | `inFlight` 가드로 겹친 트리거가 첫 트리거의 Promise 를 공유해, 이후 트리거는 자신의 `why`(로그 접두사)를 잃음 — 순수 클라이언트 로깅 관측성 이슈, wire 계약 영향 없음 | `ws-client.ts:59-86` | 조치 불요 |
| 18 | user_guide_sync | `run-debug-flow-change` 트리거는 회색지대로 재확인 — `05-run-and-debug/*.mdx` 가 애초에 realtime-fallback 동작을 문서화하지 않아 이번 PR 이 새로 깬 문서 계약은 없음 | `codebase/frontend/src/content/docs/05-run-and-debug/` | 조치 불요 |

## SPEC-DRIFT

없음.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 세션 revoke 카브아웃(최대 15분, 의도됨), 타이머 재진입 덮어쓰기(도달 불가, 재확인) |
| performance | NONE | 만료 타이머 지터 부재(INFO, plan 에 defer 등재됨) |
| architecture | LOW | `expiresAt` JSDoc 이 미사용 필드까지 소비한다고 과장 서술 |
| requirement | NONE | spec fidelity 완전 일치, spec Planned 배지만 미반영(등재됨) |
| scope | NONE | 핵심 변경은 plan/spec 범위와 1:1 대응, 잔여 서식/재시도 아티팩트만 |
| side_effect | LOW | 1R/2R WARNING 모두 해소 확인, 배포 전환 창·예외 오분류 INFO 재확인 |
| maintainability | LOW | `refreshAndReconnect` try/catch 들여쓰기가 새 가독성 결함(WARNING) |
| testing | MEDIUM | `inFlight` 리셋 미검증(뮤테이션 생존 확인, WARNING) |
| documentation | LOW | pending-가드 주석이 확장된 트리거 표면을 반영 못함(WARNING) |
| concurrency | MEDIUM | cross-generation race — 재현 스크립트로 직접 검증(WARNING) |
| api_contract | LOW | wire 계약 영향 없음, spec 배지·배포 창 INFO 재확인 |
| user_guide_sync | NONE | 유저 가이드 ko/en 완전 동반 갱신, e2e 는 근거 있는 유예 |

## 발견 없는 에이전트

없음 — 전 12개 에이전트가 최소 1건 이상(대부분 INFO)의 관찰을 남겼다.

## 권장 조치사항

1. **[concurrency WARNING]** `ws-client.ts` `connect()`/`refreshAndReconnect` 에 소켓 인스턴스 스냅샷(`mySocket`) + `if (socket !== mySocket) return;` 가드를 추가해 cross-generation race 를 닫는다. 테스트의 `io()` mock 도 호출마다 다른 인스턴스를 반환하도록 바꿔 회귀를 포착 가능하게 한다.
2. **[testing WARNING]** `inFlight` 가드가 완료 후 리셋되어 다음 트리거가 다시 refresh 하는지 검증하는 테스트를 추가한다(뮤테이션으로 현재 회귀 방지망 공백이 확인됨).
3. **[maintainability WARNING]** `refreshAndReconnect` 를 감싸는 `try/catch` 블록을 실제 중첩에 맞게 재인덴트한다.
4. **[documentation WARNING]** `connect()` pending-가드 주석을 확장된 세 트리거(connect_error/auth.token_expired/disconnect) 기준으로 갱신한다.
5. (선택, 이미 등재됨) 머지 후 planner 턴에서 spec `_(계획·미구현)_` 배지를 flip 하고 관련 tracker 체크박스를 동기화한다.
6. (선택, 이미 등재됨) 배포 런북에 구버전 프론트 번들의 배포 전환 창 리스크 감내/완화 판단을 기록해 plan 체크리스트를 닫는다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract, user_guide_sync` (12명, 전원 success)
  - **제외**: 아래 표 (2명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 누락 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단 — 이번 diff 에 의존성 변경 없음 |
  | database | router 판단 — 이번 diff 에 스키마/쿼리 변경 없음 |