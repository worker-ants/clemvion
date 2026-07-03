### 발견사항

- **[INFO]** `handleSubscribe`/`handleUnsubscribe` 가 `client.join`/`client.leave` 를 fire-and-forget(`void`)에서 `await` 로 전환
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `handleSubscribe` (`await client.join(channel)` + try/catch 롤백), `handleUnsubscribe` (`await client.leave(channel)` + try/catch, sync → `async` 전환)
  - 상세: 현재 기본 in-memory socket.io adapter 에서는 `join`/`leave` 가 동기적으로 완결되므로 `await` 도입이 ack round-trip 지연에 실질적 영향은 없다. 다만 향후 Redis adapter 도입 시 `join`/`leave` 가 실제 네트워크 RTT 를 수반하는 비동기 호출이 되면, subscribe/unsubscribe ack 응답 시간이 adapter latency 만큼 늘어난다. 이는 정합성(구독 상태 Set 과 실제 room 멤버십 일치)을 확보하기 위한 의도된 트레이드오프이고, 연결당 최대 구독 수 상한(MAX_SUBSCRIPTIONS_PER_CONNECTION)이 있어 무한정 늘어나는 구조는 아니다.
  - 제안: 현 상태로 문제 없음. Redis adapter 도입 시점에는 `join`/`leave` 호출에 명시적 timeout(`Promise.race`)을 걸어, 느려지거나 응답 없는 adapter 가 subscribe ack 전체를 무기한 블로킹하지 않도록 방어할 것을 권장(별도 후속 과제, 이번 diff 범위 밖).

- **[INFO]** `handleDisconnect` 의 room leave 루프는 여전히 fire-and-forget(`void`) 유지
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `handleDisconnect` — `for (const channel of channels) { void client.leave(channel); }`
  - 상세: 소켓 disconnect 시 socket.io 가 모든 room 을 auto-leave 하므로 이 명시적 leave 호출은 방어적·redundant 하다는 것이 주석에 명시되어 있다. 최대 구독 수 상한 내에서 순차 fire-and-forget 호출이라 스케일 문제 없음. `handleSubscribe`/`handleUnsubscribe` 는 await 로 전환됐지만 이 경로만 fire-and-forget 을 유지하는 비대칭이 존재하나, "소켓이 이미 끊기는 중이라 await 실익이 없다"는 근거가 타당하고 오히려 disconnect 처리 자체를 블로킹하지 않는 편이 낫다.
  - 제안: 변경 불필요.

- **[INFO]** frontend `bind()` 헬퍼가 핸들러 등록마다 `off` + `on` 을 호출 (M-6 이중 등록 방어)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` — 기존 19개의 `client.on(...)` 호출을 전부 `bind(event, handler)` 로 치환, `bind` 내부는 `client.off(event, handler); client.on(event, handler);`
  - 상세: mount/재구독 시 이벤트당 `off` 호출이 추가되어 등록 비용이 명목상 2배가 되지만, 총 19회 호출은 컴포넌트 mount 라이프사이클에서 1회성이라 성능 영향은 무시할 수 있는 수준이다. socket.io-client 의 `off` 는 내부적으로 이벤트별 리스너 배열에서 O(n) 탐색/제거(n=해당 이벤트의 등록된 리스너 수, 통상 1~2개)라 비용이 크지 않다. 오히려 StrictMode 이중 mount 나 cleanup 누락 경로에서 중복 리스너가 누적되어 매 이벤트마다 상태 업데이트/렌더가 중복 실행되는 것을 막아주므로, 순변경 방향은 런타임 CPU/렌더 비용 절감에 가깝다.
  - 제안: 변경 불필요.

- **[INFO]** `use-execution-events.ts` dismiss hysteresis 를 위한 `setTimeout` 추가
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` — snapshot 수신 effect 내 `toast.dismiss` 즉시 호출을 `setTimeout(() => toast.dismiss(...), 1000)` + cleanup `clearTimeout` 으로 전환
  - 상세: effect 실행마다 최대 1개의 타이머만 예약되고 cleanup 에서 확실히 정리되므로 타이머 누적이나 메모리 누수 우려는 없다. reconnect flap(짧은 간격의 연결 끊김↔재연결 반복) 완화를 위한 표준적인 debounce/hysteresis 패턴이며, 10초 warning 임계값이 선행 조건이라 실제 타이머가 예약되는 빈도 자체도 제한적이다.
  - 제안: 변경 불필요.

- **[INFO]** `ws-client.ts` connect pending guard 추가 (`socket.active` 체크) — 성능 개선에 해당
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts` `connect()` — 가드를 `socket?.connected` → `socket && (socket.connected || socket.active)` 로 확장
  - 상세: 기존 코드는 연결 진행 중(handshake/reconnect 대기, `connected=false`)에 `connect()` 가 재호출되면 매번 `socket.disconnect()` + 신규 `io()` 인스턴스 생성(churn)이 발생해 불필요한 네트워크 재시도와 리스너 재등록 오버헤드를 유발했다. `active` 가드 도입으로 이 churn 을 원천 차단하므로, 리소스 사용 관점에서 순수 개선이다. 토큰 갱신 재연결 경로(별도 `connect_error` 핸들러)는 `active=false` 상태에서 동작하므로 이 가드에 막히지 않음을 diff/주석에서 확인.
  - 제안: 변경 불필요. 긍정적 변경으로 평가.

- **[INFO]** 신규 테스트 코드(6개 unit) 자체의 성능 영향 없음
  - 위치: `websocket.gateway.spec.ts`, `use-execution-events.test.ts`, `ws-client.test.ts` 신규 테스트 케이스들
  - 상세: fake-timer 기반 hysteresis 테스트 등 표준적인 unit 테스트 패턴으로, 알고리즘/자료구조/캐싱 관점에서 지적할 사항 없음.
  - 제안: 없음.

### 요약

이번 diff 는 06-concurrency 리팩터 잔여 배치(M-3/M-6/m-3/m-5)로, WebSocket 구독/연결 경로의 4가지 race 취약점을 보강하는 정합성/견고성 개선이 중심이며 변경분 대부분이 테스트 코드다. 백엔드 `join`/`leave` await 전환은 현재 in-memory adapter 하에서 오버헤드가 사실상 0이고, 향후 Redis adapter 도입 시의 latency 증가 가능성은 이미 코드 주석으로 인지·문서화되어 있어 기습적 회귀가 아니다(후속 조치로 timeout 방어를 권장하나 이번 스코프는 아님). 프런트엔드 쪽 `bind()` off-before-on 패턴과 `connect()` 의 `active` pending 가드는 오히려 중복 리스너 실행과 소켓 재생성 churn 을 줄여 순수 성능 개선에 해당한다. dismiss hysteresis 타이머도 표준적인 debounce 구현으로 누수 우려가 없다. 알고리즘 복잡도, N+1 호출, 부적절한 캐싱, 메모리 누수, 블로킹 I/O 병목 등 관점에서 새로 유입된 성능 문제는 발견되지 않았다.

### 위험도
NONE
