# 부작용(Side Effect) 리뷰 결과

## 리뷰 대상

1. `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts`
2. `codebase/backend/src/modules/websocket/websocket.gateway.ts`
3. `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts`
4. `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts`
5. `codebase/frontend/src/lib/websocket/use-execution-events.ts`
6. `codebase/frontend/src/lib/websocket/ws-client.ts`

## 발견사항

### INFO — `handleUnsubscribe` 시그니처 변경(sync → async): 프레임워크 경계 내 안전
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:337` (`handleUnsubscribe`), 대응 diff 라인 `@@ -313,17 +334,27 @@`
- 상세: `handleUnsubscribe(...)`가 반환 타입 `{ event; data }` → `Promise<{ event; data }>`로 바뀌었다. NestJS `@SubscribeMessage` 데코레이터가 붙은 gateway 핸들러는 프레임워크가 반환값을 자동으로 `await`/`Promise.resolve`로 처리하므로 socket.io 디스패치 경로에서는 무해하다. 저장소 내 grep 결과 직접 호출부는 스펙 파일(`websocket.gateway.spec.ts`)뿐이며, 해당 spec도 `await gateway.handleUnsubscribe(...)`로 이미 갱신되어 있다. 다만 이 메서드가 `public` 이므로, 향후 다른 서비스가 gateway 인스턴스를 직접 참조해 동기 호출로 가정하면 깨질 수 있다(현재는 그런 참조 없음).
- 제안: 현재는 문제 없음. 향후 코드베이스에서 gateway 메서드를 직접 호출하는 패턴이 생기면 시그니처 재확인 필요 — 특별한 조치 불필요.

### INFO — `handleSubscribe`: `client.join` 실패 시 새 에러 응답 문자열 추가(클라이언트 계약 확장)
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:275` 부근(diff `-void client.join(channel);` → `try { await client.join(channel) } catch ...`)
- 상세: 신규 실패 분기가 `data: { success: false, error: 'Subscription failed — please retry' }` 라는 새 wire 문자열을 도입한다. 기존 `subscribed` 이벤트의 `error` 필드는 이미 여러 문자열(`'Invalid channel'`, `'Not authorized...'` 등)을 사용 중이므로 스키마 자체는 깨지지 않으나, 프런트엔드에서 `error` 문자열을 패턴 매칭(예: `localizeAckError` 류)하는 곳이 있다면 새 케이스를 인식하지 못하고 generic 처리로 빠질 수 있다. 이번 diff 범위에는 프런트 소비 측 코드가 포함되어 있지 않아 직접 검증은 불가.
- 제안: 프런트엔드의 `subscribed` ack `error` 문자열 매핑 테이블이 있다면(i18n `localizeAckError` 등) 이 신규 문자열이 최소 generic fallback으로 안전하게 흡수되는지 별도 확인 권장. 코드 변경은 불필요해 보임(INFO 수준).

### INFO — `handleDisconnect`의 `client.leave` 는 여전히 fire-and-forget(void) — 의도된 비대칭
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:140-152`
- 상세: `handleSubscribe`/`handleUnsubscribe` 경로는 `await client.join/leave`로 바뀌었으나 `handleDisconnect`의 `leave`는 여전히 `void client.leave(channel)`로 유지된다. 주석에 "socket.io가 disconnect 시 room을 auto-leave하므로 방어적·redundant, 소켓이 이미 끊기는 중이라 await 실익 없음"이라는 근거가 명시되어 있어 의도된 설계이며, `handleDisconnect` 자체는 `void` 반환(동기)이라 signature 변경도 없다. 부작용 관점에서 실제 위험은 낮다 — 다만 `for...of` 루프에서 각 채널에 대해 `leave` 호출을 fire-and-forget 하는 것은 예외(reject)가 발생해도 아무도 catch하지 않아 unhandled rejection 가능성이 있다(하지만 `client.leave`는 실제로 room 정리 실패해도 일반적으로 reject하지 않는 구현이 대부분).
- 제안: 특별한 수정 불필요, 리스크는 낮음. 필요 시 `.catch(() => {})` 정도의 방어만 고려 가능(비필수).

### INFO — `handleSubscribe`의 join 실패 롤백 시 `emitExecutionSnapshot`은 join 실패와 무관하게 호출되지 않음(정상 순서) — 회귀 없음 확인
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:257-295` 부근
- 상세: `await client.join(channel)`이 실패해 조기 `return`하는 코드 경로가 `isNewSubscription && channel.startsWith('execution:')` 체크(및 `emitExecutionSnapshot` 호출)보다 앞에 위치한다. 즉 join 실패 시 snapshot emit이 발생하지 않는 순서가 유지된다 — 새로 도입된 실패 처리가 기존 snapshot emit 부작용에 영향을 주지 않음을 코드 순서로 확인했다.
- 제안: 없음(정상).

