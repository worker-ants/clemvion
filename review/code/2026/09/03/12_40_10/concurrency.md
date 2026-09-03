# 동시성(Concurrency) 코드 리뷰

## 리뷰 대상

실제 동시성 표면이 있는 코드는 3개 파일뿐이다. 나머지(`plan/in-progress/ws-token-expired-socket-lifetime-impl.md`, `review/code/2026/09/03/11_57_58/**`, `review/code/2026/09/03/12_16_24/**`)는 이전 두 라운드 리뷰의 산출물(markdown 보고서·JSON 상태 파일·plan 체크리스트)로, 실행되는 코드가 아니라 동시성 관점에서 검토할 대상이 아니다.

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `MSG_AUTH_TOKEN_EXPIRING` wire 문구 상수 신설 (동시성 무관, 순수 리터럴)
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — 소켓별 만료 타이머(`expiryTimers`) 쌍 관리: `clearExpiryTimers` 헬퍼 추출, 타입 non-optional 화, `armExpiryTimers` 진입부(조기 `return` **앞**)에서 선제 해제, `setTimeout(...).unref()` 추가
- `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — 위 변경에 대응하는 테스트 3종 추가

실제 소스(`Read`)로 게이트 숫자와 대조해 diff 가 정확히 반영됐음을 확인했다(`183`, `205`, `224-225`, `227`, `235-240`, `274`, `317`).

## 분석

Node.js/Socket.IO 이벤트 핸들러는 단일 스레드 event loop 위에서 실행되고, 이 diff 가 건드리는 전 경로(`handleConnection` → `armExpiryTimers`, `handleDisconnect` → `clearExpiryTimers`, `setTimeout` 콜백 본문)에 `await`가 전혀 없다 — 각 핸들러 호출은 시작부터 끝까지 다른 매크로태스크의 개입 없이 완주한다.

1. **`clearExpiryTimers` 를 조기 `return` 앞으로 이동** (`websocket.gateway.ts:183`) — `armExpiryTimers` 진입 즉시 옛 타이머 쌍을 해제하므로, "새 토큰에 `exp` 가 없어 조기 return" 하는 조합에서도 옛 쌍이 남지 않는다. 이 자리가 return 뒤에 있으면 그 조합에서만 좀비 타이머(이미 stale 해진 `client` 클로저를 캡처한 채 살아있는 `notice`/`cutoff`)가 남아 중복 emit·이미 끊긴 소켓에 대한 `disconnect()` 로 이어질 수 있었는데, 이번 위치가 그 경로를 닫는다. `armExpiryTimers` 전체(해제 → 신규 타이머 생성 → unref → `Map.set`)가 단일 동기 구간이라 "해제됐지만 아직 신규 타이머가 없는" 관측 가능한 중간 상태가 존재하지 않는다.
2. **`expiryTimers` Map** — 다른 macrotask(다른 소켓의 `handleConnection`/`handleDisconnect`, 이 소켓의 `notice`/`cutoff` 콜백)가 동시에 이 Map 을 건드릴 수 있는 것처럼 보이지만, 실제로는 한 번에 하나의 콜백만 실행되므로(선점 없음) `Map.get`/`Map.set`/`Map.delete` 호출 사이에 다른 코드가 끼어들 수 없다. 진짜 위험은 "동시 접근"이 아니라 "정리 누락으로 인한 stale 참조"인데, 이는 `clearExpiryTimers` 단일 헬퍼로 무장(`armExpiryTimers`)·해제(`handleDisconnect`) 두 지점을 통일해 drift 가능성을 없앴다.
3. **`cutoff` 콜백이 `client.disconnect()` 를 호출 → Socket.IO 가 비동기로 `disconnect` 이벤트 발화 → `handleDisconnect` → `clearExpiryTimers`** 라는 콜백 체인도 매 단계가 이벤트 루프 큐를 통해 순차 처리된다. `handleDisconnect` 시점에 `clearTimeout(timers.cutoff)` 를 호출해도 이미 발화한 타이머에 대한 `clearTimeout` 은 no-op 이라 안전하고, `notice` 가 아직 남아있다면 정상적으로 취소된다 — 이중 해제·use-after-clear 문제 없음.
4. **`expiryTimers` 값 타입 non-optional 화** (`:156-159`) — `armExpiryTimers` 가 항상 `{ notice, cutoff }` 쌍을 함께 `set` 하므로(`:227`) 타입이 실제 불변식과 일치한다. 이전 `?` 타입이 허용하던 "한쪽만 존재" 상태는 이 코드 경로 안에서 애초에 도달 불가능했고, 이를 컴파일 타임에 강제하는 것은 동시성 결함을 만들지 않는다(오히려 `handleDisconnect` 의 방어적 `if (timers.notice)`/`if (timers.cutoff)` 죽은 분기를 제거).
5. **`.unref()` 추가** (`:224-225`) — 리소스 풀링/이벤트 루프 관점에서 트레이드오프가 있다: 타이머가 event loop 를 붙잡지 않으므로, graceful shutdown(SIGTERM 후 강제 timeout 없는 드레인) 중 이벤트 루프가 비었다고 판단되면 대기 중이던 `notice`/`cutoff` 콜백이 발화 전에 프로세스가 먼저 종료될 수 있다. 이는 **새로 발견한 결함이 아니라** 이미 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`(리뷰 2R W1, `#1270`)에 문서화되고 이월 트래킹 중인 의도된 하드닝의 알려진 부작용이다. 정상 종료 시 소켓 자체가 소멸하므로 실질 영향은 낮다고 판단되며, 이번 diff 는 그 판단을 바꾸지 않는다.
6. **재무장(rearm) 시나리오** — 동일 `client.id` 로 두 번째 `armExpiryTimers` 가 호출되는 경로는 현재 프로덕션(Socket.IO 가 연결마다 새 `id` 발급)에서는 도달 불가하나, `connectionStateRecovery` 활성화 시 도달 가능해진다. 신규 테스트(`websocket.gateway.spec.ts:809-831`, `:833-857`)가 `exp` 있음/없음 두 조합 모두에서 옛 타이머 쌍이 정확히 1회씩만 발화함을 단언해, 이 경로가 실제 활성화되는 시점에 회귀 가드로 작동한다.
7. 이 diff 는 기존 `handleSubscribe` 의 TOCTOU 방어 로직(tentative-add + 사후 재검증, 이 파일의 다른 구간)을 건드리지 않는다 — 범위 밖.

