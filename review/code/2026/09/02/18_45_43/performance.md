# 성능(Performance) 리뷰 — WS 소켓 수명=토큰 수명 (`auth.token_expired`), 3라운드

## 검토 범위 및 방법

이번 diff(전체 44개 파일 기준 파일 1~9)는 `review/code/2026/09/02/17_38_12/` 1라운드와
`18_18_53/` 2라운드 리뷰·수정을 거친 뒤의 **최종 상태**다. `git log --oneline -3` 로 확인한
커밋 3개(`b019d7de3` feat → `a9316a0a6` fix 1R → `1bd2000d5` fix 2R)가 이번 diff 의 실체이며,
핵심 코드는 `codebase/backend/src/modules/websocket/websocket.gateway.ts`(`armExpiryTimers`/
`handleConnection`/`handleDisconnect`)와 `codebase/frontend/src/lib/websocket/ws-client.ts`
(`refreshAndReconnect` + 3개 트리거)다. 두 파일 모두 저장소에서 `Read` 로 현재 상태를 직접
열어 대조했다(수정 없음). `review/code/17_38_12/**`·`18_18_53/**`·`review/consistency/**`(파일
10~44)는 이전 라운드 산출물·`--impl-prep` 재시도 세션으로, 성능 분석 대상인 애플리케이션
코드가 아니므로 제외한다.

이전 두 라운드의 `performance.md` 를 먼저 읽었다. 1라운드는 성능 관점 발견사항이 없었고
(별도 파일 미작성 — CRITICAL/WARNING 없음), 2라운드(`18_18_53/performance.md`)가 지터 부재로
인한 thundering herd 가능성을 WARNING 1건으로 지적했다. 아래는 그 WARNING 이 3라운드에서도
유효한지, 그리고 이번 라운드에 새로 반영된 커밋(`1bd2000d5`, in-flight 가드)이 새로운 성능
이슈를 만들지 않았는지를 확인한 결과다.

## 발견사항

- **[INFO]** 만료 타이머(사전 통지·강제 종료)에 지터가 없어 동시 접속 코호트가 900초 주기로
  재연결·토큰 재발급이 뭉칠 수 있다 — **2라운드에 이미 WARNING 으로 지적됐고, 코드 변경 없이
  plan 에 재개 신호와 함께 명시적으로 defer 됨을 재확인**
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:144`
    (`TOKEN_EXPIRY_LEAD_MS = 60_000`, 고정값) · `:187-190`(`untilNotice` 계산, 랜덤 성분 없음) ·
    `:201-207`(`cutoff` `setTimeout`, 역시 결정론적). 추적 항목:
    `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:98-105`.
  - 상세: 두 타이머 모두 JWT `exp`(발급 시각 + 고정 900초)로부터 결정론적으로 역산한 지연을
    쓴다. 로그인이 몰리는 이벤트(업무 시작 시각, 배포 직후 대량 재연결 등) 이후에는 다수 소켓의
    `exp` 가 근접해 `notice`/`cutoff` 도 초 단위로 동기화되고, 재발급 토큰도 다시
    `exp = now + 900` 이라 한 번 동기화된 코호트는 지터가 없는 한 계속 동기화된 채로 남는다
    (자기 강화적 정상 상태). 이번 라운드에서 `armExpiryTimers`/`untilNotice`/`cutoff` 계산 로직은
    2라운드 검토 시점과 **문자 그대로 동일**함을 `Read` 로 직접 확인했다 — 새로 발생한 문제가
    아니라 기존 WARNING 이 그대로 남아 있는 것이다. `ws-token-expired-socket-lifetime-impl.md`
    체크리스트(`:98-105`)에 "여기서 안 고치는 이유"(cutoff 는 `exp` 자체라 지터 불가, notice 는
    spec §1.2 가 고정한 60초 lead 값이라 바꾸려면 planner 턴 필요)와 재개 신호("배포 런북에 먼저
    기록 → 실제 관측되면 lead time 을 범위로 바꾸는 planner 턴")가 명시돼 있어, `review/**` 에만
    근거가 있던 것이 아니라 SoT(plan)로 옮겨져 있다.
  - 제안: 코드 조치는 이번 라운드에서도 불요(동의) — 이미 사운드한 이유로 defer 되어 있고
    스코프(spec 고정값 변경)가 developer 권한 밖이다. 배포 런북에 "대량 동시 로그인 후 15분
    주기 재연결 스파이크 가능성" 기록이 실제로 이뤄졌는지만 후속 확인 대상으로 남긴다.

## 검토했으나 이상 없음으로 판단한 항목

- **신규 in-flight 가드(`1bd2000d5`, 이번 라운드에 반영된 커밋)** — `ws-client.ts:59-86` 의
  `refreshAndReconnect` 가 `inFlight` Promise 로 겹친 트리거를 흡수한다. 이는 오히려 **REST
  `/auth/refresh` 중복 호출을 줄이는 방향의 개선**이다(2라운드 W2 가 지적한 "겹친 트리거가
  재발급을 두 번 부르고 방금 성공한 연결을 다시 끊는" 시나리오를 막음). 클로저 변수 하나
  (`inFlight: Promise<void> | null`)만 추가되고, `connect()` 호출당 1회만 생성되며 소켓 lifecycle
  과 함께 정리된다 — 메모리/성능 부담 없음. `ws-client.test.ts` 의 "겹친 트리거는 한 번만
  재연결한다" 테스트로 실측 확인됨(mockRefresh 호출 1회로 단언).
- **소켓당 타이머 2개(`notice`/`cutoff`) 오버헤드** — `expiryTimers` Map 은 `subscriptions`/
  `WsRateLimiterService` 와 동일한 socket-id 키 패턴으로 조회/삽입 O(1)이고,
  `handleDisconnect`(`websocket.gateway.ts:286-291`)가 예외 없이 두 타이머를 정리한다. 2라운드
  검증 대비 변경 없음 — 재확인.
  N+1 쿼리/API 호출, 블로킹 I/O, 비효율 자료구조, 과도한 문자열 연결(O(n²)) 패턴은 backend/
  frontend 어느 쪽에도 없다 — 타이머 콜백은 `Date.now()`/`Math.max`/`new Date().toISOString()`
  등 동기 CPU 연산뿐이고 DB/네트워크 호출이 없다.
- **캐싱·지연 로딩**: 이 변경은 캐시를 신설/무효화하지 않고, `handleConnection` 시점에만
  타이머를 arm 해 불필요한 선행 로딩도 없다 — 해당 없음(2라운드와 동일 결론).

## 요약

이번 3라운드 diff 는 성능 관점에서 2라운드 대비 **실질적으로 동일한 코드**다 — 유일하게 새로
반영된 커밋(`1bd2000d5`, in-flight 가드)은 오히려 중복 REST 호출을 줄이는 개선이며 소켓
lifecycle 과 함께 정리되는 클로저 변수 하나만 추가한다. 2라운드에서 WARNING 으로 지적된
"만료 타이머 지터 부재 → thundering herd 가능성"은 코드 변경 없이 그대로 남아 있으나, `plan/
in-progress/ws-token-expired-socket-lifetime-impl.md` 에 defer 사유(spec 고정값이라 developer
권한 밖)와 재개 신호(배포 런북 기록 후 관측 시 planner 턴)가 명시적으로 SoT 화되어 있어 이번
라운드에서 다시 코드 차단 사유로 올리지 않는다 — INFO 로 재확인만 한다. 그 외 N+1 호출, 블로킹
I/O, 메모리 누수, 비효율 자료구조 등 전형적 성능 안티패턴은 관측되지 않았다.

## 위험도

NONE
