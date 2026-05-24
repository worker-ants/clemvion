# 아키텍처(Architecture) Review

리뷰 대상: fix-chat-channel-dispatcher-and-cafe24-warn (8개 파일)

---

## 발견사항

### [WARNING] ExecutionRoutingContext 타입 정의 위치 — 레이어 책임 경계 모호

- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` (신규 export `ExecutionRoutingContext` 인터페이스)
- 상세: `ExecutionRoutingContext` 는 execution 도메인의 비즈니스 개념(triggerId + chatChannel)을 담지만, 정의 위치가 `websocket` 모듈이다. 결과적으로 `execution-engine` 모듈이 `websocket.service.ts` 에서 도메인 타입을 import 하는 방향 의존이 발생한다(`execution-event-emitter.service.ts` L4). 현재는 websocket 모듈이 execution 상태를 알게 되는 방향으로, 레이어가 역전된다. 이상적으로는 `ExecutionRoutingContext` 를 execution-engine 도메인 타입 파일에 정의하고 websocket 서비스가 이를 수용하는 형태가 맞다. 단, 현재 구조가 실제 circular dependency 를 유발하지는 않으며(execution -> websocket 단방향 유지) 기능 회귀 fix의 긴급도를 고려하면 blocking 수준은 아니다.
- 제안: `ExecutionRoutingContext` 를 `execution-engine/events/` 하위 공유 타입 파일(예: `execution-routing.types.ts`)에 정의하고, `websocket.service.ts` 는 해당 타입을 import 하거나, 별도 `RoutingContext` 이름으로 재정의해 양쪽을 분리한다. 단기적으로는 현 위치를 유지하되 장기 리팩토링 이슈로 등록 권장.

---

### [WARNING] WebsocketService 의 단일 책임 확장 — 라우팅 상태 관리 책임 추가

- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` (신규 `executionRouting: Map`, `registerExecutionRouting`, `releaseExecutionRouting`, `attachRoutingContext`)
- 상세: `WebsocketService` 는 원래 (1) socket.io broadcastToChannel 위임 + (2) RxJS fan-out subject 관리의 두 책임을 가졌다. 이번 변경으로 (3) execution 라우팅 컨텍스트 레지스트리(`executionRouting` Map) + (4) 런타임 attachment 로직(`attachRoutingContext`)까지 담게 되어 SRP 긴장이 증가한다. 또한 `seqCounters` Map 과 `executionRouting` Map 은 동일한 lifecycle(`terminal event 후 release`)을 갖지만 두 Map 의 동기화 보장 코드가 분산되어 있고(`releaseSeqCounter` vs `releaseExecutionRouting`), `emitExecutionEvent` 에서만 seq counter release 와 routing release 가 함께 일어나고 `emitNodeEvent` 에서는 routing attach 만 발생하는 비대칭이 존재한다.
- 제안: `seqCounters` + `executionRouting` 두 Map 을 묶는 `ExecutionSession` 객체(`{ seq, routing }`)를 단일 Map 으로 합산하면 lifecycle 동기화 누락 위험을 구조적으로 차단할 수 있다. 또는 라우팅 레지스트리만을 담당하는 `ExecutionRoutingRegistry` 서비스를 별도 추출해 WebsocketService 가 이를 주입받도록 분리하는 방향도 고려 가능.

---

### [INFO] ExecutionEventEmitter facade 의 pass-through 메서드 — 추상화 가치 재검토

