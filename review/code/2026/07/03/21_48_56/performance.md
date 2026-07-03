### 발견사항

- **[INFO]** `handleSubscribe`/`handleUnsubscribe` 가 `client.join`/`client.leave` 를 fire-and-forget(`void`)에서 `await` 로 전환
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `handleSubscribe` (client.join await, L1569-1582), `handleUnsubscribe` (client.leave await, L1650-1658)
  - 상세: 현재 in-memory socket.io adapter 에서는 `join`/`leave` 가 동기적으로 완결되므로 `await` 추가가 ack round-trip 지연에 실질적 영향은 없다. 다만 주석에서 명시하듯 향후 Redis adapter 도입 시 `join`/`leave` 가 실제 비동기(네트워크 RTT)가 되면 subscribe/unsubscribe ack 지연이 Redis adapter latency 만큼 증가한다. 이는 정합성(구독 상태와 실제 room 멤버십 일치)을 위한 의도된 트레이드오프이며, MAX_SUBSCRIPTIONS_PER_CONNECTION=20 한도 내에서는 문제 없다.
  - 제안: 현 상태로 문제 없음. 향후 Redis adapter 도입 시 `join` 호출에 타임아웃을 명시적으로 걸어(예: Promise.race) 느린 adapter 가 ack 전체를 무기한 블로킹하지 않도록 방어하는 것을 고려.

- **[INFO]** `handleDisconnect` 의 room leave 루프는 여전히 fire-and-forget 유지
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` L1441-1454
  - 상세: `for (const channel of channels) { void client.leave(channel); }` — 최대 20개(MAX_SUBSCRIPTIONS_PER_CONNECTION) 채널에 대해 순차 fire-and-forget 호출. 소켓이 이미 disconnect 중이므로 await 실익이 없다는 설명이 타당하고, 상한이 20으로 고정돼 있어 스케일 문제 없음.
  - 제안: 변경 불필요.

- **[INFO]** frontend `bind()` 헬퍼가 핸들러 등록마다 `off` + `on` 을 호출 (M-6 이중 등록 방어)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` L2580-2589, 16개 이벤트에 적용
  - 상세: mount/재구독 시 이벤트당 `client.off()` 호출이 추가되어 기존 대비 registration 비용이 2배가 되지만, 총 16회 호출은 컴포넌트 mount 라이프사이클에서 1회성이라 성능에 미치는 영향은 무시 가능한 수준. socket.io-client 의 `off` 는 내부적으로 리스너 배열에서 O(n) 탐색/제거(n=해당 이벤트의 리스너 수, 통상 1~2개)이므로 문제 없음. 오히려 StrictMode 이중 mount 시 중복 리스너 누적으로 인한 이벤트 핸들러 중복 실행(각 이벤트마다 상태 업데이트 2회 트리거) 을 방지하므로 순변경은 성능 개선에 가깝다.
  - 제안: 변경 불필요.

- **[INFO]** `use-execution-events.ts` dismiss hysteresis 를 위한 `setTimeout` 추가
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` L2655-2658
  - 상세: snapshot 수신 시마다 1개의 setTimeout(1000ms) 타이머가 예약되고 effect cleanup(`clearTimeout`)으로 정리된다. 타이머 누적이나 메모리 누수 우려 없음 — reconnect flap 방지를 위한 의도된 debounce/hysteresis 패턴으로 표준적 구현.
  - 제안: 변경 불필요.

- **[INFO]** `ws-client.ts` connect pending guard 추가 (`socket.active` 체크)
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts` L1446 (`if (socket && (socket.connected || socket.active))`)
  - 상세: 이전에는 연결 진행 중(`connected=false`, 실제로는 handshake 중)에 `connect()` 재호출 시 매번 `socket.disconnect()` + 새 `io()` 인스턴스 생성(churn)이 발생했다. 이 fix 는 불필요한 소켓 재생성과 그로 인한 리스너 재등록/네트워크 재시도를 방지하므로 순수 성능 개선(리소스 절약) 이다.
  - 제안: 변경 불필요. 오히려 긍정적 변경.

### 요약
이번 변경분은 06-concurrency 배치의 정합성 개선(join/leave await + 롤백, 이중 리스너 방어, connect churn 방지, dismiss hysteresis)이 중심이며 테스트 코드가 대다수다. join/leave 를 await 로 전환한 부분은 현재 in-memory adapter 하에서 무시 가능한 오버헤드이고, 향후 Redis adapter 전환 시 latency 증가 가능성은 이미 주석으로 인지·문서화되어 있다. frontend 쪽 `bind()` off-before-on 패턴과 `active` pending guard 는 오히려 중복 리스너/소켓 churn 을 줄이는 성능 개선에 가깝다. 알고리즘 복잡도, N+1, 캐싱, 메모리 누수 등 관점에서 새로 유입된 문제는 없다.

### 위험도
NONE
