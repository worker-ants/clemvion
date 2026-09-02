# 테스트(Testing) 리뷰 — WS 소켓 수명 = 토큰 수명 (`auth.token_expired`), 5R

## 검증 방법

이 changeset 은 이미 4라운드 리뷰·조치(`review/code/2026/09/02/{17_38_12,18_18_53,18_45_43,19_12_36}/`,
fix 커밋 `a9316a0a6`·`1bd2000d5`·`e5b683d75`·`a18376f0c`)를 거쳤다. 이번 라운드는 그 서술을
받아쓰지 않고 실제 소스(`Read`/`grep`)와 실행으로 **독립 재검증**했다. 저장소 파일은 건드리지
않았다(`git status --short` 시작·종료 모두 clean).

- `codebase/frontend`: `npx vitest run src/lib/websocket/__tests__/ws-client.test.ts` →
  **26/26 PASS**.
- `codebase/backend`: `npx jest src/modules/websocket/websocket.gateway.spec.ts
  src/modules/websocket/websocket-events.types.spec.ts` → **79/79 PASS**.
- 직전 커밋(`a18376f0c`, 이번 라운드 diff 의 최신 변경분)은 `websocket-events.types.ts` 의
  JSDoc 정정과 `ws-client.ts` 의 중복 빈 줄 1개 삭제뿐이다 — 실행 경로·분기 변화 없음. 테스트
  관점에서 신규 회귀 표면이 없음을 diff 로 직접 확인했다.
- `websocket-events.types.spec.ts` 의 `EXPECTED_EXPORTS` 완전성 가드는 런타임 module-keys
  체크가 아니라 TypeScript AST 파싱 기반 정적 가드다(`ts.createSourceFile` 로 `export` 선언을
  직접 훑음) — 그래서 `AuthTokenExpiredPayload` 처럼 런타임에 소거되는 `interface` 도 유효하게
  검사 대상이 된다. 오탐 우려 없음, 직접 소스 확인.
- 4R RESOLUTION 이 등재한 cross-generation 가드 테스트의 flaky 관측(리뷰어 76회 중 1회 실패,
  작성자 150회 0실패)에 대해 이번 라운드에서도 `-t` 필터로 **25회 추가 반복** 실행 — **0실패**.
  이 결과는 "flaky 아니다" 를 입증하지 않는다(재현 실패는 부재의 증거가 아니다) — 기존 watch
  판단을 그대로 유지하는 근거로만 기록한다.

## 발견사항

- **[INFO]** 명시적 `disconnect()`/`resetWsClient()` 가 in-flight 토큰 재발급 도중 발생하는
  경로가 테스트되지 않음 (신규 관찰 — 4라운드 리포트에 없던 각도)
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:68`
    (`const mySocket = socket;` 스냅샷) · `:74`
    (`if (!newToken || !mySocket || socket !== mySocket) return;`) · `:146-151`
    (`disconnect()` 가 `socket = null` 로 같은 클로저의 `socket` 을 지움)
  - 상세: `refreshAndReconnect` 가 `refreshAccessToken()` 을 기다리는 동안 사용자가 로그아웃하는
    등으로 같은 클라이언트 인스턴스의 `disconnect()`(→ `resetWsClient()` 경유 포함)가 호출되면,
    그 클로저의 `socket` 이 `null` 로 바뀐다. 재발급이 끝나 가드를 통과할 때
    `socket !== mySocket` 은 `null !== mySocket` 이라 `true` — 조기 반환되어 `mySocket.auth`
    변경·`connect()`/`disconnect()` 재호출이 일어나지 않는다. **코드 경로 자체는 세대 비교
    가드가 구조적으로 이 케이스도 덮어 안전해 보인다**(옛 세대 vs `null` 둘 다 `!== mySocket`).
    다만 이를 직접 겨냥한 테스트는 없다 — 기존 `옛 세대의 재발급은 새 소켓을 건드리지 않는다`
    테스트는 **새 소켓으로 교체**되는 경우만 다루고, **소켓이 사라지는(로그아웃)** 경우는
    다루지 않는다. `grep` 확인: 파일 전체에서 `resetWsClient` 는 `beforeEach`(:40)와 별개
    `describe`(:393, :401 — 토큰 만료 블록과 무관)에만 등장한다.
  - 제안: 필수 아님(가드가 구조적으로 이미 커버). 추가한다면 "재발급 pending 중
    `client.disconnect()` 호출 → release 후 `mySocket.disconnect`/`.connect` 가 호출되지
    않는다" 1건으로 그 방어를 실측 뒷받침할 수 있다.

- **[INFO]** `armExpiryTimers` 의 "`exp` 가 이미 과거인 토큰"(cutoff 도 0ms 로 즉시 발화) 경로 —
  5라운드째 여전히 직접 테스트되지 않음. 이전 라운드 판단 재확인, 변화 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:201-207`
    (`timers.cutoff = setTimeout(..., Math.max(0, untilCutoff))`) / 가장 근접한 테스트:
    `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:793-805`
    (`'lead time 보다 짧게 남은 토큰은 즉시 통지한다'`, `secondsFromNow: 30` — `untilNotice` 의
    음수 클램프만 관측, `untilCutoff` 자체가 음수인 입력은 없음)
  - 상세: `jwtService.verify` 가 만료된 토큰을 핸드셰이크 단계에서 이미 거부하므로 이 분기는
    현재 실경로에서 도달 불가라는 판단이 1R~4R 에 걸쳐 반복 확인됐고, 이번 재검증에서도
    코드·주석·plan 어디에도 반례가 없어 유효하다.
  - 제안: 필수 아님. 추가한다면 `connectWithExp(id, -10)` 1건으로 방어 코드의 "음수 지연 →
    즉시 처리" 주장을 실측으로 뒷받침할 수 있다.