- 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` (신규 `registerExecutionRouting`, `releaseExecutionRouting`)
- 상세: `ExecutionEventEmitter` 는 "향후 WS 외 채널 추가 시 엔진 호출 사이트를 건드리지 않도록"하는 facade 목적으로 도입됐다. 그러나 `registerExecutionRouting` / `releaseExecutionRouting` 은 routing context 를 WebsocketService 에 직접 위임하는 순수 pass-through다. 이 메서드들은 "이벤트 발행" 이 아닌 "상태 등록"에 해당하므로, facade 가 관리하는 추상화 범위(이벤트 채널 다중화)를 벗어난다. 향후 WS 외 채널이 추가되면 routing context 의 의미가 채널마다 달라질 수 있어 facade 레이어에서 이를 통합 관리하기 어렵다.
- 제안: 현재 구조는 기능 목적에는 부합하므로 즉시 차단 사안이 아니다. 다만 JSDoc 주석에 "본 메서드는 WebsocketService routing 전용이며, 멀티채널 추가 시 별도 검토 필요"라는 제약 명시를 권장.

---

### [INFO] `extractChatChannelFromInput` — 파싱 책임 위치

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (신규 module-level 함수)
- 상세: `extractChatChannelFromInput` 은 `input` 의 `chatChannel` 필드를 파싱·검증한다. 이 파싱 책임은 원래 `HooksService.handleChatChannelWebhook` 가 input 을 구성할 때 보장해야 할 계약이다. execution-engine 이 input 의 내부 구조를 defensive parse 해야 하는 상황은, engine 과 hook 서비스 사이의 명시적 계약(DTO 또는 타입 가드)이 부재함을 의미한다. 현재는 `Record<string, unknown>` 형태로 넘겨져 engine 이 shape 을 재검증한다.
- 제안: `HooksService` 가 `execute()` 에 넘기는 `input` 에 `ChatChannelInput` 타입을 정의하거나, input 생성 시점에 검증된 typed 객체를 넘기면 engine 의 방어적 파싱이 불필요해진다. 단기적으로는 현 방어 코드가 안전하므로 INFO 수준.

---

### [INFO] `McpToolProvider.openServer` 의 null sentinel 반환 — 타입 수준 명시적 nullable

- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` (변경된 `openServer` 반환 타입 `Promise<ServerEntry | null>`)
- 상세: "처리 불가 ref → null 반환" 패턴은 `not_capable` skipReason 을 명확히 표현하며, `Promise.allSettled` 기반 caller 에서 이미 처리 가능한 구조다. 이번 변경은 Cafe24McpToolProvider 의 silent continue 비대칭을 해소하는 올바른 방향이다. 다만 `materializeServer` 내부에서 inflight Map 에 null 결과를 캐싱한다면, 같은 integrationId 에 대해 이후 재시도 시에도 null 이 반환될 수 있다. 실제 코드를 보면 `if (!entry) return []`에서 sessions 에 등록하지 않아 inflight 캐시만 남는다. inflight 에서의 제거 타이밍이 명확한지 확인이 필요하다.
- 제안: `openServer` 가 null 을 반환한 경우 inflight Map 에서 해당 key 를 정리하는 코드가 있는지 확인하고, 없다면 `finally` 블록에서 `inflight.delete(inflightKey)` 처리 보강 권장.

---

### [INFO] fanout envelope 에서의 sanitize 이중 적용

- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` `attachRoutingContext` 메서드
- 상세: `chatChannel` 은 `registerExecutionRouting` 호출 시 `Record<string, unknown>` 으로 저장되고, `attachRoutingContext` 에서 `sanitizePayloadForWs(ctx.chatChannel)` 를 재적용한다. 이는 defense-in-depth 의도로 명시되어 있으며 보안 관점에서는 긍정적이다. 다만 emit 마다 sanitize 가 재실행되므로, execution lifecycle 이 긴 경우(AI Agent multi-turn) 동일 chatChannel 객체를 반복 sanitize 하는 CPU 비용이 발생한다. WeakMap 캐시(`sanitizePayloadForWs` 내부)가 이를 완화하나, chatChannel 은 단순 평면 객체로 깊이가 낮아 실질 비용은 미미하다.
- 제안: 현 구조는 수용 가능. 장기적으로 `registerExecutionRouting` 시점에 한 번 sanitize 한 결과를 저장하면 emit 마다 재연산을 없앨 수 있다.

---

## 요약

이번 변경은 두 개의 독립된 회귀 버그(chat-channel outbound 응답 누락, Cafe24 통합 WARN 노이즈)를 최소 침습적으로 수정한다. 아키텍처 관점에서 핵심 결정인 "wire envelope / fanout envelope 분리"는 frontend wire shape 호환성 보존과 내부 dispatcher 식별 요구를 함께 충족하는 실용적인 선택이며, 레이어 책임 분리(엔진이 emit 하고 WebsocketService 가 route 한다)를 유지한다. `ExecutionEventEmitter` facade 가 pass-through 메서드를 추가로 위임함으로써 엔진 호출 사이트의 WS 의존을 차단하는 목적도 일관되게 유지된다. 다만 `ExecutionRoutingContext` 타입이 websocket 모듈에 정의되어 execution 도메인 타입이 인프라 모듈에 역류하는 점과, `WebsocketService` 가 seq 카운터 + 라우팅 레지스트리 두 가지 상태를 독립 Map 으로 관리해 lifecycle 동기화 책임이 분산되는 점은 중장기 리팩토링 과제로 등록할 가치가 있다. McpToolProvider 의 null sentinel 패턴은 Cafe24McpToolProvider 와의 비대칭을 해소하는 올바른 방향이나 inflight 캐시 정리 경로를 추가로 검토할 필요가 있다.

---

## 위험도

MEDIUM
