### 발견사항

---

**[WARNING] `waitForConnect` — connect 이벤트 누락 시 Promise가 영구 대기**
- 위치: `ws-client.ts:84-87`
- 상세: `waitForConnect`는 `socket.once("connect", resolve)`만 등록하고 reject 경로가 없다. 연결 실패(`connect_error`)나 소켓이 끊어지는 경우 이 Promise는 resolve/reject 없이 영원히 pending 상태로 남는다. `subscribeAndPoll`이 이 Promise를 `await`하므로 해당 async 태스크가 leak된다.
- 제안: `once("connect_error", reject)` 및 `once("disconnect", reject)` 핸들러를 추가하고, resolve/reject 후 반대쪽 핸들러를 정리해야 한다.

---

**[WARNING] `subscribeAndPoll` async 태스크와 cleanup의 경쟁 조건**
- 위치: `use-execution-events.ts:130-170`, `182-197`
- 상세: `void subscribeAndPoll()`을 호출한 뒤 effect cleanup이 즉시 실행될 수 있다 (strict mode 이중 호출, 빠른 executionId 변경 등). cleanup에서 `cancelledRef.current = true`를 설정하지만, `waitForConnect()` await 이후 재개된 태스크가 `cancelledRef`를 확인하기 전에 `client.subscribe(channel)`을 호출하거나, 그 뒤 `executionsApi.getById` 응답이 돌아온 시점에 이미 새 executionId의 effect가 진행 중인 상태에서 이전 effect의 상태 업데이트가 store에 쓰여질 수 있다. `cancelledRef`가 체크 시점과 실제 연산 사이에서 원자성을 보장하지 못한다.
- 제안: `cancelledRef.current` 체크 직후 상태 업데이트까지 atomically 처리되는 것은 JS single-thread 특성상 보장되나, `await` 경계마다 체크를 두는 현재 패턴은 충분하다. 다만 `client.subscribe(channel)` 전 체크가 있음(`if (cancelledRef.current) return`)이므로 핵심 구간은 보호되고 있다. **실제 위험은 낮지만** onReconnect 핸들러가 cleanup 후에도 한 번 더 실행될 수 있다는 점은 주의가 필요하다.

---

**[WARNING] `onConnect` 핸들러 중복 등록**
- 위치: `use-execution-events.ts:104, 178`
- 상세: `"connect"` 이벤트에 `onConnect`(연결 상태 업데이트)와 `onReconnect`(재구독 트리거) 두 핸들러가 따로 등록된다. 이 자체는 문제없으나, cleanup에서 둘 다 올바르게 off하고 있다. 하지만 `onReconnect` 내부의 `subscribeAndPoll()`은 또 다른 async 태스크를 생성하며, 이 태스크가 cleanup 완료 이후 실행을 재개하면 이미 해제된 채널에 subscribe하거나 unmount된 컴포넌트의 store를 업데이트할 수 있다. `cancelledRef`가 이를 막아주지만, cleanup 순서(먼저 `cancelledRef=true`, 이후 `off`)와 `onReconnect` 실행 타이밍 사이의 미세한 경쟁이 이론적으로 존재한다.
- 제안: off 이전에 `cancelledRef.current = true`를 먼저 설정하는 현재 순서는 올바르다. 추가로 `onReconnect`를 `off`하는 시점을 cleanup 함수 최상단으로 올리면 더 안전하다.

---

**[INFO] `getWsClient` 싱글톤 — 모듈 수준 변수의 테스트 격리 문제**
- 위치: `ws-client.ts:102-108`
- 상세: `singletonInstance`는 모듈 수준 변수로, 테스트 간 상태가 공유될 수 있다. 테스트에서 `resetWsClient()`를 `beforeEach`에서 호출하여 이를 올바르게 처리하고 있으나, 실제 환경에서 Server-Side Rendering/Edge Runtime 재사용 시나리오에서는 예상치 못한 상태 공유가 발생할 수 있다.
- 제안: `"use client"` 지시어가 있으므로 SSR 위험은 낮다. 테스트 격리는 현재 방식으로 충분하다.

---

**[INFO] `waitForConnect` 테스트 — setTimeout 기반 비동기 시뮬레이션**
- 위치: `ws-client.test.ts:124-133`
- 상세: `setTimeout(() => callback(), 10)`으로 connect 이벤트를 시뮬레이션하는데, vitest의 fake timer 없이 실제 타이머를 사용한다. 대부분 문제없으나 CI 환경에서 타이밍 의존적 flakiness 가능성이 있다.
- 제안: `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(10)`을 사용하면 더 결정론적이다.

---

### 요약

전반적으로 동시성 설계는 양호하다. JavaScript 단일 스레드 모델에 적합한 패턴을 사용하고 있으며, `cancelledRef`를 통한 async 태스크 취소, 싱글톤 WS 클라이언트 유지, cleanup 시 disconnect 방지 등의 설계는 올바르다. 가장 주의할 부분은 `waitForConnect`의 reject 경로 누락으로, 네트워크 불안정 환경에서 async 태스크 leak을 유발할 수 있다. `subscribeAndPoll`의 `cancelledRef` 체크는 핵심 경쟁 조건을 방어하고 있으나, `onReconnect` 핸들러가 cleanup 직후 타이밍에 실행될 때의 미세한 경쟁은 이론적으로 남아있다.

### 위험도
**MEDIUM**