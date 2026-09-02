# 테스트(Testing) 리뷰 — WS 소켓 수명 = 토큰 수명 (`auth.token_expired`)

## 검증 방법

diff 만으로 판단하지 않고 다음을 직접 실행해 실측했다 (저장소 파일은 수정하지 않음, `git status --short` 로 원복 불요 확인):

- `codebase/frontend`: `npx tsc -p tsconfig.typecheck.json --noEmit`, `python3 scripts/check-frontend-typecheck-ratchet.py`, `npx vitest run src/lib/websocket/__tests__/ws-client.test.ts`, `npx eslint ...`
- `codebase/backend`: `npx jest src/modules/websocket/websocket.gateway.spec.ts`, `npx tsc -p tsconfig.json --noEmit`, `python3 scripts/check-backend-typecheck-ratchet.py`

## 발견사항

- **[CRITICAL]** 신규 프론트엔드 테스트가 `frontend typecheck ratchet` 게이트를 **실제로 깬다** (CI 차단, 추정이 아니라 실행 확인)
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts:151`, `:163`, `:174` (세 곳 모두 `createWsClient().connect();`)
  - 상세: `WsClient.connect` 시그니처는 `connect: (token: string) => void` (필수 인자, `codebase/frontend/src/lib/websocket/ws-client.ts:6`)인데 신규 테스트 3건이 인자 없이 `createWsClient().connect()` 를 호출한다. `pnpm test`(`vitest run`)는 타입을 strip 하므로 런타임은 통과하지만(직접 실행 확인: `20 passed`), 이 저장소는 정확히 이 사각을 막으려고 `tsconfig.typecheck.json` + `scripts/check-frontend-typecheck-ratchet.py` ratchet 게이트를 최근 도입했다(그 스크립트 자체의 docstring 이 "테스트 코드의 타입 오류는 로컬에서도 CI 에서도 아무도 보지 못한다"는 것을 막기 위해 만들었다고 명시). 직접 실행하면:
    ```
    src/lib/websocket/__tests__/ws-client.test.ts(151,24): error TS2554: Expected 1 arguments, but got 0.
    src/lib/websocket/__tests__/ws-client.test.ts(163,24): error TS2554: Expected 1 arguments, but got 0.
    src/lib/websocket/__tests__/ws-client.test.ts(174,24): error TS2554: Expected 1 arguments, but got 0.
    ```
    ratchet 스크립트도 명시적으로 실패한다: `src/lib/websocket/__tests__/ws-client.test.ts: 0 → 3` (baseline 52 초과). 이 ratchet 은 `.github/workflows/frontend-checks.yml` 의 별도 `typecheck-ratchet` job 으로 **CI 에 실제로 배선**되어 있어 push 시 실패한다. `.claude/tools/run-test.sh` 4단계(lint/unit/build/e2e)에는 포함되지 않는다고 스크립트 자신이 명시하므로, developer 가 표준 wrapper 만 돌리면 로컬에서 이 실패를 못 본다 — CI 에서 처음 드러난다.
  - 제안: 세 호출 모두 토큰 인자를 채운다. 예: `createWsClient().connect("old-token")`. (mock 소켓은 토큰 값 자체를 검증하지 않으므로 임의 문자열로 충분하다.) 수정 후 `python3 scripts/check-frontend-typecheck-ratchet.py` 로 baseline 회귀 확인.

- **[INFO]** "exp 가 이미 과거인 토큰" 조합(사전 통지·강제 종료 두 타이머가 동시에 0ms 로 발화)은 테스트되지 않음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `armExpiryTimers` 의 `Math.max(0, untilCutoff)` 클램프 (관련 테스트: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` `describe('토큰 만료 — 사전 통지 후 disconnect (§1.2)', ...)` 내 `'lead time 보다 짧게 남은 토큰은 즉시 통지한다'` 케이스)
  - 상세: 기존 4개 케이스 중 "lead time 보다 짧은" 케이스(`secondsFromNow: 30`)는 `untilNotice` 의 음수 클램프(0)만 실제로 관측한다 — `untilCutoff` 자체는 항상 양수(30000ms)로 유지돼 `timers.cutoff` 의 `Math.max(0, untilCutoff)` 클램프 분기(둘 다 0ms 로 동시 발화)는 어느 테스트에서도 경계값이 갈리지 않는다. 코드 주석은 "음수 지연 → 즉시 처리"를 방어적으로 다룬다고 명시하는데, 그 주장을 직접 검증하는 테스트는 없다. 다만 실무에서는 `jwtService.verify` 가 만료된 토큰을 이미 앞단에서 거부하므로 이 분기에 도달할 입력이 현재는 존재하지 않는다 — 우선순위는 낮음.
  - 제안: `connectWithExp(id, -10)` 류로 `exp` 가 과거인 케이스 하나를 추가해 두 타이머가 즉시(0ms) 발화하는지 확인하면 문서화된 방어 주장이 실측으로 뒷받침된다. 필수는 아님(방어 대상 입력이 실경로에서 도달 불가하다는 점을 코드 자신도 인지하고 있음).

