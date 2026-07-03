# 테스트(Testing) 리뷰 — 06 concurrency 잔여 배치 (M-3·M-6·m-3·m-5, WS 견고화)

## 발견사항

- **[WARNING]** `handleUnsubscribe` 의 `leave()` 실패(catch) 경로가 테스트로 커버되지 않음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (handleUnsubscribe, `try { await client.leave(channel) } catch (err) { this.logger.warn(...) }`), 대응 spec `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:647-660`
  - 상세: 동일 파일에서 `handleSubscribe` 의 `join()` 실패 롤백 경로는 신규 테스트(`join 실패 → 구독 롤백...`, spec.ts:315-330)로 꼼꼼히 커버했지만, 대칭 구조인 `handleUnsubscribe` 의 `leave()` 실패 경로는 `should unsubscribe from channel` 단일 happy-path 테스트만 `async`/`await` 로 갱신되었을 뿐, `leave.mockRejectedValueOnce(...)` 케이스가 없다. 이 경로는 "best-effort — unsubscribe 는 성공으로 응답" 이라는 명시적 설계 결정(주석)이 있는데, 이 계약(leave 실패해도 `result.data.success === true` 를 유지하고 warn 로그만 남긴다)을 고정하는 회귀 테스트가 없어 향후 리팩터링 시 이 fallback 동작이 조용히 깨질 수 있다.
  - 제안: `join` 실패 테스트와 대칭으로 `leave.mockRejectedValueOnce(new Error('adapter down'))` 후 `handleUnsubscribe` 를 호출해 `result.data.success === true` (best-effort 로 성공 응답 유지) 를 검증하는 테스트를 추가.

- **[INFO]** `handleDisconnect` 의 `void client.leave(channel)` (fire-and-forget) 경로에 leave 실패 시나리오 테스트 없음
  - 위치: `websocket.gateway.ts` handleDisconnect, 새로 추가된 주석 "disconnect 경로의 leave 는 ... best-effort 로 fire-and-forget(void) 유지"
  - 상세: 이 경로는 의도적으로 미변경(await 하지 않음)이라 실질 커버리지 갭이라기보다는 문서화된 설계 결정이다. 다만 `leave()` 가 reject 하는 Promise 를 반환할 때 unhandled rejection 경고가 뜨지 않는지(즉 socket.io mock 이 `leave` 를 reject 하는 Promise 로 반환해도 프로세스가 죽지 않는지)를 최소 1회 검증하면 "void 로 버려도 안전하다" 는 주석의 전제를 실증할 수 있다.
  - 제안: 우선순위 낮음(INFO) — 필요 시 `leave.mockRejectedValueOnce` 로 `handleDisconnect` 를 호출해 예외가 전파되지 않음(`expect(() => gateway.handleDisconnect(socket)).not.toThrow()`)만 확인하는 가벼운 스모크 테스트 추가 고려.

- **[INFO]** `join()` 실패 롤백 테스트가 `isNewSubscription` / snapshot 발행과의 상호작용을 다루지 않음
  - 위치: `websocket.gateway.spec.ts:317-330` (`join 실패 → 구독 롤백...`)
  - 상세: 새 테스트는 `execution:` 채널로 `join` 이 실패하는 케이스를 검증하지만, `execution:` prefix 는 `isNewSubscription && channel.startsWith('execution:')` 분기에서 `emitExecutionSnapshot` 을 fire-and-forget(`void`) 으로 트리거하는 코드 경로 **바로 아래**에 있다. 현재 구현 순서상 `join` 실패는 그 이전에 `return` 하므로 snapshot 이 발행되지 않는 것이 맞지만, 이 불변식("join 실패 시 snapshot 도 발행되지 않는다")을 명시적으로 assert 하는 라인이 없다. `emit` mock 을 스파이해 호출되지 않음을 검증하면 향후 두 로직의 순서가 뒤바뀌는 리팩터링(예: snapshot 발행을 join 이전으로 이동)을 잡아낼 수 있다.
  - 제안: 해당 테스트에 `expect(emit).not.toHaveBeenCalledWith('execution.snapshot', ...)` 어서션 추가(또는 `await new Promise(setImmediate)` 후 확인) — 낮은 우선순위지만 향후 회귀 방지에 유용.

