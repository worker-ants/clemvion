# 성능(Performance) 리뷰 — WS 소켓 수명=토큰 수명 (`auth.token_expired`), 4라운드

## 검토 범위 및 방법

이번 diff(전체 30개 파일 기준 파일 1~9가 애플리케이션 코드)는 `17_38_12`(1R)·`18_18_53`(2R)·
`18_45_43`(3R) 세 라운드의 리뷰·수정을 거친 뒤의 **최종 상태**다. `git log --oneline`으로 확인한
커밋 체인은 `b019d7de3`(feat) → `a9316a0a6`(fix 1R) → `1bd2000d5`(fix 2R) →
`e5b683d75`(fix 3R, in-flight 세대 스냅샷 + 핸들러 promise 반환)이며, 이번 라운드가 보는 diff 는
`e5b683d75`까지 반영된 상태다. 핵심 파일 두 개
(`codebase/backend/src/modules/websocket/websocket.gateway.ts`,
`codebase/frontend/src/lib/websocket/ws-client.ts`)는 프롬프트에서 diff 가 생략돼 있어 `Read` 로
저장소에서 직접 전문을 열어 대조했다(뮤테이션 없음, 저장소 미변경). `review/code/17_38_12/**`·
`18_18_53/**`·`18_45_43/**`·`review/consistency/**`(나머지 파일)는 이전 라운드/checker 산출물로
성능 분석 대상인 애플리케이션 코드가 아니므로 제외한다.

이전 세 라운드의 `performance.md`를 먼저 읽었다. 1R은 발견사항 없음, 2R은 지터 부재로 인한
thundering herd 가능성을 WARNING 1건으로 지적, 3R은 그 WARNING이 코드 미변경 상태로 plan에
명시적 defer 사유·재개 신호와 함께 SoT화되어 있음을 확인하고 INFO로 재확인(위험도 NONE)했다.
아래는 그 결론이 4라운드(이번 diff, 3R 커밋 `e5b683d75` 반영분)에서도 유효한지, 그리고 이번에
새로 반영된 "in-flight 세대 스냅샷" 로직이 새로운 성능 이슈를 만들지 않았는지를 확인한 결과다.

## 발견사항