- **[INFO]** 백엔드 타이머 발화 → 프런트 재연결까지의 종단 간(end-to-end) 경로는 unit 레벨에서만 각각 검증되고, 실제 Socket.IO 왕복을 거치는 통합/e2e 테스트는 아직 없음
  - 위치: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 체크리스트("lint / unit / build / e2e" 항목 미체크)
  - 상세: `websocket.gateway.spec.ts` 는 서버가 올바른 타이밍에 `emit`/`disconnect` 를 **호출하는지**만, `ws-client.test.ts` 는 특정 `reason` 문자열에 클라이언트가 **반응하는지**만 mock 으로 각각 검증한다. 실제 Socket.IO 서버가 `disconnect()` 를 호출했을 때 클라이언트 소켓에 정확히 `"io server disconnect"` reason 이 전달되는지, 그리고 명시적 `connect()` 이후 정상적으로 재인증되는지의 왕복은 이 diff 범위에 없다. plan 이 이미 e2e 를 미완료 항목으로 추적 중이라 은닉된 갭은 아니다.
  - 제안: 후속 e2e(별도 PR/커밋)에서 실제 서버·클라이언트 페어로 만료 → 통지 → 재연결 왕복을 최소 1건 커버할 것을 plan 체크리스트대로 이행.

## 요약

핵심 기능(WS 소켓 수명 종속·사전 통지·재연결)에 대한 unit 테스트 자체는 backend(`websocket.gateway.spec.ts` 5건, 실행 결과 67/67 pass)·frontend(`ws-client.test.ts` 3건, 실행 결과 20/20 pass) 양쪽 모두 정상 경로·해제 누락 방지·좁은 fallback 분기(대조군 포함)까지 촘촘하게 짜여 있고, 경계값(lead time 보다 짧은 잔여 시간, `exp` 없음)도 다루는 등 설계 의도가 테스트 이름·주석에 잘 드러난다. 다만 프런트엔드 신규 테스트 3건이 `WsClient.connect(token: string)` 시그니처를 어기고 인자 없이 호출해, `vitest run` 은 통과하지만 이 저장소가 별도로 도입한 `frontend typecheck ratchet` CI 게이트(`typecheck-ratchet` job)를 실제로 깬다 — 실행해 확인했다(baseline 52 → 55, 3건 증가로 즉시 FAIL). 이는 추정이 아니라 지금 이 diff 로 push 하면 CI 가 막히는 상태이므로 반드시 수정해야 한다. 그 외에는 "이미 만료된 토큰" 조합의 동시-발화 분기, 실제 Socket.IO 왕복 e2e 가 비어 있으나 전자는 실경로에서 도달 불가한 방어 코드이고 후자는 plan 이 이미 추적 중이라 경미하다.

## 위험도

CRITICAL