- **[INFO]** 사전 통지 payload 의 `message` 필드가 `expect.any(String)` 로만 검증 — 4R 지적,
  변화 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:755` /
    대응 소스 `codebase/backend/src/modules/websocket/websocket.gateway.ts:195`
    (`message: 'Access token expires soon — refresh and reconnect.'`)
  - 상세: 같은 파일의 다른 wire 문자열(`MSG_NOT_AUTHENTICATED` 등)은 정확한 리터럴을 단언하는
    관례를 따르는데 이 필드만 느슨하다. 다만 frontend 가 이 값을 소비하지 않고 이벤트 이름에만
    반응하므로(JSDoc 도 4R 에서 "진단·로깅용" 으로 명확화됨) 실사용 영향은 없다.
  - 제안: 선택적. `MSG_AUTH_TOKEN_EXPIRING` 류 상수로 승격(maintainability 리뷰 기제안)한 뒤
    그 상수를 테스트에서 참조하면 동기화된다.

- **[INFO]** cross-generation 가드 테스트의 flaky 관측 — 여전히 미해소 watch 항목, 이번
  라운드 25회 추가 프로브도 재현 실패
  - 위치: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 체크리스트
    (`cross-generation 가드 테스트의 flaky 관측 (리뷰 4R W1) — watch`) / 대상 테스트
    `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts` 의
    `'옛 세대의 재발급은 새 소켓을 건드리지 않는다'`
  - 상세: 4R 리뷰어가 76회 중 1회 실패를 관측했고 작성자는 150회 0실패였다. 이번 라운드에서
    독립적으로 25회 반복 실행했으나 역시 0실패 — 재현하지 못했다는 증거가 하나 더 늘었을
    뿐 부재를 입증하지 않는다. plan 이 재개 신호("한 번이라도 더 실패하면 끝까지 판다")를
    명시하고 있어 은닉된 갭은 아니다.
  - 제안: 조치 불요(추적 유지). 재발 시 `vi.resetAllMocks()` 와 모듈 스코프 `mockRefresh`
    구현 초기화 상호작용을 우선 의심 후보로 남겨 둔 4R 기록을 참고.

- **[INFO]** WS 만료→재연결 종단 간 e2e 부재 — 재확인, 조치 불요
  - 위치: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 체크리스트
    (`e2e — 유예. 근거를 여기 적는다...`)
  - 상세: 현 e2e 하네스가 boot-only 게이트(NODE_ENV+FLAG 이중)라 런타임 토큰 TTL 주입 표면이
    없다는 판단과 재개 신호가 SoT(plan) 안에 명시돼 있다.

## 검토했으나 이상 없음 (이전 라운드 지적의 재확인)

- **1R CRITICAL "socket.connect() no-op"**·**"typecheck ratchet 파괴"**, **2R WARNING** 2건,
  **3R WARNING** 2건 — `ws-client.ts:60-142` 의 `refreshAndReconnect` 공유 헬퍼(in-flight 가드·
  `.finally` 리셋·세대 스냅샷+비교)와 대응 테스트(`ws-client.test.ts` 의 `disconnect → connect`
  순서 단언, 겹친 트리거 1회 처리, 완료 후 재무장, 옛 세대 무영향)로 실제 반영·해소됨을 소스
  대조로 재확인했다. 신규 회귀 없음.
- backend `armExpiryTimers`/`handleConnection`/`handleDisconnect` 및 5개 신규 테스트
  (`websocket.gateway.spec.ts:719-825`) — 정상 경로·해제(누수 방지)·짧은 lead time 경계·
  `exp` 부재 무동작까지 촘촘하다. 실행 재확인(79/79 PASS).
- **테스트 격리**: 백엔드는 `describe('토큰 만료 — 사전 통지 후 disconnect (§1.2)')` 안에서만
  `jest.useFakeTimers()`/`useRealTimers()` 를 걸어 다른 테스트로 새지 않는다. 프론트는 매
  테스트 `beforeEach` 에서 `mockSocket` 재생성 + `vi.resetAllMocks()` + `resetWsClient()` 로
  초기화한다.
- `EXPECTED_EXPORTS` 완전성 가드(§websocket-events.types.spec.ts:62-66) — AST 기반 정적 검사임을
  직접 확인, 타입 전용 export 도 유효하게 검사됨.

## 요약

이번 5R diff 의 실질 변경(직전 커밋 `a18376f0c`)은 JSDoc 정정과 중복 빈 줄 삭제뿐이라 신규
실행 경로가 없고, 새 CRITICAL·WARNING 은 발견하지 못했다. 핵심 로직(사전 통지·명시적
재핸드셰이크·타이머 arm/disarm·in-flight 재진입 가드·세대 격리)에 대한 unit 테스트는
backend(79/79)·frontend(26/26) 모두 GREEN 이고, 4라운드에 걸쳐 지적된 CRITICAL 2건·WARNING
다수는 소스 대조와 실행으로 독립 재확인했다. 남은 것은 전부 INFO 로, 넷은 이전 라운드부터
추적 중인 저위험·유예 항목(과거-`exp` cutoff 분기 미검증, `message` 필드 loose assertion,
cross-generation flaky watch, e2e 유예)이고, 하나(로그아웃 중 in-flight 재발급 완료 경로 미검증)는
이번 라운드에서 새로 관찰했으나 기존 세대 비교 가드가 구조적으로 이미 방어하는 것으로 보여
차단 사유는 아니다.

## 위험도

NONE — CRITICAL 0 · WARNING 0 · INFO 5(넷은 이전 라운드부터 추적 중인 저위험 항목의 재확인,
하나는 이번 라운드 신규 관찰이나 기존 가드로 구조적으로 방어됨).