- **[INFO]** 프론트 `use-execution-events.test.ts` 의 hysteresis 테스트에서 "재-flap" 시나리오(디스미스 타이머 도중 재차 snapshot 유실) 미검증
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:2250-2278` (`delays warning dismiss ~1s after snapshot (hysteresis)`)
  - 상세: 구현 주석은 "지연 내에 다시 미수신되면(effect 재실행) cleanup 이 이 타이머를 취소해 warning 이 유지된다" 는 것이 핵심 설계 의도인데, 테스트는 단방향(1회 snapshot 수신 → 1s 후 dismiss)만 검증한다. 정작 이 기능의 존재 이유인 "flap 중 dismiss 취소" 케이스(예: dismiss 타이머 500ms 시점에 `snapshotReceived` 가 다시 false 로 리셋되는 상황을 시뮬레이션해 `dismiss` 가 끝내 호출되지 않음을 확인)가 없어, hysteresis 취소 로직 자체의 회귀는 이 테스트만으로 잡히지 않는다.
  - 제안: `executionId` 변경(또는 `snapshotReceived` 를 false 로 되돌리는 트리거)을 500ms 시점에 발생시켜 `clearTimeout` 이 실제로 동작하고 `dismiss` 가 미호출됨을 검증하는 케이스를 추가하면 hysteresis의 존재 이유를 직접 커버할 수 있다.

- **[INFO]** `ws-client.test.ts` 의 `active` 가드 테스트가 "connecting → 이후 connected 전환 시 정상 동작"까지는 다루지 않음
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts:2439-2447` (`skips connect if socket is active (connecting) — no churn`)
  - 상세: 신규 테스트는 `active=true` 일 때 재호출이 churn 을 만들지 않는지만 검증한다. `active` 가 false 로 돌아온 뒤(연결 실패로 재시도 소진 등) 재호출 시 정상적으로 재연결(disconnect+재생성)되는지는 커버 갭이지만, 이는 기존 `reconnects with new token if socket exists but disconnected` 테스트(active=false 암묵 가정)로 사실상 커버되어 있어 실질 갭은 작다(INFO).
  - 제안: 필요 시 `active=true → false` 전환 후 재호출 케이스를 추가해 가드 조건의 양쪽 경계를 모두 문서화.

- **[INFO]** `M-6` 이중 등록(off-before-on) 테스트가 "핸들러가 실제로 1회만 실행됨" 을 직접 검증하지 않음
  - 위치: `use-execution-events.test.ts:2229-2246` (`registers each handler off-before-on`)
  - 상세: 테스트는 `off`/`on` mock 호출 인자(참조 동일성)만 검증한다. 이는 구현 세부사항(bind 헬퍼의 내부 동작)에 대한 화이트박스 검증으로는 타당하지만, 이 기능의 실제 목적인 "StrictMode 이중 mount 시에도 동일 이벤트에 대해 핸들러가 정확히 1회만 실행된다"를 blackbox 로 직접 assert 하는 테스트는 없다. mock 기반 `on`/`off` 가 실제 이벤트 리스너 등록/해제를 시뮬레이션하지 않으므로(단순 `vi.fn()`), 이 목적 자체는 이 unit 레벨에서 검증하기 어렵다는 점은 감안할 만하다.
  - 제안: 우선순위 낮음. 필요 시 mock `on`/`off` 를 실제 리스너 배열을 관리하는 stub 으로 교체해 "동일 이벤트에 등록된 핸들러 개수가 항상 1" 이라는 불변식을 시뮬레이션 레벨에서 검증할 수도 있으나, 현재 비용 대비 효용은 낮다.

## 테스트 품질 관찰 (긍정적 사항)

- `join` 실패 롤백 테스트는 상태(Set 미오염)와 응답(ack success:false)을 함께 검증해 "tentative-add + 롤백" 계약을 정확히 고정한다 — 좋은 회귀 가드.
- 기존 `enforces MAX_SUBSCRIPTIONS across concurrent subscribe with deferred authorize (TOCTOU race)` 테스트는 이번 diff 대상은 아니지만, `join` await 도입 후에도 유효성이 깨지지 않는지 확인 차 재검토했다 — deferred resolve 패턴은 `join` 동기 mock(`jest.fn()`, 기본 resolved)과 독립적이라 회귀 영향 없음을 확인.
- `handleUnsubscribe` 를 `async` 로 바꾼 변경에 대해 기존 happy-path 테스트가 `await` 로 정확히 갱신되어 있어 시그니처 변경에 따른 실패는 없다(회귀 없음).
- 프론트 `connectOffCalls`/`resumedOffCalls` 카운트 재계산(2→4, 1→2)은 `bind` 헬퍼의 "등록 시 dedup off + cleanup off" 동작을 정확히 반영한 수정이며, 산술 근거가 주석으로 명확히 설명되어 있다.
- Mock 구조(`createMockSocket`, `authedSocket`/`authedMessageSocket` 헬퍼)가 일관되게 재사용되어 각 describe 블록의 격리성이 유지된다. 테스트 간 상태 공유는 없고 `beforeEach` 에서 모듈이 재생성되므로 독립 실행 가능.
- 신규 테스트들의 한글 주석이 "왜 이 테스트가 필요한지"(M-3/M-6/m-3/m-5 태그 + 시나리오 설명)를 명확히 표현해 가독성이 높다.

## 요약

이번 배치는 WS 재연결/동시성 견고화(join/leave await, 이중 리스너 방어, dismiss hysteresis, connect churn 가드)에 대해 핵심 해피패스와 핵심 실패 경로(`handleSubscribe`의 join 실패 롤백) 하나는 정확하고 견고하게 테스트되었으나, 대칭 위치인 `handleUnsubscribe`의 `leave()` 실패 경로("best-effort 로 성공 처리"라는 명시적 설계 결정)에 대한 회귀 테스트가 누락되어 있는 점이 가장 눈에 띄는 갭이다. 프론트엔드 쪽 hysteresis/이중 등록 방어 테스트는 구현 세부사항 검증에 치우쳐 있어, 해당 기능의 존재 이유인 "flap 중 취소" 시나리오를 직접 커버하는 케이스가 없다는 점도 보강 여지가 있다. 다만 이들은 모두 기능 자체를 무력화하는 수준은 아니며, 전반적으로 mock 사용과 테스트 격리는 적절하고 기존 테스트도 시그니처 변경에 맞춰 정확히 갱신되었다.

## 위험도

LOW
