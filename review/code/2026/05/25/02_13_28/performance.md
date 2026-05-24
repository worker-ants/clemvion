# 성능(Performance) 리뷰

**리뷰 대상**: fix(chat-channel + mcp) — ChatChannelDispatcher routing context 등록 + McpToolProvider silent skip
**리뷰어**: Performance Sub-Agent
**리뷰 일자**: 2026-05-25

---

## 발견사항

### [INFO] `attachRoutingContext` — context 미등록 분기의 zero-allocation 최적화는 양호하나, context 등록 분기의 shallow-spread 비용이 이벤트 빈도에 따라 누적될 수 있음

- **위치**: `codebase/backend/src/modules/websocket/websocket.service.ts` — `attachRoutingContext()` 메서드 (diff 기준 `+329–+345`)
- **상세**: context 미등록 경로(`if (!ctx) return wireEnvelope`)는 새 객체를 만들지 않고 동일 참조를 반환하므로 allocation 없음 — 올바른 최적화. 그러나 context 등록 경로에서는 매 `emitExecutionEvent` / `emitNodeEvent` 호출마다 (1) `additions` 임시 객체 생성, (2) `Object.keys(additions).length === 0` 검사, (3) 최종 spread `{ ...wireEnvelope, ...additions }` 로 새 객체 생성, 이 3단계가 실행된다. AI Agent 노드는 턴당 수십~수백 회 `emitNodeEvent`를 발행할 수 있으므로, chatChannel이 등록된 실행 동안 불필요한 GC 압력이 반복된다.
- **제안**: `additions` 임시 객체를 제거하고, `triggerId`/`chatChannel` 유무를 직접 검사해 spread를 구성하면 allocation 1회로 줄일 수 있다. 예: `return { ...wireEnvelope, ...(ctx.triggerId ? { triggerId: ctx.triggerId } : {}), ...(ctx.chatChannel ? { chatChannel: sanitized } : {}) }`. 더 나아가, routing context를 등록할 때 `sanitizePayloadForWs(chatChannel)` 결과를 미리 계산해 Map에 저장하면 emit마다 `sanitizePayloadForWs`를 재호출하는 비용도 제거된다.

---

### [INFO] `attachRoutingContext` — `sanitizePayloadForWs(ctx.chatChannel)` 이 emit 마다 반복 호출됨 (캐싱 부재)

- **위치**: `codebase/backend/src/modules/websocket/websocket.service.ts` — `attachRoutingContext()` 내 `sanitizePayloadForWs(ctx.chatChannel)` 호출
- **상세**: `executionRouting` Map에는 원본 `chatChannel` 객체가 저장되어 있고, `attachRoutingContext`는 매 이벤트 발행 시마다 `sanitizePayloadForWs(ctx.chatChannel)`을 호출한다. 동일 execution 내에서 chatChannel은 변경되지 않으므로, 이 sanitize 결과는 execution 생애 동안 불변이다. AI_MESSAGE 이벤트가 다수 발행되는 long-running AI Agent 실행에서는 동일 chatChannel 객체에 대해 sanitize가 수십 회 반복된다.
- **제안**: `registerExecutionRouting` 시점에 `chatChannel`을 즉시 sanitize하여 정제된 값을 Map에 저장한다. `ExecutionRoutingContext.chatChannel` 타입을 "이미 sanitize된 사본"으로 관리하면 `attachRoutingContext`에서 추가 처리가 필요 없다. 단, `sanitizePayloadForWs`가 내부적으로 WeakMap 캐시를 사용하고 있으므로 실질적 impact는 낮을 수 있으나, 캐시 히트 여부는 객체 동일성(reference equality)에 의존하므로 사전 정제가 더 명확하다.

---

### [INFO] `extractChatChannelFromInput` — 호출 경로가 execute() 진입 시 1회이므로 성능 영향 미미, 단 불필요한 property 접근 단계가 있음

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `extractChatChannelFromInput()` 함수 (diff 기준 `+264–+287`)
- **상세**: 함수 자체는 execute() 당 1회만 호출되므로 hot-path 문제는 없다. 다만 `(raw as { provider?: unknown }).provider` 와 같이 동일 `raw` 객체를 2회 캐스팅하여 각각 1개 property씩 읽는 구조는 가독성 저하 외에 실질적 성능 영향은 없다. 현재 구현으로 충분.
- **제안**: 성능 관점 조치 불필요. 가독성 개선이 필요하다면 `const { provider, conversationKey } = raw as Record<string, unknown>` 단일 캐스팅으로 정리 가능하나 성능 영향 없음.

