# 부작용(Side Effect) 리뷰

**대상 PR**: fix(chat-channel + mcp) — 응답 누락 + Cafe24 통합 WARN 노이즈
**리뷰 일시**: 2026-05-25
**리뷰어**: side-effect-agent

---

## 발견사항

### [INFO] WebsocketService 에 신규 인스턴스-레벨 공유 상태(`executionRouting`) 추가
- **위치**: `codebase/backend/src/modules/websocket/websocket.service.ts` L264–267
- **상세**: `private readonly executionRouting = new Map<string, ExecutionRoutingContext>()` 가 서비스 인스턴스 생명주기와 동일한 Map 으로 도입됐다. 기존의 `seqCounters` Map 과 동일한 패턴이며, 동일한 lifecycle 정책(terminal event 후 자동 release)을 따른다. NestJS 의 `@Injectable()` 기본값은 Singleton 이므로 프로세스 전체에서 공유되는 상태다. 이는 의도된 설계이며 `seqCounters` 와 정합하는 선례가 있다. 단, 단일 인스턴스 가정이 분산 환경(multi-instance)에서 깨질 경우 라우팅 컨텍스트가 등록된 인스턴스와 emit 하는 인스턴스가 달라지는 레이스 조건이 발생한다. 코드 주석과 `seqCounters` 주석에 이미 "추후 Redis INCR 로 강화" 라는 보강 노트가 있어 인지된 한계임을 확인.
- **제안**: 현재 단일 인스턴스 배포 기준으로 문제 없음. 멀티 인스턴스 배포 시 별도 follow-up 필요.

### [INFO] `attachRoutingContext` 가 routing context 미등록 시 wireEnvelope 동일 참조를 반환
- **위치**: `codebase/backend/src/modules/websocket/websocket.service.ts` L404–420 (`attachRoutingContext`)
- **상세**: context 가 없으면 wireEnvelope 자체를 반환하고, context 가 있으면 `{ ...wireEnvelope, ...additions }` 신규 객체를 반환한다. fanout envelope 은 `executionEventSubject.next()` 로 내부 구독자에게 전달되며, 같은 wireEnvelope 참조가 wire(gateway.broadcastToChannel)와 fanout 양쪽에 흘러갈 수 있다. 구독자가 fanout payload 를 직접 변경(mutate)한다면 wire 경로의 내용이 오염될 수 있다. 현재 구독자(`SseAdapter`, `NotificationFanout`, `ChatChannelDispatcher`)가 payload 를 읽기만 한다면 문제없으나, 방어적으로 `Object.freeze()` 를 적용하거나 항상 새 객체를 반환하는 것이 더 안전하다.
- **제안**: 현행 코드베이스 구독자 패턴 기준으로 즉각적인 위험은 없음. 향후 구독자 추가 시 mutate 금지 규약을 명시할 것.

### [INFO] `extractChatChannelFromInput` 이 `channelUserKey` 검증을 생략하고 raw 전체를 통과시킴
- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L165–287 (`extractChatChannelFromInput`)
- **상세**: 함수는 `provider` 와 `conversationKey` 가 비어있지 않은 string 임을 검증하지만, `channelUserKey` 는 검증하지 않고 raw 객체 전체를 통과시킨다. 주석에 "sanitize 는 WebsocketService 측에서 적용" 이라 명시되어 있다. `WebsocketService.attachRoutingContext` 에서 `sanitizePayloadForWs(ctx.chatChannel)` 를 호출하므로 credential-like 키는 마스킹되나, 예상치 못한 필드(예: large blobs, circular ref)가 포함될 경우 메모리 점유 또는 직렬화 비용이 발생할 수 있다. 현재 sanitize 가 `MAX_SANITIZE_DEPTH = 10` 으로 depth 제한을 두어 최악의 경우 `[REDACTED_DEPTH]` 로 대체하므로 보안 누출은 차단됨.
- **제안**: 현행 설계(두 단계 sanitize 위임)는 이미 defense-in-depth 를 충족. 즉각적인 수정 필요 없음.

### [WARNING] `execute()` 에서 `registerExecutionRouting` 이후 `runExecution` 의 `.catch()` 에서만 `releaseExecutionRouting` 를 호출 — 정상 종료 경로에서의 release 누락 위험 분석 필요
- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L767–785
- **상세**: `execute()` 는 `triggerId` 가 있을 때 `registerExecutionRouting` 을 호출한다. 이후 `runExecution` 은 fire-and-forget 으로 실행되며, 정상 종료 시에는 `WebsocketService.emitExecutionEvent` 내부에서 terminal event(`COMPLETED`/`FAILED`/`CANCELLED`) 발송 시 `releaseExecutionRouting` 가 자동 호출된다. 비정상 종료(setup 단계 throw — runExecution 본문 진입 전) 시에는 `.catch()` 에서 명시 release 를 수행한다. 이 구조는 기능적으로 올바르다. 단, `runExecution` 이 terminal event 를 emit 하지 않고 정상적으로 반환하는 코드 경로(현재 없지만 미래 리팩토링에서 생길 수 있음)가 생기면 routing context 가 누수된다. `seqCounters` 도 동일한 설계 위험을 공유하므로 기존 선례와 일관된다.
- **제안**: 현재 코드 기준으로 누수 경로 없음. `runExecution` 이 항상 terminal event 를 emit 하거나 throw 한다는 불변식을 unit test 또는 주석으로 명시하면 미래 회귀를 차단할 수 있다.

