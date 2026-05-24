# 테스트(Testing) 리뷰

## 발견사항

### [INFO] `emitNodeEvent` 에 routing context 첨부되는 경로가 테스트되지 않음
- 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` — 새 `execution routing context` describe 블록
- 상세: `emitExecutionEvent` 를 통한 routing context 첨부는 8개 케이스로 충분히 커버되어 있으나, `emitNodeEvent` 역시 `attachRoutingContext` 를 동일하게 호출한다 (`websocket.service.ts:389`). 이 경로에 대한 테스트가 전혀 없다. 실제로 ChatChannelDispatcher / NotificationFanout 이 AI_MESSAGE 노드 이벤트를 구독하는 시나리오라면, `emitNodeEvent` 경유 시 `triggerId` / `chatChannel` 이 fanout envelope 에 첨부되지 않아 silent 실패가 발생할 수 있다.
- 제안: 다음 케이스를 추가한다. `registerExecutionRouting` 후 `emitNodeEvent` 를 발행하고, `executionEvents$` fanout envelope 에 `triggerId` 가 첨부되는지 확인하는 테스트 1개.

---

### [INFO] `extractChatChannelFromInput` 의 엣지 케이스 — 직접 unit 테스트 부재
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L165–181
- 상세: `extractChatChannelFromInput` 은 module-private 순수 함수이며 다음 분기를 갖는다. (1) `input` 이 null/non-object, (2) `chatChannel` 키 부재 또는 non-object, (3) `provider` 가 빈 문자열, (4) `conversationKey` 가 빈 문자열, (5) 정상 경우. 현재 `execute()` 통합 테스트가 (1)·(5)·(2)에 해당하는 케이스를 간접 커버하지만, (3)·(4) (빈 문자열 provider/conversationKey) 는 `registerExecutionRouting` 호출 여부로 확인할 수 있는 테스트가 없다. 해당 분기가 잘못 처리되면 빈 chatChannel 이 routing context 에 실려 dispatcher guard 를 통과하거나, conversationKey 를 찾지 못하는 채널로 outbound 발송이 시도될 수 있다.
- 제안: `execute()` 수준 테스트에 두 케이스를 추가한다. `chatChannel: { provider: '', conversationKey: '12345' }` 및 `chatChannel: { provider: 'telegram', conversationKey: '' }` 가 있을 때 `registerExecutionRouting` 에 `chatChannel` 이 포함되지 않아야 함을 검증한다.

---

### [INFO] `execute()` 오류 경로의 `releaseExecutionRouting` 호출 — 테스트 없음
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L785 / `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- 상세: `runExecution` 이 실패하면 `.catch` 핸들러에서 `eventEmitter.releaseExecutionRouting(executionId)` 를 호출한다. 현재 테스트 suite 에 `releaseExecutionRouting` 에 대한 assertion 이 전혀 없다 (mock 선언만 존재). 설정 단계(예: `workflow not found` throw) 에서 terminal event 가 emit 되지 않은 채 실행이 종료되는 경로에서 routing context 가 Map 에 남아 다음 executionId 재사용 시 stale context 가 첨부되는 회귀를 막기 위해 설치된 코드이므로, 테스트가 없으면 future regression 을 잡지 못한다.
- 제안: `triggerId` 가 있는 상태에서 `runExecution` 내부가 throw 하도록 mock 을 설정하고 (`mockHandler.execute.mockRejectedValueOnce(...)`), `flushPromises()` 후 `mockWebsocketService.releaseExecutionRouting` 이 `executionId` 로 호출됐는지 검증하는 테스트를 추가한다.

---

