# 테스트(Testing) 리뷰 — WS 소켓 수명 = 토큰 수명 (`auth.token_expired`), 4R (최종 상태 재검증)

## 검증 방법

이 changeset 은 이미 3라운드 리뷰·조치(`review/code/2026/09/02/{17_38_12,18_18_53,18_45_43}/`,
fix 커밋 `a9316a0a6`·`1bd2000d5`·`e5b683d75`)를 거친 최종 상태다. 앞선 라운드의 서술을 그대로
받아쓰지 않고, 실제 소스(`Read`)·전체 스위트 실행·타겟 뮤테이션으로 **직접 재검증**했다.
저장소 파일은 뮤테이션 직후 `cp` 로 즉시 원복(`git status --short` 로 잔여 변경 없음 확인 완료).

- `codebase/frontend`: `npx vitest run src/lib/websocket/__tests__/ws-client.test.ts` →
  **26/26 PASS**, `npx vitest run src/lib/websocket` (모듈 전체) → **204/204 PASS**,
  `python3 scripts/check-frontend-typecheck-ratchet.py` → **52건/15파일, baseline 일치**
  (1R 이 이 게이트를 실제로 깼던 CRITICAL — 지금은 통과 확인).
- `codebase/backend`: `npx jest src/modules/websocket/websocket.gateway.spec.ts` →
  **67/67 PASS**, `npx jest src/modules/websocket`(모듈 전체) → **178/178 PASS**.
- 뮤테이션 재검증: `ws-client.ts:74` 의 `socket !== mySocket`(cross-generation 가드, 3R W1)를
  제거 → `옛 세대의 재발급은 새 소켓을 건드리지 않는다` 테스트가 **RED** 로 즉시 전환됨을
  직접 실행으로 확인(`gen1.connect` 가 1회 호출됨). `cp` 로 원복 후 `git status --short` 클린
  확인. RESOLUTION.md 의 "세대 비교 제거 RED" 주장과 일치.

## 발견사항

- **[INFO]** `armExpiryTimers` 의 "만료 시각이 이미 과거인 토큰"(cutoff 도 0ms 로 즉시 발화)
  경로는 4라운드째 여전히 직접 테스트되지 않음 — 위험도 재확인, 신규 아님
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:201-207`
    (`timers.cutoff = setTimeout(..., Math.max(0, untilCutoff))`) / 가장 근접한 테스트:
    `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:793-805`
    (`'lead time 보다 짧게 남은 토큰은 즉시 통지한다'`, `secondsFromNow: 30`)
  - 상세: 기존 근접 케이스는 `untilNotice` 의 음수 클램프(사전 통지가 즉시 발화)만 관측하고,
    `untilCutoff` 자체가 음수인 입력(예: `secondsFromNow: -10`)은 어느 라운드에서도 추가되지
    않았다. `jwtService.verify` 가 만료된 토큰을 핸드셰이크 단계에서 이미 거부하므로 이
    분기는 현재 실경로에서 도달 불가라는 판단이 1R~3R 에 걸쳐 반복 확인됐고 이번 재검증에서도
    유효하다(코드·주석·plan 어디에도 반례 없음). 조치 없이 유지됨은 의도된 결정이지 누락이
    아니다.
  - 제안: 필수 아님. 추가한다면 `connectWithExp(id, -10)` 1건으로 "음수 지연 → 즉시 처리"
    라는 주석의 방어적 주장을 실측으로 뒷받침할 수 있다.

- **[INFO]** 사전 통지 payload 의 `message` 필드가 `expect.any(String)` 로만 검증돼, 문구
  변경에 대한 회귀 보호가 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:755`
    (`message: expect.any(String)`), 대응 소스:
    `codebase/backend/src/modules/websocket/websocket.gateway.ts:195`
    (`message: 'Access token expires soon — refresh and reconnect.'`)
  - 상세: 같은 파일의 다른 wire 문자열(`MSG_NOT_AUTHENTICATED` 등)을 검증하는 기존 테스트들은
    정확한 리터럴을 단언하는 관례를 따르는데, 이 필드만 느슨하다. 다만 이 payload 는 frontend
    (`ws-client.ts`)가 값을 전혀 읽지 않고 이벤트 이름에만 반응하므로(3R RESOLUTION 이미
    "문서가 구현보다 넓다"로 별도 기록) 실사용 영향은 없다 — 순수 진단/로그용 문자열이라
    깨져도 사용자 동작에 영향이 없다. 우선순위는 낮음.
  - 제안: 선택적. `MSG_AUTH_TOKEN_EXPIRING` 류 상수로 승격(maintainability 리뷰가 이미 제안)한
    뒤 그 상수를 테스트에서 참조하면 문구·검증이 한 곳에서 동기화된다.

