# 테스트(Testing) 리뷰 — WS 소켓 수명 = 토큰 수명 (`auth.token_expired`), 2R

## 검증 방법

diff 로만 판단하지 않고 실제로 실행해 확인했다(저장소는 뮤테이션 검증 뒤 `cp` 로 즉시 원복,
`git status --short` 로 잔여 변경 없음 확인):

- `codebase/frontend`: `npx vitest run src/lib/websocket/__tests__/ws-client.test.ts` (20/20 PASS),
  `python3 scripts/check-frontend-typecheck-ratchet.py` (52/15, baseline 일치)
- `codebase/backend`: `npx jest src/modules/websocket/websocket.gateway.spec.ts` (67/67 PASS),
  `npx jest src/modules/websocket/websocket-events.types.spec.ts` (12/12 PASS)
- 1R(`17_38_12`)에서 지적된 CRITICAL 2건(no-op 재연결, typecheck ratchet 파괴)은 현재 diff에
  실제로 반영돼 있고(`ws-client.ts:66-67` 의 `if (socket.connected) socket.disconnect();`,
  테스트 3곳의 `connect("old-token")` 인자), 위 실행으로 재확인했다 — 이 라운드에서 재기재하지 않는다.
- 아래 두 WARNING 은 **뮤테이션으로 직접 검증**했다(대상 코드를 임시로 고쳐 실행 후 `cp` 로 원복,
  원복 후 `git status --short` 로 클린 확인).

## 발견사항

- **[WARNING]** `connect_error` → `refreshAndReconnect` 위임 경로가 테스트로 전혀 검증되지 않음 (뮤테이션 생존 확인)
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts` — `socket.on("connect_error", ...)` 핸들러
    안의 `void refreshAndReconnect("connect_error");` 호출부(`connect_error` 등록 직후 줄, 1R W1 수정으로
    이번에 신설)
  - 상세: 1R 아키텍처 리뷰(W1)의 권고대로 `connect_error` 핸들러가 기존 inline 로직을 버리고 공유 헬퍼
    `refreshAndReconnect`를 호출하도록 리팩터됐다. 그런데 이 위임 자체를 검증하는 테스트가 없다 —
    `ws-client.test.ts` 전체에서 `"connect_error"` 는 `waitForConnect` 의 `reject` 케이스(라인 231 부근,
    `handlerFor` 헬퍼를 쓰지 않는 별도 mock)에서만 등장하고, "connect_error 발생 시 토큰이 갱신되고
    재핸드셰이크된다" 를 확인하는 테스트는 존재하지 않는다. 직접 확인: `void refreshAndReconnect("connect_error");`
    호출부를 주석 처리(no-op)로 뮤테이션해도 `vitest run` 은 **20/20 GREEN** 을 유지했다(원복 완료,
    `git status --short` 클린). 이 파일은 바로 이 PR 1R 에서 "mock 이 프로덕션에 없는 상태를 검사해
    CRITICAL 이 안 잡혔다"는 vacuous 테스트 교훈을 얻은 자리라서, 세 트리거 중 하나(가장 오래되고
    실사용 빈도가 높은 `connect_error`, Carousel stuck 버그 fix 원 코드)가 리팩터 후 회귀 안전망 없이
    남은 것은 같은 리스크 클래스다.
  - 제안: `handlerFor("connect_error")` 로 핸들러를 꺼내 실제로 호출하고, `refreshAttempted` 가드까지
    포함해 "1회차엔 refresh+재연결, 2회차(같은 소켓 재시도)엔 스킵" 을 최소 1건 단언하는 테스트를 추가한다.

- **[WARNING]** `refreshAndReconnect` 의 `if (!newToken || !socket) return;` 가드 및 `catch` 에러 경로가 미검증 (뮤테이션 생존 확인)
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts` — `refreshAndReconnect` 함수 내부
    `const newToken = await refreshAccessToken(); if (!newToken || !socket) return;` 및
    `catch (refreshErr) { console.error(...); }`
  - 상세: `ws-client.test.ts` 전체에서 `mockRefresh` 는 항상 `"new-token"` 을 반환하는 고정
    구현(`vi.fn(async () => "new-token")`)만 쓰이고, `mockResolvedValueOnce(null)`/`mockRejectedValueOnce`
    류로 "재발급 실패" 경로를 흔드는 테스트가 없다(grep 확인: 파일 전체에 `mockRejectedValue`·
    `mockResolvedValueOnce` 부재). 직접 확인: 가드를 `if (false) return;` 로 뮤테이션(사실상 제거)해도
    `vitest run` 은 **20/20 GREEN** 을 유지했다(원복 완료). 즉 이 가드가 지워져 `socket` 이 이미 `null`인
    상태(예: `resetWsClient()` 경합)에서 `socket.auth` 에 접근해 TypeError 를 던지는 회귀가 나도 테스트
    스위트는 이를 못 잡는다. 세 트리거가 이제 이 함수 하나를 공유하므로(`connect_error`·
    `auth.token_expired`·`disconnect`), 이 가드 하나의 결함이 세 경로 모두에 전파된다 — 공유 헬퍼로
    통합한 이번 리팩터(1R W1)의 이점(회귀 방지)이 이 가드에 대해서는 아직 실현되지 않았다.
  - 제안: `mockRefresh.mockResolvedValueOnce(null)`(또는 `mockRejectedValueOnce(new Error(...))`) 케이스를
    최소 1건 추가해 "재발급 실패 시 `socket.connect()`/`socket.disconnect()` 가 호출되지 않는다" 를 단언한다.

