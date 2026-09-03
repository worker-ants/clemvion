# 동시성(Concurrency) 코드 리뷰

## 리뷰 범위 판단

이번 diff 는 커밋 `69aad5d5d`~`a1984f196` (WS `auth.token_expired` 이월 INFO 정리 + 후속 3라운드 fix)에
해당한다. 동시성 관점에서 실질적으로 검토할 대상은 코드 3개 파일뿐이다.

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `MSG_AUTH_TOKEN_EXPIRING`
  문자열 상수 export 추가. 런타임 상태·자원 공유 없음 — 동시성 무관.
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — 소켓별 만료 타이머
  (`expiryTimers` Map) 관리 리팩터: `clearExpiryTimers` 헬퍼 추출, 타입 non-optional 화,
  `armExpiryTimers` 진입부 선제 해제, `setTimeout(...).unref()` 추가. **동시성 관점의 핵심 대상.**
- `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — 위 변경을 검증하는
  테스트 추가(재무장·unref·순서 단언). fake timer 기반, 동시성 결함 없음.

나머지 파일(`plan/in-progress/ws-token-expired-socket-lifetime-impl.md`, `review/code/**`,
`review/consistency/**` 하위 다수)은 plan 문서·이전 라운드 리뷰 산출물(markdown/json) 커밋이며
코드가 아니다 — 동시성 관점 해당 없음.

## 발견사항

CRITICAL/WARNING 없음.

- **[INFO]** `.unref()` 는 정상 종료(graceful shutdown) 경로에서 대기 중인 만료 통지/강제
  종료 콜백이 실행되지 못하고 프로세스가 먼저 죽을 수 있는 트레이드오프
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `armExpiryTimers` 내
    `notice.unref(); cutoff.unref();` (`Read` 로 확인한 실제 줄 번호 224-225)
  - 상세: `unref()`는 이 두 타이머가 event loop 를 붙잡아 프로세스 종료를 최대 토큰 수명(900초)
    만큼 늦추는 것을 막기 위한 의도된 하드닝이다(주석에 "셧다운을 붙잡지 않는다" 명시). 다만
    이로 인해 SIGTERM 이후 커넥션 드레인만 하고 별도 강제 대기를 두지 않는 종료 경로에서는,
    아직 발화하지 않은 `notice`/`cutoff` 콜백이 프로세스 종료 전에 실행되지 못할 수 있다.
    정상 종료 시 소켓 자체가 함께 소멸하므로 실질 영향은 제한적이나, 그레이스풀 드레인 창
    안에서는 "사전 통지를 받았어야 할 클라이언트가 못 받는" 시나리오가 이론상 존재한다.
  - 제안: 새 결함이 아니라 이미 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`
    에 별도 이월 항목("셧다운 중 만료 콜백 미실행", 서브사이클 `12_16_24` W1)으로 추적 중이므로
    이번 라운드에서 추가 조치는 불요. 배포 런북에 그레이스풀 셧다운 정책과의 상호작용만
    남겨 두면 된다.

## 분석 근거

1. **`expiryTimers` Map 접근** — `armExpiryTimers`(연결 시)와 `clearExpiryTimers`(해제 시, 호출부는
   `armExpiryTimers` 진입부 선제 해제 및 `handleDisconnect`) 모두 `await` 없는 완전 동기 함수다.
   Node.js 는 단일 스레드 event loop 이므로 이 세 지점 사이에 다른 매크로태스크(타이머 콜백 등)가
   끼어들 수 없다 — 동일 `client.id` 키에 대한 read-modify-write 가 항상 하나의 tick 안에서
   완결되어 경쟁 조건 여지가 없다.
2. **선제 해제(`armExpiryTimers` 진입부 `clearExpiryTimers(client.id)`)** — 같은 `client.id` 로
   재무장(현재 socket.io 기본 설정에서는 연결마다 새 id 발급이라 도달 불가, `connectionStateRecovery`
   활성화 시 도달)할 때 옛 타이머 쌍을 먼저 지운다. 이 호출이 조기 `return`(exp 없는 토큰)보다
   **앞**에 있음을 실제 소스로 확인했다(`clearExpiryTimers` 호출 → 이후 `if (...) return;`) —
   두 갈래(정상 재무장·exp 없는 재무장) 모두에서 옛 타이머가 해제된다. 신규 테스트가 두 갈래를
   모두 개별 단언(`oldEmits`/`newEmits` 각각, 그리고 exp 없는 재무장 시 옛 타이머 미발화)해
   회귀를 가드한다.
3. **타입 non-optional 화(`{ notice?: ...; cutoff?: ... }` → `{ notice: ...; cutoff: ... }`)** —
   `armExpiryTimers` 가 항상 두 타이머를 함께 `Map.set` 하므로(선제 해제 → 생성 → unref →
   set 이 하나의 동기 블록) 실제 불변식과 타입이 일치한다. `handleDisconnect` 의 옛 `if (timers.notice)`
   /`if (timers.cutoff)` 방어 분기(도달 불가능했던 죽은 코드)가 제거된 것도 동시성 결함을
   만들지 않는다 — 오히려 "한쪽만 존재"라는 표현 불가능한 상태를 컴파일 타임에 차단한다.
4. **순서 보장** — `cutoff` 콜백은 `client.disconnect()` 를 호출할 뿐 `expiryTimers` Map 을 직접
   건드리지 않는다. 실제 정리는 socket.io 의 `disconnect` 이벤트를 통해 `handleDisconnect` →
   `clearExpiryTimers` 로 이어진다. 이미 발화한 타이머 참조에 대한 `clearTimeout` 은 Node 에서
   no-op 이므로, "발화 후 클리어"·"클리어 후 재조회" 순서가 뒤섞여도 이중 실행이나 예외로
   이어지지 않는다.
5. **`.unref()`** — 이벤트 루프 블로킹/좀비 프로세스 방지 관점에서 올바른 방향(위 INFO 참고).
6. **테스트(`websocket.gateway.spec.ts`)** — `jest.useFakeTimers()` + `jest.setSystemTime` 조합으로
   결정적 타이밍을 확보했고, `beforeEach`/`afterEach` 로 fake timer 를 매 테스트 격리한다.
   `jest.spyOn(global, 'setTimeout')` 은 `try/finally` 로 `mockRestore()` 를 보장해 스파이가
   다음 테스트로 새는 것을 막는다. 동시 다중 소켓 시나리오(같은 id 재사용)도 순차 동기 호출로
   재현되어 있어 실제 race 를 검증하지는 않지만(단일 스레드 전제상 필요하지도 않다), 코드
   경로의 정확성은 충분히 덮는다.
7. 이번 diff 는 `handleSubscribe` 의 기존 TOCTOU 방어 로직(tentative-add + 사후 재검증, 이 diff
   범위 밖의 기존 코드)이나 `WsRateLimiterService` 카운터를 건드리지 않는다.

## 뮤테이션/저장소 변경

본 리뷰는 `Read`/`Bash(git log, git diff --stat)` 로만 확인했으며 저장소 파일을 뮤테이션하지
않았다. `git status --short` 확인 불요(쓰기 작업 없음).

## 요약

이번 diff 는 WS 소켓별 만료 타이머 쌍(`expiryTimers`)의 생성·해제 절차를 단일 헬퍼로 통합하고,
타입을 실제 불변식(항상 쌍)에 맞게 non-optional 화했으며, 재무장 시 옛 타이머를 조기 return
**앞에서** 선제 해제하고 타이머에 `.unref()`를 적용한 하드닝 변경이다. 관련 코드 경로가 모두
`await` 없는 동기 구간 안에서 Map 을 읽고 쓰므로 Node.js 단일 스레드 event loop 전제 아래
경쟁 조건·데드락 여지가 없고, 오히려 이전에 존재하던 잠재적 타이머 누수(같은 `client.id` 재사용
시 좀비 타이머로 인한 이중 emit/disconnect, 그리고 조기 return 조합에서의 해제 누락)를 제거했다.
신규 테스트가 재무장 두 갈래·unref·발화 순서를 개별적으로 정밀 단언해 회귀 가드도 충분하다.
`.unref()`가 그레이스풀 셧다운과 상호작용하는 지점은 이미 plan 에 별도 이월 항목으로 추적 중인
알려진 트레이드오프이며 이번 라운드의 신규 결함이 아니다. 동시성 관점에서 CRITICAL/WARNING은
발견되지 않았다.

## 위험도

NONE