## 검토했으나 이상 없음 (앞선 3라운드 지적의 재확인)

- **1R CRITICAL "socket.connect() no-op"**: `ws-client.ts:85-86` 의
  `if (mySocket.connected) mySocket.disconnect(); mySocket.connect();` 가 실제 재핸드셰이크를
  강제하고, `ws-client.test.ts:155-172` 가 `disconnect → connect` 호출 순서까지 단언한다 —
  코드·테스트 모두 확인.
- **1R CRITICAL "frontend typecheck ratchet 파괴"**: 3건의 `connect()` 무인자 호출은 모두
  토큰 인자를 받도록 수정돼 있고, ratchet 스크립트가 baseline(52/15) 과 일치함을 직접 실행해
  재확인했다.
- **2R WARNING "재진입 가드가 신규 트리거를 안 덮음"**: `refreshAndReconnect` 내부의 `inFlight`
  가드(`ws-client.ts:60-97`)가 트리거가 아니라 헬퍼 안에 있어 세 트리거 전부를 관통한다 —
  `ws-client.test.ts:189-211`("겹친 트리거는 한 번만 재연결한다")로 확인.
- **3R WARNING "가드 리셋 미검증"**: `.finally(() => { inFlight = null; })` 리셋이
  `ws-client.test.ts:264-282`("가드는 완료 후 초기화된다 — 다음 주기에도 다시 갱신한다")로
  직접 커버된다. 두 번째 주기에 `mockRefresh`/`connect` 가 다시 호출됨을 명시적으로 단언한다.
- **3R WARNING "cross-generation race"**: `const mySocket = socket` 스냅샷 + `socket !== mySocket`
  세대 비교 두 축 모두 `ws-client.test.ts:287-321`이 커버하며, 세대 비교 축은 위 뮤테이션으로
  직접 RED 를 재확인했다(본 라운드 신규 검증).
- **테스트 격리**: 백엔드는 `describe('토큰 만료 — 사전 통지 후 disconnect (§1.2)')` 안에서만
  `jest.useFakeTimers()`/`useRealTimers()` 를 걸어 다른 테스트로 fake timer 가 새지 않고,
  그 밖의 기존 `JwtService.verify` mock (파일 전체 grep 결과 `exp:` 필드는 신규 describe 블록
  1곳에만 존재) 은 `exp` 를 안 채워 실제 `setTimeout` 이 걸리지 않는다 — 확인함. 프론트도
  매 테스트 `beforeEach` 에서 `mockSocket` 재생성 + `resetWsClient()` 로 싱글턴을 초기화해
  테스트 간 상태 누수가 없다.
- **e2e 부재**: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 가 유예 사유(현
  e2e 하네스는 boot-only 게이트라 런타임 토큰 TTL 주입 표면이 없음)와 재개 신호를 명시적으로
  들고 있어 은닉된 갭이 아니다 — 조치 불요 재확인.

## 요약

핵심 로직(사전 통지·명시적 재핸드셰이크·타이머 arm/disarm·in-flight 재진입 가드·세대 격리)에
대한 unit 테스트는 backend(178/178)·frontend(204/204) 전체 스위트가 GREEN 이고, 앞선
3라운드에서 CRITICAL 2건·WARNING 다수가 지적한 지점들을 이번 라운드에서 소스 대조와 실행으로
독립 재검증했다 — 특히 3R 의 cross-generation 가드는 직접 뮤테이션(`socket !== mySocket` 제거)
을 걸어 RED 로 전환됨을 재확인해 "테스트가 실제로 그 불변식을 지킨다"를 검증(원복 완료,
`git status --short` 클린). 남은 것은 두 건의 저위험 INFO 뿐이다 — 백엔드 "만료 시각이 이미
과거인 토큰"(cutoff 즉시 발화) 분기는 상위 JWT 검증이 걸러 도달 불가라 4라운드째 의도적으로
미조치 상태이고, 사전 통지 `message` 필드의 느슨한 단언(`expect.any(String)`)은 그 값을
소비하는 코드가 없어 실질 위험이 없다. 신규 CRITICAL·WARNING 은 발견하지 못했다.

## 위험도

NONE — CRITICAL 0 · WARNING 0(3라운드에 걸쳐 이미 지적·조치·재검증됨) · INFO 2(둘 다 저위험,
4라운드 연속 동일 판단 유지).