### [INFO] `McpToolProvider.openServer` 의 반환 타입이 `ServerEntry` 에서 `ServerEntry | null` 로 변경
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` L555–573
- **상세**: `openServer` 의 반환 타입이 `Promise<ServerEntry>` 에서 `Promise<ServerEntry | null>` 로 변경됐으며, `inflight` Map 의 타입도 `Map<string, Promise<ServerEntry>>` 에서 `Map<string, Promise<ServerEntry | null>>` 로 확장됐다. `materializeServer` 가 null 을 받아 즉시 `[]` 를 반환하도록 처리됐다. 호출자(`buildTools`)는 `Promise.allSettled` 로 결과를 수집하므로 null 반환이 fulfilled 로 처리되어 빈 배열로 spread 된다. 기존의 throw→WARN 경로가 null→silent skip 으로 변경되는 것은 의도된 동작이며 부작용 없음. `inflight` 캐시에 null 결과가 단시간 저장됐다가 `.finally()` 에서 삭제되는 패턴도 기존과 동일하다.
- **제안**: 이상 없음.

### [INFO] `ExecutionRoutingContext` 인터페이스가 새 public export 로 추가됨
- **위치**: `codebase/backend/src/modules/websocket/websocket.service.ts` L32–41
- **상세**: `ExecutionRoutingContext` 가 export 되어 `execution-event-emitter.service.ts` 가 import 해 사용한다. 공개 API 의 타입 인터페이스 추가로, 기존 import 측에 영향 없음. 인터페이스 필드가 모두 optional(`triggerId?`, `chatChannel?`)이어서 미래 필드 추가 시 backward compatible 하다.
- **제안**: 이상 없음.

### [INFO] `ExecutionEventEmitter` 에 `registerExecutionRouting` / `releaseExecutionRouting` 두 메서드 추가
- **위치**: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` L51–65
- **상세**: 두 메서드 모두 `WebsocketService` 로의 thin delegation이며, 새 상태를 `ExecutionEventEmitter` 자체에 보유하지 않는다. 기존 메서드(`emitExecution`, `emitNode`) 시그니처는 변경 없어 호출자 영향 없음. 추가 메서드이므로 기존 DI 소비자의 mock 타입 업데이트가 필요할 수 있으나, 본 PR 의 test 파일에서 이를 이미 반영(`registerExecutionRouting: jest.fn()`, `releaseExecutionRouting: jest.fn()`).
- **제안**: 이상 없음.

### [INFO] 테스트 코드에서 `logger.warn` spy 를 static 접근자로 추출
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.spec.ts` L882–900
- **상세**: `(McpToolProvider as unknown as { logger: { warn: jest.Mock } }).logger` 와 같이 private static 멤버를 타입 우회로 접근한다. 이는 구현 내부를 직접 참조하므로 리팩토링 시 취약하다. 단, `try/finally` 에서 `mockRestore()` 를 보장하여 다른 테스트로 누수되지 않도록 처리됐다.
- **제안**: 기능적 문제 없음. 향후 DI 주입 Logger 로 전환 시 spy 방식도 공식 메서드로 교체 권장.

---

## 요약

이번 변경은 두 개의 독립적인 회귀 수정으로 구성된다. Issue 1(`ChatChannelDispatcher` 응답 누락)은 `WebsocketService` 에 `executionRouting` Map 을 추가하여 fanout envelope 에만 라우팅 컨텍스트를 첨부하고 wire envelope(frontend socket.io)은 그대로 유지하는 설계를 채택했다. 이 Map 은 기존 `seqCounters` 와 동일한 lifecycle 정책(terminal event 후 자동 release, setup throw 시 catch 에서 명시 release)을 따르므로 메모리 누수 경로가 닫혀 있다. Issue 2(Cafe24 WARN 노이즈)는 `openServer` 의 throw 를 null sentinel 반환으로 교체하여 WARN 없이 silent skip 하도록 수정했으며, 기존 `Promise.allSettled` 패턴과 자연스럽게 결합된다. 전역 변수 신규 도입 없음, 환경 변수 변경 없음, 파일시스템 부작용 없음, 의도하지 않은 네트워크 호출 없음. 유일하게 주목할 점은 fanout payload 가 routing context 미등록 시 wireEnvelope 동일 참조를 반환한다는 것인데, 현행 구독자가 payload 를 mutate 하지 않는다면 문제 없으나 방어적 설계 측면에서 인지가 필요하다.

---

## 위험도

LOW