- **[INFO]** 백엔드 — "lead time 보다 짧을 뿐 아니라 `exp` 자체가 이미 과거인 토큰" (두 타이머 동시 0ms 발화) 케이스 미검증 — 1R 에서 이미 지적된 항목, 이번 라운드에도 미반영
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `armExpiryTimers` 의
    `Math.max(0, untilCutoff)` 클램프 / 대응 테스트: `websocket.gateway.spec.ts`
    `'토큰 만료 — 사전 통지 후 disconnect (§1.2)'` 블록
  - 상세: 신규 5개 케이스 중 `secondsFromNow: 30`(lead time 보다 짧은 경우)은 `untilNotice` 의 음수
    클램프만 관측하고, `untilCutoff` 자체가 음수인 입력(`secondsFromNow: -10` 류)은 어느 테스트에서도
    시도되지 않는다 — 코드 주석(`websocket.gateway.ts:183-186`)이 "음수면 즉시" 를 명시적으로 방어
    코드화했다고 밝히는데 그 주장을 직접 흔드는 입력이 없다. 1R testing.md 가 이미 이 갭을 INFO 로
    기록했고(우선순위 낮음 — `jwtService.verify` 가 만료 토큰을 앞단에서 거르므로 실경로 도달 불가),
    이번 fix 라운드에서도 추가되지 않았다. 차단 사유 아님, 재확인 차 기록.
  - 제안: `connectWithExp(id, -10)` 케이스 1건 추가로 방어 코드 주장을 실측 뒷받침(선택적).

## 요약

1R CRITICAL 2건(재연결 no-op, typecheck ratchet 파괴)은 이번 diff 에 실제로 반영됐고 직접 실행으로
재확인했다(frontend 20/20, backend websocket 67/67 + events-types 12/12, ratchet 52/15). 다만 그 fix 자체가
새로 만든 공유 경로(`refreshAndReconnect`)에 대해 **두 가지 분기가 뮤테이션으로 생존**한다 —
① `connect_error` 트리거가 이 헬퍼로 위임됐다는 사실 자체를 검증하는 테스트가 없고, ② 재발급
실패(`null`/throw) 시 `socket`/`newToken` 가드가 동작하는지 검증하는 테스트가 없다. 두 건 모두 실제로
코드를 고쳐 GREEN 이 유지됨을 확인했다 — 이 PR 이 1R 에서 얻은 "GREEN 은 증거가 아니다" 교훈이 이번에
합친 공유 헬퍼의 방어 분기에는 아직 적용되지 않은 상태다. 백엔드 쪽은 신규 5개 테스트가 정상 경로·해제·
좁은 lead-time 경계를 촘촘히 덮고 있어 상대적으로 견고하며, 남은 갭(음수 `exp`)은 1R 에서 이미 저위험으로
분류된 항목이 그대로 남은 것뿐이다.

## 위험도

MEDIUM — CRITICAL 0, WARNING 2건(둘 다 신설 공유 인증-재연결 경로의 방어 분기 미검증, 뮤테이션으로
생존 확인). 병합을 막을 결함은 아니지만 세션 관리 경로라 회귀 시 파급이 크다.
