# 테스트(Testing) 리뷰 — WS 소켓 수명 = 토큰 수명 (`auth.token_expired`), 3R

## 검증 방법

diff 만으로 판단하지 않고 실제 소스(`Read`)와 실행으로 확인했다. 저장소 파일은 뮤테이션 검증
직후 `cp` 로 즉시 원복(`git status --short` 로 잔여 변경 없음 확인).

- `codebase/frontend`: `npx vitest run src/lib/websocket/__tests__/ws-client.test.ts` → **24/24 PASS**,
  `python3 scripts/check-frontend-typecheck-ratchet.py` → **52/15 (baseline 일치)**
- `codebase/backend`: `npx jest src/modules/websocket/websocket.gateway.spec.ts` → **67/67 PASS**,
  `python3 scripts/check-backend-typecheck-ratchet.py` → **199/38 (baseline 일치)**
- 1R CRITICAL 2건(no-op `connect()`, typecheck ratchet 파괴)·2R WARNING 2건(`connect_error` 위임
  미검증, 재발급 실패 가드 미검증)이 실제로 반영·해소됐음을 소스 대조로 재확인했다
  (`ws-client.test.ts:215-229`의 `connect_error 도 같은 헬퍼로 위임된다` 테스트,
  `:232-259`의 재발급 실패 2케이스). 이번 라운드에서 재기재하지 않는다.
- 아래 WARNING 1건은 **뮤테이션으로 직접 검증**했다 — 대상 코드를 `cp` 백업 후 고쳐 실행,
  원복 후 `git status --short` 로 클린 확인.

## 발견사항

- **[WARNING]** `refreshAndReconnect` 의 `inFlight` 재진입 가드가 **완료 후 초기화되는지**를
  검증하는 테스트가 없다 (뮤테이션 생존 확인)
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:82-85`
    (`inFlight = run.finally(() => { inFlight = null; });`)
  - 상세: 이 가드는 2R W2 fix 로 신설됐고, 목적은 두 가지다 — ① 겹친 트리거를 한 번만
    처리(concurrency), ② 처리 완료 후 **다음** 트리거는 다시 새 refresh 를 시작(sequential
    re-arm). `ws-client.test.ts` 의 `'겹친 트리거는 한 번만 재연결한다 — in-flight 가드'`
    (`:189-211`)는 ①만 검증한다 — 두 트리거를 `release()` 전에 동시에 기동해 `mockRefresh`가
    1회만 불렸음을 확인할 뿐, 첫 사이클이 **완료된 뒤** 별도의 두 번째(비-겹침) 트리거가
    다시 refresh 를 시작하는지는 어느 테스트에서도 관측되지 않는다(`grep`으로 확인:
    `mockRefresh).toHaveBeenCalledTimes(2)` 류 단언이 파일 전체에 없음).
    직접 확인: `inFlight = run.finally(() => { inFlight = null; });` 를
    `inFlight = run;`(초기화 제거)로 뮤테이션해도 `vitest run` 은 **24/24 GREEN** 을
    유지했다(`cp` 로 원복 완료, `git status --short` 클린).
    이 뮤테이션이 프로덕션에서 의미하는 것: `connect()` 는 앱 세션당 한 번만 새 클로저를
    만들고, 이후 모든 재연결은 같은 소켓 인스턴스의 `disconnect()`+`connect()`(재핸드셰이크)로
    이뤄지므로 `refreshAndReconnect`·`inFlight` 는 **소켓의 전체 수명(수 시간~수 일) 동안
    공유**된다. `inFlight` 가 리셋되지 않으면 **최초 1회의 성공한 갱신 이후 모든 후속
    900초 주기**(`auth.token_expired`·`connect_error`·`disconnect` 세 트리거 전부, 셋 다 같은
    `inFlight` 클로저 변수를 공유)가 `if (inFlight) return inFlight;` 에 막혀 조용히
    아무 것도 하지 않는다 — refresh 호출도, `socket.auth.token` 교체도, 재핸드셰이크도
    일어나지 않는다. 이는 이 PR 이 고치려던 원 결함("소켓이 만료 뒤에도 무기한 인가된 채
    방치")의 **두 번째 사이클부터 재발**과 사실상 동치이고, 게다가 `connect_error` 경로까지
    이 가드를 공유하므로 `reconnectionAttempts: Infinity` 백오프가 갱신되지 않는 stale
    토큰으로 영구 재시도하는 상태에 빠질 수 있다. 지금 코드는 정확히 옳다(`.finally` 리셋이
    있다) — 이건 **회귀가 조용히 들어와도 잡히지 않는다는 커버리지 갭**이다.
  - 제안: `겹친 트리거` 테스트 뒤에 "첫 트리거가 resolve 될 때까지 `await` 한 다음, **별도의**
    두 번째 트리거(`auth.token_expired` 재emit 또는 `disconnect` 재발화)를 쏘고
    `mockRefresh`/`connect` 가 **다시** 호출되는지"를 단언하는 케이스를 추가한다. 예:
    ```ts
    await (handlerFor("auth.token_expired") as (a: unknown) => Promise<void>)(payload);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    await (handlerFor("disconnect") as (r: string) => Promise<void>)("io server disconnect");
    expect(mockRefresh).toHaveBeenCalledTimes(2); // inFlight 가 리셋됐어야 두 번째가 돈다
    ```

- **[INFO]** 백엔드 — "`exp` 자체가 이미 과거인 토큰"(두 타이머 동시 0ms 발화) 케이스 여전히
  미검증 — 1R·2R 에서 이미 지적·저위험 분류된 항목, 3R 에서도 변화 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:201-207`
    (`timers.cutoff = setTimeout(..., Math.max(0, untilCutoff))`) / 대응 테스트:
    `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:719-825`
    (`'토큰 만료 — 사전 통지 후 disconnect (§1.2)'` 블록, 여전히 5개 케이스 그대로)
  - 상세: `secondsFromNow: 30`(`:793`) 케이스는 `untilNotice` 의 음수 클램프만 관측하고
    `untilCutoff` 자체가 음수인 입력(`secondsFromNow: -10` 류)은 3R 코드에도 추가되지 않았다.
    `jwtService.verify` 가 만료 토큰을 앞단에서 걸러 실경로 도달 불가라는 이전 라운드 판단이
    유효해 우선순위는 낮다. 재확인 차 기록.
  - 제안: 필수 아님. 추가한다면 `connectWithExp(id, -10)` 1건으로 방어 코드 주장을 실측
    뒷받침.