### INFO — 프런트 `bind()` 헬퍼가 매 `useEffect` 실행마다 `off` 후 `on`을 호출 — 의도된 멱등 등록이나 리스너 총량 증가 위험 없음 확인
- 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:1024-1032`(bind 정의), 각 `bind("event", handler)` 호출부
- 상세: `bind`는 `client.off(event, handler); client.on(event, handler);`로 등록 직전 동일 참조를 제거 후 재등록한다. `handler`들은 모두 `useCallback`으로 stable reference이므로 동일 `useEffect` 재실행 시(StrictMode 이중 mount 등) 실제로 리스너가 중복 누적되지 않는다 — 의도된 부작용 억제 패턴이며 올바르게 동작한다. cleanup에서의 `client.off(...)` 호출과 결합해 최종 리스너 수가 일정하게 유지된다.
- 제안: 없음. 테스트(`use-execution-events.test.ts`)에서 off/on 페어링과 cleanup 시 off 횟수 배가(2→4, 1→2)를 검증하고 있어 회귀 가드가 마련되어 있다.

### INFO — `dismiss hysteresis` 타이머(`setTimeout` 1000ms)가 새 부작용(전역 타이머) 도입하지만 cleanup으로 정리됨
- 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:2655-2658`(신규 diff), `useEffect` 블록 (`:1178` 부근)
- 상세: `snapshotReceived === true`일 때 즉시 `toast.dismiss` 대신 1초 지연 타이머를 예약하고, effect cleanup에서 `clearTimeout(dismissTimer)`을 반환한다. `executionId`가 바뀌거나 `snapshotReceived`가 다시 false로 바뀌면 effect가 재실행되어 이전 타이머가 정리되므로 타이머 누수 위험은 없다. `toast.dismiss`는 외부 라이브러리(sonner) 호출로 전역 UI 상태(토스트 스택)를 변경하는 부작용이지만 기존에도 존재하던 부작용이며 트리거 시점만 지연되었다.
- 제안: 없음.

### INFO — `ws-client.ts`의 `connect()` pending 가드 추가는 기존 재연결 흐름과 상호작용 — 의도 주석대로 무영향 확인
- 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:20-31`(diff), `connect` 함수 전체
- 상세: 기존 `if (socket?.connected) return;`에 `socket.active` 조건이 추가되어, 연결 진행 중(`active===true`, `connected===false`)일 때도 조기 반환한다. 이로 인해 `disconnect()` + 재생성(신규 `io()` 호출, 즉 새로운 소켓 인스턴스 생성이라는 부작용)이 스킵된다 — 이것이 이번 변경의 핵심 의도(churn 방지)이며 부작용을 "덜 일으키는" 방향이라 안전하다. 주석에 명시된 대로, 토큰 갱신 재연결은 `connect_error` 핸들러 내부에서 기존 소켓 인스턴스의 `auth.token`을 직접 mutate(`(socket.auth as {token}).token = newToken`)하고 `socket.connect()`를 호출하는 별도 경로이므로 이번 가드와 충돌하지 않는다.
- 제안: 없음. `socket.auth` 직접 mutate는 이번 diff 범위 밖의 기존 코드이나, socket.io 인스턴스의 내부 상태(`auth` 객체)를 외부에서 직접 변경하는 패턴이라는 점은 참고로 남긴다(이번 PR이 도입한 것은 아님).

### INFO — 테스트 파일들의 변경은 프로덕션 부작용 없음(mock 구조 확장만)
- 위치: `websocket.gateway.spec.ts`, `use-execution-events.test.ts`, `ws-client.test.ts` 전체 diff
- 상세: 세 테스트 파일의 변경은 신규 테스트 케이스 추가 및 기존 mock(`createMockSocket`)에 `active` 필드 추가, 비동기 호출로의 전환(`await gateway.handleUnsubscribe`)에 국한된다. 전역 상태·파일시스템·네트워크에 대한 새로운 부작용은 없다.
- 제안: 없음.

## 요약

이번 변경 세트는 WebSocket 구독/해제 경로에 `join`/`leave`의 비동기 실패를 고려한 롤백 로직(M-3), 프런트 이벤트 리스너의 멱등 등록(M-6), 재연결 churn 방지 가드(m-3), 그리고 warning toast dismiss hysteresis(m-5)를 도입한다. `handleUnsubscribe`의 시그니처가 동기 → 비동기로 바뀌었으나 NestJS 게이트웨이 디스패치 경계 내에서만 소비되므로 외부 호출자 영향은 없다. 새로 추가된 `join` 실패 시 ack 에러 문자열(`'Subscription failed — please retry'`)은 프런트 소비 측 매핑 여부를 확인할 필요가 있으나 이번 diff 범위 밖이라 INFO로 남긴다. `handleDisconnect`의 `leave`는 의도적으로 fire-and-forget을 유지해 join/leave 경로 간 비대칭이 있으나 주석 근거가 명확하고 리스크는 낮다. 프런트의 `bind()` 헬퍼와 dismiss 타이머는 모두 cleanup을 통해 부작용(리스너 누적, 타이머 누수)을 회수하도록 설계되어 있다. 전반적으로 의도치 않은 전역 상태 변경, 신규 전역 변수, 파일시스템/네트워크 부작용, 공개 API 파괴적 변경은 발견되지 않았다.

## 위험도

LOW