## 뮤테이션/저장소 변경

본 리뷰에서는 저장소 파일을 뮤테이션하지 않았다(정적 추론 + `Read`로 실제 소스 대조만 수행). `git status --short` 로 확인할 잔여물 없음.

## 발견사항

CRITICAL/WARNING 없음.

- **[INFO]** `.unref()` 로 인한 graceful-shutdown 중 만료 콜백 미발화 가능성
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:224-225` (`notice.unref(); cutoff.unref();`, `armExpiryTimers` 내부)
  - 상세: 이벤트 루프 keep-alive 를 포기하는 트레이드오프. 셧다운 중 "사전 통지를 받았어야 할 클라이언트가 못 받는" 창이 열릴 수 있다. 이미 plan(`plan/in-progress/ws-token-expired-socket-lifetime-impl.md`, `#1270` 항목)에 별도 이월 항목으로 추적 중이며 이번 diff 의 신규 결함이 아니다.
  - 제안: 조치 불요(문서화된 의도, 별도 트래커에서 관리). 배포 런북에 그레이스풀 드레인 중 이 창이 있음을 유지.

## 요약

이번 diff 는 WS 소켓별 만료 타이머 쌍의 무장/해제를 `clearExpiryTimers` 단일 헬퍼로 통합하고, 선제 해제 호출을 조기 `return` 앞으로 옮기고, 타입을 non-optional 화하고, `.unref()` 를 적용한 순수 하드닝 변경이다. 관련 코드 경로 전체가 `await` 없는 동기 구간 안에서 공유 `Map`(`expiryTimers`)을 읽고 쓰므로 Node.js 단일 스레드 event loop 전제 하에 경쟁 조건·데드락 여지가 없고, 오히려 이전에 남아 있던 좁은 조합(재무장 시 `exp` 없는 토큰)의 타이머 누수를 닫는다. 신규 테스트 3종이 상수 일치·재무장 시 옛 타이머 해제(양쪽 `exp` 조합)·unref 를 각각 검증해 회귀 가드도 충분하다. `.unref()` 의 셧다운 상호작용은 알려진·이미 추적 중인 트레이드오프이며 새로운 동시성 결함이 아니다. 이전 두 라운드(`11_57_58`, `12_16_24`)의 독립적인 concurrency 리뷰도 동일하게 NONE 으로 판정했고, 이번 재검토도 그 결론을 재확인한다.

## 위험도

NONE