---

### [INFO] `McpToolProvider` — `null` sentinel 패턴으로 throw 제거 후 `Promise.allSettled` + `inflight` Map 동작이 변경됨: null 반환 시 inflight 항목이 resolved `null` 으로 캐시되어 재진입 시 재검사 없이 재사용

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` — `openServer()` / `materializeServer()` (diff 기준 `+990–+993`, `+999–+1016`)
- **상세**: 변경 전 `openServer`는 `serviceType !== 'mcp'`일 때 throw하여 `inflight` Map에 rejected Promise가 캐시됐다. 변경 후 `null`을 resolve하면 `inflight` Map에 `Promise<null>`이 캐시된다. 동일 `(executionId, integrationId)` 쌍으로 재진입할 경우, 두 번째 호출도 `inflight` Map에서 `Promise<null>`을 꺼내 `null`을 반환하게 된다. 이는 not_capable skip의 재-skip으로 의도된 동작이며 성능상 de-dup이 유지되므로 문제 없다. 단, `materializeServer`에서 `null` 반환 직후 `sessions.set(...)` 을 건너뛰므로 session 수가 증가하지 않는다 — 메모리 누수 없음.
- **제안**: 조치 불필요. 기존 de-dup 캐시 동작이 null sentinel에도 올바르게 적용된다.

---

### [INFO] `executionRouting` Map — 비정상 종료 경로(fire-and-forget catch 블록)에서 `releaseExecutionRouting` 호출로 누수 방지가 구현되어 있으나, execute() 외부 비동기 에러 경로의 커버리지를 확인해야 함

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — fire-and-forget catch 블록 (diff 기준 `+319–+322`)
- **상세**: `this.runExecution(...).catch(...)` 내부에서 `releaseExecutionRouting` 호출로 Map 정리를 시도한다. 이는 setup 단계 throw 시 terminal event가 발행되지 않아 Map entry가 영구 잔류하는 누수를 방지하는 올바른 처리다. `runExecution`이 정상 경로(terminal event 발행)를 따를 때는 `emitExecutionEvent`가 자동 release하므로 이중 release(Map.delete가 idempotent)는 무해하다.
- **제안**: 현재 구현으로 메모리 누수 관리가 충분하다. 추가 조치 불필요. 다만 향후 `executeInline` 경로(diff에서 plan 문서가 언급)가 별도로 존재한다면 해당 경로에서도 동일한 register/release 패턴이 적용되는지 확인 권장.

---

### [INFO] `Object.keys(additions).length === 0` 검사 — 빈 context 등록 가능성 확인

- **위치**: `codebase/backend/src/modules/websocket/websocket.service.ts` — `attachRoutingContext()` 마지막 가드
- **상세**: `registerExecutionRouting`의 타입 시그니처상 `ExecutionRoutingContext`는 `triggerId?: string`, `chatChannel?: Record<string, unknown>` 모두 optional이다. 빈 context `{}`를 등록하면 `attachRoutingContext`는 `additions` 객체를 만든 뒤 length === 0을 확인하고 wireEnvelope 동일 참조를 반환한다. 이 경로는 현재 코드베이스에서 발생하지 않으나(항상 `triggerId`를 포함), 방어 코드로서 존재한다.
- **제안**: 현재 구현은 방어적이며 성능 영향 미미하다. 조치 불필요.

---

## 요약

이번 변경은 성능 측면에서 전반적으로 잘 설계되어 있다. context 미등록 분기의 zero-allocation 반환(`if (!ctx) return wireEnvelope`), `McpToolProvider`의 null sentinel을 통한 throw 제거(reject 대신 resolve null로 de-dup 캐시 유지), fire-and-forget catch 블록의 명시 release를 통한 Map 누수 방지가 모두 올바르게 구현되어 있다. 개선 여지가 있는 부분은 두 가지다. 첫째, `attachRoutingContext`가 매 이벤트 발행마다 `additions` 임시 객체를 생성하는 패턴으로, AI Agent처럼 이벤트 빈도가 높은 실행에서 GC 압력이 반복된다. 둘째, `sanitizePayloadForWs(ctx.chatChannel)`가 emit마다 재호출되는데, `registerExecutionRouting` 시점에 사전 정제해두면 이 비용을 완전히 제거할 수 있다. 두 항목 모두 현 트래픽 규모에서는 측정 가능한 병목이 되기 어렵지만, AI Agent 실행이 장기화될수록 누적 영향이 커질 수 있어 INFO 수준으로 기록한다.

---

## 위험도

LOW
