# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `setTimeout(...).unref()` 도입이 실제로 바꾸는 프로세스 종료(그레이스풀 셧다운) 타이밍에 대해, 이 라운드가 근거로 삼은 "이미 배포 런북에서 별도 추적 중"이라는 주장이 plan 문서와 대조하면 성립하지 않는다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:225-226` (`notice.unref(); cutoff.unref();`). 근거로 인용된 주장의 위치: `review/code/2026/09/03/11_57_58/RESOLUTION.md`(`## 미조치 (판단 유지)` `#2·#3`: *"reviewer 도 의도된 개선, 배포 런북에서 별도 추적 중"*, *"런북 항목은 이미 plan 에 있다"*) 및 `review/code/2026/09/03/11_57_58/SUMMARY.md`(INFO `#2`·`#3`).
  - 상세: `unref()` 는 실질적 부작용이다 — 이전(unref 없음) 에는 이 타이머들이 이벤트 루프를 붙잡아 SIGTERM 이후에도 프로세스가 최대 토큰 수명(최대 900초)까지 종료를 못 할 수 있었다(코드 주석 `:223-224` 이 이 문제를 직접 서술한다). `unref()` 는 이 행을 고치지만, 반대급부로 **프로세스가 이벤트 루프가 비면 이 타이머의 만료를 기다리지 않고 먼저 종료될 수 있다** — 즉 그레이스풀 셧다운 도중 `notice`(사전 통지 emit)나 `cutoff`(강제 disconnect) 콜백이 아예 실행되지 않을 수 있다. `RESOLUTION.md`/`SUMMARY.md` 는 이 트레이드오프가 "배포 런북에 이미 있다" 고 적었지만, `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:151-164` 를 직접 열어 대조한 결과 그 자리에 있는 런북 항목 2건은 **다른 주제**다 — (1) "만료 타이머 지터 없음 → 재연결 스파이크"(`:151-160`), (2) "배포 전환 창 리스크(구버전 번들)"(`:162-164`). `unref()`·그레이스풀 셧다운 상호작용을 다루는 항목은 plan 어디에도 없다. `grep -n "그레이스풀\|unref\|셧다운\|shutdown"` 결과 plan 파일에서 "unref" 언급은 `:105` (event-loop keep-alive 버그 자체를 고쳤다는 서술) 하나뿐이고, 셧다운 트레이드오프에 대한 별도 런북 항목은 존재하지 않는다.
  - 제안: `RESOLUTION.md`/`SUMMARY.md` 의 "런북에서 추적 중" 문구를 철회하거나, `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 에 "unref 도입으로 그레이스풀 셧다운 중 notice/cutoff 콜백이 미실행될 수 있음" 을 명시하는 런북 항목을 실제로 추가한다. (허용 가능한 리스크라는 판단 자체는 타당해 보이지만, "이미 추적됨" 이라는 사실 주장은 근거가 없다.)

- **[INFO]** `MSG_AUTH_TOKEN_EXPIRING` 신규 export — `websocket-events.types.ts` 의 공개 표면에 새 심볼이 추가된다.
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:315-316`
  - 상세: `export const MSG_AUTH_TOKEN_EXPIRING = 'Access token expires soon — refresh and reconnect.'` 은 순수 additive 다. wire 로 나가는 값은 이전 리터럴과 동일(`grep` 결과 이 상수를 소비하는 곳은 `websocket.gateway.ts`·`websocket.gateway.spec.ts` 두 곳뿐, 이름 충돌 없음)하고 기존 소비자에 영향이 없다. 부작용 관점에서 문제 없음.
  - 제안: 조치 불필요.

- **[INFO]** `armExpiryTimers` 진입부의 선제 `clearExpiryTimers(client.id)` 호출은 매 성공적 `handleConnection` 마다 실행되는 새 부수 호출이지만, 현재 Socket.IO 가 연결마다 새 `client.id` 를 발급하므로 실질적으로는 no-op(Map 조회 실패 → 조기 return)이다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:184` (`this.clearExpiryTimers(client.id);`), 호출부 `:275` (`handleConnection` 내 `this.armExpiryTimers(client, payload.exp);`, 유일한 호출 지점 확인).
  - 상세: `armExpiryTimers` 는 코드베이스 전체에서 `handleConnection` 한 곳에서만 호출된다(`grep -n "armExpiryTimers("` 확인). 따라서 이 선제 해제가 다른 소켓의 타이머를 잘못 지우거나 예기치 않은 전역 상태 변경을 일으킬 경로는 없다. `connectionStateRecovery` 활성화 시에만 실제로 동작하게 되는 방어 코드라는 주석 설명과 일치.
  - 제안: 조치 불필요. `connectionStateRecovery` 도입 시 이 가정을 재확인할 것(이미 plan/SUMMARY 에 언급됨).

- **[INFO]** `expiryTimers` Map 값 타입을 `{ notice?; cutoff? }` → `{ notice; cutoff }` (non-optional) 로 좁힌 것은 `private readonly` 필드 내부 타입 변경이라 외부 호출자·공개 시그니처에 영향 없음.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:156-159`
  - 상세: 필드가 `private` 이고 소비처는 같은 클래스 내부(`armExpiryTimers`/`clearExpiryTimers`/`handleDisconnect`) 뿐이라 시그니처 변경에 따른 호출자 영향(점검 관점 4)은 없다.
  - 제안: 조치 불필요.

## 요약

핵심 코드 변경(타이머 쌍 non-optional화, `clearExpiryTimers` 추출, `armExpiryTimers` 선제 해제, `MSG_AUTH_TOKEN_EXPIRING` 상수 승격)은 모두 `private` 표면 안에서 일어나고 호출자·공개 API 에 영향이 없어 부작용 위험이 낮다. 유일하게 실질적인 부작용은 `setTimeout(...).unref()` 도입으로, 이는 프로세스 종료(그레이스풀 셧다운) 타이밍을 바꾸는 의도된 하드닝이지만, 이번 라운드가 그 트레이드오프의 완화 근거로 인용한 "배포 런북에서 이미 추적 중" 이라는 주장은 실제 plan 문서 대조 결과 성립하지 않는다 — 셧다운 상호작용을 다루는 런북 항목이 어디에도 없다. 기능적으로는 문제가 없을 가능성이 높지만(프로세스가 죽으면 소켓도 어차피 죽는다), "추적됨" 이라는 문서상의 보장이 실제 문서보다 넓다는 점은 이번 라운드에서 바로잡아야 한다.

## 위험도
LOW