- **[INFO]** 만료 타이머(사전 통지·강제 종료)에 지터가 없어 동시 접속 코호트가 900초 주기로
  재연결·토큰 재발급이 뭉칠 수 있다 — **1R부터 이어진 항목, 3라운드 연속으로 코드 변경 없이
  plan에 재개 신호와 함께 defer됨을 재확인. 이번 라운드에서도 델타 없음**
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:144`
    (`TOKEN_EXPIRY_LEAD_MS = 60_000`, 고정값) · `:187-190`(`untilNotice` 계산, 랜덤 성분 없음) ·
    `:201-207`(`cutoff` `setTimeout`, 역시 결정론적). 추적 항목:
    `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:98-107`(체크박스 `[ ]`, 미해결
    상태로 남아 있음을 재확인).
  - 상세: 두 타이머 모두 JWT `exp`(발급 시각 + 고정 900초)로부터 결정론적으로 역산한 지연을
    쓴다. 로그인이 몰리는 이벤트(업무 시작 시각, 배포 직후 대량 재연결, 장애 복구 후 재접속
    폭주 등) 이후에는 다수 소켓의 `exp`가 근접해 `notice`/`cutoff`도 초 단위로 동기화되고,
    재발급 토큰도 다시 `exp = now + 900`이라 한 번 동기화된 코호트는 지터가 없는 한 계속
    동기화된 채로 남는다(자기 강화적 정상 상태 thundering herd). `armExpiryTimers`/
    `untilNotice`/`cutoff` 계산 로직을 `Read`로 직접 열어 2R·3R 검토 시점과 문자 그대로
    동일함을 확인했다 — 새로 발생한 문제가 아니라 기존 WARNING이 그대로 남아 있는 것이다.
    `ws-token-expired-socket-lifetime-impl.md:98-107`에 "여기서 안 고치는 이유"(cutoff는
    `exp` 자체라 지터를 넣을 수 없고, notice는 spec §1.2가 고정한 60초 lead 값이라 바꾸려면
    관측 가능한 계약을 바꾸는 것 — planner 턴 필요)와 재개 신호("배포 런북에 먼저 기록 → 실제
    관측되면 lead time을 범위로 바꾸는 planner 턴")가 명시돼 있어 `review/**`에만 근거가
    있던 것이 아니라 SoT(plan)로 옮겨져 있다.
  - 제안: 코드 조치는 이번 라운드에서도 불요(동의) — spec 고정값 변경은 developer 권한 밖이고
    이미 사운드한 이유로 defer되어 있다. 배포 런북에 "대량 동시 로그인 후 15분 주기 재연결
    스파이크 가능성" 기록이 실제로 이뤄졌는지만 후속 확인 대상으로 남긴다(이미 plan에 별도
    항목 `:109-111`로 등재된 "배포 전환 창 리스크"와는 다른 축).

## 이번 라운드에 새로 반영된 코드(3R 커밋) 검토 — 이상 없음

- **in-flight 세대 스냅샷(`mySocket`/`socket !== mySocket` 비교)** —
  `codebase/frontend/src/lib/websocket/ws-client.ts:60-98`(`refreshAndReconnect` 정의),
  특히 `:68`(`const mySocket = socket;` 스냅샷)·`:74`(`socket !== mySocket` 세대 비교). 클로저
  지역 변수 하나(`mySocket`)만 추가되고, `refreshAndReconnect` 호출당 1회 생성돼 해당 async
  IIFE(`:70-90`)가 끝나면 즉시 GC 대상이 된다. `connect()` 호출당(즉 소켓 인스턴스당) 1회만
  정의되는 함수 스코프 안에 있어(핸들러가 매 이벤트마다 재정의되지 않음, `:22-145`), 이벤트가
  반복 발생해도 반복 할당이 늘지 않는다. 메모리/CPU 부담 없음.
- **세 핸들러가 `refreshAndReconnect(...)`의 promise를 `void` 대신 `return`한다** —
  `ws-client.ts:121`(`connect_error`)·`:135`(`auth.token_expired`)·`:143`(`disconnect`). 이는
  Socket.IO가 반환값을 무시하므로 런타임 동작·성능에 영향이 없다(3R RESOLUTION이 명시한 대로
  테스트 타이밍 정합성만을 위한 변경).
- **`inFlight` 가드(2R에서 도입, 이번 라운드에도 유지)** — 겹친 트리거를 한 번의 REST
  `/auth/refresh` 호출로 흡수해 오히려 중복 호출을 줄이는 방향이며 이번 라운드에서 로직
  변경 없음. 재확인.
- **`armExpiryTimers`/`handleConnection`/`handleDisconnect`(백엔드)** — 3R 대비 이번 라운드
  로직 변경 없음(`Read`로 대조, 문자 그대로 동일). 소켓당 O(1) Map 엔트리 1개 + 타이머 2개,
  `handleDisconnect`(`websocket.gateway.ts:284-291`)가 예외 없이 두 타이머를 `clearTimeout`
  + `Map.delete` — 누수 없음.

## 검토했으나 이상 없음으로 판단한 항목

- **N+1 쿼리/API 호출**: 없음. `armExpiryTimers`·핸들러 콜백 모두 DB/외부 API 호출을 반복문
  안에서 발생시키지 않는다. frontend `refreshAndReconnect`도 트리거당 1회 REST 호출이고
  `inFlight` dedup으로 겹침을 흡수한다.
- **블로킹 I/O**: 타이머 콜백은 `Date.now()`/`Math.max`/`new Date().toISOString()` 등 동기 CPU
  연산뿐이며 DB/네트워크 호출이 없다.
- **알고리즘 복잡도·데이터 구조**: `expiryTimers`(`Map<socketId, {notice, cutoff}>`)는
  `subscriptions`/`WsRateLimiterService`와 동일한 socket-id 키 패턴으로 조회/삽입/삭제 O(1)
  — 용도(소켓별 상태 관리)에 적합.
- **문자열/객체 생성 비용**: 콜백마다 `payload` 객체 리터럴 1개, 소켓당 1회성이라 무시 가능한
  수준.
- **캐싱·지연 로딩**: 이 변경은 캐시를 신설/무효화하지 않고, `handleConnection` 시점에만
  타이머를 arm 해 불필요한 선행 로딩도 없다 — 해당 없음.
- **메모리 누수**: 소켓당 타이머 쌍은 `handleDisconnect`에서 예외 없이 해제되고, frontend
  `mySocket` 클로저도 async 작업 종료와 함께 회수된다.

## 요약

이번 4라운드 diff는 성능 관점에서 3라운드 대비 **실질적으로 동일한 코드**다. 이번에 반영된
유일한 실체 변경(3R 커밋 `e5b683d75`의 in-flight 세대 스냅샷 + 핸들러 promise 반환)은 정확성
버그(옛 세대의 재발급이 새 소켓을 끊는 레이스) 수정이며 성능 비용은 무시할 수 있는 수준(호출당
지역 변수 1개)이다. 2R에서 WARNING으로 제기되고 3R·4R에서 연속으로 INFO 재확인된 "만료 타이머
지터 부재 → thundering herd 가능성"은 이번에도 코드 변경 없이 그대로이지만, plan
(`ws-token-expired-socket-lifetime-impl.md`)에 defer 사유(spec 고정값 변경은 developer 권한
밖)와 명시적 재개 신호(배포 관측 시 planner 턴)가 SoT로 남아 있어 이번 라운드에서도 코드 차단
사유로 올리지 않는다. N+1 호출·블로킹 I/O·메모리 누수·비효율 자료구조·불필요한 중복 연산 등
전형적 성능 안티패턴은 관측되지 않았다.

## 위험도

NONE