### [INFO] `McpToolProvider` WARN 테스트 — private static logger 접근 방식의 취약성
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.spec.ts` L416–436, L456–481
- 상세: `jest.spyOn((McpToolProvider as unknown as { logger: { warn: jest.Mock } }).logger, 'warn')` 으로 private static 필드를 캐스팅하여 spy 를 설치한다. 이는 TypeScript 타입 시스템을 우회하는 강제 캐스팅으로, (1) NestJS 가 Logger 를 내부적으로 래핑하거나 클래스 구조를 변경하면 런타임에서 `undefined` 에 `.warn` spy 를 시도해 테스트 자체가 오류로 실패할 수 있다. (2) `spy` 가 실패해도 `try/finally` 로 `mockRestore()` 하므로 테스트 격리는 보장되나, spy 설치 실패 시 `warnSpy.not.toHaveBeenCalled()` assertion 이 거짓 통과된다.
- 제안: 단기적으로는 spy 설치가 성공했는지 확인하는 assertion(`expect(warnSpy).toBeDefined()`)을 추가한다. 장기적으로는 `Logger` 를 생성자 주입 또는 모듈 DI 로 주입받아 mock 교체가 가능하도록 리팩터링하는 것을 권장한다.

---

### [INFO] `inflight` cache 에 null 이 저장되는 경로 — 동시 요청 시나리오 테스트 부재
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` L542–550
- 상세: `openServer` 가 `null` 을 반환할 때 `inflight` Map 에 `Promise<null>` 이 캐시된다. 같은 `(executionId, integrationId)` 페어로 동시 요청이 2개 이상 들어오면 두 번째 요청이 캐시된 `Promise<null>` 을 재사용하므로 `sessions.set(...)` 없이 `[]` 를 반환한다. 이 de-dup 경로가 null sentinel 과 함께 올바르게 작동하는지 확인하는 테스트가 없다.
- 제안: 동일 `integrationId` 에 대해 `buildTools` 를 두 번 병렬 호출하고 (두 번 모두 `cafe24` serviceType), 두 결과 모두 `[]` 이며 `connect` 가 0회 호출됐는지 확인하는 테스트를 추가한다.

---

### [WARNING] `registerExecutionRouting` mock 이 테스트 간 `mockClear` 되지 않음
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — top-level `beforeEach`
- 상세: `mockWebsocketService.emitExecutionEvent` 와 `emitNodeEvent` 는 일부 describe 블록의 `beforeEach` 에서 `mockClear()` 가 명시적으로 호출되지만 (`L1867`, `L1891`, `L2226` 등), `registerExecutionRouting` 와 `releaseExecutionRouting` 은 전혀 clear 되지 않는다. 상위 `beforeEach` 가 `TestingModule.compile()` 을 매번 실행해 DI 컨테이너가 재생성되므로 현재는 격리되어 있다. 그러나 미래에 `beforeAll` 로 전환하거나 module scope 를 조정할 경우 즉각 cross-test 오염이 발생한다. 또한 describe 내부 `beforeEach` 에서 다른 mock 들은 `mockClear()` 하는 패턴의 일관성도 깨진다.
- 제안: `emitExecutionEvent` / `emitNodeEvent` 를 clear 하는 동일 위치에 `registerExecutionRouting` / `releaseExecutionRouting` 에 대한 `mockClear()` 도 추가한다.

---

## 요약

이번 변경에 대한 테스트 커버리지는 전반적으로 양호하다. WebsocketService routing context 의 핵심 흐름 (등록·첨부·자동 release·명시 release·race condition·sanitize·wire/fanout 분리)은 8개 케이스로 잘 커버되어 있고, ExecutionEngineService 의 register 호출 분기 3가지(chat channel trigger / plain trigger / 수동 실행)도 명확히 검증된다. McpToolProvider 의 silent skip 수정 역시 단독 cafe24 + 혼합 시나리오 두 케이스로 회귀를 막는다. 다만 네 가지 커버리지 갭이 존재한다. `emitNodeEvent` 를 통한 routing context 첨부가 미검증, `extractChatChannelFromInput` 의 빈 문자열 경계값이 미검증, `runExecution` 오류 경로에서 `releaseExecutionRouting` 호출이 미검증, `inflight` 캐시의 null sentinel 동시 접근이 미검증이다. 이 갭들은 모두 INFO 수준이며 즉각 릴리스를 막지는 않으나, 특히 오류 경로의 `releaseExecutionRouting` 검증 부재는 이 fix 의 핵심 안전망에 해당하므로 follow-up 추가를 권장한다.

## 위험도

LOW

STATUS: SUCCESS
