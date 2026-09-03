# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** 소켓 재무장(rearm) 시 선제 `clearExpiryTimers` 호출 추가 — 무시할 수준의 오버헤드, 오히려 잠재적 누수를 막는 개선
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:182-188`(`clearExpiryTimers` 신설), `:215`(`armExpiryTimers` 진입부 호출)
  - 상세: `armExpiryTimers` 진입 시마다 `Map.get`+2×`clearTimeout`+`Map.delete` (O(1))를 추가로 수행한다. `handleConnection`(연결당 1회)에서만 호출되므로 hot path 가 아니고, 연결 빈도 대비 비용은 무시할 수준이다. 오히려 `connectionStateRecovery` 가 켜졌을 때 같은 `client.id` 로 재연결되면 옛 타이머 쌍이 해제되지 않고 맵에 방치되던 잠재적 per-socket 타이머 누수를 원천 차단한다 — 메모리/누수 관점에서 순수 개선.
  - 제안: 없음(현행 유지 권장).

- **[INFO]** `setTimeout(...).unref()` 추가 — 이벤트 루프 점유 감소, 셧다운 지연 방지
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:238-239`
  - 상세: 종전에는 `notice`/`cutoff` 타이머가 event loop 를 붙잡아, 다수 소켓이 접속한 상태에서 프로세스 종료(SIGTERM 등)가 최대 토큰 수명(900초)만큼 지연될 수 있었다. `unref()` 로 두 타이머 모두 프로세스 종료를 막지 않게 되어 graceful shutdown 성능/응답성이 개선된다.
  - 제안: 없음. `websocket.gateway.spec.ts:832-843` 의 `hasRef()===false` 단언이 이 특성을 회귀 없이 고정한다.

- **[INFO]** `expiryTimers: Map<string, {notice, cutoff}>` — 자료구조 적절
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:157-160`
  - 상세: 소켓당 최대 2개 타이머를 `client.id` 키의 `Map` 으로 관리 — O(1) 삽입/조회/삭제이며 `handleDisconnect`(:318, `clearExpiryTimers` 위임)에서 정리되어 소켓 수 만큼만 상수 크기를 유지한다(연결 종료 시 회수). 신설된 `MSG_AUTH_TOKEN_EXPIRING` 상수(`websocket-events.types.ts:309-310`)는 모듈 로드 시 1회 평가되는 리터럴이라 반복 계산·재할당 이슈 없음.
  - 제안: 없음.

- **[INFO]** `websocket.gateway.spec.ts` 신규 3개 테스트 — 프로덕션 경로 성능에 영향 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:794-843`
  - 상세: fake timers 기반 단위 테스트로, `jest.spyOn(global, 'setTimeout')` 사용(`:833`) 및 반복 필터(`:819-824`)는 테스트 스코프에 한정되며 O(1)~O(n) 수준(n=mock 호출 수, 실행당 상수)이라 실행 비용상 문제 없음.
  - 제안: 없음.

N+1 호출, 블로킹 I/O, 불필요한 문자열 연결/재계산, 부적절한 캐싱 전략, 과도한 선행 로딩 등은 이번 diff 범위에서 발견되지 않았다. 변경은 `codebase/backend/src/modules/websocket/websocket.gateway.ts` 의 타이머 무장/해제 로직을 헬퍼로 통합하고 non-optional 타입 강제 + `unref()` 를 추가한 리팩터로, 신규 DB/외부 호출이나 반복문 내 I/O 를 도입하지 않는다.

## 요약

이번 변경은 WS 소켓별 만료 타이머(사전 통지·강제 종료) 관리를 `clearExpiryTimers` 헬퍼로 통합하고, 타이머에 `.unref()` 를 추가하며, 재무장 시 선제 해제를 넣은 소규모 리팩터다. 알고리즘 복잡도는 전부 O(1) 수준이고 새로운 N+1 패턴·블로킹 I/O·불필요한 메모리 할당은 없다. 오히려 `connectionStateRecovery` 활성화 시 잠재적이었던 소켓당 타이머 누수를 차단하고, `unref()` 로 프로세스 셧다운 시 이벤트 루프 점유를 제거해 메모리/셧다운 성능 측면에서 긍정적이다. 신규 상수(`MSG_AUTH_TOKEN_EXPIRING`)와 테스트 추가는 성능에 중립적이다.

## 위험도

NONE