- **[INFO]** WS 만료→재연결 종단 간(end-to-end) e2e 는 여전히 부재하나, plan 이 명시적으로
  유예 사유·재개 신호를 기록해 은닉된 갭이 아님 — 재확인
  - 위치: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 체크리스트
    (`- [ ] e2e — 유예. 근거를 여기 적는다...`)
  - 상세: 현 e2e 하네스의 test-hook 이 boot-only op 게이트(NODE_ENV+FLAG 이중)라 런타임
    토큰 TTL 주입 표면이 없다는 판단이 SoT(plan) 안에 있고, 재개 신호(하네스 런타임 주입
    도입 또는 이 경로 회귀 관측)까지 명시돼 있다. 조치 불요.

## 요약

핵심 기능(사전 통지·명시적 재핸드셰이크·타이머 arm/disarm·재진입 가드)에 대한 unit 테스트는
backend(67/67)·frontend(24/24) 양쪽 모두 정상 경로·경계값(lead time 보다 짧은 잔여 시간·`exp`
없음)·해제 누락 방지·재발급 실패(빈 토큰·throw)·겹친 트리거까지 촘촘하다. 1R CRITICAL 2건·2R
WARNING 2건은 실제로 반영·해소돼 있음을 직접 실행으로 재확인했다. 다만 2R 에서 신설된
`inFlight` 재진입 가드는 "겹침을 한 번으로 합친다"만 테스트됐고 "완료 후 다음 트리거는 다시
돈다"는 어느 테스트에도 없다 — `.finally` 리셋을 제거해도 24/24 GREEN 을 유지함을 뮤테이션으로
직접 확인했다. 코드 자체는 지금 옳지만, 이 가드가 소켓 전체 수명 동안 세 트리거(`connect_error`·
`auth.token_expired`·`disconnect`)를 모두 관통하는 단일 변수라서, 이 리셋 한 줄의 회귀는 **최초
사이클 이후 영구히** 토큰 갱신을 멈춘다 — 이 PR 이 고치려던 원 결함이 두 번째 900초 주기부터
조용히 재발하는 것과 사실상 같다. 백엔드의 "exp 과거" 케이스와 e2e 부재는 이전 라운드부터
이어진 저위험·유예 항목으로 재확인만 했다.

## 위험도

MEDIUM — CRITICAL 0, WARNING 1건(신설 공유 재연결 경로의 sequential-reset 불변식이 뮤테이션으로
생존 확인됨. 현재 코드는 정확하나 회귀 방지망이 없음), INFO 2건(둘 다 이전 라운드부터 저위험으로
추적 중, 신규 아님).
