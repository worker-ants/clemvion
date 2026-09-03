# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `armExpiryTimers` 진입부에서 매 연결마다 `clearExpiryTimers`(Map.get + 2×clearTimeout + Map.delete)를 무조건 호출하도록 바뀌었다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:184` (`this.clearExpiryTimers(client.id);`)
  - 상세: `handleConnection` 은 소켓 연결당 1회만 호출되는 경로이고(핫루프 아님), 추가된 연산은 대부분의 경우(신규 연결) `Map.get` 미스 1회로 끝나는 O(1) 상수 비용이다. 재무장(rearm) 경로에서도 `clearTimeout` 2회 + `Map.delete` 1회로 여전히 O(1)이다. 성능 저하는 무시할 수준이며, 타이머 쌍 누수를 막는 정합성 수정이 이 비용을 상쇄하고도 남는다.
  - 제안: 조치 불필요. 참고용 기록.

- **[INFO]** `notice.unref()` / `cutoff.unref()` 도입은 이벤트 루프 keep-alive 를 해제해 셧다운을 앞당기는 방향의 개선이다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:225-226`
  - 상세: 소켓별 최대 2개(사전 통지·강제 종료) 타이머가 `unref` 없이 이벤트 루프를 최대 900초(access token 수명)까지 붙잡고 있었을 가능성을 제거한다. 동시 접속 소켓 수만큼 타이머가 늘어도 `unref()` 자체의 런타임 비용은 무시할 수준이고, 프로세스 graceful shutdown 지연을 줄이는 순(純) 개선이다. 부작용(그레이스풀 셧다운 중 콜백 미실행 가능성)은 기능/운영 트레이드오프이지 성능 저하가 아니며, 이미 이월 INFO 로 별도 추적 중이다.
  - 제안: 조치 불필요.

- **[INFO]** `expiryTimers: Map<string, {notice, cutoff}>` 자료구조는 소켓 ID 키 기반 O(1) lookup/삭제로 용도에 적합하다. `handleDisconnect` 에서 `clearExpiryTimers` 로 항상 정리되므로 무제한 누적(메모리 누수) 경로는 없다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:156-159`
  - 상세: non-optional 필드 전환(`?` 제거)은 타입 수준 변경으로 런타임 성능에 영향 없음.
  - 제안: 조치 불필요.

- **[INFO]** `MSG_AUTH_TOKEN_EXPIRING` 모듈 레벨 상수 승격은 매 emit 마다 리터럴을 재생성하던 것을 상수 참조로 바꿔 미세하게 유리하다(무시 가능한 수준).
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts` (`export const MSG_AUTH_TOKEN_EXPIRING`)
  - 상세: 성능 목적의 변경은 아니고(문구 SoT 목적) 부수 효과도 무시 가능.
  - 제안: 조치 불필요.

이번 diff 범위에서 N+1 쿼리, 블로킹 I/O, 캐싱 필요 구간, O(n²) 누적, 부적절한 자료구조, 불필요한 선행 로딩 등은 관측되지 않았다. `websocket.gateway.spec.ts` 에 추가된 테스트(재무장·unref·상수 일치)는 실행 시간에 유의미한 영향을 주지 않는 소규모 단위 테스트다.

## 요약

이번 변경은 WS 소켓 만료 타이머의 **정합성 하드닝**(선제 해제로 누수 차단, non-optional 타입, `unref()` 로 셧다운 지연 제거, wire 문구 상수화)에 집중되어 있다. 모든 신규/변경 연산은 소켓 연결·해제 시점에 1회씩 실행되는 O(1) 동작이며, 알고리즘 복잡도·N+1·블로킹 I/O·메모리 누수·부적절한 자료구조 관점에서 성능 저하를 유발하는 지점은 없다. 오히려 `unref()` 도입은 그레이스풀 셧다운 성능을 개선하는 방향이다.

## 위험도
NONE
